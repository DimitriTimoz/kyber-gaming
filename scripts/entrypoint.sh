#!/usr/bin/env bash
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

echo "[entrypoint] Setting up Kyber Cloud Gaming container..."

# 1. Synchronize UID and GID for gamer user
if [ "$(id -u gamer)" != "$PUID" ] || [ "$(id -g gamer)" != "$PGID" ]; then
    echo "[entrypoint] Adjusting user gamer to UID $PUID and GID $PGID..."
    groupmod -o -g "$PGID" gamer || true
    usermod -o -u "$PUID" -g "$PGID" gamer || true
fi

# Ensure gamer is in required groups
for grp in video audio input render; do
    if getent group "$grp" >/dev/null 2>&1; then
        usermod -aG "$grp" gamer || true
    fi
done

# 2. XDG runtime dir for PipeWire and D-Bus
XDG_DIR="/run/user/$PUID"
mkdir -p "$XDG_DIR"
chown -R gamer:gamer "$XDG_DIR"
chmod 0700 "$XDG_DIR"

# Ensure home directory ownership
chown gamer:gamer /home/gamer

# Setup structured emulator directories
mkdir -p \
    /home/gamer/roms/eglantine/games \
    /home/gamer/roms/eglantine/updates \
    /home/gamer/roms/eglantine/dlc \
    /home/gamer/roms/eglantine/keys \
    /home/gamer/roms/eglantine/firmware \
    /home/gamer/roms/eglantine/mods \
    /home/gamer/roms/saves \
    /home/gamer/bios \
    /home/gamer/.local/share/eglantine/keys \
    /home/gamer/.local/share/eden/keys \
    /home/gamer/.config/eden

# Compatibility symlink for AppImages or emulators referencing /home/user
if [ ! -e /home/user ]; then
    ln -s /home/gamer /home/user 2>/dev/null || true
fi

# Backwards compatibility symlink: roms/switch -> roms/eglantine/games
if [ ! -e /home/gamer/roms/switch ]; then
    ln -s /home/gamer/roms/eglantine/games /home/gamer/roms/switch 2>/dev/null || true
fi

