# Technical Specification & Implementation Plan: Headless Kyber Cloud Gaming

This document outlines the architecture, technical specifications, and implementation details for a Headless Cloud Gaming containerized stack based on Ubuntu 24.04 LTS, utilizing Kyber streaming technology (`kyber.tech` / `gitlab.com/kyber.stream`), running completely headless without physical monitors, and integrating Steam, Heroic Games Launcher, console emulators, and an integrated ROM & game manager.

---

## 1. Context & Objectives

The goal is to modernize self-hosted cloud gaming setups:
- Replace Sunshine/Moonlight with Kyber: Kyber is an ultra-low latency remote control and streaming engine written in Rust by the VideoLAN/VLC team, utilizing QUIC and WebTransport protocols, accessible directly from modern web browsers or native desktop apps.
- 100% Headless Operation: No physical monitor, television, or dummy HDMI/DisplayPort plug is required on the host. Display and EDID are simulated via software with full 3D hardware acceleration.
- Base Operating System: Ubuntu 24.04 LTS.
- Gaming Launchers: Steam (Desktop and Big Picture console modes) and Heroic Games Launcher (Epic Games Store and GOG).
- Console Emulators: RetroArch, RPCS3 (PS3), PCSX2 (PS2), Dolphin (GameCube/Wii), DuckStation (PS1).
- ROM & Game Storage: Centralized management and upload interface for games, saves, and BIOS firmware files.
- Continuous Integration & Packaging: Automated build pipelines for container images (GHCR) and cross-platform native clients (macOS, Linux, Windows).

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Host["Host (Linux Server / Proxmox / Baremetal)"]
        GPU["GPU (NVIDIA NVENC / AMD VA-API)"]
        Uinput["Device /dev/uinput (Gamepads & Keyboard)"]
        Storage["Persistent Volumes (Roms, Bios, Saves, Steam, Heroic)"]
    end

    subgraph Container["Ubuntu 24.04 LTS Container"]
        subgraph Core["Virtual Display & Audio"]
            EDID["EDID Generator (1080p, 1440p, 4K @ 60/120/144Hz)"]
            Xorg["Headless Xorg (AllowEmptyInitialConfiguration / Dummy)"]
            Openbox["Lightweight Window Manager (Openbox)"]
            Pipewire["PipeWire + Virtual Audio Sink"]
            Resizer["Dynamic Resizer & ROM Service (Port 8081)"]
        end

        subgraph StreamingEngine["Streaming Engine"]
            Kyber["Kyber Server (Rust / WebTransport / QUIC)"]
        end

        subgraph Launchers["Gaming Applications & Emulators"]
            Hub["Console OS Kiosk Hub (Chrome)"]
            Steam["Steam (Big Picture & Desktop)"]
            Heroic["Heroic Games Launcher"]
            Emulators["RetroArch / RPCS3 / PCSX2 / Dolphin / DuckStation"]
            Browser["Fullscreen Web Browser"]
        end

        Supervisor["Process Supervisor (Supervisord)"]
    end

    subgraph Client["Gamer Device (macOS / Linux / Windows / iOS / Android)"]
        WebClient["Web Browser Client (QUIC / WebTransport)"]
        DesktopApp["Kyber Desktop App (Tauri v2 + Rust)"]
        Controller["Physical Gamepad (Xbox / PlayStation / Switch)"]
    end

    GPU --> Core
    Storage --> Core
    Uinput --> StreamingEngine
    Core --> Launchers
    Core --> StreamingEngine
    StreamingEngine <-->|Port 8080 UDP/TCP (QUIC + HTTPS)| WebClient
    StreamingEngine <-->|Port 8080 UDP/TCP (QUIC + HTTPS)| DesktopApp
    Resizer <-->|Port 8081 TCP (REST API + Upload)| WebClient
    Resizer <-->|Port 8081 TCP (REST API + Upload)| DesktopApp
    Controller --> WebClient
    Controller --> DesktopApp
