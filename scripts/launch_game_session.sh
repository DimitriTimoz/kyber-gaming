#!/usr/bin/env bash
set -e

export PATH="/usr/games:/usr/local/games:/opt/Heroic:/opt/kyber/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export DISPLAY="${DISPLAY_NUM:-:0}"
export HOME="/home/gamer"
export XCURSOR_SIZE="${XCURSOR_SIZE:-24}"
export XCURSOR_THEME="${XCURSOR_THEME:-Adwaita}"

# Inherit GPU environment overrides configured during entrypoint hardware detection
if [ -f /etc/profile.d/kyber_gpu.sh ]; then
    . /etc/profile.d/kyber_gpu.sh
fi

echo "[session] Starting Kyber game session manager on DISPLAY $DISPLAY"

# Wait for X server
while ! xdpyinfo >/dev/null 2>&1; do
    echo "[session] Waiting for X server on $DISPLAY..."
    sleep 0.5
done

# Ensure canonical Openbox and theme configs are synced into persistent volume
if [ -d /etc/kyber/openbox ]; then
    mkdir -p "$HOME/.config/openbox"
    cp -f /etc/kyber/openbox/* "$HOME/.config/openbox/" 2>/dev/null || true
fi
if [ -d /usr/share/themes/KyberDark ]; then
    mkdir -p "$HOME/.themes"
    cp -rf /usr/share/themes/KyberDark "$HOME/.themes/" 2>/dev/null || true
fi

# Ensure Openbox loads latest rc.xml rules and mousebindings
openbox --reconfigure 2>/dev/null || true

# Set desktop background canvas
xsetroot -solid "#0c0f17" 2>/dev/null || true

get_screen_dims() {
    SCREEN_RES=$(xrandr --current 2>/dev/null | awk '/\*/ {print $1; exit}')
    SCREEN_W=$(echo "${SCREEN_RES:-1920x1080}" | cut -d'x' -f1)
    SCREEN_H=$(echo "${SCREEN_RES:-1920x1080}" | cut -d'x' -f2)
}

dismiss_loading_screen() {
    pkill -u gamer -f "kyber-hub-profile" 2>/dev/null || true
}

enforce_window_maximized() {
    local wid="$1"
    [ -n "$wid" ] || return 0
    get_screen_dims
    wmctrl -ir "$wid" -b remove,fullscreen 2>/dev/null || true
    wmctrl -ir "$wid" -e "0,0,0,${SCREEN_W},${SCREEN_H}" 2>/dev/null || true
    wmctrl -ir "$wid" -b add,maximized_vert,maximized_horz 2>/dev/null || true
    wmctrl -ia "$wid" 2>/dev/null || true
    xdotool windowactivate "$wid" 2>/dev/null || true
}

# Pre-bootstrap Steam if not yet initialized
STEAMDIR="$HOME/.steam/debian-installation"

