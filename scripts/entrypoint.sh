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
        -days 3650 \
        -subj "/C=FR/ST=Cloud/L=Gaming/O=Kyber/CN=kyber.local" >/dev/null 2>&1
    chmod 644 "$TLS_DIR/cert.pem"
    chmod 600 "$TLS_DIR/key.pem"
    chown -R gamer:gamer "$TLS_DIR"
fi

# 5. Install NVIDIA Xorg GLX module matching the host driver (if NVIDIA Xorg driver is mounted)
if [ -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ]; then
    /usr/local/bin/install_nvidia_xorg.sh || echo "[entrypoint] WARNING: NVIDIA Xorg module installation failed."
fi

# 6. Dynamic GPU configuration for Kyber
KYBER_CONF="/etc/kyber/kyber_config.toml"
if [ -f "$KYBER_CONF" ]; then
    if [ -f /usr/lib/xorg/modules/drivers/nvidia_drv.so ]; then
        echo "[entrypoint] Native NVIDIA Xorg driver detected -> Configuring Kyber with nvenc + xcb."
        sed -i 's/^encoder = .*/encoder = "nvenc"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "xcb"/' "$KYBER_CONF"
    elif [ -e /proc/driver/nvidia/version ] || command -v nvidia-smi >/dev/null 2>&1; then
        echo "[entrypoint] NVIDIA GPU detected with virtual screen -> Configuring Kyber with nvenc + xcb."
        sed -i 's/^encoder = .*/encoder = "nvenc"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "xcb"/' "$KYBER_CONF"
    elif [ -e /dev/dri ]; then
        echo "[entrypoint] Non-NVIDIA GPU detected (/dev/dri) -> Configuring Kyber with vaapi + drm."
        sed -i 's/^encoder = .*/encoder = "vaapi"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "drm"/' "$KYBER_CONF"
    else
        echo "[entrypoint] No hardware GPU detected -> Fallback to software x264 + xcb."
        sed -i 's/^encoder = .*/encoder = "x264"/' "$KYBER_CONF"
        sed -i 's/^grab_backend = .*/grab_backend = "xcb"/' "$KYBER_CONF"
    fi
    chown gamer:gamer "$KYBER_CONF"
fi

# Make scripts executable
chmod +x /usr/local/bin/*.sh /usr/local/bin/*.py

echo "[entrypoint] Starting process supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