# Auto-link any uploaded Switch keys from eglantine/keys or bios to Eglantine/Eden keys directory
for keydir in /home/gamer/roms/eglantine/keys /home/gamer/bios; do
    if [ -d "$keydir" ]; then
        for keyfile in "$keydir"/*.keys; do
            if [ -f "$keyfile" ]; then
                ln -sf "$keyfile" "/home/gamer/.local/share/eglantine/keys/$(basename "$keyfile")" 2>/dev/null || true
                ln -sf "$keyfile" "/home/gamer/.local/share/eden/keys/$(basename "$keyfile")" 2>/dev/null || true
            fi
        done
    fi
done

# Ensure Eglantine config points to game directories with recursive scanning
EDEN_CONF="/home/gamer/.config/eden/qt-config.ini"
if [ ! -f "$EDEN_CONF" ]; then
    mkdir -p "$(dirname "$EDEN_CONF")"
    cat << 'EOF' > "$EDEN_CONF"
[UI]
fullscreen=true
singleWindowMode=true
Paths\gamedirs\size=2
Paths\gamedirs\1\path=/home/gamer/roms/eglantine/games
Paths\gamedirs\1\deep_scan=true
Paths\gamedirs\1\expanded=true
Paths\gamedirs\2\path=/home/gamer/roms/switch
Paths\gamedirs\2\deep_scan=true
Paths\gamedirs\2\expanded=true
EOF
fi

mkdir -p /home/gamer/.config/openbox /home/gamer/.config/tint2 /home/gamer/.themes /home/gamer/.local/share/applications
if [ -d /etc/kyber/openbox ]; then
    cp -f /etc/kyber/openbox/* /home/gamer/.config/openbox/ 2>/dev/null || true
fi
if [ -f /etc/kyber/tint2/tint2rc ]; then
    cp -f /etc/kyber/tint2/tint2rc /home/gamer/.config/tint2/tint2rc 2>/dev/null || true
fi
if [ -d /usr/share/themes/KyberDark ]; then
    cp -rf /usr/share/themes/KyberDark /home/gamer/.themes/ 2>/dev/null || true
fi
if [ -f /usr/share/applications/kyber-hub.desktop ]; then
    cp -f /usr/share/applications/kyber-hub.desktop /home/gamer/.local/share/applications/ 2>/dev/null || true
fi

chown -R gamer:gamer /home/gamer/roms /home/gamer/bios /home/gamer/saves /home/gamer/.local /home/gamer/.config /home/gamer/.themes 2>/dev/null || true

# 3. Permissions on uinput and input devices
if [ -e /dev/uinput ]; then
    chmod 666 /dev/uinput || true
fi
if [ -d /dev/input ]; then
    chmod -R 666 /dev/input/* 2>/dev/null || true
fi

# 4. Generate self-signed TLS certificates for Kyber if missing
TLS_DIR="/etc/kyber/tls"
mkdir -p "$TLS_DIR"
if [ ! -f "$TLS_DIR/cert.pem" ] || [ ! -f "$TLS_DIR/key.pem" ]; then
    echo "[entrypoint] Generating self-signed TLS certificate for Kyber (port 8080)..."
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "$TLS_DIR/key.pem" \
        -out "$TLS_DIR/cert.pem" \
        -days 14 \
        -subj "/C=FR/ST=Cloud/L=Gaming/O=Kyber/CN=kyber.local" >/dev/null 2>&1
    chmod 644 "$TLS_DIR/cert.pem"
    chmod 600 "$TLS_DIR/key.pem"
    chown -R gamer:gamer "$TLS_DIR"
fi

# Compute SHA-256 certificate fingerprint for WebTransport serverCertificateHashes
if [ -f "$TLS_DIR/cert.pem" ]; then
    FINGERPRINT_HEX=$(openssl x509 -in "$TLS_DIR/cert.pem" -outform der | openssl dgst -sha256 2>/dev/null | awk '{print $NF}')
    if [ -n "$FINGERPRINT_HEX" ]; then
        echo "$FINGERPRINT_HEX" > "$TLS_DIR/fingerprint_sha256.txt"
        chown gamer:gamer "$TLS_DIR/fingerprint_sha256.txt" 2>/dev/null || true
        echo "[entrypoint] WebTransport SHA-256 certificate fingerprint: $FINGERPRINT_HEX"
    fi
fi

# 5. GPU hardware detection and driver synchronization
HAS_NVIDIA=false
HAS_AMD=false
HAS_INTEL=false

if [ -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ] || [ -e /proc/driver/nvidia/version ] || command -v nvidia-smi >/dev/null 2>&1; then
    HAS_NVIDIA=true
fi

if [ -e /dev/dri ]; then
    chmod -R 666 /dev/dri/* 2>/dev/null || true
    for vendor_file in /sys/class/drm/card*/device/vendor; do
        if [ -f "$vendor_file" ]; then
            v=$(cat "$vendor_file" 2>/dev/null || true)
            case "$v" in
                0x1002) HAS_AMD=true ;;
                0x8086) HAS_INTEL=true ;;
            esac
        fi
    done
    if ! $HAS_AMD && ! $HAS_INTEL; then
        if lspci 2>/dev/null | grep -iE 'vga|3d|display' | grep -qi 'AMD\|ATI\|Radeon'; then
            HAS_AMD=true
        elif lspci 2>/dev/null | grep -iE 'vga|3d|display' | grep -qi 'Intel'; then
            HAS_INTEL=true
        fi
    fi
fi

# Synchronize NVIDIA userspace and Xorg modules if NVIDIA hardware is detected
if $HAS_NVIDIA; then
    /usr/local/bin/install_nvidia_xorg.sh || echo "[entrypoint] WARNING: NVIDIA userspace synchronization encountered an issue."
fi

