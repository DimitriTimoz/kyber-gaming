# Kyber Cloud Gaming (Headless)

A containerized headless cloud gaming infrastructure based on Ubuntu 24.04 LTS, powered by the low-latency streaming protocol Kyber (VideoLAN / VLC team), with virtual display emulation, Steam Big Picture, Heroic Games Launcher, console emulators, and an integrated ROM & game manager.

---

## Features

- Headless Virtual Display: Runs on headless servers without a physical monitor or HDMI dummy plug. Virtual display and EDID are fully simulated with hardware 3D acceleration.
- Kyber Streaming Engine:
  - Ultra-low latency QUIC / WebTransport streaming on a unified port (8080 TCP/UDP).
  - Web client served directly from the container (`/webclient`).
  - Hardware-accelerated video capture via X11/NVFBC or DRM/VA-API with NVENC/VA-API encoding.
- Gaming Launchers & Emulators:
  - Steam (Desktop and Big Picture console modes).
  - Heroic Games Launcher (Epic Games Store and GOG).
  - Eglantine (Nintendo Switch & Switch 2 / NX2 experimental emulator with Vulkan rendering).
  - Google Chrome for game wikis, mod downloads, and web browsing.
  - Openbox window manager with custom keyboard shortcuts.
- ROM & Game Installation Manager:
  - Integrated REST API (`/api/roms/browse`, `/api/roms/upload_chunk`) and 100% native Web/Desktop management interface (no third-party file managers).
  - Dedicated hierarchical subfolder structure per emulator: `eglantine/games`, `eglantine/updates`, `eglantine/dlc`, `eglantine/keys`, `eglantine/firmware`, `eglantine/mods`, `saves`.
  - High-performance chunked file uploader (10 MB slices) with real-time throughput telemetry (MB/s), ETA calculation, and progress tracking.
  - Interactive breadcrumbs navigation, real-time client search filter, folder creation, and safe deletion.
  - Automatic synchronization of uploaded `prod.keys` and `title.keys` to Eglantine key storage (`/home/gamer/.local/share/eglantine/keys`).
  - Persistent volume support for `/home/gamer/roms` with host/NAS mount options.
- Controller & Peripheral Support: Virtual `/dev/uinput` injection (Xbox 360, DualShock/DualSense) and remote mouse/keyboard input.
- Virtual Audio: PipeWire audio routing to Kyber Opus/AAC stream without a physical sound card.
- Dynamic Display Resizing: Automatically adapts to the client browser or desktop window dimensions via REST API (`port 8081`).
- Secure Authentication: Password-protected streaming controller and Kyber Control Plane API.

---

## Architecture & CI/CD Packaging

Kyber Gaming includes automated continuous integration and packaging pipelines:

1. Docker Container Packaging (`.github/workflows/docker.yml`):
   - Multi-stage image build for `linux/amd64` using Docker Buildx and GitHub Actions cache.
   - Automatically publishes tagged and latest images to GitHub Container Registry:
     `ghcr.io/<owner>/kyber-gaming:latest`
2. Desktop Client Continuous Packaging (`.github/workflows/desktop.yml`):
   - Cross-platform build with Rust toolchain and pre-built Tauri CLI.
   - Compiles native bundles for:
     - macOS: Universal binary DMG (`universal-apple-darwin` for Apple Silicon & Intel)
     - Linux: Debian package (`.deb`), Red Hat / Fedora (`.rpm`), and standalone `.AppImage`
     - Windows: Microsoft Installer (`.msi`) and standalone NSIS setup (`-setup.exe`)
   - Automatically publishes or updates rolling releases (`continuous`) under GitHub Releases on every `main` push.
3. Official Release Automation (`.github/workflows/release.yml`):
   - Triggered on Git tags (`v*.*.*`).
   - Builds both the release container image and all desktop installers.
   - Computes SHA-256 checksums (`SHA256SUMS.txt`) and publishes an official GitHub Release with assets attached.

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

### Option 2: Production with Caddy Reverse Proxy (Automatic HTTPS & HTTP/3 QUIC)

For zero-warning browser streaming over the internet with automatic Let's Encrypt / ZeroSSL TLS certificates:

```bash
DOMAIN=gaming.yourdomain.com docker compose -f docker-compose.caddy.yml up -d
```

This starts Caddy on host ports 80 and 443 with native HTTP/3 QUIC proxying to Kyber's WebTransport server.

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

