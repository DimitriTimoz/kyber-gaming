#!/usr/bin/env bash
# ==============================================================================
# Eglantine Nintendo Switch & Switch 2 (NX2) Emulator Installer
# Repository: https://github.com/Djihads80/Eglantine
# Mirror: https://git.panintegr.al/Backup/Eglantine
# ==============================================================================
set -e

EGLANTINE_VERSION="${EGLANTINE_VERSION:-build-206}"
INSTALL_DIR="/opt/eglantine"
BIN_DIR="/usr/local/bin"
TEMP_FILE="/tmp/eglantine.AppImage"

echo "[eglantine-install] Installing Eglantine ($EGLANTINE_VERSION)..."

# 1. Download AppImage bundle (contains self-contained Qt 6.8+ and all dependencies)
DOWNLOAD_URL="https://github.com/Djihads80/Eglantine/releases/download/${EGLANTINE_VERSION}/eglantine-linux-x86_64.AppImage"
echo "[eglantine-install] Downloading from $DOWNLOAD_URL..."

if command -v curl >/dev/null 2>&1; then
    curl -sSL -o "$TEMP_FILE" "$DOWNLOAD_URL"
elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$TEMP_FILE" "$DOWNLOAD_URL"
else
    echo "[eglantine-install] ERROR: Neither curl nor wget is available." >&2
    exit 1
fi

chmod +x "$TEMP_FILE"

# 2. Extract AppImage to /opt/eglantine for seamless headless container execution
echo "[eglantine-install] Extracting AppImage into $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
cd /opt
"$TEMP_FILE" --appimage-extract >/dev/null
mv squashfs-root eglantine
rm -f "$TEMP_FILE"
chmod -R 755 "$INSTALL_DIR"

# 3. Create execution wrapper in /usr/local/bin
cat << 'EOF' > "${BIN_DIR}/eglantine"
#!/usr/bin/env bash
exec /opt/eglantine/AppRun "$@"
EOF
chmod 755 "${BIN_DIR}/eglantine"

# Also symlink eden-cli if available
if [ -f "${INSTALL_DIR}/usr/bin/eden-cli" ]; then
    ln -sf "${INSTALL_DIR}/usr/bin/eden-cli" "${BIN_DIR}/eden-cli"
fi

# 4. Prepare required directories
mkdir -p /home/gamer/roms/switch
mkdir -p /home/gamer/bios
mkdir -p /home/gamer/.local/share/eglantine/keys
chown -R gamer:gamer /home/gamer/roms /home/gamer/bios /home/gamer/.local 2>/dev/null || true

echo "[eglantine-install] Eglantine successfully installed to $INSTALL_DIR and ${BIN_DIR}/eglantine."