clean_steam_locks() {
    rm -rf \
        "$STEAMDIR/config/htmlcache/Singleton"* \
        "$STEAMDIR/config/htmlcache/GPUCache" \
        "$HOME/.local/share/Steam/config/htmlcache/Singleton"* \
        "$HOME/.local/share/Steam/config/htmlcache/GPUCache" \
        "$STEAMDIR/.steam_exec_test.sh" \
        "$STEAMDIR/steam.pid" \
        /tmp/steam* 2>/dev/null || true

    # Pre-configure and normalize Steam library storage display (/games/steam)
    python3 - << 'PYEOF' 2>/dev/null || true
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

if [ ! -f "$STEAMDIR/steam.sh" ]; then
    echo "[session] Steam bootstrap not detected. Initializing headless bootstrap..."
    mkdir -p "$STEAMDIR/deb-installer" 2>/dev/null || true
    version="1.0.0.79"
    url="https://repo.steampowered.com/steam/archive/beta/steam_${version}.tar.gz"
    if curl -sSL "$url" -o "$STEAMDIR/deb-installer/steam_${version}.tar.gz" 2>/dev/null; then
        tar -C "$STEAMDIR/deb-installer" -zxf "$STEAMDIR/deb-installer/steam_${version}.tar.gz" steam-launcher/bootstraplinux_ubuntu12_32.tar.xz 2>/dev/null || true
        if [ -f "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz" ]; then
            tar -C "$STEAMDIR" -xf "$STEAMDIR/deb-installer/steam-launcher/bootstraplinux_ubuntu12_32.tar.xz" 2>/dev/null || true
            echo "$version" > "$STEAMDIR/deb-installer/version" 2>/dev/null || true
            echo "[session] Steam bootstrap installed successfully."
        fi
    else
        echo "[session] Warning: Could not download Steam bootstrap. Proceeding..."
    fi
fi

# Default to menu so users always see the Hub on connect
CURRENT_ACTION="${LAUNCHER:-menu}"

while true; do
    echo "[session] Current State: $CURRENT_ACTION"

    case "$CURRENT_ACTION" in
        steam)
            echo "[session] Starting Steam..."
            clean_steam_locks
            STEAM_CEF_FLAGS="${STEAM_CEF_OPTS:--no-cef-sandbox}"
            steam $STEAM_CEF_FLAGS >/dev/null 2>&1 &

            STEAM_WIN_SEEN=0
            STEAM_LOGIN_SEEN=0
            LOADING_DISMISSED=0
            NO_WIN_TICKS=0
            WAIT_TICKS=0

            # Background watcher: continuously strip _MOTIF_WM_HINTS from all Steam windows
            # so Openbox paints the titlebar with the red Close [X] button
            (
                while pgrep -u gamer -f "ubuntu12_32/steam|steam.sh" >/dev/null 2>&1; do
                    for wid in $(wmctrl -lx 2>/dev/null | grep -iE "steamwebhelper|steam\.steam" | awk '{print $1}'); do
                        if xprop -id "$wid" _MOTIF_WM_HINTS 2>/dev/null | grep -q "0x2"; then
                            xprop -id "$wid" -remove _MOTIF_WM_HINTS 2>/dev/null || true
                            openbox --reconfigure 2>/dev/null || true
                        fi
                    done
                    sleep 0.35
                done
            ) &
            DECOR_WATCHER_PID=$!

            # Monitor until Steam exits or its main window is closed via [X]
            while pgrep -u gamer -f "ubuntu12_32/steam|steam.sh" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "steam" ]; then
                        echo "[session] Action requested while Steam is running: $NEXT"
                        kill -9 "$DECOR_WATCHER_PID" 2>/dev/null || true
                        pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        sleep 0.3
                        pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi

                # Check for Steam Login window
                LOGIN_WID=$(wmctrl -l 2>/dev/null | grep -iE "Sign in to Steam|Se connecter|Steam Login" | awk '{print $1}' | head -n 1 || true)
                if [ -n "$LOGIN_WID" ]; then
                    STEAM_LOGIN_SEEN=1
                    STEAM_WIN_SEEN=1
                    # Ensure dummy background Steam window (USER_TIME=0) never covers the Sign-In dialog
                    for wid in $(wmctrl -lx 2>/dev/null | grep -i "steamwebhelper" | awk '{print $1}'); do
                        if [ "$wid" != "$LOGIN_WID" ]; then
                            UTIME=$(xprop -id "$wid" _NET_WM_USER_TIME 2>/dev/null | awk -F'= ' '{print $2}' | tr -d '[:space:]' || true)
                            if [ "$UTIME" = "0" ]; then
                                xdotool windowunmap "$wid" 2>/dev/null || true
                            fi
                        fi
                    done
                    if [ "$LOADING_DISMISSED" -eq 0 ]; then
                        dismiss_loading_screen
                        LOADING_DISMISSED=1
                    fi
                    wmctrl -ia "$LOGIN_WID" 2>/dev/null || true
                fi

                # Locate primary Steam window (titled 'Steam')
                MAIN_STEAM_WID=""
                MAIN_STEAM_VIEWABLE=0
                for wid in $(wmctrl -l 2>/dev/null | grep -E " Steam$" | awk '{print $1}'); do
                    if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                        MAIN_STEAM_WID="$wid"
                        MAIN_STEAM_VIEWABLE=1
                        STEAM_WIN_SEEN=1
                        break
                    fi
                done

                # Fallback to any viewable steam window that is not a popup/notification
                if [ -z "$MAIN_STEAM_WID" ] && [ "$STEAM_LOGIN_SEEN" -eq 0 ]; then
                    for wid in $(wmctrl -lx 2>/dev/null | grep -iE "steamwebhelper|steam\.steam" | grep -viE "special offers|notification|news" | awk '{print $1}'); do
                        if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                            MAIN_STEAM_WID="$wid"
                            MAIN_STEAM_VIEWABLE=1
                            STEAM_WIN_SEEN=1
                            break
                        fi
                    done
                fi

                if [ -n "$MAIN_STEAM_WID" ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                    enforce_window_maximized "$MAIN_STEAM_WID"
                    dismiss_loading_screen
                    LOADING_DISMISSED=1
                elif [ "$STEAM_WIN_SEEN" -eq 0 ] && [ "$WAIT_TICKS" -ge 60 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                    dismiss_loading_screen
                    LOADING_DISMISSED=1
                fi

                # Check if a game launched from Steam is running
                GAME_RUNNING=0
                if pgrep -u gamer -f "reaper|pressure-vessel" >/dev/null 2>&1; then
                    GAME_RUNNING=1
                fi

                # Detect when the main Steam window has been closed by the user
                if [ "$STEAM_WIN_SEEN" -eq 1 ] && [ "$GAME_RUNNING" -eq 0 ]; then
                    if [ "$MAIN_STEAM_VIEWABLE" -eq 0 ] && [ -z "$LOGIN_WID" ]; then
                        NO_WIN_TICKS=$((NO_WIN_TICKS + 1))
                        if [ "$NO_WIN_TICKS" -ge 2 ]; then
                            echo "[session] Steam main window closed by user. Terminating background Steam..."
                            kill -9 "$DECOR_WATCHER_PID" 2>/dev/null || true
                            pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                            sleep 0.3
                            pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                            break
                        fi
                    else
                        NO_WIN_TICKS=0
                    fi
                fi

                WAIT_TICKS=$((WAIT_TICKS + 1))
                sleep 0.35
            done

            kill -9 "$DECOR_WATCHER_PID" 2>/dev/null || true
            if [ "$CURRENT_ACTION" = "steam" ]; then
                echo "[session] Steam has closed. Returning to Launcher Hub..."
                dismiss_loading_screen
                CURRENT_ACTION="menu"
            fi
            ;;

        steam-bigpicture)
            echo "[session] Starting Steam Big Picture..."
            clean_steam_locks
            STEAM_BP_FLAGS="${STEAM_BP_OPTS:--no-cef-sandbox}"
            steam -bigpicture $STEAM_BP_FLAGS >/dev/null 2>&1 &
            STEAM_BP_SEEN=0
            LOADING_DISMISSED=0
            NO_WIN_TICKS=0
            WAIT_TICKS=0
            while pgrep -u gamer -f "ubuntu12_32/steam|steam.sh" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "steam-bigpicture" ]; then
                        echo "[session] Action requested: $NEXT"
                        pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        sleep 0.3
                        pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi

                # Locate the primary Big Picture window while ignoring dummy zero-time helper windows
                BP_WID=""
                for wid in $(wmctrl -l 2>/dev/null | grep -iE "big picture|steam" | awk '{print $1}'); do
                    if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                        UTIME=$(xprop -id "$wid" _NET_WM_USER_TIME 2>/dev/null | awk -F'= ' '{print $2}' | tr -d '[:space:]' || true)
                        if [ "$UTIME" != "0" ]; then
                            BP_WID="$wid"
                            break
                        fi
                    fi
                done

                # Fallback: scan any viewable steam window that has an active user time
                if [ -z "$BP_WID" ]; then
                    for wid in $(wmctrl -lx 2>/dev/null | grep -iE "steamwebhelper|steam" | awk '{print $1}'); do
                        if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                            UTIME=$(xprop -id "$wid" _NET_WM_USER_TIME 2>/dev/null | awk -F'= ' '{print $2}' | tr -d '[:space:]' || true)
                            if [ "$UTIME" != "0" ]; then
                                BP_WID="$wid"
                                break
                            fi
                        fi
                    done
                fi

                # Unmap dummy background Steam windows (USER_TIME=0) that can obstruct the view
                for wid in $(wmctrl -lx 2>/dev/null | grep -i "steamwebhelper" | awk '{print $1}'); do
                    if [ "$wid" != "$BP_WID" ]; then
                        UTIME=$(xprop -id "$wid" _NET_WM_USER_TIME 2>/dev/null | awk -F'= ' '{print $2}' | tr -d '[:space:]' || true)
                        if [ "$UTIME" = "0" ]; then
                            xdotool windowunmap "$wid" 2>/dev/null || true
                        fi
                    fi
                done

                VIEWABLE_BP=0
                if [ -n "$BP_WID" ]; then
                    if xwininfo -id "$BP_WID" 2>/dev/null | grep -q "Map State: IsViewable"; then
                        VIEWABLE_BP=1
                        STEAM_BP_SEEN=1
                    fi
                fi

                if [ -n "$BP_WID" ] && [ "$VIEWABLE_BP" -eq 1 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                    wmctrl -ir "$BP_WID" -b add,fullscreen 2>/dev/null || true
                    xdotool windowactivate "$BP_WID" 2>/dev/null || wmctrl -ia "$BP_WID" 2>/dev/null || true
                    dismiss_loading_screen
                    LOADING_DISMISSED=1
                elif [ "$STEAM_BP_SEEN" -eq 0 ] && [ "$WAIT_TICKS" -ge 60 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                    dismiss_loading_screen
                    LOADING_DISMISSED=1
                fi

                GAME_RUNNING=0
                if pgrep -u gamer -f "reaper|pressure-vessel" >/dev/null 2>&1; then
                    GAME_RUNNING=1
                fi

                if [ "$STEAM_BP_SEEN" -eq 1 ] && [ "$GAME_RUNNING" -eq 0 ]; then
                    if [ "$VIEWABLE_BP" -eq 0 ]; then
                        NO_WIN_TICKS=$((NO_WIN_TICKS + 1))
                        if [ "$NO_WIN_TICKS" -ge 2 ]; then
                            echo "[session] Steam Big Picture window closed. Returning to Hub..."
                            pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                            sleep 0.3
                            pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
                            break
                        fi
                    else
                        NO_WIN_TICKS=0
                    fi
                fi
                WAIT_TICKS=$((WAIT_TICKS + 1))
                sleep 0.35
            done
            if [ "$CURRENT_ACTION" = "steam-bigpicture" ]; then
                echo "[session] Steam Big Picture closed. Returning to Launcher Hub..."
                dismiss_loading_screen
                CURRENT_ACTION="menu"
            fi
            ;;

        heroic)
            echo "[session] Starting Heroic Games Launcher..."
            get_screen_dims
            # Configure Heroic to open at full display dimensions, set /games/heroic paths, and disable exitToTray
            SCREEN_W="$SCREEN_W" SCREEN_H="$SCREEN_H" GAMES_ROOT="${GAMES_ROOT:-/games}" python3 - << 'PYEOF' 2>/dev/null || true
import json, os, configparser

p = "/home/gamer/.config/heroic/config.json"
w = int(os.environ.get("SCREEN_W", "1920"))
h = int(os.environ.get("SCREEN_H", "1080"))
games_root = os.environ.get("GAMES_ROOT", "/games")
heroic_dir = f"{games_root}/heroic"
heroic_prefixes = f"{games_root}/heroic/prefixes"

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
data["windowBounds"] = {"x": 0, "y": 0, "width": w, "height": h, "maximized": True}

with open(p, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

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

            HEROIC_BIN="/opt/Heroic/heroic"
            [ -x "$HEROIC_BIN" ] || HEROIC_BIN="$(command -v heroic || echo /usr/bin/heroic)"
            "$HEROIC_BIN" --no-sandbox >/dev/null 2>&1 &
            HEROIC_WIN_SEEN=0
            LOADING_DISMISSED=0
            WAIT_TICKS=0
            while pgrep -u gamer -f "heroic" >/dev/null 2>&1; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "heroic" ]; then
                        echo "[session] Action requested: $NEXT"
                        pkill -TERM -u gamer -f "heroic" 2>/dev/null || true
                        sleep 0.2
                        pkill -9 -u gamer -f "heroic" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi

                HEROIC_WID=""
                for wid in $(wmctrl -lx 2>/dev/null | grep -i "heroic" | awk '{print $1}'); do
                    if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                        HEROIC_WID="$wid"
                        break
                    fi
                done

                if [ -n "$HEROIC_WID" ]; then
                    if [ "$HEROIC_WIN_SEEN" -eq 0 ]; then
                        HEROIC_WIN_SEEN=1
                        enforce_window_maximized "$HEROIC_WID"
                        dismiss_loading_screen
                        LOADING_DISMISSED=1
                        sleep 0.3
                        enforce_window_maximized "$HEROIC_WID"
                    fi
                    sleep 1
                elif [ "$HEROIC_WIN_SEEN" -eq 1 ]; then
                    echo "[session] Heroic window closed via [X]. Terminating background helpers..."
                    pkill -TERM -u gamer -f "heroic" 2>/dev/null || true
                    sleep 0.2
                    pkill -9 -u gamer -f "heroic" 2>/dev/null || true
                    break
                else
                    WAIT_TICKS=$((WAIT_TICKS + 1))
                    if [ "$WAIT_TICKS" -ge 60 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                        dismiss_loading_screen
                        LOADING_DISMISSED=1
                    fi
                    sleep 0.25
                fi
            done
            if [ "$CURRENT_ACTION" = "heroic" ]; then
                echo "[session] Heroic has closed. Returning to Launcher Hub..."
                dismiss_loading_screen
                CURRENT_ACTION="menu"
            fi
            ;;

        restart-steam)
            echo "[session] Restarting Steam cleanly..."
            pkill -TERM -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
            sleep 0.5
            pkill -9 -u gamer -f "steamwebhelper|ubuntu12_32/steam|steam.sh" 2>/dev/null || true
            sleep 1
            rm -f "$STEAMDIR/config/htmlcache/Singleton"* 2>/dev/null || true
            CURRENT_ACTION="steam"
            ;;

        browser|chrome|google-chrome)
            echo "[session] Starting Web Browser (Google Chrome)..."
            get_screen_dims
            # Ensure Chrome uses native system titlebar with functional close button
            python3 -c '