```

---

## 3. Technical Component Details

### 3.1. Headless Display Emulation
On a server without a monitor, the GPU driver often refuses to initialize rendering contexts or hardware video encoding (NVENC). To resolve this:
1. Virtual EDID Profile:
   - Generate a binary EDID block (`edid.bin`) injected into the X server.
   - Define display modes:
     - `1920x1080` @ 60Hz, 120Hz, 144Hz
     - `2560x1440` @ 60Hz, 120Hz, 144Hz
     - `3840x2160` @ 60Hz, 120Hz
2. Xorg Configuration (`xorg.conf`):
   - NVIDIA Profile:
     - `ConnectedMonitor "DFP-0"`
     - `CustomEDID "DFP-0:/etc/X11/edid.bin"`
     - `AllowEmptyInitialConfiguration "True"`
     - `UseDisplayDevice "None"`
   - Dummy Profile (AMD / Software Fallback):
     - `xserver-xorg-video-dummy` driver with high-refresh Modelines.
3. Dynamic Resizing:
   - Utilize `xrandr` via `resizer_service.py` to adapt resolution on-the-fly to the client viewport.

### 3.2. Headless Audio Engine
- PipeWire replaces legacy PulseAudio:
  - Containerized PipeWire daemon.
  - Virtual sink (`module-null-sink` named `KyberAudioSink`).
  - Audio from Proton, Wine, emulators, and native games routes automatically to this sink.
  - Kyber captures the monitor output of this sink to encode the audio stream (Opus / AAC).

### 3.3. Kyber Streaming Integration
- Multi-stage Docker build compiling `kyber-server` and libraries from upstream repositories (`gitlab.com/kyber.stream`).
- Configuration `kyber_config.toml`:
  - Video capture: Direct X11 / NVFBC (NVIDIA Framebuffer Capture) / DRM.
  - Hardware encoder: `nvenc` (NVIDIA) or `vaapi` (AMD/Intel) with software `x264` fallback.
  - Inputs: Injection of mouse, keyboard, and virtual Xbox 360 / DualShock controller events via `/dev/uinput`.
  - Networking: Unified listening port `8080` (UDP for QUIC/WebTransport, TCP for HTTP/signaling).
  - Security: TLS certificates generated automatically on startup or mounted by user.

### 3.4. Session Manager, Hub & Launchers
- Openbox: Lightweight window manager (zero CPU overhead, no heavy compositor).
- Console OS Hub: Data-driven fullscreen kiosk interface (`/opt/kyber/hub`) with controller navigation, sound effects, system telemetry, and category filters.
- Steam: Multiarch package (`amd64` + `i386`) with Proton and Steam Runtime support.
- Heroic Games Launcher: Official `.deb` package supporting Epic Games Store and GOG.
- Emulators: RetroArch, RPCS3, PCSX2, Dolphin, DuckStation.
- Web Browser: Google Chrome for web browsing, game wikis, and mod downloads.

### 3.5. ROM & Emulator Game Manager
- Centralized storage structure: `/home/gamer/roms/<system>`, `/home/gamer/bios`, `/home/gamer/saves`.
- REST endpoints in `resizer_service.py`:
  - `GET /api/roms`: Returns inventory of games per system with file sizes and counts.
  - `POST /api/roms/upload`: Binary streaming upload supporting multi-gigabyte ISOs with progress tracking.
  - `POST /api/roms/delete`: Secure deletion with path traversal protection.

### 3.6. Packaging & CI/CD Pipelines
- Docker Container CI (`.github/workflows/docker.yml`): Automated buildx compilation and push to GHCR (`ghcr.io`).
- Desktop Client Matrix (`.github/workflows/desktop.yml`): Compiles `.dmg` (macOS Universal), `.deb`/`.AppImage` (Linux), and `.msi`/`.exe` (Windows).
- Release Automation (`.github/workflows/release.yml`): Coordinates release asset generation and publication on Git tag pushes.

---

## 4. Repository Structure

```text
kyber-gaming/
├── Dockerfile                  # Multi-stage build Ubuntu 24.04 (Rust builder + Runtime)
├── docker-compose.yml          # Production Compose deployment with GPU and volumes
├── PLAN.md                     # Architecture specification document
├── README.md                   # User guide and quick start
├── config/
│   ├── kyber/
│   │   └── kyber_config.toml   # Kyber streaming and controller parameters
│   ├── supervisor/
│   │   └── supervisord.conf    # Supervisor service definitions and boot order
│   ├── xorg/
│   │   ├── xorg.nvidia.conf    # Headless Xorg for NVIDIA with virtual EDID
│   │   └── xorg.dummy.conf     # Xorg fallback / AMD configuration
│   ├── openbox/
│   │   ├── autostart           # Window manager autostart script
│   │   ├── rc.xml              # Window rules and keybindings
│   │   └── menu.xml            # Openbox desktop menu
│   └── pipewire/
│       └── pipewire.conf.d/    # PipeWire virtual sink configuration
├── desktop-client/             # Cross-platform native client (Rust + Tauri v2)
│   ├── Cargo.toml
│   ├── README.md               # Desktop client documentation
│   ├── src-tauri/              # Rust backend (server config, ping, process runner)
│   └── ui/                     # Monochromatic industrial interface (Geist & Geist Mono)
├── hub/                        # Fullscreen Console OS Kiosk Hub
│   ├── index.html
│   ├── hub.js
│   ├── style.css
│   └── launchers.json
├── webclient/                  # Browser streaming client and connection lobby
└── scripts/
    ├── entrypoint.sh           # Container setup, permissions, GPU detection, and TLS
    ├── init_display.sh         # Headless display preparation and EDID injection
    ├── make_edid.py            # EDID 1080p/1440p/4K @ 60/120/144Hz generator
    ├── run_kycontroller.sh     # Kyber controller startup wrapper
    ├── resizer_service.py      # Dynamic resolution resize and ROM manager REST API
    ├── switch_launcher.sh      # Session switcher between Hub, Steam, and emulators
    ├── kyber_console_hub.sh    # Console OS kiosk process manager
    └── launch_game_session.sh  # Session supervisor loop
```
