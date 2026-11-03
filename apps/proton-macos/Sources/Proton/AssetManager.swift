import SwiftUI
import AppKit

enum AssetManager {
    static func image(named name: String) -> NSImage? {
        // Try Bundle.module
        if let url = Bundle.module.url(forResource: name, withExtension: "jpg") ??
                     Bundle.module.url(forResource: name, withExtension: "png") {
            if let image = NSImage(contentsOf: url) {
                return image
            }
        }
        
        // Try Bundle.main
        if let path = Bundle.main.path(forResource: name, ofType: "jpg") ??
                      Bundle.main.path(forResource: name, ofType: "png") {
            if let image = NSImage(contentsOfFile: path) {
                return image
            }
        }
        
        return nil
    }
}
