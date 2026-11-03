#!/usr/bin/env bash
set -e

export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"
LAUNCHER_MODE="${LAUNCHER:-steam}"

echo "[launcher] Selected launcher: $LAUNCHER_MODE"
echo "[launcher] Current PATH: $PATH"

# Wait for X server and Window Manager to be ready
while ! xdpyinfo >/dev/null 2>&1; do
    echo "[launcher] Waiting for X server on $DISPLAY..."
    sleep 1
done

case "$LAUNCHER_MODE" in
    steam)
        echo "[launcher] Starting Steam..."
        STEAM_EXEC=""
        if command -v steam >/dev/null 2>&1; then
            STEAM_EXEC="steam"
        elif [ -x /usr/games/steam ]; then
            STEAM_EXEC="/usr/games/steam"
        elif [ -x /usr/local/bin/steam ]; then
            STEAM_EXEC="/usr/local/bin/steam"
        elif [ -x /usr/bin/steam ]; then
            STEAM_EXEC="/usr/bin/steam"
        fi

        if [ -z "$STEAM_EXEC" ]; then
            echo "[launcher] ERROR: Steam executable not found in PATH or /usr/games/steam!"
            echo "[launcher] Searching for steam binary:"
            find /usr -name "steam" 2>/dev/null || true
            sleep infinity
        fi

        # Pre-bootstrap Steam if not yet initialized, avoiding Zenity GUI prompts
        STEAMDIR="$HOME/.steam/debian-installation"
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

        # Clean up any stale Chromium singleton lock files
        rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true

        # Set desktop background canvas
        xsetroot -solid "#1a1b26" 2>/dev/null || true

        echo "[launcher] Executing: $STEAM_EXEC -no-cef-sandbox"
        "$STEAM_EXEC" -no-cef-sandbox &
        sleep 2
        while pgrep -u gamer -f steam >/dev/null; do
            sleep 2
        done
        ;;
    steam-bigpicture)
        echo "[launcher] Starting Steam Big Picture..."
        STEAM_EXEC="steam"
        command -v steam >/dev/null 2>&1 || STEAM_EXEC="/usr/games/steam"
        rm -f "$HOME/.steam/debian-installation/config/htmlcache/Singleton"* 2>/dev/null || true
        xsetroot -solid "#1a1b26" 2>/dev/null || true
        echo "[launcher] Executing: $STEAM_EXEC -bigpicture -no-cef-sandbox"
        "$STEAM_EXEC" -bigpicture -no-cef-sandbox &
        sleep 2
        while pgrep -u gamer -f steam >/dev/null; do
            sleep 2
        done
        ;;
    heroic)
        echo "[launcher] Starting Heroic Games Launcher..."
        HEROIC_EXEC=""
        if command -v heroic >/dev/null 2>&1; then
            HEROIC_EXEC="heroic"
        elif [ -x /opt/Heroic/heroic ]; then
            HEROIC_EXEC="/opt/Heroic/heroic"
        elif [ -x /usr/bin/heroic ]; then
            HEROIC_EXEC="/usr/bin/heroic"
        fi

        if [ -z "$HEROIC_EXEC" ]; then
            echo "[launcher] ERROR: Heroic executable not found!"
            sleep infinity
        fi

        echo "[launcher] Executing: $HEROIC_EXEC --no-sandbox"
        exec "$HEROIC_EXEC" --no-sandbox
        ;;
    desktop)
        echo "[launcher] Desktop mode active. Waiting for user interaction..."
        exec sleep infinity
        ;;
    *)
        echo "[launcher] Unknown launcher '$LAUNCHER_MODE'. Defaulting to desktop mode..."
        exec sleep infinity
        ;;
esac
