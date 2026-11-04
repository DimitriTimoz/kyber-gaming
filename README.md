# Kyber Cloud Gaming (Headless)

A containerized headless cloud gaming infrastructure based on Ubuntu 24.04 LTS, powered by the low-latency streaming protocol Kyber (VideoLAN / VLC team), with virtual display emulation, Steam Big Picture, Heroic Games Launcher, console emulators, and an integrated ROM & game manager.

---

## Features

- Headless Virtual Display: Runs on headless servers without a physical monitor or HDMI dummy plug. Virtual display and EDID are fully simulated with hardware 3D acceleration.
- Kyber Streaming Engine:
  - Ultra-low latency QUIC / WebTransport streaming on a unified port (8080 TCP/UDP).
  - Web client served directly from the container (`/webclient`).
  - Hardware-accelerated video capture via X11/NVFBC or DRM/VA-API with NVENC/VA-API encoding.
- Gaming Launchers & Console Emulators:
  - Steam (Desktop and Big Picture console modes).
  - Heroic Games Launcher (Epic Games Store and GOG).
  - RetroArch, RPCS3 (PS3), PCSX2 (PS2), Dolphin (GameCube/Wii), DuckStation (PS1).
  - Google Chrome for game wikis, mod downloads, and web browsing.
  - Openbox window manager with custom keyboard shortcuts.
- ROM & Game Installation Manager:
  - Integrated REST API (`/api/roms`) and Web/Desktop management interface.
  - Drag-and-drop ROM uploading with auto-detection for consoles (`.iso`, `.chd`, `.rvz`, `.nsp`, `.pkg`, `.sfc`, `.zip`).
  - Dedicated persistent volumes for ROMs (`/home/gamer/roms`), BIOS firmware (`/home/gamer/bios`), and game saves (`/home/gamer/saves`).
  - Direct host or NAS mount support.
- Controller & Peripheral Support: Virtual `/dev/uinput` injection (Xbox 360, DualShock/DualSense) and remote mouse/keyboard input.
- Virtual Audio: PipeWire audio routing to Kyber Opus/AAC stream without a physical sound card.
- Dynamic Display Resizing: Automatically adapts to the client browser or desktop window dimensions via REST API (`port 8081`).
- Secure Authentication: Password-protected streaming controller and resizer API.

---

## Architecture & CI/CD Packaging

Kyber Gaming includes automated continuous integration and packaging pipelines:

1. Docker Container Packaging (`.github/workflows/docker.yml`):
   - Multi-stage image build for `linux/amd64` using Docker Buildx and GitHub Actions cache.
   - Automatically publishes tagged and latest images to GitHub Container Registry:
     `ghcr.io/<owner>/kyber-gaming:latest`
2. Desktop Client Matrix (`.github/workflows/desktop.yml`):
   - Cross-platform build with Rust toolchain and pre-built Tauri CLI.
   - Compiles native bundles for:
     - macOS: Universal binary DMG (`universal-apple-darwin` for Apple Silicon & Intel)
     - Linux: Debian package (`.deb`) and standalone `.AppImage`
     - Windows: Microsoft Installer (`.msi`) and standalone `.exe`
3. Release Automation (`.github/workflows/release.yml`):
   - Triggered on Git tags (`v*.*.*`).
   - Builds both the release container image and all desktop installers.
   - Computes SHA-256 checksums (`SHA256SUMS.txt`) and publishes a GitHub Release with assets attached.

---

## Quick Start

### Option 1: Docker Compose (Prebuilt or Local Build)

1. Clone repository:
```bash
git clone https://github.com/DimitriTimoz/kyber-gaming.git
cd kyber-gaming
```

