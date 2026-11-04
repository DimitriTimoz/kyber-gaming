#!/usr/bin/env bash
set -e

TARGET="${1:-menu}"
export DISPLAY="${DISPLAY:-:0}"
export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[switch_launcher] Request: $TARGET on DISPLAY $DISPLAY"

# Notify the session manager loop
echo "$TARGET" > /tmp/kyber_next_action

case "$TARGET" in
    menu)
        # Kill current launcher to immediately return to the hub
        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic" 2>/dev/null || true
        ;;

    restart-steam)
        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
        ;;

    desktop)
        # Minimize windows if wmctrl is available
        wmctrl -k on 2>/dev/null || xdotool key Super+d 2>/dev/null || true
        ;;

    *)
        # Kill Console Hub if still active
        pkill -u gamer -f "kyber-hub-profile" 2>/dev/null || true
        # For steam, steam-bigpicture, heroic: if another launcher is running, close it
        if [ "$TARGET" = "heroic" ]; then
            pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
        elif [ "$TARGET" = "steam" ] || [ "$TARGET" = "steam-bigpicture" ]; then
            pkill -u gamer -f "heroic" 2>/dev/null || true
        fi
        ;;
esac

exit 0
