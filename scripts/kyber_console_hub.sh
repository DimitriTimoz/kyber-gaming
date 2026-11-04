#!/usr/bin/env bash
set -e

export DISPLAY="${DISPLAY:-:0}"
export HOME="/home/gamer"

echo "[hub-launcher] Launching Kyber Gaming Console OS Kiosk on $DISPLAY..." >&2

# Clean any existing profile lock or stale action
rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
rm -f /tmp/kyber-hub-profile/Singleton* 2>/dev/null || true
mkdir -p /tmp/kyber-hub-profile/Default

# Suppress Google Translate and first-run prompts
echo '{"translate":{"enabled":false},"translate_blocked_hosts":["127.0.0.1","localhost"]}' > /tmp/kyber-hub-profile/Default/Preferences 2>/dev/null || true

# Determine URL to load (local resizer server or file:///)
HUB_URL="https://127.0.0.1:8081/hub/"
# Fallback to local file if HTTP server isn't up
if ! curl -k -s --connect-timeout 1 "$HUB_URL" >/dev/null 2>&1; then
    HUB_URL="file:///opt/kyber/hub/index.html"
fi

echo "[hub-launcher] Opening Hub UI at $HUB_URL" >&2

# Launch Google Chrome in full console kiosk mode
/opt/google/chrome/chrome \
    --kiosk \
    --no-first-run \
    --no-default-browser-check \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=Translate,OptimizationHints \
    --disable-translate \
    --lang=fr-FR \
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
    --app="$HUB_URL" >/dev/null 2>&1 &

CHROME_PID=$!
sleep 1

# Wait for a selection event (/tmp/kyber_next_action written by web UI or external API)
# or until Chrome is closed
while [ ! -f /tmp/kyber_next_action ]; do
    if ! pgrep -u gamer -f "kyber-hub-profile" >/dev/null 2>&1; then
        echo "[hub-launcher] Chrome was closed externally." >&2
        break
    fi
    sleep 0.2
done

# Extract choice
CHOICE=""
if [ -f /tmp/kyber_next_action ]; then
    CHOICE=$(cat /tmp/kyber_next_action)
    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
    echo "[hub-launcher] Selection registered: $CHOICE" >&2
fi

# Clean up Chrome processes
kill "$CHROME_PID" 2>/dev/null || true
pkill -u gamer -f "kyber-hub-profile" 2>/dev/null || true

# If no choice (e.g. user closed Chrome or tab was killed), default back to menu to avoid black screen
if [ -z "$CHOICE" ]; then
    CHOICE="menu"
fi

echo "$CHOICE"