2. Configure environment in `docker-compose.yml`:
```yaml
services:
  kyber-gaming:
    image: ghcr.io/dimitritimoz/kyber-gaming:latest
    # Or build locally:
    # build: .
    network_mode: host
    privileged: true
    environment:
      - RESOLUTION=1920x1080
      - REFRESH_RATE=60
      - LAUNCHER=menu
      - AUTH_USER=gamer
      - AUTH_PASSWORD=kybergaming
    volumes:
      - steam_data:/home/gamer/.local/share/Steam
      - heroic_data:/home/gamer/.config/heroic
      - gamer_home:/home/gamer
      - roms_data:/home/gamer/roms
      - bios_data:/home/gamer/bios
      - saves_data:/home/gamer/saves
      # Optional: Mount your NAS or host ROM library directly:
      # - /mnt/nas/roms:/home/gamer/roms
      # - /mnt/nas/bios:/home/gamer/bios
```

3. Launch container:
```bash
docker compose up -d
```

4. View logs:
```bash
docker compose logs -f
```

---

## Connecting to the Stream

### 1. Browser Client (Zero Install)

Navigate to:
`https://<SERVER_IP>:8080/webclient`

- Enter credentials (default: `gamer` / `kybergaming`).
- Select target resolution (or use Detected Screen).
- Click Connect to start the session.

### 2. Desktop Client (Native Rust + Tauri v2)

Native client installers are available in GitHub Releases for macOS, Linux, and Windows:
- Multi-server manager with ping latency checks.
- Dedicated ROM & Game Manager view.
- Persistent configuration per OS standards (`~/.config/kyber`, `%APPDATA%\kyber`, or `~/Library/Application Support/kyber`).

To run locally in development mode:
```bash
cd desktop-client
cargo tauri dev
```

---

## ROM & Emulator Game Management

The container organizes emulator storage in standard directories:

```text
/home/gamer/
├── roms/
│   ├── ps3/            # RPCS3 (.iso, .pkg, .rap, .bin)
│   ├── ps2/            # PCSX2 (.iso, .chd, .bin, .cso, .gz)
│   ├── psx/            # DuckStation / RetroArch (.chd, .cue, .bin, .iso, .pbp)
│   ├── gamecube/       # Dolphin (.iso, .gcm, .rvz, .ciso)
│   ├── wii/            # Dolphin (.iso, .wbfs, .rvz)
│   ├── switch/         # Switch emulators (.nsp, .xci, .nsz)
│   ├── snes/           # Super Nintendo (.sfc, .smc, .zip)
│   ├── nes/            # Nintendo Entertainment System (.nes, .zip)
│   ├── gba/            # Game Boy Advance (.gba, .zip)
│   ├── gbc/            # Game Boy / Color (.gbc, .gb, .zip)
│   ├── genesis/        # Sega Genesis / Mega Drive (.md, .bin, .zip)
│   ├── n64/            # Nintendo 64 (.n64, .z64, .v64, .zip)
│   └── arcade/         # Arcade / MAME (.zip, .7z)
├── bios/               # Emulator firmware BIOS files
└── saves/              # Game saves and memory cards
```

### Accessing the Manager

- In Console Hub: Press `M` on keyboard, select the ROM Manager card in Emulators, or click the bottom bar button.
- In Desktop Client: Select the `02 ROMS & GAMES` tab in the sidebar.
- Via REST API:
  - Inventory: `GET /api/roms`
  - Upload: `POST /api/roms/upload?system=<sys>&filename=<name>`
  - Delete: `POST /api/roms/delete` with JSON `{"system": "...", "filename": "..."}`

---

## Dynamic Display Resizing

The virtual X11 screen adjusts on the fly via port 8081:

1. Automatic: Injected client scripts detect the viewport and request the server to match the display dimensions.
2. Manual REST API:
```bash
curl -k "https://<SERVER_IP>:8081/api/resize?width=2560&height=1440&rate=120&auth_user=gamer&auth_pass=kybergaming"
```

---

## Keyboard & Gamepad Shortcuts

- `A` / `Enter`: Launch selected item
- `B` / `Esc`: Minimize / Desktop Mode
- `M`: Open ROM & Game Manager
- `R`: Clean reload Steam cache and process
- `Q` / `E` (or Bumpers): Switch category tabs
- `Ctrl+Shift+Q` (Web Client) or `Ctrl+Q` (Desktop Client): Exit active session
