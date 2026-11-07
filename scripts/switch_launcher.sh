#!/usr/bin/env bash
set -e

TARGET="${1:-menu}"
export DISPLAY="${DISPLAY:-:0}"
export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[switch_launcher] Request: $TARGET on DISPLAY $DISPLAY"

# Helper to terminate Chrome browser instances while preserving Console Hub kiosk
terminate_browser() {
    for pid in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
        if [ -r "/proc/$pid/cmdline" ]; then
            if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                kill -TERM "$pid" 2>/dev/null || true
            fi
        fi
    done
    sleep 0.2
    for pid in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
        if [ -r "/proc/$pid/cmdline" ]; then
            if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
    done
}

# Helper to cleanly and forcibly kill all game launchers and emulators
kill_all_launchers() {
    pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|eglantine|eden-cli|retroarch" 2>/dev/null || true
    terminate_browser
    sleep 0.3
    pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|eglantine|eden-cli|retroarch" 2>/dev/null || true
}

case "$TARGET" in
    close-active)
        # Triggered when clicking the Openbox [X] titlebar button or close keyboard shortcuts
        ACTIVE_WID=$(xdotool getactivewindow 2>/dev/null || true)
        if [ -z "$ACTIVE_WID" ] || [ "$ACTIVE_WID" = "0" ]; then
            ACTIVE_WID=$(xprop -root _NET_ACTIVE_WINDOW 2>/dev/null | awk '{print $NF}')
        fi

        # Verify ACTIVE_WID is a valid hexadecimal or decimal window ID
        if ! echo "$ACTIVE_WID" | grep -qE "^(0x[0-9a-fA-F]+|[0-9]+)$"; then
            ACTIVE_WID=""
        fi

        # If no active window exists to close, return directly to the Console Hub menu
        if [ -z "$ACTIVE_WID" ]; then
            echo "[switch_launcher] No active window found. Returning to Console Hub menu..."
            kill_all_launchers
            echo "menu" > /tmp/kyber_next_action
            chmod 666 /tmp/kyber_next_action 2>/dev/null || true
            exit 0
        fi

        WIN_CLASS=""
        WIN_NAME=""
        WIN_PID=""
        if [ -n "$ACTIVE_WID" ] && [ "$ACTIVE_WID" != "0x0" ] && [ "$ACTIVE_WID" != "0" ]; then
            WIN_CLASS=$(xprop -id "$ACTIVE_WID" WM_CLASS 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)
            WIN_NAME=$(xprop -id "$ACTIVE_WID" WM_NAME 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)
            WIN_PID=$(xprop -id "$ACTIVE_WID" _NET_WM_PID 2>/dev/null | awk -F'= ' '{print $2}' | tr -d '[:space:]' || true)
        fi

        echo "[switch_launcher] Close requested for window $ACTIVE_WID (class: '$WIN_CLASS', name: '$WIN_NAME')"

        # 1. Popups and secondary dialogs for Steam (Special Offers, News, Friends, Settings):
        # Close only the dialog window without terminating the main Steam session
        if echo "$WIN_CLASS" | grep -qi "steam" && echo "$WIN_NAME" | grep -qiE "special offers|news|friends list|settings"; then
            if [ -n "$ACTIVE_WID" ] && [ "$ACTIVE_WID" != "0x0" ]; then
                wmctrl -ic "$ACTIVE_WID" 2>/dev/null || true
                sleep 0.1
                if xwininfo -id "$ACTIVE_WID" 2>/dev/null | grep -q "IsViewable"; then
                    xdotool windowkill "$ACTIVE_WID" 2>/dev/null || true
                fi
            fi
            exit 0
        fi

        # 2. Main gaming launchers & browser (Steam, Heroic, Eglantine, Eden, RetroArch, Chrome):
        # Shut down the launcher completely and return to the Console Hub menu
        if echo "$WIN_CLASS" | grep -qE "steam|heroic|eglantine|eden|google-chrome|retroarch"; then
            if ! echo "$WIN_CLASS" | grep -q "kyberhub"; then
                echo "[switch_launcher] Closing main launcher ($WIN_CLASS). Returning to Hub..."
                if [ -n "$ACTIVE_WID" ] && [ "$ACTIVE_WID" != "0x0" ]; then
                    wmctrl -ic "$ACTIVE_WID" 2>/dev/null || true
                fi
                kill_all_launchers
                echo "menu" > /tmp/kyber_next_action
                chmod 666 /tmp/kyber_next_action 2>/dev/null || true
                exit 0
            fi
        fi

        # 3. Standard desktop applications / utility windows:
        if [ -n "$ACTIVE_WID" ] && [ "$ACTIVE_WID" != "0x0" ]; then
            wmctrl -ic "$ACTIVE_WID" 2>/dev/null || true
            sleep 0.2
            if xwininfo -id "$ACTIVE_WID" 2>/dev/null | grep -q "IsViewable"; then
                if [ -n "$WIN_PID" ] && [ "$WIN_PID" -gt 1 ] 2>/dev/null; then
                    kill -9 "$WIN_PID" 2>/dev/null || true
                fi
                xdotool windowkill "$ACTIVE_WID" 2>/dev/null || true
            fi
        fi
        exit 0
        ;;

    kill-apps)
        # Kills background launchers from inside the Hub without restarting the Hub itself
        kill_all_launchers
        if ! pgrep -u gamer -f "kyber-hub-profile" >/dev/null 2>&1; then
            echo "menu" > /tmp/kyber_next_action
            chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        fi
        exit 0
        ;;

    menu)
        kill_all_launchers
        echo "menu" > /tmp/kyber_next_action
        chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        ;;

    restart-steam)
        echo "$TARGET" > /tmp/kyber_next_action
        chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
        sleep 0.3
        pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
        ;;

    desktop)
        echo "$TARGET" > /tmp/kyber_next_action
        chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        pkill -u gamer -f "kyber-hub-profile" 2>/dev/null || true
        wmctrl -k on 2>/dev/null || xdotool key Super+d 2>/dev/null || true
        ;;

    retroarch)
        kill_all_launchers
        echo "$TARGET" > /tmp/kyber_next_action
        chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        ;;

    *)
        echo "$TARGET" > /tmp/kyber_next_action
        chmod 666 /tmp/kyber_next_action 2>/dev/null || true
        # Keep Console Hub (kyber-hub-profile) alive during launch so its fullscreen
        # loading screen (#launchOverlay) stays visible until the new launcher window maps.
        # Clean previous game/launcher processes when switching targets
        pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|eglantine|eden-cli|retroarch" 2>/dev/null || true
        sleep 0.2
        pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|eglantine|eden-cli|retroarch" 2>/dev/null || true
        if [ "$TARGET" != "browser" ] && [ "$TARGET" != "chrome" ] && [ "$TARGET" != "google-chrome" ]; then
            terminate_browser
        fi
        ;;
esac

exit 0
