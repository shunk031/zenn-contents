import AppKit
import Foundation

guard let app = NSWorkspace.shared.frontmostApplication else {
    fputs("macOS did not report a frontmost application.\n", stderr)
    exit(EXIT_FAILURE)
}
let bundleId = app.bundleIdentifier ?? ""
let name = app.localizedName ?? ""
print("\(app.processIdentifier)\t\(bundleId)\t\(name)")
