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
        # Kill current launcher or emulator to immediately return to the hub
        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|retroarch|rpcs3|pcsx2|dolphin-emu|duckstation|cemu|ryujinx|yuzu" 2>/dev/null || true
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
        # Clean previous game/launcher processes when switching targets
        pkill -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh|heroic|retroarch|rpcs3|pcsx2|dolphin-emu|duckstation|cemu|ryujinx|yuzu" 2>/dev/null || true
        ;;
esac

exit 0
