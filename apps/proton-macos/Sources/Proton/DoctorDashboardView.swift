import SwiftUI

struct DoctorDashboardView: View {
    let doctorEmail: String
    let onSignOut: () -> Void
    
    @State private var isMicActive = false
    @State private var selectedTab = "Queue"
    
    var body: some View {
        ZStack {
            // Ambient dark medical glass background
            Color(red: 0.05, green: 0.05, blue: 0.07).ignoresSafeArea()
            
            // Subtle ambient sunset gradient bleeding in from top right
            RadialGradient(
                colors: [
                    Color(red: 0.98, green: 0.45, blue: 0.25).opacity(0.12),
                    Color.clear
                ],
                center: .topTrailing,
                startRadius: 50,
                endRadius: 550
            )
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top Doctor Bar
                HStack(spacing: 16) {
                    ProtonLogoView(size: 24, showText: true)
                    
                    Text("•")
                        .foregroundColor(ProtonTheme.textTertiary)
                    
                    Text("Doctor Clinical Console")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(ProtonTheme.textSecondary)
                    
                    Spacer()
                    
                    // Clinical status badge
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 7, height: 7)
                        Text("FHIR Copilot Live")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color.green.opacity(0.9))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.green.opacity(0.12))
                    .clipShape(Capsule())
                    
                    // Doctor Profile Pill
                    HStack(spacing: 10) {
                        ZStack {
                            Circle()
                                .fill(LinearGradient(colors: [ProtonTheme.orangeAccent, Color.orange], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(width: 30, height: 30)
                            Text("SM")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.white)
                        }
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Dr. Sarah Mitchell, MD")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white)
                            Text(doctorEmail.isEmpty ? "dr.mitchell@protoncare.ai" : doctorEmail)
                                .font(.system(size: 10))
                                .foregroundColor(ProtonTheme.textTertiary)
                        }
                    }
                    .padding(.leading, 8)
                    
                    // Sign Out Button
                    Button(action: onSignOut) {
                        HStack(spacing: 5) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 12))
                            Text("Sign Out")
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(ProtonTheme.textSecondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 16)
                .background(Color.black.opacity(0.35))
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(Color.white.opacity(0.06)),
                    alignment: .bottom
                )
                
                // Main Clinical Grid
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        // Ambient Consultation Banner
                        HStack {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 8) {
                                    Text("AMBIENT CLINICAL LISTENING")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(ProtonTheme.orangeAccent)
                                        .tracking(1)
                                    
                                    if isMicActive {
                                        Text("REC")
                                            .font(.system(size: 9, weight: .black))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.red)
                                            .clipShape(Capsule())
                                    }
                                }
                                
                                Text(isMicActive ? "Transcribing Consultation • Real-time SOAP note drafting" : "Ready for next patient consultation")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(.white)
                                
                                Text("Automated medical speech recognition, ICD-10 coding & FHIR Observation synthesis.")
                                    .font(.system(size: 12))
                                    .foregroundColor(ProtonTheme.textSecondary)
                            }
                            
                            Spacer()
                            
                            Button {
                                withAnimation(.spring(response: 0.3)) {
                                    isMicActive.toggle()
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: isMicActive ? "stop.fill" : "mic.fill")
                                        .font(.system(size: 13, weight: .semibold))
                                    Text(isMicActive ? "Stop Copilot" : "Start Ambient Encounter")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundColor(isMicActive ? .white : .black)
                                .padding(.horizontal, 18)
                                .padding(.vertical, 10)
                                .background(
                                    Capsule()
                                        .fill(isMicActive ? Color.red : ProtonTheme.creamButton)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(22)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color.white.opacity(0.04))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(isMicActive ? Color.red.opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1)
                                )
                        )
                        
                        // Today's Patient Queue
                        Text("Today's Patient Queue (8 Cases)")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                        
                        VStack(spacing: 10) {
                            patientRow(name: "Marcus Vance", age: "54M", reason: "Cardiac Auscultation Follow-up", time: "10:30 AM", status: "In Waiting Room", badgeColor: Color.orange)
                            patientRow(name: "Elena Rostova", age: "42F", reason: "Post-op Hypertension Review", time: "11:15 AM", status: "Prepared by Nurse", badgeColor: Color.blue)
                            patientRow(name: "David Chen", age: "29M", reason: "Asthma Exacerbation & Spirometry", time: "11:45 AM", status: "Scheduled", badgeColor: Color.gray)
                            patientRow(name: "Clara Morales", age: "68F", reason: "Type 2 Diabetes HbA1c Review", time: "01:30 PM", status: "Scheduled", badgeColor: Color.gray)
                        }
                    }
                    .padding(28)
                }
            }
        }
    }
    
    @ViewBuilder
    private func patientRow(name: String, age: String, reason: String, time: String, status: String, badgeColor: Color) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 36, height: 36)
                Text(String(name.prefix(1)))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                    Text("(\(age))")
                        .font(.system(size: 12))
                        .foregroundColor(ProtonTheme.textTertiary)
                }
                Text(reason)
                    .font(.system(size: 12))
                    .foregroundColor(ProtonTheme.textSecondary)
            }
            
            Spacer()
            
            Text(time)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(ProtonTheme.textSecondary)
            
            Text(status)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(badgeColor)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(badgeColor.opacity(0.12))
                .clipShape(Capsule())
            
            Button("Open Chart") {}
                .buttonStyle(.plain)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(ProtonTheme.orangeAccent)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(ProtonTheme.orangeAccent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }
}
