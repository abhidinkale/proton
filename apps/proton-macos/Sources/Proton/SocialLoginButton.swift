import SwiftUI

enum SocialProvider {
    case google
    case apple
    case phone
}

struct SocialLoginButton: View {
    let provider: SocialProvider
    let action: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            ZStack {
                Capsule()
                    .fill(Color.white.opacity(isHovered ? 0.12 : 0.06))
                
                Capsule()
                    .stroke(Color.white.opacity(isHovered ? 0.22 : 0.08), lineWidth: 1)
                
                switch provider {
                case .google:
                    Text("G")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                case .apple:
                    Image(systemName: "applelogo")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                case .phone:
                    Image(systemName: "phone.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .frame(height: 40)
            .scaleEffect(isHovered ? 1.03 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                isHovered = hovering
            }
        }
    }
}
