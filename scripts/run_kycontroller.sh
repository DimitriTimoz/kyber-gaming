#!/usr/bin/env bash
set -e

export PATH="/opt/kyber/bin:$PATH"
export LD_LIBRARY_PATH="/opt/kyber/lib:/opt/kyber/lib/x86_64-linux-gnu:/opt/kyber/lib64:$LD_LIBRARY_PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"

echo "[kyber] Waiting for X display on $DISPLAY..."
while ! xdpyinfo >/dev/null 2>&1; do
    sleep 1
done

echo "[kyber] Starting Kyber controller..."
# kycontroller automatically reads ./kyber_config.toml or specified path
cd /etc/kyber
exec kycontroller "$@"
