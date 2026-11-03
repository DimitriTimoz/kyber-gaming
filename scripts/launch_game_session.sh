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
        echo "[launcher] Starting Steam Big Picture..."
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

        echo "[launcher] Executing: $STEAM_EXEC -bigpicture -no-cef-sandbox"
        exec "$STEAM_EXEC" -bigpicture -no-cef-sandbox
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