The container organizes emulator storage in a clean hierarchical structure with dedicated subfolders per emulator:

```text
/home/gamer/roms/
├── eglantine/
│   ├── games/        # Base game ROMs (.nsp, .xci, .nsz)
│   ├── updates/      # Game update patches (.nsp)
│   ├── dlc/          # Downloadable content packs (.nsp)
│   ├── keys/         # Decryption keys (prod.keys, title.keys)
│   ├── firmware/     # Switch system firmware archives (.zip, .bin)
│   └── mods/         # Game mods and custom content
├── switch -> eglantine/games   # Backward-compatible symlink
└── saves/            # Emulator save files and memory states
```

When keys or firmware files (such as `prod.keys` or `title.keys`) are uploaded to `eglantine/keys/` or `/home/gamer/bios/`, they are automatically mirrored to Eglantine's internal key directories (`/home/gamer/.local/share/eglantine/keys/` and `/home/gamer/.local/share/eden/keys/`). Eglantine is configured with recursive directory discovery (`deep_scan=true`), so games in subfolders are detected automatically.

### High-Performance Chunked Uploader

The management interface features a built-in chunked upload engine:
- Large Switch games (10GB–25GB) are sliced into 10 MB chunks via the browser/desktop client.
- Uploads avoid HTTP gateway timeouts and can be monitored via live telemetry: speed in **MB/s**, remaining time (**ETA**), and dual progress bars.
- Drag-and-drop is supported anywhere within the file explorer.

### Accessing the Library Explorer

- In Console Hub: Press `M` on keyboard, select the ROM Manager card in Emulators, or click the bottom bar button.
- In Desktop Client: Select the `02 ROMS & GAMES` tab in the sidebar.
- Via REST API:
  - Directory Browsing: `GET /api/roms/browse?path=<rel_path>`
  - File Download: `GET /api/roms/download?path=<rel_path>`
  - Folder Creation: `POST /api/roms/create_folder` with JSON `{"path": "...", "folder_name": "..."}`
  - Chunk Upload: `POST /api/roms/upload_chunk?upload_id=...&filename=...&target_path=...&chunk_index=...&total_chunks=...&total_size=...`
  - Safe Item Deletion: `POST /api/roms/delete` with JSON `{"path": "..."}`
  - Legacy Inventory: `GET /api/roms`

---

## Hardware GPU Acceleration & Driver Compatibility

Kyber Gaming is engineered to handle heterogenous GPU architectures and host kernel driver updates automatically without rebuilding images:

### 1. NVIDIA Acceleration & Automated Driver Synchronization
- Multiarch 64-bit & 32-bit Acceleration:
  - 64-bit GLX, NvFBC (`libnvidia-fbc.so`), and NVENC video encoding for host streaming.
  - Complete 32-bit acceleration stack (`libGLX_nvidia`, `libnvidia-glcore`, `libcuda`, `libnvidia-encode`, `libnvidia-fbc`, 32-bit Vulkan ICD manifest) in `/usr/lib/i386-linux-gnu/`. This ensures seamless compatibility with 32-bit Steam titles and Wine / Proton 32-bit DirectX games.
- Host Driver Upgrade Self-Healing:
  - On startup, the container detects the exact host driver version (`/proc/driver/nvidia/version` or `nvidia-smi`).
  - If the host kernel driver was updated (e.g., from `550.120` to `550.163` or `560.xx`), the container detects the ABI mismatch, removes stale libraries, downloads the matching official userspace suite to `/var/cache/nvidia-driver/`, extracts the missing components, updates `ldconfig`, and starts Xorg without segmentation faults.

### 2. AMD Radeon & Intel GPU Support
- Direct Rendering Infrastructure (DRI):
  - Automatically identifies AMD Radeon vendor IDs (`0x1002`) and Intel GPU vendor IDs (`0x8086`) under `/dev/dri/`.
  - Configures Xorg modesetting with Glamor 2D/3D hardware acceleration (`/etc/kyber/xorg.modesetting.conf`).
  - Sets up environment profiles for Mesa RADV (`AMD_VULKAN_ICD=RADV`, `radeon_icd.x86_64.json`) and VA-API hardware video encoding (`LIBVA_DRIVER_NAME=radeonsi`).
- Software Fallback:
  - If no physical GPU or DRI device is detected, Kyber safely falls back to the virtual dummy display driver (`xorg.dummy.conf`).

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
