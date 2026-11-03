#!/usr/bin/env bash
set -e

DISPLAY_NUM="${DISPLAY_NUM:-:0}"
DEFAULT_RES="${RESOLUTION:-1920x1080}"
DEFAULT_REFRESH="${REFRESH_RATE:-60}"

echo "[init_display] Initializing headless virtual display for $DISPLAY_NUM..."

# 1. Generate standard gaming EDID
python3 /usr/local/bin/make_edid.py /etc/X11/edid.bin

# 2. Select appropriate Xorg config
mkdir -p /etc/X11
if [ -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ] && \
   [ -e /usr/lib/xorg/modules/extensions/libglxserver_nvidia.so ] && \
   [ "${FORCE_DUMMY:-false}" != "true" ]; then
    echo "[init_display] NVIDIA Xorg driver and GLX module found. Using NVIDIA Xorg configuration."
    cp /etc/kyber/xorg.nvidia.conf /etc/X11/xorg.conf
else
    echo "[init_display] Using Xorg Dummy driver for reliable headless virtual screen."
    cp /etc/kyber/xorg.dummy.conf /etc/X11/xorg.conf
fi

# 3. Clean up stale X locks
rm -f /tmp/.X${DISPLAY_NUM#:}-lock
rm -f /tmp/.X11-unix/X${DISPLAY_NUM#:}
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# 4. Start Xorg in background or managed by supervisor
echo "[init_display] Starting Xorg on $DISPLAY_NUM..."
exec /usr/lib/xorg/Xorg "$DISPLAY_NUM" \
    -config /etc/X11/xorg.conf \
    -ac \
    -noreset \
    +extension GLX \
    +extension RANDR \
    +extension RENDER \
    -logfile /var/log/Xorg.0.log