# 6. Dynamic GPU configuration for Kyber streaming server
KYBER_CONF="/etc/kyber/kyber_config.toml"
if [ -f "$KYBER_CONF" ]; then
    if $HAS_NVIDIA; then
        echo "[entrypoint] NVIDIA GPU detected -> Configuring Kyber with nvenc + xcb."
        sed -i 's/^encoder = .*/encoder = "nvenc"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "xcb"/' "$KYBER_CONF"
        # Export default environment for gamer sessions
        cat << 'EOF' > /etc/profile.d/kyber_gpu.sh
export __GLX_VENDOR_LIBRARY_NAME=nvidia
export VK_DRIVER_FILES=/etc/vulkan/icd.d/nvidia_icd.json:/etc/vulkan/icd.d/nvidia_icd.i686.json
EOF
    elif $HAS_AMD; then
        echo "[entrypoint] AMD Radeon GPU detected (/dev/dri) -> Configuring Kyber with vaapi + drm."
        sed -i 's/^encoder = .*/encoder = "vaapi"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "drm"/' "$KYBER_CONF"
        cat << 'EOF' > /etc/profile.d/kyber_gpu.sh
export LIBVA_DRIVER_NAME=radeonsi
export AMD_VULKAN_ICD=RADV
export VK_DRIVER_FILES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json:/usr/share/vulkan/icd.d/radeon_icd.i686.json
export MESA_VK_DEVICE_SELECT=1
EOF
    elif $HAS_INTEL; then
        echo "[entrypoint] Intel GPU detected (/dev/dri) -> Configuring Kyber with vaapi + drm."
        sed -i 's/^encoder = .*/encoder = "vaapi"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "drm"/' "$KYBER_CONF"
        cat << 'EOF' > /etc/profile.d/kyber_gpu.sh
export LIBVA_DRIVER_NAME=iHD
export VK_DRIVER_FILES=/usr/share/vulkan/icd.d/intel_icd.x86_64.json:/usr/share/vulkan/icd.d/intel_icd.i686.json
EOF
    else
        echo "[entrypoint] No hardware GPU detected -> Fallback to software x264 + xcb."
        sed -i 's/^encoder = .*/encoder = "x264"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "xcb"/' "$KYBER_CONF"
        cat << 'EOF' > /etc/profile.d/kyber_gpu.sh
export LIBGL_ALWAYS_SOFTWARE=1
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
EOF
    fi
    chmod 644 /etc/profile.d/kyber_gpu.sh 2>/dev/null || true
    chown gamer:gamer "$KYBER_CONF"
fi

# 7. Configure secure authentication for Kyber controller
AUTH_USER="${AUTH_USER:-gamer}"
AUTH_PASSWORD="${AUTH_PASSWORD:-kybergaming}"
AUTH_HASH=$(echo -n "$AUTH_PASSWORD" | sha256sum | awk '{print $1}')

echo "[entrypoint] Configuring Kyber controller authentication for user: $AUTH_USER"
if [ -f "$KYBER_CONF" ]; then
    python3 -c "
conf_path = '$KYBER_CONF'
with open(conf_path, 'r') as f:
    lines = f.readlines()

new_lines = []
in_auth = False
for line in lines:
    if line.strip().startswith('[kycontroller.auth.basic]'):
        in_auth = True
        new_lines.append(line)
        new_lines.append('enabled = true\n\n')
        new_lines.append('[[kycontroller.auth.basic.logins]]\n')
        new_lines.append('username = \"$AUTH_USER\"\n')
        new_lines.append('password = \"$AUTH_HASH\"\n\n')
        continue
    if in_auth:
        if line.strip().startswith('[') and not line.strip().startswith('[[kycontroller.auth'):
            in_auth = False
            new_lines.append(line)
        continue
    new_lines.append(line)

with open(conf_path, 'w') as f:
    f.writelines(new_lines)
" || true
    chown gamer:gamer "$KYBER_CONF"
fi

# Make scripts executable
chmod +x /usr/local/bin/*.sh /usr/local/bin/*.py

echo "[entrypoint] Starting process supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
