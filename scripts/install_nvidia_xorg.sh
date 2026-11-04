#!/usr/bin/env bash
# ==============================================================================
# Kyber Gaming - Adaptive Multiarch NVIDIA Xorg, GLX, Vulkan & NvFBC Installer
#
# Detects the exact host NVIDIA driver version, validates ABI compatibility,
# and automatically installs both 64-bit and 32-bit userspace acceleration
# libraries (libglxserver_nvidia, NvFBC, 32-bit GLX/Vulkan runtimes).
# Automatically self-heals when host drivers are upgraded.
# ==============================================================================
set -e

LOG_PREFIX="[nvidia-driver]"
CACHE_DIR="${NVIDIA_DRIVER_CACHE:-/var/cache/nvidia-driver}"
XORG_EXT_DIR="/usr/lib/xorg/modules/extensions"
LIB64_DIR="/usr/lib/x86_64-linux-gnu"
LIB32_DIR="/usr/lib/i386-linux-gnu"

# 1. Check if NVIDIA Xorg driver is mounted into the container
if [ ! -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ]; then
    echo "$LOG_PREFIX nvidia_drv.so not mounted in container, skipping NVIDIA userspace setup."
    exit 0
fi

# 2. Detect exact host kernel driver version
VER=""
if [ -r /proc/driver/nvidia/version ]; then
    VER=$(sed -n 's/.*Kernel Module[[:space:]]*\([0-9][0-9.]*\).*/\1/p' /proc/driver/nvidia/version | head -n 1)
fi
if [ -z "$VER" ] && command -v nvidia-smi >/dev/null 2>&1; then
    VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -n 1 | tr -d '[:space:]')
fi
if [ -z "$VER" ]; then
    echo "$LOG_PREFIX ERROR: Unable to detect host NVIDIA driver version from /proc or nvidia-smi."
    exit 1
fi

echo "$LOG_PREFIX Detected host NVIDIA driver version: $VER"

# 3. Check existing installed versions to detect driver upgrades
need_install=false

CURRENT_GLX_TARGET=$(readlink "$XORG_EXT_DIR/libglxserver_nvidia.so" 2>/dev/null || true)
if [ "$CURRENT_GLX_TARGET" != "libglxserver_nvidia.so.$VER" ] || [ ! -f "$XORG_EXT_DIR/libglxserver_nvidia.so.$VER" ]; then
    echo "$LOG_PREFIX GLX server module mismatch or missing (found: '$CURRENT_GLX_TARGET', required: 'libglxserver_nvidia.so.$VER')."
    need_install=true
fi

if [ ! -f "$LIB64_DIR/libnvidia-fbc.so.$VER" ]; then
    echo "$LOG_PREFIX 64-bit libnvidia-fbc.so.$VER missing."
    need_install=true
fi

if [ ! -f "$LIB32_DIR/libGLX_nvidia.so.$VER" ] || [ ! -f "$LIB32_DIR/libnvidia-glcore.so.$VER" ]; then
    echo "$LOG_PREFIX 32-bit OpenGL / Vulkan runtime libraries missing for version $VER."
    need_install=true
fi

if ! $need_install; then
    echo "$LOG_PREFIX All 64-bit and 32-bit NVIDIA userspace libraries match host driver $VER."
    exit 0
fi

echo "$LOG_PREFIX Host driver upgrade or missing components detected. Installing userspace libraries for $VER..."

# 4. Clean up older non-bind-mounted files to avoid library version conflicts
rm -f "$XORG_EXT_DIR"/libglxserver_nvidia.so* 2>/dev/null || true
rm -f "$LIB64_DIR"/libnvidia-fbc.so.* 2>/dev/null || true
rm -f "$LIB32_DIR"/libnvidia* "$LIB32_DIR"/libGLX_nvidia* 2>/dev/null || true

# 5. Acquire installer archive (cached across restarts via persistent volume)
RUN_FILE="$CACHE_DIR/NVIDIA-Linux-x86_64-$VER.run"
mkdir -p "$CACHE_DIR" "$XORG_EXT_DIR" "$LIB64_DIR" "$LIB32_DIR"

if [ ! -s "$RUN_FILE" ]; then
    PRIMARY_URL="https://download.nvidia.com/XFree86/Linux-x86_64/$VER/NVIDIA-Linux-x86_64-$VER.run"
    MIRROR_URL="https://us.download.nvidia.com/XFree86/Linux-x86_64/$VER/NVIDIA-Linux-x86_64-$VER.run"
    
    echo "$LOG_PREFIX Downloading NVIDIA installer for $VER from primary source..."
    if ! wget -q --timeout=30 -O "$RUN_FILE.part" "$PRIMARY_URL"; then
        echo "$LOG_PREFIX Primary source failed, attempting mirror download..."
        wget -q --timeout=30 -O "$RUN_FILE.part" "$MIRROR_URL"
    fi
    mv "$RUN_FILE.part" "$RUN_FILE"
fi

# 6. Extract userspace files (target directory must not exist prior to extraction)
EXTRACT_DIR="/tmp/nvidia-$VER"
rm -rf "$EXTRACT_DIR"
echo "$LOG_PREFIX Extracting userspace binaries from installer..."
sh "$RUN_FILE" --extract-only --target "$EXTRACT_DIR" >/dev/null

