#!/usr/bin/env bash
# Install the NVIDIA Xorg GLX server module (and NvFBC) matching the host driver.
#
# The NVIDIA Container Toolkit mounts nvidia_drv.so into the container but not
# libglxserver_nvidia.so. Without it, Xorg falls back to Mesa's libglx.so and
# segfaults. The userspace files are extracted from the official NVIDIA
# installer for the exact host driver version (no kernel module is installed).
set -e

LOG_PREFIX="[nvidia-xorg]"
CACHE_DIR="${NVIDIA_DRIVER_CACHE:-/var/cache/nvidia-driver}"
XORG_EXT_DIR="/usr/lib/xorg/modules/extensions"
LIB_DIR="/usr/lib/x86_64-linux-gnu"

# Nothing to do without the NVIDIA Xorg driver
if [ ! -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ]; then
    echo "$LOG_PREFIX nvidia_drv.so not present, skipping."
    exit 0
fi

# Detect host driver version
VER=""
if [ -r /proc/driver/nvidia/version ]; then
    VER=$(sed -n 's/.*Kernel Module[[:space:]]*\([0-9][0-9.]*\).*/\1/p' /proc/driver/nvidia/version | head -n 1)
fi
if [ -z "$VER" ] && command -v nvidia-smi >/dev/null 2>&1; then
    VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -n 1 | tr -d ' ')
fi
if [ -z "$VER" ]; then
    echo "$LOG_PREFIX ERROR: unable to detect NVIDIA driver version."
    exit 1
fi
echo "$LOG_PREFIX Host NVIDIA driver version: $VER"

need_glx=true
[ -f "$XORG_EXT_DIR/libglxserver_nvidia.so" ] && need_glx=false

need_glcore=true
ldconfig -p | grep -q "libnvidia-glcore.so.$VER" && need_glcore=false

need_fbc=true
ldconfig -p | grep -q "libnvidia-fbc.so.1" && need_fbc=false

if ! $need_glx && ! $need_glcore && ! $need_fbc; then
    echo "$LOG_PREFIX All required NVIDIA userspace files already present."
    exit 0
fi

# Download installer (cached across restarts via volume)
RUN_FILE="$CACHE_DIR/NVIDIA-Linux-x86_64-$VER.run"
mkdir -p "$CACHE_DIR"
if [ ! -s "$RUN_FILE" ]; then
    URL="https://download.nvidia.com/XFree86/Linux-x86_64/$VER/NVIDIA-Linux-x86_64-$VER.run"
    echo "$LOG_PREFIX Downloading $URL ..."
    wget -q -O "$RUN_FILE.part" "$URL"
    mv "$RUN_FILE.part" "$RUN_FILE"
fi

# Extract userspace files only
EXTRACT_DIR="/tmp/nvidia-$VER"
rm -rf "$EXTRACT_DIR"
sh "$RUN_FILE" --extract-only --target "$EXTRACT_DIR" >/dev/null

if $need_glx; then
    echo "$LOG_PREFIX Installing libglxserver_nvidia.so"
    install -m 0755 "$EXTRACT_DIR/libglxserver_nvidia.so.$VER" "$XORG_EXT_DIR/libglxserver_nvidia.so.$VER"
    ln -sf "libglxserver_nvidia.so.$VER" "$XORG_EXT_DIR/libglxserver_nvidia.so"
fi

if $need_glcore; then
    echo "$LOG_PREFIX Installing libnvidia-glcore.so.$VER"
    install -m 0755 "$EXTRACT_DIR/libnvidia-glcore.so.$VER" "$LIB_DIR/"
fi

if $need_fbc; then
    echo "$LOG_PREFIX Installing libnvidia-fbc.so.$VER (NvFBC)"
    install -m 0755 "$EXTRACT_DIR/libnvidia-fbc.so.$VER" "$LIB_DIR/"
    ln -sf "libnvidia-fbc.so.$VER" "$LIB_DIR/libnvidia-fbc.so.1"
    ln -sf "libnvidia-fbc.so.1" "$LIB_DIR/libnvidia-fbc.so"
fi

ldconfig
rm -rf "$EXTRACT_DIR"
echo "$LOG_PREFIX Done."
