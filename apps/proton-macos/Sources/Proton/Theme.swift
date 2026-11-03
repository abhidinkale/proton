import SwiftUI

enum ProtonTheme {
    // Brand Colors
    static let creamButton = Color(red: 0.95, green: 0.92, blue: 0.88) // #F2EBE0
    static let creamButtonHover = Color(red: 1.0, green: 0.97, blue: 0.94)
    static let orangeAccent = Color(red: 0.98, green: 0.52, blue: 0.33) // #FA8454
    static let darkCardBg = Color(red: 0.09, green: 0.08, blue: 0.08)
    static let inputBg = Color.white.opacity(0.065)
    static let inputBorder = Color.white.opacity(0.09)
    static let inputBorderFocused = Color(red: 0.98, green: 0.52, blue: 0.33).opacity(0.6)
    
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.40)
    static let textMuted = Color.white.opacity(0.28)
    
    // Gradients
    static let cardBorderGradient = LinearGradient(
        colors: [
            Color.white.opacity(0.22),
            Color(red: 0.98, green: 0.52, blue: 0.33).opacity(0.35),
            Color.white.opacity(0.08),
            Color(red: 0.98, green: 0.40, blue: 0.20).opacity(0.25)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
