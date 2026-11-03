# Technical Specification & Implementation Plan: Headless Kyber Cloud Gaming

This document outlines the architecture, technical specifications, and implementation steps for a **Headless Cloud Gaming** Docker container based on **Ubuntu 24.04 LTS**, utilizing **Kyber** streaming technology (`kyber.tech` / `gitlab.com/kyber/kyber`), running completely headless without any physical display, and integrating **Steam** and **Heroic Games Launcher**.

---

## 1. Context & Objectives

The goal is to modernize projects like `docker-steam-headless`:
* **Replace Sunshine with Kyber**: Kyber is an ultra-low latency remote control and streaming engine written in Rust by the VLC/VideoLAN team, utilizing **QUIC** and **WebTransport** protocols, accessible directly from modern web browsers or native client apps.
* **100% Headless Operation**: No physical monitor, television, or dummy HDMI/DisplayPort plug is required on the host. Display and EDID are simulated via software with full 3D hardware acceleration.
* **Base OS**: **Ubuntu 24.04 LTS**.
* **Launchers**: **Steam** (Big Picture mode) and **Heroic Games Launcher** (Epic Games Store & GOG). *(Console emulators are deferred to a subsequent phase).*

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Host["Host (Linux Server / Proxmox)"]
        GPU["GPU (NVIDIA NVENC / AMD VA-API)"]
        Uinput["Device /dev/uinput (Gamepads & Keyboard)"]
    end

    subgraph Container["Ubuntu 24.04 LTS Container"]
        subgraph Core["Virtual Display & Audio"]
            EDID["EDID Generator (1080p, 1440p, 4K @ 60/120/144Hz)"]
            Xorg["Headless Xorg (AllowEmptyInitialConfiguration / Dummy)"]
            Openbox["Lightweight Window Manager (Openbox)"]
            Pipewire["PipeWire + Virtual Null Audio Sink"]
            Resizer["Dynamic Resizer Service (Port 8081)"]
        end

        subgraph StreamingEngine["Streaming Engine"]
            Kyber["Kyber Server (Rust / WebTransport / QUIC)"]
        end

        subgraph Launchers["Gaming Applications"]
            Steam["Steam (Big Picture)"]
            Heroic["Heroic Games Launcher"]
        end

        Supervisor["Process Supervisor (Supervisord)"]
    end

    subgraph Client["Gamer Device"]
        Browser["Web Browser (Chrome/Edge/Firefox) or Kyber Client"]
        Controller["Physical Gamepad (Xbox / PlayStation)"]
    end

    GPU --> Core
    Uinput --> StreamingEngine
    Core --> Launchers
    Core --> StreamingEngine
    StreamingEngine <-->|Port 8080 UDP/TCP (QUIC + HTTPS)| Browser
    Resizer <-->|Port 8081 TCP (REST API)| Browser
    Controller --> Browser
