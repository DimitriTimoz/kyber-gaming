#!/usr/bin/env bash
set -e

export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"
export HOME="/home/gamer"

echo "[session] Starting Kyber game session manager on DISPLAY $DISPLAY"

# Wait for X server
while ! xdpyinfo >/dev/null 2>&1; do
    echo "[session] Waiting for X server on $DISPLAY..."
    sleep 0.5
done

# Set desktop background canvas
xsetroot -solid "#0c0f17" 2>/dev/null || true

# Pre-bootstrap Steam if not yet initialized
STEAMDIR="$HOME/.steam/debian-installation"
if [ ! -f "$STEAMDIR/steam.sh" ]; then
    echo "[session] Steam bootstrap not detected. Initializing headless bootstrap..."
    mkdir -p "$STEAMDIR/deb-installer"
    version="1.0.0.79"
    url="https://repo.steampowered.com/steam/archive/beta/steam_${version}.tar.gz"
    if curl -sSL "$url" -o "$STEAMDIR/deb-installer/steam_${version}.tar.gz"; then
        tar -C "$STEAMDIR/deb-installer" -zxf "$STEAMDIR/deb-installer/steam_${version}.tar.gz" steam-launcher/bootstraplinux_ubuntu12_32.tar.xz 2>/dev/null || true
        if [ -f "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz" ]; then
            tar -C "$STEAMDIR" -xf "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz"
            echo "$version" > "$STEAMDIR/deb-installer/version"
            echo "[session] Steam bootstrap installed successfully."
        fi
    fi
fi

# Default to menu so users always see the Hub on connect
CURRENT_ACTION="${LAUNCHER:-menu}"

