import SwiftUI

struct ContentView: View {
    @State private var isAuthenticated: Bool = false
    @State private var doctorEmail: String = "dr.sarah.mitchell@protoncare.ai"
    
    var body: some View {
        ZStack {
            WindowAccessor()
                .frame(width: 0, height: 0)
            
            if isAuthenticated {
                DoctorDashboardView(
                    doctorEmail: doctorEmail,
                    onSignOut: {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                            isAuthenticated = false
                        }
                    }
                )
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.98)),
                    removal: .opacity.combined(with: .scale(scale: 1.02))
                ))
            } else {
                LoginView(
                    isAuthenticated: $isAuthenticated,
                    doctorEmail: $doctorEmail
                )
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 1.02)),
                    removal: .opacity.combined(with: .scale(scale: 0.98))
                ))
            }
        }
        .frame(minWidth: 1020, minHeight: 680)
        .preferredColorScheme(.dark)
    }
}