```

---

## 3. Technical Component Details

### 3.1. Headless Display Emulation
On a server without a monitor, the GPU driver often refuses to initialize rendering contexts or hardware video encoding (NVENC). To resolve this:
1. **Virtual EDID Profile**:
   * Generate a binary EDID block (`edid.bin`) injected into the X server.
   * Define display modes:
     * `1920x1080` @ 60Hz, 120Hz, 144Hz
     * `2560x1440` @ 60Hz, 120Hz, 144Hz
     * `3840x2160` @ 60Hz, 120Hz
2. **Xorg Configuration (`xorg.conf`)**:
   * **NVIDIA Profile**:
     * `ConnectedMonitor "DFP-0"`
     * `CustomEDID "DFP-0:/etc/X11/edid.bin"`
     * `AllowEmptyInitialConfiguration "True"`
     * `UseDisplayDevice "None"`
   * **Dummy Profile (AMD / Fallback)**:
     * `xserver-xorg-video-dummy` driver with high-refresh Modelines.
3. **Dynamic Resizing**:
   * Utilize `xrandr` via `resizer_service.py` to adapt resolution on-the-fly to the client viewport.

### 3.2. Headless Audio Engine
* **PipeWire** replaces legacy PulseAudio:
  * Start a containerized PipeWire daemon.
  * Create a **virtual sink** (`module-null-sink` named `KyberAudioSink`).
  * Audio from Proton, Wine, and native games routes automatically to this sink.
  * Kyber Server captures the monitor output of this sink to encode the audio stream (Opus / AAC).

### 3.3. Kyber Streaming Integration
* **Binaries & Dependencies**:
  * Multi-stage Docker build compiling `kyber-server` from the official GitLab repository (`gitlab.com/kyber.stream/apps/kyber-desktop.git`).
* **Configuration `kyber_config.toml`**:
  * Video capture: Direct X11 / NVFBC (NVIDIA Framebuffer Capture) / DRM.
  * Hardware encoder: `h264_nvenc` / `hevc_nvenc` (NVIDIA) or `vaapi` (AMD/Intel).
  * Audio capture: PipeWire Monitor.
  * Inputs: Injection of mouse, keyboard, and virtual Xbox 360 / DualShock controller events via `/dev/uinput`.
  * Networking: Unified listening port `8080` (UDP for QUIC/WebTransport, TCP for HTTP/signaling).
  * Security: Auto-generated or mounted TLS certificates.

### 3.4. Session Manager & Launchers
* **Openbox**: Lightweight window manager (zero CPU overhead, no heavy compositor).
* **Steam**:
  * Multiarch package (`amd64` + `i386`).
  * Proton and Steam Runtime support.
  * Direct launch in Big Picture mode (`steam -bigpicture`).
* **Heroic Games Launcher**:
  * Official `.deb` package.
  * Epic Games Store and GOG support via Wine-GE / Proton-GE.

### 3.5. Process Supervisor
* Use **Supervisord** to orchestrate and monitor processes:
  1. `dbus-daemon`
  2. `init-display` (EDID generation + `Xorg :0`)
  3. `pipewire` & `pipewire-pulse`
  4. `wireplumber`
  5. `openbox`
  6. `resizer` (dynamic resolution API)
  7. `kyber-server`
  8. `steam` (or launcher configured via environment variables)

---

## 4. Repository Structure

```text
kyber-gaming/
├── Dockerfile                  # Multi-stage build Ubuntu 24.04 (Rust builder + Runtime)
├── docker-compose.yml          # Deployment configuration with GPU pass-through and volumes
├── PLAN.md                     # Architecture specification document
├── README.md                   # User guide and quick start
├── config/
│   ├── kyber/
│   │   └── kyber_config.toml   # Kyber audio, video, network, and uinput configuration
│   ├── supervisor/
│   │   └── supervisord.conf    # Supervisor service definitions and boot order
│   ├── xorg/
│   │   ├── xorg.nvidia.conf    # Headless Xorg for NVIDIA with virtual EDID
│   │   └── xorg.dummy.conf     # Xorg fallback / AMD configuration
│   ├── openbox/
│   │   ├── autostart           # Window manager autostart script
│   │   └── rc.xml              # Window rules and decorations
│   └── pipewire/
│       └── pipewire.conf.d/    # PipeWire virtual sink configuration
└── scripts/
    ├── entrypoint.sh           # Entrypoint script (permissions, GPU detection, TLS certs)
    ├── init_display.sh         # Headless display preparation and EDID injection
    ├── make_edid.py            # EDID 1080p/1440p/4K @ 60/120/144Hz generator
    ├── run_kycontroller.sh     # Kyber controller startup wrapper
    ├── resizer_service.py      # Dynamic resolution resize REST API service
    ├── client_autoresize.js    # Client-side auto-resize reporting script
    └── launch_game_session.sh  # Game session launcher (Steam / Heroic)
```
