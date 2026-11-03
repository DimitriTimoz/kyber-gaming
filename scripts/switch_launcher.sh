#!/usr/bin/env bash
set -e

TARGET="${1:-menu}"
export DISPLAY="${DISPLAY:-:0}"
export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[switch_launcher] Request: $TARGET on DISPLAY $DISPLAY"

case "$TARGET" in
    steam)
        if pgrep -u gamer -f "ubuntu12_32/steam" >/dev/null 2>&1; then
            echo "[switch_launcher] Steam is already running. Focusing window..."
            wmctrl -x -a steam 2>/dev/null || xdotool search --onlyvisible --class steam windowactivate 2>/dev/null || true
            steam steam://open/library 2>/dev/null || true
        else
            echo "[switch_launcher] Starting Steam..."
            rm -f "$HOME/.steam/debian-installation/config/htmlcache/Singleton"* 2>/dev/null || true
            nohup steam -no-cef-sandbox >/dev/null 2>&1 &
        fi
        ;;

    steam-bigpicture)
        if pgrep -u gamer -f "ubuntu12_32/steam" >/dev/null 2>&1; then
            echo "[switch_launcher] Steam is already running. Opening Big Picture..."
            steam steam://open/bigpicture 2>/dev/null || true
            wmctrl -x -a steam 2>/dev/null || true
        else
            echo "[switch_launcher] Starting Steam Big Picture..."
            rm -f "$HOME/.steam/debian-installation/config/htmlcache/Singleton"* 2>/dev/null || true
            nohup steam -bigpicture -no-cef-sandbox >/dev/null 2>&1 &
        fi
        ;;

    heroic)
        if pgrep -u gamer -f "heroic" >/dev/null 2>&1; then
            echo "[switch_launcher] Heroic is already running. Focusing window..."
            wmctrl -x -a heroic 2>/dev/null || xdotool search --onlyvisible --class heroic windowactivate 2>/dev/null || true
        else
            echo "[switch_launcher] Starting Heroic Games Launcher..."
            HEROIC_BIN="/opt/Heroic/heroic"
            [ -x "$HEROIC_BIN" ] || HEROIC_BIN="$(command -v heroic || echo /usr/bin/heroic)"
            nohup "$HEROIC_BIN" --no-sandbox >/dev/null 2>&1 &
        fi
        ;;

    restart-steam)
        echo "[switch_launcher] Restarting Steam cleanly..."
        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
        sleep 2
        rm -f "$HOME/.steam/debian-installation/config/htmlcache/Singleton"* 2>/dev/null || true
        nohup steam -no-cef-sandbox >/dev/null 2>&1 &
        ;;

    menu)
        echo "[switch_launcher] Opening Kyber Launcher Menu..."
        if pgrep -u gamer -f "kyber_launcher_menu.py" >/dev/null 2>&1; then
            wmctrl -a "Kyber Cloud Gaming" 2>/dev/null || true
        else
            nohup python3 /usr/local/bin/kyber_launcher_menu.py >/dev/null 2>&1 &
        fi
        ;;

    desktop)
        echo "[switch_launcher] Minimizing all windows to show desktop..."
        wmctrl -k on 2>/dev/null || xdotool key Super+d 2>/dev/null || true
        ;;

    *)
        echo "[switch_launcher] Unknown target '$TARGET'. Defaulting to menu..."
        nohup python3 /usr/local/bin/kyber_launcher_menu.py >/dev/null 2>&1 &
        ;;
esac

exit 0
