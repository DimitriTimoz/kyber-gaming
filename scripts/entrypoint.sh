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

# Setup unified games storage volume (/games)
GAMES_ROOT="${GAMES_DIR:-/games}"
mkdir -p \
    "$GAMES_ROOT/steam/steamapps" \
    "$GAMES_ROOT/heroic/prefixes" \
    "$GAMES_ROOT/retroarch/cores" \
    "$GAMES_ROOT/retroarch/system" \
    "$GAMES_ROOT/retroarch/saves" \
    "$GAMES_ROOT/retroarch/states" \
    "$GAMES_ROOT/retroarch/config" \
    "$GAMES_ROOT/retroarch/playlists" \
    "$GAMES_ROOT/retroarch/thumbnails" \
    "$GAMES_ROOT/roms/eglantine/games" \
    "$GAMES_ROOT/roms/eglantine/updates" \
    "$GAMES_ROOT/roms/eglantine/dlc" \
    "$GAMES_ROOT/roms/eglantine/keys" \
    "$GAMES_ROOT/roms/eglantine/firmware" \
    "$GAMES_ROOT/roms/eglantine/mods" \
    "$GAMES_ROOT/roms/ps1" \
    "$GAMES_ROOT/roms/ps2" \
    "$GAMES_ROOT/roms/n64" \
    "$GAMES_ROOT/roms/snes" \
    "$GAMES_ROOT/roms/nes" \
    "$GAMES_ROOT/roms/gba" \
    "$GAMES_ROOT/roms/megadrive" \
    "$GAMES_ROOT/roms/arcade" \
    "$GAMES_ROOT/roms/saves" \
    "$GAMES_ROOT/bios" \
    "$GAMES_ROOT/saves"

