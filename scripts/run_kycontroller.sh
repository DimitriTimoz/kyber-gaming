#!/usr/bin/env bash
set -e

export PATH="/opt/kyber/bin:/opt/kyber:/usr/local/bin:/usr/bin:/bin:$PATH"
export LD_LIBRARY_PATH="/opt/kyber/lib:/opt/kyber/lib/x86_64-linux-gnu:/opt/kyber/lib64:$LD_LIBRARY_PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"

echo "[kyber] Waiting for X display on $DISPLAY..."
while ! xdpyinfo >/dev/null 2>&1; do
    sleep 1
done

echo "[kyber] Checking for Kyber executable..."
KY_BIN=""
if command -v kycontroller >/dev/null 2>&1; then
    KY_BIN="kycontroller"
elif [ -x /opt/kyber/bin/kycontroller ]; then
    KY_BIN="/opt/kyber/bin/kycontroller"
elif [ -x /opt/kyber/kycontroller ]; then
    KY_BIN="/opt/kyber/kycontroller"
fi

if [ -z "$KY_BIN" ]; then
    echo "[kyber] ERROR: kycontroller binary was not found in /opt/kyber/bin!"
    echo "[kyber] Listing contents of /opt/kyber:"
    ls -laR /opt/kyber 2>/dev/null || true
    echo "[kyber] Sleeping to allow inspection..."
    sleep infinity
fi

echo "[kyber] Starting Kyber controller using $KY_BIN..."
cd /etc/kyber
exec "$KY_BIN" "$@"
