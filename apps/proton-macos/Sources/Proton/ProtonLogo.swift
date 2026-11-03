import SwiftUI

struct ProtonLogoView: View {
    var size: CGFloat = 28
    var showText: Bool = true
    
    var body: some View {
        HStack(spacing: 11) {
            // Iconic Proton mark
            ZStack {
                Circle()
                    .fill(Color.white)
                    .frame(width: size, height: size)
                
                // Cutout / inner loop geometry
                Circle()
                    .fill(ProtonTheme.darkCardBg)
                    .frame(width: size * 0.42, height: size * 0.42)
                    .offset(x: size * 0.12, y: -size * 0.08)
                
                // Lower tail curve
                RoundedRectangle(cornerRadius: size * 0.16)
                    .fill(Color.white)
                    .frame(width: size * 0.34, height: size * 0.58)
                    .offset(x: -size * 0.22, y: size * 0.22)
            }
            .frame(width: size, height: size)
            
            if showText {
                Text("Proton")
                    .font(.system(size: size * 0.88, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .tracking(-0.3)
            }
        }
    }
}
