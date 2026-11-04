#!/usr/bin/env bash
set -e

PLATFORM="${1:-linux}"
TARGET_DIR="desktop-client/src-tauri/binaries"
mkdir -p "$TARGET_DIR"

echo "[sidecar] Preparing kyclient sidecar binary for target: $PLATFORM"

BIN_NAME="kyclient"
if [ "$PLATFORM" = "windows" ]; then
    BIN_NAME="kyclient.exe"
fi

DEST_FILE="$TARGET_DIR/$BIN_NAME"

# 1. If an existing binary is provided in environment or path, copy it
if [ -n "$KYCLIENT_SOURCE" ] && [ -f "$KYCLIENT_SOURCE" ]; then
    echo "[sidecar] Copying from KYCLIENT_SOURCE: $KYCLIENT_SOURCE"
    cp "$KYCLIENT_SOURCE" "$DEST_FILE"
    chmod +x "$DEST_FILE" 2>/dev/null || true
    exit 0
fi

# 2. Check if host has kyclient installed
if command -v "$BIN_NAME" >/dev/null 2>&1; then
    HOST_BIN="$(command -v "$BIN_NAME")"
    echo "[sidecar] Found host $BIN_NAME at $HOST_BIN, copying to bundle..."
    cp "$HOST_BIN" "$DEST_FILE"
    chmod +x "$DEST_FILE" 2>/dev/null || true
    exit 0
fi

# 3. Check for pre-existing binary in directory
if [ -f "$DEST_FILE" ] && [ -s "$DEST_FILE" ]; then
    echo "[sidecar] Binary $DEST_FILE already present."
    chmod +x "$DEST_FILE" 2>/dev/null || true
    exit 0
fi

# 4. Optional download from upstream GitLab releases if available
echo "[sidecar] Attempting download from upstream Kyber release repository..."
UPSTREAM_URL=""
case "$PLATFORM" in
    macos)
        UPSTREAM_URL="https://gitlab.com/api/v4/projects/kyber.stream%2Fapps%2Fkyber-desktop/jobs/artifacts/main/raw/build/kyclient-macos?job=build-macos"
        ;;
    linux)
        UPSTREAM_URL="https://gitlab.com/api/v4/projects/kyber.stream%2Fapps%2Fkyber-desktop/jobs/artifacts/main/raw/build/kyclient-linux?job=build-linux"
        ;;
    windows)
        UPSTREAM_URL="https://gitlab.com/api/v4/projects/kyber.stream%2Fapps%2Fkyber-desktop/jobs/artifacts/main/raw/build/kyclient-windows.exe?job=build-windows"
        ;;
esac

if [ -n "$UPSTREAM_URL" ]; then
    if curl -sSL -f --connect-timeout 5 -o "$DEST_FILE" "$UPSTREAM_URL" 2>/dev/null; then
        echo "[sidecar] Successfully downloaded upstream kyclient binary."
        chmod +x "$DEST_FILE" 2>/dev/null || true
        exit 0
    else
        echo "[sidecar] Upstream release download skipped or unavailable."
    fi
fi

# 5. Fallback placeholder script for test builds
echo "[sidecar] Creating launcher fallback runner for $PLATFORM..."
if [ "$PLATFORM" = "windows" ]; then
    # Simple batch / binary stub for Windows test environments
    touch "$DEST_FILE"
else
    cat << 'EOF' > "$DEST_FILE"
#!/usr/bin/env bash
# Kyber Client Launcher Proxy
# If native kyclient is installed on system, delegates to it
if command -v kyclient >/dev/null 2>&1; then
    exec kyclient "$@"
else
    echo "[kyclient] Error: kyclient binary is required for streaming."
    echo "[kyclient] Install kyclient or connect via the Web Client at https://<host>:8080/webclient"
    exit 1
fi
EOF
    chmod +x "$DEST_FILE"
fi

echo "[sidecar] Sidecar preparation complete: $DEST_FILE"
