// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Proton",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "Proton", targets: ["Proton"])
    ],
    targets: [
        .executableTarget(
            name: "Proton",
            path: "Sources/Proton",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .unsafeFlags(["-swift-version", "5"])
            ]
        )
    ]
)
