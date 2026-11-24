import AppKit
import CoreGraphics
import Foundation

let allowFrontmost = CommandLine.arguments.count == 4 && CommandLine.arguments[3] == "--allow-frontmost"
guard (CommandLine.arguments.count == 3 || allowFrontmost),
      let expectedPID = pid_t(CommandLine.arguments[2]) else {
    fputs("usage: window-id <app-bundle-path> <pid> [--allow-frontmost]\n", stderr)
    exit(2)
}

let bundlePrefix = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL.path
let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.microsoft.VSCode")
    .filter { app in
        guard app.processIdentifier == expectedPID else { return false }
        guard let path = app.bundleURL?.standardizedFileURL.path else { return false }
        return path == bundlePrefix || path.hasPrefix(bundlePrefix + "/")
    }

guard let app = running.first else {
    fputs("launched VS Code process is not running from the app copy\n", stderr)
    exit(3)
}

guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
    fputs("unable to list desktop windows\n", stderr)
    exit(4)
}

let candidates = windows.filter { item in
    (item[kCGWindowOwnerPID as String] as? Int) == Int(app.processIdentifier)
        && (item[kCGWindowLayer as String] as? Int) == 0
        && (item[kCGWindowIsOnscreen as String] as? Bool ?? false)
        && (item[kCGWindowNumber as String] as? Int) != nil
}

func area(_ item: [String: Any]) -> CGFloat {
    guard let bounds = item[kCGWindowBounds as String] as? NSDictionary,
          let rect = CGRect(dictionaryRepresentation: bounds) else { return 0 }
    return rect.width * rect.height
}

guard let window = candidates.max(by: { area($0) < area($1) }),
      let id = window[kCGWindowNumber as String] as? Int,
      let bounds = window[kCGWindowBounds as String] as? NSDictionary,
      let rect = CGRect(dictionaryRepresentation: bounds) else {
    fputs("no visible VS Code window found\n", stderr)
    exit(5)
}

guard let targetIndex = windows.firstIndex(where: { ($0[kCGWindowNumber as String] as? Int) == id }) else {
    fputs("unable to determine VS Code window order\n", stderr)
    exit(6)
}
let otherWindowIndex = windows.firstIndex { item in
    guard (item[kCGWindowOwnerPID as String] as? Int) != Int(app.processIdentifier),
          (item[kCGWindowLayer as String] as? Int) == 0,
          (item[kCGWindowIsOnscreen as String] as? Bool ?? false) else { return false }
    return area(item) > 0
}
if !allowFrontmost {
    guard let otherWindowIndex, targetIndex > otherWindowIndex else {
        fputs("VS Code window is not behind another on-screen app window\n", stderr)
        exit(7)
    }
}

print("\(id) \(Int(rect.width)) \(Int(rect.height)) \(targetIndex) \(otherWindowIndex ?? -1)")