while true; do
    echo "[session] Current State: $CURRENT_ACTION"

    case "$CURRENT_ACTION" in
        steam)
            echo "[session] Starting Steam..."
            rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true
            steam -no-cef-sandbox >/dev/null 2>&1 &
            # Wait for steam to actually launch
            sleep 3
            # Monitor until Steam exits
            while pgrep -u gamer -f "ubuntu12_32/steam|steam.sh" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "steam" ]; then
                        echo "[session] Action requested while Steam is running: $NEXT"
                        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi
                sleep 1
            done
            if [ "$CURRENT_ACTION" = "steam" ]; then
                echo "[session] Steam has closed. Returning to Launcher Hub..."
                CURRENT_ACTION="menu"
            fi
            ;;

        steam-bigpicture)
            echo "[session] Starting Steam Big Picture..."
            rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true
            steam -bigpicture -no-cef-sandbox >/dev/null 2>&1 &
            sleep 3
            while pgrep -u gamer -f "ubuntu12_32/steam|steam.sh" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "steam-bigpicture" ]; then
                        echo "[session] Action requested: $NEXT"
                        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi
                sleep 1
            done
            if [ "$CURRENT_ACTION" = "steam-bigpicture" ]; then
                echo "[session] Steam Big Picture closed. Returning to Launcher Hub..."
                CURRENT_ACTION="menu"
            fi
            ;;

        heroic)
            echo "[session] Starting Heroic Games Launcher..."
            HEROIC_BIN="/opt/Heroic/heroic"
            [ -x "$HEROIC_BIN" ] || HEROIC_BIN="$(command -v heroic || echo /usr/bin/heroic)"
            "$HEROIC_BIN" --no-sandbox >/dev/null 2>&1 &
            sleep 3
            while pgrep -u gamer -f "heroic" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "heroic" ]; then
                        echo "[session] Action requested: $NEXT"
                        pkill -u gamer -f "heroic" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi
                sleep 1
            done
            if [ "$CURRENT_ACTION" = "heroic" ]; then
                echo "[session] Heroic has closed. Returning to Launcher Hub..."
                CURRENT_ACTION="menu"
            fi
            ;;

        restart-steam)
            echo "[session] Restarting Steam cleanly..."
            pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
            sleep 2
            rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true
            CURRENT_ACTION="steam"
            ;;

        browser|chrome|google-chrome)
            echo "[session] Starting Web Browser (Google Chrome)..."
            google-chrome \
                --no-sandbox \
                --no-first-run \
                --no-default-browser-check \
                --disable-gpu-sandbox \
                --test-type \
                --disable-infobars \
                --start-maximized \
                --disable-features=Translate \
                --lang=fr-FR >/dev/null 2>&1 &
            sleep 2
            while true; do
                # Check if non-hub Chrome is running
                BROWSER_RUNNING=0
                for p in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
                    if [ -r "/proc/$p/cmdline" ]; then
                        if tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                            BROWSER_RUNNING=1
                            break
                        fi
                    fi
                done

                if [ "$BROWSER_RUNNING" -eq 0 ]; then
                    echo "[session] Browser closed. Returning to Console Hub..."
                    CURRENT_ACTION="menu"
                    break
                fi

                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "browser" ] && [ "$NEXT" != "chrome" ] && [ "$NEXT" != "google-chrome" ]; then
                        echo "[session] Action requested while browser running: $NEXT"
                        for p in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
                            if [ -r "/proc/$p/cmdline" ]; then
                                if tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                                    kill "$p" 2>/dev/null || true
                                fi
                            fi
                        done
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi
                sleep 1
            done
            ;;

        desktop)
            echo "[session] Desktop mode active. Waiting for user interaction..."
            while [ ! -s /tmp/kyber_next_action ]; do
                sleep 1
            done
            CURRENT_ACTION="$(cat /tmp/kyber_next_action | tr -d '[:space:]')"
            rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
            ;;

        menu)
            echo "[session] Presenting Fullscreen Console Kiosk Hub..."
            # Clean any stale hub processes
            pkill -u gamer -f "kyber-hub-profile|kyber_console_hub|kyber_launcher_menu" 2>/dev/null || true
            RAW_CHOICE=$(bash /usr/local/bin/kyber_console_hub.sh || echo "menu")
            CHOICE=$(echo "$RAW_CHOICE" | tail -n 1 | tr -d '[:space:]')
            echo "[session] Console Hub selection: '$CHOICE'"
            if [ -z "$CHOICE" ] || [ "$CHOICE" = "menu" ]; then
                CURRENT_ACTION="menu"
            else
                CURRENT_ACTION="$CHOICE"
            fi
            ;;

        *)
            echo "[session] Executing target launcher or emulator: $CURRENT_ACTION..."
            EXEC_CMD=""
            if command -v "$CURRENT_ACTION" >/dev/null 2>&1; then
                EXEC_CMD="$CURRENT_ACTION"
            elif [ -x "/usr/games/$CURRENT_ACTION" ]; then
                EXEC_CMD="/usr/games/$CURRENT_ACTION"
            elif [ -x "/usr/local/bin/$CURRENT_ACTION" ]; then
                EXEC_CMD="/usr/local/bin/$CURRENT_ACTION"
            fi

            if [ -n "$EXEC_CMD" ]; then
                echo "[session] Launching '$EXEC_CMD'..."
                setsid $EXEC_CMD >/dev/null 2>&1 &
                APP_PID=$!
                sleep 2

                # Watchdog loop: monitors process and any spawned child threads
                while true; do
                    # Check if main process or any process matching the target is alive
                    IS_ALIVE=0
                    if kill -0 "$APP_PID" 2>/dev/null; then
                        IS_ALIVE=1
                    elif pgrep -u gamer -f "$CURRENT_ACTION" >/dev/null 2>&1; then
                        IS_ALIVE=1
                    fi

                    if [ "$IS_ALIVE" -eq 0 ]; then
                        echo "[session] Process $CURRENT_ACTION has exited or terminated. Cleaning up..."
                        break
                    fi

                    # Handle user requested switch
                    if [ -s /tmp/kyber_next_action ]; then
                        NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                        rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                        if [ -n "$NEXT" ] && [ "$NEXT" != "$CURRENT_ACTION" ]; then
                            echo "[session] Action switch requested: $NEXT"
                            kill -TERM "$APP_PID" 2>/dev/null || true
                            pkill -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                            CURRENT_ACTION="$NEXT"
                            break
                        fi
                    fi
                    sleep 1
                done

                # Ensure any zombie child processes are cleaned up
                pkill -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                xsetroot -solid "#0c0f17" 2>/dev/null || true

                if [ "$CURRENT_ACTION" = "$CURRENT_ACTION" ]; then
                    echo "[session] Returning cleanly to Console Hub..."
                    CURRENT_ACTION="menu"
                fi
            else
                echo "[session] Target '$CURRENT_ACTION' is not installed or not executable in PATH."
                sleep 1.5
                CURRENT_ACTION="menu"
            fi
            ;;
    esac
    sleep 0.5
done
