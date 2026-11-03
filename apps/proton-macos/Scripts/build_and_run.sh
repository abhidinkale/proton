#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Proton"
APP_BUNDLE="${ROOT_DIR}/${APP_NAME}.app"
CONTENTS="${APP_BUNDLE}/Contents"
MACOS_DIR="${CONTENTS}/MacOS"
RESOURCES_DIR="${CONTENTS}/Resources"

echo "==> Building ${APP_NAME} macOS Native Application..."

# Kill any existing instance
pkill -x "${APP_NAME}" 2>/dev/null || true

# Prepare bundle folders
rm -rf "${APP_BUNDLE}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}"

# 1. Compile Swift executable
echo "==> Compiling Swift binary..."
swiftc \
  -O \
  -parse-as-library \
  -framework AppKit \
  -framework WebKit \
  -target arm64-apple-macos14.0 \
  "${ROOT_DIR}/Sources/Proton/main.swift" \
  -o "${MACOS_DIR}/${APP_NAME}"

chmod +x "${MACOS_DIR}/${APP_NAME}"

# 2. Copy Web & Image Resources
echo "==> Copying resources..."
cp -R "${ROOT_DIR}/Sources/Proton/Resources/." "${RESOURCES_DIR}/"

# 3. Write Info.plist
cat > "${CONTENTS}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key><string>Proton Doctor</string>
    <key>CFBundleIdentifier</key><string>me.proton.clinical</string>
    <key>CFBundleExecutable</key><string>${APP_NAME}</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSHumanReadableCopyright</key><string>Copyright © 2026 Proton Clinical AI</string>
    <key>NSMicrophoneUsageDescription</key><string>Proton uses your microphone for real-time ambient clinical consultation transcription.</string>
</dict>
</plist>
PLIST

# 4. Sign ad-hoc
echo "==> Codesigning bundle..."
codesign --force --deep --sign - "${APP_BUNDLE}"

echo "==> Launching ${APP_BUNDLE}..."
open "${APP_BUNDLE}"

echo "==> Successfully launched Proton Doctor Mac App!"
