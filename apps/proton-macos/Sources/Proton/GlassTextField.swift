import SwiftUI

struct GlassTextField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    @State private var isRevealed: Bool = false
    @FocusState private var isFocused: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(isFocused ? ProtonTheme.orangeAccent : ProtonTheme.textTertiary)
                .frame(width: 20)
            
            if isSecure && !isRevealed {
                SecureField("", text: $text)
                    .focused($isFocused)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 13.5))
                    .overlay(alignment: .leading) {
                        if text.isEmpty {
                            Text(placeholder)
                                .foregroundColor(ProtonTheme.textTertiary)
                                .font(.system(size: 13.5))
                                .allowsHitTesting(false)
                        }
                    }
            } else {
                TextField("", text: $text)
                    .focused($isFocused)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 13.5))
                    .overlay(alignment: .leading) {
                        if text.isEmpty {
                            Text(placeholder)
                                .foregroundColor(ProtonTheme.textTertiary)
                                .font(.system(size: 13.5))
                                .allowsHitTesting(false)
                        }
                    }
            }
            
            if isSecure {
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isRevealed.toggle()
                    }
                } label: {
                    Image(systemName: isRevealed ? "eye" : "eye.slash")
                        .font(.system(size: 13.5))
                        .foregroundColor(ProtonTheme.textTertiary)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 46)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(ProtonTheme.inputBg)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .stroke(isFocused ? ProtonTheme.inputBorderFocused : ProtonTheme.inputBorder, lineWidth: 1)
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}
