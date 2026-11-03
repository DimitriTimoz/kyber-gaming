#!/usr/bin/env bash
set -e

export DISPLAY="${DISPLAY_NUM:-:0}"
LAUNCHER_MODE="${LAUNCHER:-steam}"

echo "[launcher] Selected launcher: $LAUNCHER_MODE"

# Wait for X server and Window Manager to be ready
while ! xdpyinfo >/dev/null 2>&1; do
    echo "[launcher] Waiting for X server on $DISPLAY..."
    sleep 1
done

case "$LAUNCHER_MODE" in
    steam)
        echo "[launcher] Starting Steam Big Picture..."
        # Steam flags for container and headless setup
        exec steam -bigpicture -no-cef-sandbox
        ;;
    heroic)
        echo "[launcher] Starting Heroic Games Launcher..."
        exec heroic --no-sandbox
        ;;
    desktop)
        echo "[launcher] Desktop mode active. Waiting for user interaction..."
        exec sleep infinity
        ;;
    *)
        echo "[launcher] Unknown launcher '$LAUNCHER_MODE'. Defaulting to Steam..."
        exec steam -bigpicture -no-cef-sandbox
        ;;
esac
