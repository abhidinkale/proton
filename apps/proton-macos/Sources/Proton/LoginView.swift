import SwiftUI

enum AuthMode {
    case signup
    case login
}

struct LoginView: View {
    @Binding var isAuthenticated: Bool
    @Binding var doctorEmail: String
    
    @State private var authMode: AuthMode = .signup
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var agreeToTerms: Bool = true
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    
    var body: some View {
        ZStack {
            // 1. Ambient Sunset Landscape Background
            backgroundScene
            
            // 2. Floating Ember Particles
            EmberParticlesView()
            
            // 3. Centered Glassmorphic Modal Card
            HStack(spacing: 0) {
                // Left Column: Authentication Form
                formColumn
                    .frame(width: 440)
                    .background(
                        Color(red: 0.10, green: 0.09, blue: 0.09).opacity(0.94)
                    )
                
                // Right Column: Botanical Anatomical Artwork
                heroArtworkColumn
                    .frame(width: 440)
            }
            .frame(width: 880, height: 560)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(ProtonTheme.cardBorderGradient, lineWidth: 1.2)
            )
            .shadow(color: Color.black.opacity(0.70), radius: 45, x: 0, y: 22)
            .shadow(color: Color(red: 0.98, green: 0.45, blue: 0.20).opacity(0.12), radius: 60, x: 0, y: 10)
        }
        .frame(minWidth: 1020, minHeight: 680)
    }
    
    // MARK: - Background Scene
    private var backgroundScene: some View {
        ZStack {
            // Rich fallback sunset gradient
            LinearGradient(
                colors: [
                    Color(red: 0.18, green: 0.08, blue: 0.08),
                    Color(red: 0.35, green: 0.12, blue: 0.06),
                    Color(red: 0.65, green: 0.25, blue: 0.08),
                    Color(red: 0.12, green: 0.05, blue: 0.02)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            // Full scene photo backdrop if available
            if let bgImg = AssetManager.image(named: "ambient_sunset") ?? AssetManager.image(named: "full_scene") {
                Image(nsImage: bgImg)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .overlay(Color.black.opacity(0.15))
                    .blur(radius: 2)
                    .scaleEffect(1.04)
                    .ignoresSafeArea()
            }
        }
    }
    
    // MARK: - Left Form Column
    private var formColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brand Logo Header
            HStack {
                ProtonLogoView(size: 26, showText: true)
                Spacer()
                
                // Quick Demo Pill for easy review
                Button {
                    quickFillDoctor()
                } label: {
                    Text("Demo Doctor")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(ProtonTheme.orangeAccent)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(ProtonTheme.orangeAccent.opacity(0.14))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 28)
            
            // Title & Subtitle
            VStack(alignment: .leading, spacing: 7) {
                Text(authMode == .signup ? "Sign up" : "Log in")
                    .font(.system(size: 32, weight: .bold, design: .default))
                    .foregroundColor(ProtonTheme.textPrimary)
                    .animation(.easeInOut(duration: 0.2), value: authMode)
                
                Text(authMode == .signup
                     ? "Your personal health companion.\nTrack, understand and improve your health."
                     : "Welcome back, Doctor.\nEnter your clinical credentials to access copilot.")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(ProtonTheme.textSecondary)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(.easeInOut(duration: 0.2), value: authMode)
            }
            .padding(.bottom, 22)
            
            // Input Fields
            VStack(spacing: 12) {
                GlassTextField(
                    icon: "envelope",
                    placeholder: "Enter Email",
                    text: $email
                )
                
                GlassTextField(
                    icon: "lock",
                    placeholder: authMode == .signup ? "Create Password" : "Enter Password",
                    text: $password,
                    isSecure: true
                )
            }
            .padding(.bottom, 14)
            
            // Error Message (if any)
            if let error = errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 11))
                    Text(error)
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundColor(Color(red: 1.0, green: 0.4, blue: 0.4))
                .padding(.bottom, 10)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            
            // Checkbox / Options Row
            HStack(spacing: 10) {
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        agreeToTerms.toggle()
                    }
                } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(agreeToTerms ? ProtonTheme.orangeAccent : Color.white.opacity(0.3), lineWidth: 1.2)
                            .background(
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(agreeToTerms ? ProtonTheme.orangeAccent.opacity(0.2) : Color.white.opacity(0.05))
                            )
                            .frame(width: 16, height: 16)
                        
                        if agreeToTerms {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(ProtonTheme.orangeAccent)
                        }
                    }
                }
                .buttonStyle(.plain)
                
                Text("I agree to the Terms & Privacy Policy")
                    .font(.system(size: 12))
                    .foregroundColor(ProtonTheme.textSecondary)
                
                Spacer()
            }
            .padding(.bottom, 18)
            
            // Primary Action Button: "Create Account ->" / "Sign In ->"
            ProtonButton(
                title: authMode == .signup ? "Create Account" : "Sign In",
                icon: "arrow.right",
                isLoading: isLoading
            ) {
                handleAuthSubmission()
            }
            .padding(.bottom, 18)
            
            // Divider "or sign up with"
            HStack(spacing: 12) {
                Rectangle()
                    .fill(Color.white.opacity(0.10))
                    .frame(height: 1)
                
                Text(authMode == .signup ? "or sign up with" : "or sign in with")
                    .font(.system(size: 12))
                    .foregroundColor(ProtonTheme.textTertiary)
                    .fixedSize()
                
                Rectangle()
                    .fill(Color.white.opacity(0.10))
                    .frame(height: 1)
            }
            .padding(.bottom, 16)
            
            // Social Auth Buttons (Google, Apple, Phone)
            HStack(spacing: 14) {
                SocialLoginButton(provider: .google) {
                    quickFillDoctor()
                    handleAuthSubmission()
                }
                SocialLoginButton(provider: .apple) {
                    quickFillDoctor()
                    handleAuthSubmission()
                }
                SocialLoginButton(provider: .phone) {
                    quickFillDoctor()
                    handleAuthSubmission()
                }
            }
            .padding(.bottom, 22)
            
            // Switch Mode Link
            HStack(spacing: 4) {
                Spacer()
                Text(authMode == .signup ? "Already have an account?" : "Don't have an account?")
                    .font(.system(size: 12.5))
                    .foregroundColor(ProtonTheme.textSecondary)
                
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        errorMessage = nil
                        authMode = (authMode == .signup ? .login : .signup)
                    }
                } label: {
                    Text(authMode == .signup ? "Log in" : "Sign up")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(ProtonTheme.orangeAccent)
                }
                .buttonStyle(.plain)
                Spacer()
            }
        }
        .padding(.horizontal, 36)
        .padding(.vertical, 32)
    }
    
    // MARK: - Right Hero Column
    private var heroArtworkColumn: some View {
        ZStack {
            // Full bleed artwork
            if let hero = AssetManager.image(named: "hero_anatomy") {
                Image(nsImage: hero)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 440, height: 560)
                    .clipped()
            } else if let full = AssetManager.image(named: "full_scene") {
                Image(nsImage: full)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 440, height: 560)
                    .clipped()
            } else {
                // Fallback anatomical art rendering
                ZStack {
                    LinearGradient(
                        colors: [
                            Color(red: 0.25, green: 0.10, blue: 0.05),
                            Color(red: 0.85, green: 0.35, blue: 0.10)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    
                    VStack(spacing: 12) {
                        Image(systemName: "figure.walk")
                            .font(.system(size: 80))
                            .foregroundColor(.white.opacity(0.8))
                        Text("Anatomical AI Copilot")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white.opacity(0.9))
                    }
                }
            }
            
            // Smooth left edge gradient to blend seamlessly into the dark card form
            LinearGradient(
                colors: [
                    Color(red: 0.10, green: 0.09, blue: 0.09).opacity(0.95),
                    Color(red: 0.10, green: 0.09, blue: 0.09).opacity(0.4),
                    Color.clear
                ],
                startPoint: .leading,
                endPoint: .init(x: 0.22, y: 0.5)
            )
            .allowsHitTesting(false)
            
            // Subtle floating embers inside the hero side
            EmberParticlesView()
        }
    }
    
    // MARK: - Actions
    private func quickFillDoctor() {
        email = "dr.sarah.mitchell@protoncare.ai"
        password = "••••••••••••"
        agreeToTerms = true
        errorMessage = nil
    }
    
    private func handleAuthSubmission() {
        errorMessage = nil
        
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedEmail.isEmpty {
            errorMessage = "Please enter your doctor email."
            return
        }
        
        if authMode == .signup && !agreeToTerms {
            errorMessage = "Please accept the Terms & Privacy Policy."
            return
        }
        
        isLoading = true
        
        // Simulate clinical authentication verification
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            isLoading = false
            doctorEmail = trimmedEmail
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                isAuthenticated = true
            }
        }
    }
}
