import AppKit
import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2 else {
    fputs("usage: window-id <app-bundle-path>\n", stderr)
    exit(2)
}

let bundlePrefix = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL.path
let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.microsoft.VSCode")
    .filter { app in
        guard let path = app.bundleURL?.standardizedFileURL.path else { return false }
        return path == bundlePrefix || path.hasPrefix(bundlePrefix + "/")
    }

guard let app = running.sorted(by: { ($0.launchDate ?? .distantPast) > ($1.launchDate ?? .distantPast) }).first else {
    fputs("VS Code app copy is not running\n", stderr)
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

print("\(id) \(Int(rect.width)) \(Int(rect.height))")
