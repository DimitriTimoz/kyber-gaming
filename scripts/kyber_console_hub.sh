#!/usr/bin/env bash
set -e
EXTERNAL_CLOSE=0

export DISPLAY="${DISPLAY:-:0}"
export HOME="/home/gamer"
export XCURSOR_SIZE="${XCURSOR_SIZE:-24}"
export XCURSOR_THEME="${XCURSOR_THEME:-Adwaita}"

echo "[hub-launcher] Launching Kyber Gaming Console OS Kiosk on $DISPLAY..." >&2

# Clean any existing profile lock or stale action
rm -f /tmp/kyber_next_action 2>/dev/null || true
: > /tmp/kyber_next_action 2>/dev/null || true
rm -rf /tmp/kyber-hub-profile 2>/dev/null || true
mkdir -p /tmp/kyber-hub-profile/Default

# Suppress Google Translate and first-run prompts
echo '{"translate":{"enabled":false},"translate_blocked_hosts":["127.0.0.1","localhost"]}' > /tmp/kyber-hub-profile/Default/Preferences 2>/dev/null || true

# Determine URL to load (local Kyber Control Plane server or file:///)
HUB_URL="https://127.0.0.1:8081/hub/"
# Fallback to local file if HTTP server isn't up
if ! curl -k -s --connect-timeout 1 "$HUB_URL" >/dev/null 2>&1; then
    HUB_URL="file:///opt/kyber/hub/index.html"
fi

echo "[hub-launcher] Opening Hub UI at $HUB_URL" >&2

# Detect active display resolution so the kiosk window always fills 100% of the screen
SCREEN_RES=$(xrandr --current 2>/dev/null | awk '/\*/ {print $1; exit}')
SCREEN_W=$(echo "${SCREEN_RES:-1920x1080}" | cut -d'x' -f1)
SCREEN_H=$(echo "${SCREEN_RES:-1920x1080}" | cut -d'x' -f2)

if pgrep -u gamer -f "kyber-hub-profile" >/dev/null 2>&1; then
    echo "[hub-launcher] Reusing active Console Hub instance on $DISPLAY..." >&2
else
    # Launch Google Chrome in true fullscreen console kiosk mode
    /opt/google/chrome/chrome \
        --class=KyberHub \
        --no-sandbox \
        --kiosk \
        --start-fullscreen \
        --start-maximized \
        --window-position=0,0 \
        --window-size="${SCREEN_W},${SCREEN_H}" \
        --no-first-run \
        --no-default-browser-check \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --disable-features=Translate,OptimizationHints \
        --disable-translate \
        --lang=en-US \
        --noerrdialogs \
        --disable-popup-blocking \
        --autoplay-policy=no-user-gesture-required \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --enable-gpu-rasterization \
        --enable-zero-copy \
        --ignore-certificate-errors \
        --allow-file-access-from-files \
        --user-data-dir=/tmp/kyber-hub-profile \
        "$HUB_URL" >/tmp/chrome_hub.log 2>&1 &
fi

# Wait up to 4s for the Hub window to map, then enforce fullscreen, 0,0 geometry, and active focus
HUB_WID=""
for _ in $(seq 1 20); do
    HUB_WID=$(wmctrl -lx 2>/dev/null | grep -iE "kyberhub|Kyber Console OS" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$HUB_WID" ]; then
        break
    fi
    sleep 0.2
done

if [ -n "$HUB_WID" ]; then
    wmctrl -ir "$HUB_WID" -e "0,0,0,${SCREEN_W},${SCREEN_H}" 2>/dev/null || true
    wmctrl -ir "$HUB_WID" -b add,fullscreen,maximized_vert,maximized_horz 2>/dev/null || true
    wmctrl -ia "$HUB_WID" 2>/dev/null || true
    xdotool windowactivate "$HUB_WID" 2>/dev/null || true
else
    wmctrl -r "Kyber Console OS" -e "0,0,0,${SCREEN_W},${SCREEN_H}" 2>/dev/null || true
    wmctrl -r "Kyber Console OS" -b add,fullscreen,maximized_vert,maximized_horz 2>/dev/null || true
    wmctrl -a "Kyber Console OS" 2>/dev/null || true
fi

# Wait for a selection event (/tmp/kyber_next_action written with non-empty command)
# or until Chrome is closed
while [ ! -s /tmp/kyber_next_action ]; do
    if ! pgrep -u gamer -f "kyber-hub-profile" >/dev/null 2>&1; then
        echo "[hub-launcher] Hub closed by user (Alt+F4 / window close): leaving OS mode." >&2
        EXTERNAL_CLOSE=1
        break
    fi
    sleep 0.2
done

# Extract choice
CHOICE=""
if [ -s /tmp/kyber_next_action ]; then
    CHOICE=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
    echo "[hub-launcher] Selection registered: $CHOICE" >&2
fi

# If no action was selected or Chrome was closed/interrupted, default to menu
if [ -z "$CHOICE" ]; then
    CHOICE="menu"
fi

# Only close the Hub immediately when dropping to desktop; for game launchers, keep the Hub
# alive so its fullscreen loading screen (#launchOverlay) remains visible until the target window maps.
if [ "$CHOICE" = "desktop" ]; then
    pkill -u gamer -f "kyber-hub-profile" 2>/dev/null || true
fi

echo "$CHOICE"
