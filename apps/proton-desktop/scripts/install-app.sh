#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Proton Clinic"
DIST_DIR="$DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APPLICATIONS_DIR="/Applications"

echo "==> Building $APP_NAME.app..."
mkdir -p "$DIST_DIR"
rm -rf "$APP_BUNDLE"

# 1. Clone local Electron runtime template
cp -R "$DIR/node_modules/electron/dist/Electron.app" "$APP_BUNDLE"

# 2. Rename executable
mv "$APP_BUNDLE/Contents/MacOS/Electron" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# 3. Strip default electron app
rm -f "$APP_BUNDLE/Contents/Resources/default_app.asar"

# 4. Copy Proton desktop source
mkdir -p "$APP_BUNDLE/Contents/Resources/app"
cp -R "$DIR/src" "$APP_BUNDLE/Contents/Resources/app/"
cp -R "$DIR/assets" "$APP_BUNDLE/Contents/Resources/app/"
cp "$DIR/package.json" "$APP_BUNDLE/Contents/Resources/app/"

# 5. Apply Caduceus App Icon
cp "$DIR/assets/icon.icns" "$APP_BUNDLE/Contents/Resources/electron.icns"

# 6. Update Info.plist
plutil -replace CFBundleDisplayName -string "$APP_NAME" "$APP_BUNDLE/Contents/Info.plist"
plutil -replace CFBundleName -string "$APP_NAME" "$APP_BUNDLE/Contents/Info.plist"
plutil -replace CFBundleExecutable -string "$APP_NAME" "$APP_BUNDLE/Contents/Info.plist"
plutil -replace CFBundleIdentifier -string "com.proton.clinic" "$APP_BUNDLE/Contents/Info.plist"

# 7. Install to /Applications
echo "==> Installing to $APPLICATIONS_DIR/$APP_NAME.app..."
rm -rf "$APPLICATIONS_DIR/$APP_NAME.app"
cp -R "$APP_BUNDLE" "$APPLICATIONS_DIR/"
xattr -cr "$APPLICATIONS_DIR/$APP_NAME.app" 2>/dev/null || true
touch "$APPLICATIONS_DIR/$APP_NAME.app"

# 8. Register with macOS LaunchServices
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APPLICATIONS_DIR/$APP_NAME.app" 2>/dev/null || true

echo "✓ Successfully installed $APP_NAME into $APPLICATIONS_DIR!"