import json, os
p = "/home/gamer/.config/google-chrome/Default/Preferences"
os.makedirs(os.path.dirname(p), exist_ok=True)
data = {}
if os.path.exists(p):
    try: data = json.load(open(p))
    except Exception: pass
data.setdefault("browser", {})["custom_chrome_frame"] = False
try: json.dump(data, open(p, "w"))
except Exception: pass
' 2>/dev/null || true

            google-chrome \
                --no-sandbox \
                --no-first-run \
                --no-default-browser-check \
                --disable-gpu-sandbox \
                --test-type \
                --disable-infobars \
                --start-maximized \
                --window-position=0,0 \
                --window-size="${SCREEN_W},${SCREEN_H}" \
                --disable-features=Translate \
                --lang=en-US >/dev/null 2>&1 &

            BROWSER_WIN_SEEN=0
            LOADING_DISMISSED=0
            WAIT_TICKS=0
            while true; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "browser" ] && [ "$NEXT" != "chrome" ] && [ "$NEXT" != "google-chrome" ]; then
                        echo "[session] Action requested while browser running: $NEXT"
                        for p in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
                            if [ -r "/proc/$p/cmdline" ]; then
                                if tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                                    kill -9 "$p" 2>/dev/null || true
                                fi
                            fi
                        done
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi

                # Check if non-hub Chrome is running
                BROWSER_RUNNING=0
                for p in $(pgrep -u gamer -f "chrome" 2>/dev/null); do
                    if [ -r "/proc/$p/cmdline" ]; then
                        if tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null | grep -v "kyber-hub-profile" | grep -q "chrome"; then
                            BROWSER_RUNNING=1
                            break
                        fi
                    fi
                done

                if [ "$BROWSER_RUNNING" -eq 0 ] && [ "$WAIT_TICKS" -ge 8 ]; then
                    echo "[session] Browser closed. Returning to Console Hub..."
                    dismiss_loading_screen
                    CURRENT_ACTION="menu"
                    break
                fi

                BROWSER_WID=$(wmctrl -lx 2>/dev/null | grep -i "google-chrome" | grep -vi "kyberhub" | awk '{print $1}' | head -n 1 || true)
                if [ -n "$BROWSER_WID" ]; then
                    if [ "$BROWSER_WIN_SEEN" -eq 0 ]; then
                        BROWSER_WIN_SEEN=1
                        enforce_window_maximized "$BROWSER_WID"
                        dismiss_loading_screen
                        LOADING_DISMISSED=1
                    fi
                    sleep 1
                else
                    WAIT_TICKS=$((WAIT_TICKS + 1))
                    if [ "$WAIT_TICKS" -ge 30 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                        dismiss_loading_screen
                        LOADING_DISMISSED=1
                    fi
                    sleep 0.25
                fi
            done
            ;;

        desktop)
            echo "[session] Entering Libre Desktop Mode (tint2 + pcmanfm)..."
            dismiss_loading_screen
            xsetroot -solid "#0b0f19" 2>/dev/null || true
            pgrep -u gamer -x "tint2" >/dev/null 2>&1 || (tint2 >/dev/null 2>&1 &)
            pgrep -u gamer -f "pcmanfm --desktop" >/dev/null 2>&1 || (pcmanfm --desktop >/dev/null 2>&1 &)

            while true; do
                if [ -s /tmp/kyber_next_action ]; then
                    NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                    rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                    if [ -n "$NEXT" ] && [ "$NEXT" != "desktop" ]; then
                        echo "[session] Action switch requested from desktop: $NEXT"
                        pkill -u gamer -x "tint2" 2>/dev/null || true
                        pkill -u gamer -f "pcmanfm --desktop" 2>/dev/null || true
                        CURRENT_ACTION="$NEXT"
                        break
                    fi
                fi
                sleep 0.5
            done
            ;;

        menu)
            echo "[session] Presenting Fullscreen Console Kiosk Hub..."
            # Clean any desktop panels during fullscreen kiosk
            pkill -u gamer -x "tint2" 2>/dev/null || true
            RAW_CHOICE=$(bash /usr/local/bin/kyber_console_hub.sh || echo "menu")
            CHOICE=$(echo "$RAW_CHOICE" | tail -n 1 | tr -d '[:space:]')
            echo "[session] Console Hub selection: '$CHOICE'"
            if [ -z "$CHOICE" ] || [ "$CHOICE" = "menu" ]; then
                CURRENT_ACTION="menu"
            else
                CURRENT_ACTION="$CHOICE"
            fi
            ;;

        *)
            LAUNCHED_ACTION="$CURRENT_ACTION"
            echo "[session] Executing target launcher or emulator: $LAUNCHED_ACTION..."
            EXEC_CMD=""
            if command -v "$CURRENT_ACTION" >/dev/null 2>&1; then
                EXEC_CMD="$CURRENT_ACTION"
            elif [ -x "/usr/games/$CURRENT_ACTION" ]; then
                EXEC_CMD="/usr/games/$CURRENT_ACTION"
            elif [ -x "/usr/local/bin/$CURRENT_ACTION" ]; then
                EXEC_CMD="/usr/local/bin/$CURRENT_ACTION"
            fi

            if [ -n "$EXEC_CMD" ]; then
                echo "[session] Launching '$EXEC_CMD'..."
                setsid $EXEC_CMD >/dev/null 2>&1 &
                APP_PID=$!
                APP_WIN_SEEN=0
                LOADING_DISMISSED=0
                WAIT_TICKS=0

                # Watchdog loop: monitors process and window state
                while true; do
                    # Handle user requested switch (including Cancel during loading)
                    if [ -s /tmp/kyber_next_action ]; then
                        NEXT=$(cat /tmp/kyber_next_action | tr -d '[:space:]')
                        rm -f /tmp/kyber_next_action 2>/dev/null || : > /tmp/kyber_next_action 2>/dev/null || true
                        if [ -n "$NEXT" ] && [ "$NEXT" != "$CURRENT_ACTION" ]; then
                            echo "[session] Action switch requested: $NEXT"
                            kill -TERM "$APP_PID" 2>/dev/null || true
                            if [ "$CURRENT_ACTION" = "eglantine" ]; then
                                pkill -TERM -u gamer -f "eglantine|eden|ryujinx" 2>/dev/null || true
                            else
                                pkill -TERM -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                            fi
                            sleep 0.3
                            kill -9 "$APP_PID" 2>/dev/null || true
                            if [ "$CURRENT_ACTION" = "eglantine" ]; then
                                pkill -9 -u gamer -f "eglantine|eden|ryujinx" 2>/dev/null || true
                            else
                                pkill -9 -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                            fi
                            CURRENT_ACTION="$NEXT"
                            break
                        fi
                    fi

                    IS_ALIVE=0
                    if kill -0 "$APP_PID" 2>/dev/null; then
                        IS_ALIVE=1
                    elif [ "$CURRENT_ACTION" = "eglantine" ] && pgrep -u gamer -f "eglantine|eden|ryujinx" >/dev/null 2>&1; then
                        IS_ALIVE=1
                    elif pgrep -u gamer -f "$CURRENT_ACTION" >/dev/null 2>&1; then
                        IS_ALIVE=1
                    fi

                    if [ "$IS_ALIVE" -eq 0 ] && [ "$WAIT_TICKS" -ge 4 ]; then
                        echo "[session] Process $CURRENT_ACTION has exited or terminated. Cleaning up..."
                        break
                    fi

                    APP_WID=""
                    MATCH_QUERY="$CURRENT_ACTION"
                    if [ "$CURRENT_ACTION" = "eglantine" ]; then
                        MATCH_QUERY="eglantine|eden|ryujinx"
                    fi
                    for wid in $(wmctrl -lx 2>/dev/null | grep -iE "$MATCH_QUERY" | awk '{print $1}'); do
                        if xwininfo -id "$wid" 2>/dev/null | grep -q "Map State: IsViewable"; then
                            APP_WID="$wid"
                            break
                        fi
                    done

                    if [ -n "$APP_WID" ]; then
                        if [ "$APP_WIN_SEEN" -eq 0 ]; then
                            APP_WIN_SEEN=1
                            enforce_window_maximized "$APP_WID"
                            dismiss_loading_screen
                            LOADING_DISMISSED=1
                            sleep 0.25
                            enforce_window_maximized "$APP_WID"
                        fi
                        sleep 1
                    elif [ "$APP_WIN_SEEN" -eq 1 ]; then
                        echo "[session] Window for $CURRENT_ACTION closed via [X]. Cleaning up process..."
                        kill -TERM "$APP_PID" 2>/dev/null || true
                        pkill -TERM -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                        sleep 0.3
                        kill -9 "$APP_PID" 2>/dev/null || true
                        pkill -9 -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                        break
                    else
                        WAIT_TICKS=$((WAIT_TICKS + 1))
                        if [ "$WAIT_TICKS" -ge 48 ] && [ "$LOADING_DISMISSED" -eq 0 ]; then
                            dismiss_loading_screen
                            LOADING_DISMISSED=1
                        fi
                        sleep 0.25
                    fi
                done

                # Ensure any zombie child processes are cleaned up
                pkill -9 -u gamer -f "$CURRENT_ACTION" 2>/dev/null || true
                xsetroot -solid "#0c0f17" 2>/dev/null || true

                if [ "$CURRENT_ACTION" = "$LAUNCHED_ACTION" ]; then
                    echo "[session] Returning cleanly to Console Hub..."
                    dismiss_loading_screen
                    CURRENT_ACTION="menu"
                fi
            else
                echo "[session] Target '$CURRENT_ACTION' is not installed or not executable in PATH."
                dismiss_loading_screen
                sleep 1
                CURRENT_ACTION="menu"
            fi
            ;;
    esac
    sleep 0.5
done
