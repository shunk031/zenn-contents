import AppKit
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
func reportFrontmostApplication() {
    guard let app = NSWorkspace.shared.frontmostApplication else {
        fputs("macOS did not report a frontmost application.\n", stderr)
        exit(EXIT_FAILURE)
    }
    print("\(app.processIdentifier)\t\(app.bundleIdentifier ?? "")\t\(app.localizedName ?? "")")
}

if arguments == ["--frontmost"] {
    reportFrontmostApplication()
    exit(0)
}

guard arguments.count >= 2 else {
    FileHandle.standardError.write(Data("usage: launch-app <app-path> <app-argument>...\n".utf8))
    exit(EXIT_FAILURE)
}

let applicationURL = URL(fileURLWithPath: arguments[0])
let open = Process()
open.executableURL = URL(fileURLWithPath: "/usr/bin/open")
open.arguments = ["-g", "-n", applicationURL.path, "--args"] + Array(arguments.dropFirst())
do {
    try open.run()
    open.waitUntilExit()
} catch {
    FileHandle.standardError.write(Data("Could not launch VS Code copy in the background: \(error)\n".utf8))
    exit(EXIT_FAILURE)
}
guard open.terminationStatus == 0 else {
    FileHandle.standardError.write(Data("open -g -n failed with status \(open.terminationStatus).\n".utf8))
    exit(EXIT_FAILURE)
}

let profileArgument = arguments.dropFirst().enumerated().first { $0.element == "--user-data-dir" }
guard let profileIndex = profileArgument?.offset, profileIndex + 2 < arguments.count else {
    FileHandle.standardError.write(Data("The isolated user-data path is required to identify the launched process.\n".utf8))
    exit(EXIT_FAILURE)
}
let profilePath = arguments[profileIndex + 2]
let executable = applicationURL.appendingPathComponent("Contents/MacOS/Electron").path
func matchingProcesses() -> [Int32] {
    let processList = Process()
    processList.executableURL = URL(fileURLWithPath: "/bin/ps")
    processList.arguments = ["-ww", "-axo", "pid=,command="]
    let output = Pipe()
    processList.standardOutput = output
    do {
        try processList.run()
    } catch {
        FileHandle.standardError.write(Data("Could not inspect the launched process: \(error)\n".utf8))
        exit(EXIT_FAILURE)
    }
    let listingData = output.fileHandleForReading.readDataToEndOfFile()
    processList.waitUntilExit()
    let listing = String(data: listingData, encoding: .utf8) ?? ""
    return listing.split(whereSeparator: \.isNewline).compactMap { line -> Int32? in
        let fields = line.split(maxSplits: 1, whereSeparator: \.isWhitespace)
        guard fields.count == 2,
              fields[1].hasPrefix(executable + " "),
              fields[1].contains("--user-data-dir \(profilePath)") else { return nil }
        return Int32(fields[0])
    }
}
let deadline = Date().addingTimeInterval(30)
while Date() < deadline {
    let matches = matchingProcesses()
    if matches.count == 1, let pid = matches.first {
        print(pid)
        exit(0)
    }
    if matches.count > 1 {
        FileHandle.standardError.write(Data("Expected one launched VS Code process for the isolated profile; found \(matches.count).\n".utf8))
        exit(EXIT_FAILURE)
    }
    Thread.sleep(forTimeInterval: 0.25)
}
FileHandle.standardError.write(Data("VS Code process did not appear for the isolated profile before the launch deadline.\n".utf8))
exit(EXIT_FAILURE)