# 7. Install 64-bit Xorg & GLX acceleration modules
echo "$LOG_PREFIX Installing 64-bit acceleration libraries..."
if [ -f "$EXTRACT_DIR/libglxserver_nvidia.so.$VER" ]; then
    install -m 0755 "$EXTRACT_DIR/libglxserver_nvidia.so.$VER" "$XORG_EXT_DIR/libglxserver_nvidia.so.$VER"
    ln -sf "libglxserver_nvidia.so.$VER" "$XORG_EXT_DIR/libglxserver_nvidia.so"
fi

# Install NvFBC (64-bit)
if [ -f "$EXTRACT_DIR/libnvidia-fbc.so.$VER" ]; then
    install -m 0755 "$EXTRACT_DIR/libnvidia-fbc.so.$VER" "$LIB64_DIR/"
    ln -sf "libnvidia-fbc.so.$VER" "$LIB64_DIR/libnvidia-fbc.so.1"
    ln -sf "libnvidia-fbc.so.1" "$LIB64_DIR/libnvidia-fbc.so"
fi

# Install other 64-bit components only if not already bind-mounted by Container Toolkit
for lib in libnvidia-glcore libnvidia-gpucomp libnvidia-glvkspirv libnvidia-glsi libnvidia-eglcore; do
    if [ -f "$EXTRACT_DIR/$lib.so.$VER" ] && [ ! -f "$LIB64_DIR/$lib.so.$VER" ]; then
        install -m 0755 "$EXTRACT_DIR/$lib.so.$VER" "$LIB64_DIR/" || true
    fi
done

# 8. Install 32-bit acceleration libraries (essential for Steam, Wine, Proton 32-bit DirectX games)
if [ -d "$EXTRACT_DIR/32" ]; then
    echo "$LOG_PREFIX Installing 32-bit OpenGL / Vulkan / CUDA runtime libraries..."
    for lib32 in "$EXTRACT_DIR/32"/*.so.*; do
        if [ -f "$lib32" ]; then
            install -m 0755 "$lib32" "$LIB32_DIR/" || true
        fi
    done

    # 32-bit GLX symlinks
    if [ -f "$LIB32_DIR/libGLX_nvidia.so.$VER" ]; then
        ln -sf "libGLX_nvidia.so.$VER" "$LIB32_DIR/libGLX_nvidia.so.0"
        ln -sf "libGLX_nvidia.so.0" "$LIB32_DIR/libGLX_nvidia.so"
    fi

    # 32-bit EGL symlinks
    if [ -f "$LIB32_DIR/libEGL_nvidia.so.$VER" ]; then
        ln -sf "libEGL_nvidia.so.$VER" "$LIB32_DIR/libEGL_nvidia.so.0"
    fi

    # 32-bit GLESv2 symlinks
    if [ -f "$LIB32_DIR/libGLESv2_nvidia.so.$VER" ]; then
        ln -sf "libGLESv2_nvidia.so.$VER" "$LIB32_DIR/libGLESv2_nvidia.so.2"
    fi

    # 32-bit CUDA symlinks
    if [ -f "$LIB32_DIR/libcuda.so.$VER" ]; then
        ln -sf "libcuda.so.$VER" "$LIB32_DIR/libcuda.so.1"
        ln -sf "libcuda.so.1" "$LIB32_DIR/libcuda.so"
    fi

    # 32-bit NvFBC symlinks
    if [ -f "$LIB32_DIR/libnvidia-fbc.so.$VER" ]; then
        ln -sf "libnvidia-fbc.so.$VER" "$LIB32_DIR/libnvidia-fbc.so.1"
        ln -sf "libnvidia-fbc.so.1" "$LIB32_DIR/libnvidia-fbc.so"
    fi

    # 32-bit Encode symlinks
    if [ -f "$LIB32_DIR/libnvidia-encode.so.$VER" ]; then
        ln -sf "libnvidia-encode.so.$VER" "$LIB32_DIR/libnvidia-encode.so.1"
        ln -sf "libnvidia-encode.so.1" "$LIB32_DIR/libnvidia-encode.so"
    fi

    # 32-bit VDPAU symlinks
    if [ -f "$LIB32_DIR/libvdpau_nvidia.so.$VER" ]; then
        ln -sf "libvdpau_nvidia.so.$VER" "$LIB32_DIR/libvdpau_nvidia.so.1"
    fi
fi

# 9. Configure 32-bit Vulkan ICD manifest for NVIDIA
mkdir -p /etc/vulkan/icd.d /usr/share/vulkan/icd.d
cat << 'EOF' > /etc/vulkan/icd.d/nvidia_icd.i686.json
{
    "file_format_version" : "1.0.0",
    "ICD": {
        "library_path": "/usr/lib/i386-linux-gnu/libGLX_nvidia.so.0",
        "api_version" : "1.3.277"
    }
}
EOF

# 10. Update dynamic linker cache and clean up
ldconfig
rm -rf "$EXTRACT_DIR"

echo "$LOG_PREFIX Successfully synchronized 64-bit and 32-bit NVIDIA userspace libraries for driver $VER."
