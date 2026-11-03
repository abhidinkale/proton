import SwiftUI
import AppKit

struct WindowAccessor: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            if let window = view.window {
                window.titleVisibility = .hidden
                window.titlebarAppearsTransparent = true
                window.styleMask.insert(.fullSizeContentView)
                window.isMovableByWindowBackground = true
                window.backgroundColor = NSColor(red: 0.1, green: 0.08, blue: 0.08, alpha: 1.0)
            }
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}
