import SwiftUI

struct ProtonButton: View {
    let title: String
    var icon: String = "arrow.right"
    var isLoading: Bool = false
    let action: () -> Void
    
    @State private var isHovered = false
    @State private var isPressed = false
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color.black))
                        .scaleEffect(0.85)
                } else {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color.black)
                    
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.black)
                        .offset(x: isHovered ? 2 : 0)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(
                Capsule()
                    .fill(isHovered ? ProtonTheme.creamButtonHover : ProtonTheme.creamButton)
            )
            .shadow(
                color: isHovered ? Color.white.opacity(0.25) : Color.clear,
                radius: 12, x: 0, y: 0
            )
            .scaleEffect(isPressed ? 0.985 : (isHovered ? 1.008 : 1.0))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .onHover { hovering in
            withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                isHovered = hovering
            }
        }
    }
}
