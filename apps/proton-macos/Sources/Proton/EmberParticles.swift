import SwiftUI

struct EmberParticle: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var opacity: Double
    var speed: Double
}

struct EmberParticlesView: View {
    @State private var particles: [EmberParticle] = (0..<18).map { _ in
        EmberParticle(
            x: CGFloat.random(in: 0...1),
            y: CGFloat.random(in: 0...1),
            size: CGFloat.random(in: 1.5...3.5),
            opacity: Double.random(in: 0.2...0.7),
            speed: Double.random(in: 4...9)
        )
    }
    @State private var phase: CGFloat = 0

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let time = timeline.date.timeIntervalSinceReferenceDate
                for particle in particles {
                    let yOffset = CGFloat(sin(time / particle.speed + Double(particle.x * 10))) * 15
                    let xOffset = CGFloat(cos(time / (particle.speed * 1.5) + Double(particle.y * 10))) * 12
                    
                    let px = (particle.x * size.width + xOffset).truncatingRemainder(dividingBy: size.width)
                    let py = (particle.y * size.height + yOffset).truncatingRemainder(dividingBy: size.height)
                    
                    let rect = CGRect(
                        x: px >= 0 ? px : px + size.width,
                        y: py >= 0 ? py : py + size.height,
                        width: particle.size,
                        height: particle.size
                    )
                    
                    let glow = Double.random(in: 0.7...1.0)
                    context.fill(
                        Circle().path(in: rect),
                        with: .color(
                            Color(red: 1.0, green: 0.75, blue: 0.45).opacity(particle.opacity * glow)
                        )
                    )
                }
            }
        }
        .allowsHitTesting(false)
    }
}
