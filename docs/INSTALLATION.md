# Kyber Gaming - Complete Installation & Deployment Guide

This guide provides end-to-end instructions for deploying the headless Kyber Gaming server on Linux hosts (with NVIDIA, AMD, Intel, or virtual GPUs), setting up remote connectivity via LAN, Tailscale, or public domain, managing ROM libraries, and connecting through the native Desktop Client or WebClient.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Host Requirements](#2-prerequisites--host-requirements)
3. [Server Installation](#3-server-installation)
   - [Method A: Docker Compose with Prebuilt Image (Recommended)](#method-a-docker-compose-with-prebuilt-image-recommended)
   - [Method B: Building the Docker Image from Source](#method-b-building-the-docker-image-from-source)
4. [GPU Configuration](#4-gpu-configuration)
   - [NVIDIA GeForce / RTX / Quadro / Tesla](#nvidia-geforce--rtx--quadro--tesla)
   - [AMD Radeon & APUs](#amd-radeon--apus)
   - [Intel Arc & Iris Xe](#intel-arc--iris-xe)
   - [CPU / Virtual Dummy Display Fallback](#cpu--virtual-dummy-display-fallback)
5. [Storage, ROMs, Keys & Firmware Setup](#5-storage-roms-keys--firmware-setup)
   - [Directory Structure](#directory-structure)
   - [Uploading Games, Updates, and DLC](#uploading-games-updates-and-dlc)
   - [Archive Extraction (.zip, .7z, .rar)](#archive-extraction-zip-7z-rar)
   - [Switch Keys & Firmware Automated Placement](#switch-keys--firmware-automated-placement)
6. [Network Configuration & Remote Access](#6-network-configuration--remote-access)
   - [Local Area Network (LAN)](#local-area-network-lan)
   - [Tailscale Private Mesh (Zero Port-Forwarding)](#tailscale-private-mesh-zero-port-forwarding)
   - [Production HTTPS & HTTP/3 via Caddy](#production-https--http3-via-caddy)
7. [Client Installation & Connection](#7-client-installation--connection)
   - [Desktop Client (macOS, Windows, Linux)](#desktop-client-macos-windows-linux)
   - [Web Browser Client (Zero Install)](#web-browser-client-zero-install)
8. [Troubleshooting & Maintenance](#8-troubleshooting--maintenance)

---

## 1. Architecture Overview

Kyber Gaming operates as a containerized stack designed for low-latency game streaming:

- **Headless Host Server (`kyber-gaming`):**
  - Simulated X11 virtual display with dynamic EDID generation.
  - Kyber streaming daemon (`port 8080 TCP/UDP`): QUIC / WebTransport protocol.
  - Kyber Control Service (`port 8081 TCP`): REST API for dynamic resolution resizing, system telemetry, launcher switching, and hierarchical ROM management.
  - Gaming Environment: Steam (Desktop and Big Picture), Heroic Games Launcher (Epic Games & GOG), Eglantine (Nintendo Switch / NX2 emulator with Vulkan), Google Chrome, Openbox window manager, and PipeWire virtual audio.
- **Client Layer:**
  - **Desktop Client:** Tauri v2 native app (macOS, Windows, Linux) with hardware display resolution detection, latency ping telemetry, in-app streaming player, and full ROM manager.
  - **Web Client:** Direct browser streaming over WebRTC / WebTransport via `https://<server-ip>:8080/webclient/`.

---

## 2. Prerequisites & Host Requirements

### Host Operating System
- Any modern 64-bit Linux distribution:
  - Ubuntu 22.04 LTS / 24.04 LTS
  - Debian 12 (Bookworm)
  - Arch Linux
  - Fedora 39+

### Software Dependencies
- **Docker Engine** (version 24.0 or newer)
- **Docker Compose** (Compose v2: `docker compose`)
- For NVIDIA hosts: **NVIDIA Container Toolkit** (`nvidia-container-toolkit`)

### Required Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 8080 | TCP / UDP | Kyber WebTransport & WebRTC game stream, WebClient |
| 8081 | TCP | Control Service, Dynamic Screen Resizer, ROM Explorer REST API |
| 443  | TCP / UDP | (Optional) Caddy Reverse Proxy for public HTTPS / HTTP/3 |
| 80   | TCP | (Optional) Caddy HTTP-to-HTTPS redirect & ACME challenges |

---

## 3. Server Installation

### Method A: Docker Compose with Prebuilt Image (Recommended)

1. Clone the repository on your server:
```bash
git clone https://github.com/DimitriTimoz/kyber-gaming.git
cd kyber-gaming
```

2. Review or customize `docker-compose.yml`:
```yaml
services:
  kyber-gaming:
    image: ghcr.io/dimitritimoz/kyber-gaming:latest
    container_name: kyber-gaming
    restart: unless-stopped
    network_mode: host
    privileged: true
    environment:
      - RESOLUTION=1920x1080
      - REFRESH_RATE=60
      - LAUNCHER=menu
      - AUTH_USER=gamer
      - AUTH_PASSWORD=kybergaming
    volumes:
      # Main persistent user data (Steam, Heroic, emulators, configs, saves, ROMs)
      - gamer_home:/home/gamer
      # Optional: Bind-mount your existing host or NAS directories:
      # - /mnt/storage/games/roms:/home/gamer/roms
    devices:
      - /dev/uinput:/dev/uinput
      - /dev/input:/dev/input

volumes:
  gamer_home:
```

3. Start the container in detached mode:
```bash
docker compose up -d
```

4. Verify the startup logs:
```bash
docker compose logs -f
```

---

### Method B: Building the Docker Image from Source

If you want to build the container locally from the Dockerfile:

1. Build the image:
```bash
docker compose build --no-cache
```

2. Start the service:
```bash
docker compose up -d
```

---

## 4. GPU Configuration

Kyber Gaming automatically detects the GPU hardware on startup and configures Xorg and Vulkan drivers accordingly.

### NVIDIA GeForce / RTX / Quadro / Tesla

1. **Install NVIDIA Drivers on the Host:**
   Ensure proprietary NVIDIA drivers are installed on the host (e.g. `nvidia-driver-550` or newer):
   ```bash
   nvidia-smi
   ```

2. **Install NVIDIA Container Toolkit:**
   On Debian/Ubuntu:
   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt-get update
   sudo apt-get install -y nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

3. **Host Driver Auto-Sync:**
   The container features self-healing driver synchronization. If your host kernel updates its NVIDIA driver, the container detects the version mismatch on boot, downloads matching userspace libraries (both 64-bit and 32-bit for Wine/Steam), and links them without requiring a container rebuild.

### AMD Radeon & APUs

AMD GPUs use the open-source Mesa stack and Linux Direct Rendering Infrastructure (DRI):

1. Verify DRI permissions on the host:
   ```bash
   ls -la /dev/dri
   ```
2. Ensure the container has access to `/dev/dri` (handled automatically when `privileged: true` is enabled).
3. The container automatically selects `xorg.modesetting.conf` with Glamor 2D/3D acceleration, Mesa RADV Vulkan (`AMD_VULKAN_ICD=RADV`), and VA-API video capture.

### Intel Arc & Iris Xe

Intel GPUs are recognized through DRI vendor ID `0x8086`. Hardware encoding uses Intel VA-API / QSV via `/dev/dri/renderD128`.

### CPU / Virtual Dummy Display Fallback

If no physical GPU is present, Kyber falls back to the virtual dummy display driver (`xorg.dummy.conf`), allowing desktop mode, menu navigation, and CPU-rendered emulators.

---

## 5. Storage, ROMs, Keys & Firmware Setup

### Directory Structure

Storage inside `/home/gamer/roms` is organized into a clean hierarchical tree:

```text
/home/gamer/roms/
|-- eglantine/
|   |-- games/        Base game ROMs (.nsp, .xci, .nsz)
|   |-- updates/      Title update patches (.nsp)
|   |-- dlc/          Downloadable content packages (.nsp)
|   |-- keys/         Switch encryption keys (prod.keys, title.keys)
|   |-- firmware/     Extracted firmware components (.nca)
|   `-- mods/         Custom game modifications
|-- switch -> eglantine/games   (Backwards-compatibility symlink)
`-- saves/            Emulator saves and memory states
```

### Uploading Games, Updates, and DLC

You can upload files into any subfolder using:
1. **Desktop Client:** Navigate to the `02 ROMS & GAMES` tab, choose your target subfolder (e.g. `Switch Games`), and drag and drop files directly onto the window.
2. **Kyber Console Hub:** Open the on-screen ROM Manager by selecting the **ROM Manager** tile or pressing `M` on a keyboard / `Back/Select` on a controller.
3. **Direct File Copy on Host:** If using a persistent volume or bind mount, copy files straight into `/home/gamer/roms/...` on the host filesystem.

### Archive Extraction (.zip, .7z, .rar)

Most ROM dumps, firmware packages, and key collections are distributed in compressed archives. Kyber Gaming handles them natively:

1. **One-Click UI Extraction:**
   - In both the Desktop Client and the Hub ROM Manager, any archive file (`.zip`, `.7z`, `.rar`, `.tar`, `.gz`) displays a dedicated **EXTRACT** action button.
   - Clicking **EXTRACT** decompresses the archive on the server in background and refreshes the directory listing once complete.
2. **Supported Formats:**
   - `.zip`
   - `.7z`
   - `.rar`
   - `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`, `.tar.xz`

### Switch Keys & Firmware Automated Placement

When you upload or extract Switch keys or firmware packages, Kyber's automated storage hooks handle placement:

- **Decryption Keys:**
  - Files named `prod.keys`, `title.keys`, or `*.keys` are mirrored to:
    - `/home/gamer/.local/share/eden/keys/`
    - `/home/gamer/.local/share/eglantine/keys/`
    - `/home/gamer/roms/eglantine/keys/`
- **Firmware (.nca):**
  - Extracted `.nca` firmware packages are placed into:
    - `/home/gamer/.local/share/eden/nand/system/Contents/registered/`
    - `/home/gamer/roms/eglantine/firmware/`
- **Permissions:**
  - All extracted files are recursively assigned ownership to `gamer:gamer`.

---

## 6. Network Configuration & Remote Access

### Local Area Network (LAN)

If the server and client are on the same home network:
- Streaming URL: `https://<LOCAL_SERVER_IP>:8080/webclient/`
- Control Port: `8081`

### Tailscale Private Mesh (Zero Port-Forwarding)

Tailscale provides an encrypted, zero-configuration peer-to-peer connection:

1. Install Tailscale on the server:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
2. Install Tailscale on your client device (Mac, PC, Linux).
3. Connect using your server's Tailscale IP:
   - Server: `<tailscale-ip>:8080` (e.g. `100.64.0.1:8080`)
   - Control API: `<tailscale-ip>:8081` (e.g. `100.64.0.1:8081`)
4. No router port forwarding or public IP exposure required.

### Production HTTPS & HTTP/3 via Caddy

For seamless browser streaming without certificate warnings, use the bundled Caddy reverse proxy:

1. Point your domain DNS `A` record (e.g. `gaming.yourdomain.com`) to your server IP.
2. Launch with `docker-compose.caddy.yml`:
   ```bash
   DOMAIN=gaming.yourdomain.com docker compose -f docker-compose.caddy.yml up -d
   ```
3. Caddy automatically issues Let's Encrypt certificates and routes HTTP/3 QUIC traffic to Kyber.

---

## 7. Client Installation & Connection

### Desktop Client (macOS, Windows, Linux)

The Desktop Client is written in Rust with Tauri v2, providing native window management, display scaling, and Keep-Alive connection pooling.

#### Option 1: Prebuilt Release Packages
Download the installer for your operating system from the repository's GitHub Releases:
- **macOS:** `.dmg` (Apple Silicon & Intel)
- **Windows:** `.msi` or `.exe` installer
- **Linux:** `.AppImage` or `.deb`

#### Option 2: Building from Source
1. Install Rust (`rustup`):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Install Tauri CLI v2:
   ```bash
   cargo install tauri-cli --version "^2.0.0" --locked
   ```
3. Navigate to the desktop client folder and launch development mode:
   ```bash
   cd desktop-client
   cargo tauri dev
   ```
4. Or compile a release binary:
   ```bash
   cargo tauri build
   ```

#### Client Configuration
1. Open the Desktop Client and go to the **SERVERS** tab.
2. Click **ADD SERVER** and enter:
   - **Name:** e.g. `Homelab Gaming`
   - **Host:** your server LAN IP (`192.168.x.x`) or Tailscale IP (`100.x.x.x`)
   - **Port:** `8080`
   - **Username:** `gamer`
   - **Password:** `kybergaming`
3. In the **SETTINGS** tab:
   - **Resolution:** `Auto Native Screen` (detects Retina / 16:10 / 16:9 / Ultrawide automatically).
   - **Framerate:** `60 FPS` or `120 FPS` (ProMotion / high-refresh).
   - **Bitrate:** `40 Mbps` (adjust according to your network bandwidth).
   - **Codec:** `H.264` or `HEVC`.
4. Click **CONNECT** on your server card to start the session.

---

### Web Browser Client (Zero Install)

1. Open Google Chrome, Brave, Chromium, or Safari.
2. Navigate to:
   ```text
   https://<SERVER_IP>:8080/webclient/
   ```
3. Accept the self-signed TLS certificate if prompted.
4. Enter credentials:
   - **Username:** `gamer`
   - **Password:** `kybergaming`
5. Click **Connect**.
6. Click anywhere on the streaming canvas to enable audio and lock mouse pointer.

---

## 8. Troubleshooting & Maintenance

### Inspecting Running Services Inside the Container
The container runs all components under `supervisor`:
```bash
docker exec kyber-gaming supervisorctl status
```
Expected output:
```text
control                          RUNNING   pid ..., uptime ...
dbus                             RUNNING   pid ..., uptime ...
dbus-session                     RUNNING   pid ..., uptime ...
kyber                            RUNNING   pid ..., uptime ...
launcher                         RUNNING   pid ..., uptime ...
openbox                          RUNNING   pid ..., uptime ...
pipewire                         RUNNING   pid ..., uptime ...
pipewire-pulse                   RUNNING   pid ..., uptime ...
wireplumber                      RUNNING   pid ..., uptime ...
xorg                             RUNNING   pid ..., uptime ...
```

### Restarting a Specific Service
To restart the control plane without interrupting the main container:
```bash
docker exec kyber-gaming supervisorctl restart control
```
To restart the console launcher:
```bash
docker exec kyber-gaming supervisorctl restart launcher
```

### Terminating a Hung Emulator Session
If an emulator process hangs or needs a force restart:
```bash
docker exec kyber-gaming pkill -9 -f 'eglantine|eden-cli|steam'
```
The supervisor process will keep the Kyber stream and Console OS active.

### Verifying GPU Acceleration Inside Container
Check that 3D acceleration and Vulkan renderers are detected:
```bash
docker exec kyber-gaming nvidia-smi
docker exec -e DISPLAY=:0 kyber-gaming glxinfo | grep "OpenGL renderer"
```

### Viewing Stream Telemetry & Real-Time Performance
In the WebClient or In-App streaming player:
- The top-right HUD bar displays:
  - Current screen resolution and refresh rate
  - Encoding bitrate (Mbps)
  - Frame delivery latency (ms)
  - Active audio sample rate
- Keyboard shortcuts:
  - `M`: Open ROM Manager
  - `A` / `Enter`: Launch item
  - `B` / `Esc`: Return to launcher / desktop
  - `Ctrl+Q`: Quit streaming session