# Auto-migrate existing ROMs/BIOS/Steam files from legacy /home/gamer volume into /games
if [ -d /home/gamer/roms ] && [ ! -L /home/gamer/roms ]; then
    echo "[entrypoint] Migrating existing ROMs to $GAMES_ROOT/roms..."
    cp -rn /home/gamer/roms/* "$GAMES_ROOT/roms/" 2>/dev/null || true
    rm -rf /home/gamer/roms
fi
ln -sfn "$GAMES_ROOT/roms" /home/gamer/roms

if [ -d /home/gamer/bios ] && [ ! -L /home/gamer/bios ]; then
    echo "[entrypoint] Migrating existing BIOS to $GAMES_ROOT/bios..."
    cp -rn /home/gamer/bios/* "$GAMES_ROOT/bios/" 2>/dev/null || true
    rm -rf /home/gamer/bios
fi
ln -sfn "$GAMES_ROOT/bios" /home/gamer/bios

if [ -d /home/gamer/saves ] && [ ! -L /home/gamer/saves ]; then
    echo "[entrypoint] Migrating existing saves to $GAMES_ROOT/saves..."
    cp -rn /home/gamer/saves/* "$GAMES_ROOT/saves/" 2>/dev/null || true
    rm -rf /home/gamer/saves
fi
ln -sfn "$GAMES_ROOT/saves" /home/gamer/saves

# Decouple Steam library: point steamapps directly into /games/steam/steamapps
mkdir -p /home/gamer/.local/share/Steam /home/gamer/.steam/debian-installation
if [ -d /home/gamer/.local/share/Steam/steamapps ] && [ ! -L /home/gamer/.local/share/Steam/steamapps ]; then
    echo "[entrypoint] Migrating existing Steam games to $GAMES_ROOT/steam/steamapps..."
    cp -rn /home/gamer/.local/share/Steam/steamapps/* "$GAMES_ROOT/steam/steamapps/" 2>/dev/null || true
    rm -rf /home/gamer/.local/share/Steam/steamapps
fi
ln -sfn "$GAMES_ROOT/steam/steamapps" /home/gamer/.local/share/Steam/steamapps
ln -sfn "$GAMES_ROOT/steam/steamapps" /home/gamer/.steam/debian-installation/steamapps
ln -sfn "$GAMES_ROOT" /home/gamer/Games

# Pre-configure and normalize Steam library storage display
configure_steam_library() {
    python3 - << 'PYEOF'
import os
import re

games_root = os.environ.get("GAMES_ROOT", "/games")
target_label = f"{games_root}/steam"

vdf_template = f'''"libraryfolders"
{{
\t"0"
\t{{
\t\t"path"\t\t"/home/gamer/.local/share/Steam"
\t\t"label"\t\t"{target_label}"
\t}}
}}
'''

steam_dirs = [
    "/home/gamer/.local/share/Steam/config",
    "/home/gamer/.steam/debian-installation/config",
    f"{games_root}/steam/steamapps",
    "/home/gamer/.local/share/Steam/steamapps",
    "/home/gamer/.steam/debian-installation/steamapps",
]

for sdir in steam_dirs:
    try:
        os.makedirs(sdir, exist_ok=True)
        vdf_path = os.path.join(sdir, "libraryfolders.vdf")
        if not os.path.exists(vdf_path) or os.path.getsize(vdf_path) == 0:
            with open(vdf_path, "w", encoding="utf-8") as f:
                f.write(vdf_template)
        else:
            with open(vdf_path, "r", encoding="utf-8") as f:
                content = f.read()
            updated = re.sub(r'("label"\s+)"(?:|.*nvidia.*|/)"', rf'\1"{target_label}"', content)
            if '"label"' not in updated and '"0"' in updated:
                updated = re.sub(r'("0"\s*\{[^}]*?"path"\s+"[^"]+")', rf'\1\n\t\t"label"\t\t"{target_label}"', updated)
            if updated != content:
                with open(vdf_path, "w", encoding="utf-8") as f:
                    f.write(updated)
    except Exception:
        pass

# Ensure registry.vdf disables GPU accelerated rendering in web views (prevents Big Picture black screen)
reg_dirs = [
    "/home/gamer/.steam",
    "/home/gamer/.steam/steam",
    "/home/gamer/.steam/debian-installation",
    "/home/gamer/.local/share/Steam",
]
for rdir in reg_dirs:
    try:
        rpath = os.path.join(rdir, "registry.vdf")
        if os.path.exists(rpath):
            with open(rpath, "r", encoding="utf-8") as f:
                rcontent = f.read()
            rupdated = re.sub(r'("GPUAccelWebViews"\s+)"[01]"', r'\1"0"', rcontent)
            rupdated = re.sub(r'("GPUAccelWebViewsV3"\s+)"[01]"', r'\1"0"', rupdated)
            if '"GPUAccelWebViews"' not in rupdated and '"Steam"' in rupdated:
                rupdated = re.sub(
                    r'("Steam"\s*\{)',
                    r'\1\n\t\t\t\t\t"GPUAccelWebViews"\t\t"0"\n\t\t\t\t\t"GPUAccelWebViewsV3"\t\t"0"',
                    rupdated
                )
            if rupdated != rcontent:
                with open(rpath, "w", encoding="utf-8") as f:
                    f.write(rupdated)
    except Exception:
        pass
PYEOF
}
configure_steam_library

# Self-healing Steam lock and cache cleaner
clean_steam_locks() {
    rm -rf \
        /home/gamer/.local/share/Steam/config/htmlcache/Singleton* \
        /home/gamer/.local/share/Steam/config/htmlcache/GPUCache \
        /home/gamer/.steam/debian-installation/config/htmlcache/Singleton* \
        /home/gamer/.steam/debian-installation/config/htmlcache/GPUCache \
        /home/gamer/.steam/steam/config/htmlcache/Singleton* \
        /home/gamer/.steam/steam/config/htmlcache/GPUCache \
        /home/gamer/.steam/debian-installation/.steam_exec_test.sh \
        /home/gamer/.steam/debian-installation/steam.pid \
        /tmp/steam* \
        /tmp/.X11-unix/X0-lock \
        /tmp/.X0-lock 2>/dev/null || true
}
clean_steam_locks

# Setup unified Heroic Games Launcher directories and configuration (/games/heroic)
mkdir -p "$GAMES_ROOT/heroic/prefixes" "$GAMES_ROOT/heroic/tools"
ln -sfn "$GAMES_ROOT/heroic" "$GAMES_ROOT/Heroic"
mkdir -p /home/gamer/.config/heroic /home/gamer/.config/legendary
ln -sfn "$GAMES_ROOT/heroic/tools" /home/gamer/.config/heroic/tools 2>/dev/null || true
mkdir -p /home/gamer/Games
ln -sfn "$GAMES_ROOT/heroic" /home/gamer/Games/Heroic 2>/dev/null || true
ln -sfn "$GAMES_ROOT/heroic" /home/gamer/Games/heroic 2>/dev/null || true

python3 - << 'PYEOF' 2>/dev/null || true
import json, os, configparser

games_root = os.environ.get("GAMES_ROOT", "/games")
heroic_dir = f"{games_root}/heroic"
heroic_prefixes = f"{games_root}/heroic/prefixes"

# 1. Configure Heroic GUI config.json
p = "/home/gamer/.config/heroic/config.json"
os.makedirs(os.path.dirname(p), exist_ok=True)
data = {}
if os.path.exists(p):
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        pass

data["defaultInstallPath"] = heroic_dir
data["winePrefix"] = heroic_prefixes
ds = data.setdefault("defaultSettings", {})
ds["defaultInstallPath"] = heroic_dir
ds["defaultWinePrefix"] = heroic_prefixes
ds["winePrefix"] = heroic_prefixes
ds["exitToTray"] = False
ds["startInTray"] = False
data["exitToTray"] = False

with open(p, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

# 2. Configure Legendary CLI config.ini
leg_p = "/home/gamer/.config/legendary/config.ini"
os.makedirs(os.path.dirname(leg_p), exist_ok=True)
cfg = configparser.ConfigParser()
if os.path.exists(leg_p):
    try:
        cfg.read(leg_p)
    except Exception:
        pass
if not cfg.has_section("Legendary"):
    cfg.add_section("Legendary")
cfg.set("Legendary", "install_dir", heroic_dir)
with open(leg_p, "w", encoding="utf-8") as f:
    cfg.write(f)
PYEOF

# Compatibility symlink for AppImages or emulators referencing /home/user
if [ ! -e /home/user ]; then
    ln -s /home/gamer /home/user 2>/dev/null || true
fi

# Backwards compatibility symlink: roms/switch -> roms/eglantine/games
if [ ! -e "$GAMES_ROOT/roms/switch" ]; then
    ln -s "$GAMES_ROOT/roms/eglantine/games" "$GAMES_ROOT/roms/switch" 2>/dev/null || true
fi

# Auto-link any uploaded Switch keys from eglantine/keys or bios to Eglantine/Eden keys directory
mkdir -p /home/gamer/.local/share/eglantine/keys /home/gamer/.local/share/eden/keys /home/gamer/.config/eden
for keydir in "$GAMES_ROOT/roms/eglantine/keys" "$GAMES_ROOT/bios"; do
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
Paths\gamedirs\1\path=/games/roms/eglantine/games
Paths\gamedirs\1\deep_scan=true
Paths\gamedirs\1\expanded=true
Paths\gamedirs\2\path=/games/roms/switch
Paths\gamedirs\2\deep_scan=true
Paths\gamedirs\2\expanded=true
EOF
fi

# Setup persistent RetroArch environment & config
mkdir -p "$GAMES_ROOT/retroarch/config" "$GAMES_ROOT/retroarch/system" "$GAMES_ROOT/retroarch/saves" "$GAMES_ROOT/retroarch/states" "$GAMES_ROOT/retroarch/cores"
mkdir -p /home/gamer/.config

if [ -d /home/gamer/.config/retroarch ] && [ ! -L /home/gamer/.config/retroarch ]; then
    cp -rn /home/gamer/.config/retroarch/* "$GAMES_ROOT/retroarch/config/" 2>/dev/null || true
    rm -rf /home/gamer/.config/retroarch
fi
ln -sfn "$GAMES_ROOT/retroarch/config" /home/gamer/.config/retroarch

RETROARCH_CFG="$GAMES_ROOT/retroarch/config/retroarch.cfg"
if [ ! -f "$RETROARCH_CFG" ]; then
    cat << 'EOF' > "$RETROARCH_CFG"
video_fullscreen = "true"
video_windowed_fullscreen = "true"
video_driver = "vulkan"
audio_driver = "pulse"
menu_driver = "ozone"
rgui_browser_directory = "/games/roms"
content_directory = "/games/roms"
libretro_directory = "/games/retroarch/cores"
libretro_info_path = "/usr/share/libretro/info"
system_directory = "/games/retroarch/system"
savefile_directory = "/games/retroarch/saves"
savestate_directory = "/games/retroarch/states"
playlist_directory = "/games/retroarch/playlists"
thumbnails_directory = "/games/retroarch/thumbnails"
input_menu_toggle_gamepad_combo = "2"
input_enable_hotkey_btn = "8"
input_exit_emulator_btn = "9"
quit_press_twice = "false"
pause_nonactive = "false"
video_vsync = "true"
video_max_swapchain_images = "3"
EOF
    chown -R gamer:gamer "$RETROARCH_CFG" 2>/dev/null || true
fi

if [ -d "$GAMES_ROOT/bios" ]; then
    for bf in "$GAMES_ROOT/bios"/*; do
        if [ -f "$bf" ]; then
            ln -sf "$bf" "$GAMES_ROOT/retroarch/system/$(basename "$bf")" 2>/dev/null || true
        fi
    done
fi

# System configuration version sync: automatically update Openbox/Tint2 configs on image upgrade
IMAGE_VER=$(cat /etc/kyber/version 2>/dev/null || echo "1.0.3")
USER_VER=$(cat /home/gamer/.config/kyber_version 2>/dev/null || echo "0.0.0")

mkdir -p /home/gamer/.config/openbox /home/gamer/.config/tint2 /home/gamer/.themes /home/gamer/.local/share/applications

if [ "$IMAGE_VER" != "$USER_VER" ] || [ ! -f /home/gamer/.config/openbox/rc.xml ]; then
    echo "[entrypoint] Synchronizing container system configs (v$IMAGE_VER)..."
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
    echo "$IMAGE_VER" > /home/gamer/.config/kyber_version
fi

chown -R gamer:gamer "$GAMES_ROOT" /home/gamer/roms /home/gamer/bios /home/gamer/saves /home/gamer/.local /home/gamer/.config /home/gamer/.themes /home/gamer/.steam /home/gamer/.cache 2>/dev/null || true

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
    AUTH_USER="$AUTH_USER" AUTH_HASH="$AUTH_HASH" KYBER_CONF="$KYBER_CONF" python3 - << 'PYEOF'
import os

conf_path = os.environ.get("KYBER_CONF")
auth_user = os.environ.get("AUTH_USER", "gamer")
auth_hash = os.environ.get("AUTH_HASH", "")

if conf_path and os.path.exists(conf_path):
    with open(conf_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    in_auth = False
    for line in lines:
        if line.strip().startswith("[kycontroller.auth.basic]"):
            in_auth = True
            new_lines.append(line)
            new_lines.append("enabled = true\n\n")
            new_lines.append("[[kycontroller.auth.basic.logins]]\n")
            new_lines.append(f"username = \"{auth_user}\"\n")
            new_lines.append(f"password = \"{auth_hash}\"\n\n")
            continue
        if in_auth:
            if line.strip().startswith("[") and not line.strip().startswith("[[kycontroller.auth"):
                in_auth = False
                new_lines.append(line)
            continue
        new_lines.append(line)

    with open(conf_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
PYEOF
    chown gamer:gamer "$KYBER_CONF"
fi

# Make scripts executable
chmod +x /usr/local/bin/*.sh /usr/local/bin/*.py

echo "[entrypoint] Starting process supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
