#!/usr/bin/env bash
set -e

export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"
LAUNCHER_MODE="${LAUNCHER:-menu}"

echo "[launcher] Selected initial launcher: $LAUNCHER_MODE"
echo "[launcher] Current PATH: $PATH"

# Wait for X server and Window Manager to be ready
while ! xdpyinfo >/dev/null 2>&1; do
    echo "[launcher] Waiting for X server on $DISPLAY..."
    sleep 1
done

# Clean up any stale Chromium singleton lock files
STEAMDIR="$HOME/.steam/debian-installation"
rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true

# Set desktop background canvas
xsetroot -solid "#1a1b26" 2>/dev/null || true

# Pre-bootstrap Steam if not yet initialized, avoiding Zenity GUI prompts
if [ ! -f "$STEAMDIR/steam.sh" ]; then
    echo "[launcher] Steam bootstrap not detected. Initializing headless bootstrap..."
    mkdir -p "$STEAMDIR/deb-installer"
    version="1.0.0.79"
    url="https://repo.steampowered.com/steam/archive/beta/steam_${version}.tar.gz"
    if curl -sSL "$url" -o "$STEAMDIR/deb-installer/steam_${version}.tar.gz"; then
        tar -C "$STEAMDIR/deb-installer" -zxf "$STEAMDIR/deb-installer/steam_${version}.tar.gz" steam-launcher/bootstraplinux_ubuntu12_32.tar.xz 2>/dev/null || true
        if [ -f "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz" ]; then
            tar -C "$STEAMDIR" -xf "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz"
            echo "$version" > "$STEAMDIR/deb-installer/version"
            echo "[launcher] Steam bootstrap installed successfully."
        fi
    fi
fi

# Launch the initial requested launcher
/usr/local/bin/switch_launcher.sh "$LAUNCHER_MODE"

# Continuous supervisor loop:
# Whenever no game launcher (steam or heroic) is active, automatically show the Launcher Menu!
while true; do
    if ! pgrep -u gamer -f "ubuntu12_32/steam|heroic" >/dev/null 2>&1; then
        if ! pgrep -u gamer -f "kyber_launcher_menu.py" >/dev/null 2>&1; then
            echo "[launcher-supervisor] No active game launcher. Presenting Launcher Menu..."
            python3 /usr/local/bin/kyber_launcher_menu.py || true
        fi
    fi
    sleep 2
done
