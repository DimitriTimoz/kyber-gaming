#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="/Applications/Kyber Gaming.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"

echo "[build] Compiling native Swift Launcher binary..."
mkdir -p "$SCRIPT_DIR/build"
swiftc -O "$SCRIPT_DIR/src/main.swift" -o "$SCRIPT_DIR/build/kyber-launcher"

echo "[build] Creating macOS Application bundle at $APP_DIR..."
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR/ui"

# Copy binary
cp "$SCRIPT_DIR/build/kyber-launcher" "$MACOS_DIR/Kyber Gaming"
chmod +x "$MACOS_DIR/Kyber Gaming"

# Copy UI resources
cp -r "$SCRIPT_DIR/ui/"* "$RESOURCES_DIR/ui/"

# Copy App Icon if available from Kyber-Client
if [ -f "/Applications/Kyber-Client.app/Contents/Resources/kyber.icns" ]; then
    cp "/Applications/Kyber-Client.app/Contents/Resources/kyber.icns" "$RESOURCES_DIR/kyber.icns"
fi

# Write Info.plist
cat << 'EOF' > "$CONTENTS/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Kyber Gaming</string>
    <key>CFBundleIdentifier</key>
    <string>com.kyber.gaming.launcher</string>
    <key>CFBundleName</key>
    <string>Kyber Gaming</string>
    <key>CFBundleIconFile</key>
    <string>kyber.icns</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "[build] Successfully installed Kyber Gaming.app into /Applications!"
echo "[build] Users can now launch 'Kyber Gaming' from Finder, Launchpad, or Spotlight!"
