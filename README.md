# 🎮 Kyber Cloud Gaming (Headless)

A containerized **Headless Cloud Gaming** solution based on **Ubuntu 24.04 LTS**, powered by the ultra-low latency streaming technology **[Kyber](https://kyber.tech/)** (written in Rust by the VideoLAN / VLC team), featuring full virtual display emulation, **Steam (Big Picture)**, and the **Heroic Games Launcher**.

Inspired by `docker-steam-headless`, this project modernizes the experience by replacing Sunshine/Moonlight with Kyber's **QUIC / WebTransport** protocol, accessible directly from any modern web browser without requiring third-party client apps.

---

## 🚀 Features

- 🖥️ **100% Headless**: No physical monitor, TV, or HDMI "dummy plug" required on the host machine. The virtual display and EDID are fully simulated with complete 3D hardware acceleration.
- ⚡ **Kyber Technology**:
  - Ultra-low latency QUIC / WebTransport streaming on a **unified port** (`8080/TCP+UDP`).
  - Integrated web client served natively (`/webclient`).
  - Hardware capture via X11/NVFBC or DRM/VA-API with NVENC/VA-API hardware encoding.
- 🕹️ **Integrated PC Launchers**:
  - **Steam** (launches natively in *Big Picture* mode).
  - **Heroic Games Launcher** (Epic Games Store & GOG).
  - Lightweight desktop environment (Openbox) available.
- 🎮 **Full Controller Support**: Virtual `/dev/uinput` injection (Xbox 360, DualShock/DualSense) and remote mouse/keyboard input.
- 🔊 **PipeWire Virtual Audio**: Transparent game audio routing to Kyber's Opus/AAC stream without a physical sound card.
- 📺 **Automatic Dynamic Resizing**: The virtual display automatically adapts to the exact dimensions of your client browser window or device screen via an integrated resizer service (`port 8081`). Also supports manual resolutions (1080p, 1440p, 4K up to 144Hz).

---

## 📋 Prerequisites

1. **Docker Engine & Docker Compose** (recent release with Compose V2).
2. **Host GPU Acceleration**:
   * **NVIDIA**: [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed and configured.
   * **AMD / Intel**: Access to the `/dev/dri` render node.
3. **`uinput` kernel module** loaded on the host:
   ```bash
   sudo modprobe uinput
   echo "uinput" | sudo tee -a /etc/modules-load.d/uinput.conf
   ```

---

## 🛠️ Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/your-user/kyber-gaming.git
cd kyber-gaming
```

### 2. Launch with Docker Compose
```bash
docker compose up -d --build
```

### 3. Monitor startup logs
```bash
docker compose logs -f
```

---

## 🌐 Connecting to the Stream

### Option A : Console Web Hub intégré ⚡ *(Zero Install - Recommandé)*
Le conteneur Docker intègre nativement un **Lobby Console & Web Hub** avant le stream. Il fonctionne instantanément sur n'importe quel appareil (**Windows, macOS, Linux, Steam Deck, iPad, Android**) sans rien installer :

👉 **`https://<SERVER_IP>:8080/webclient`**

- **Console Lobby Pré-Stream** : Détection des specs GPU (modèle, température, VRAM) et latence en temps réel.
- **Réglages en 1 clic** : Résolution virtuelle (1080p, 1440p, 4K), Framerate (60, 120, 144 FPS), Débit (30, 50, 80 Mbps), Codecs (H.264, HEVC).
- **Détecteur de Manettes** : Reconnaissance automatique via l'API Web Gamepad (Xbox, PlayStation DualSense, Switch) avec test de vibration.
- **Sélecteur de Launcher** : Switch en direct entre le **Console OS Hub**, **Steam Big Picture** ou **Heroic Games**.
- **Barre rapide en jeu** : Accès instantané au plein écran, rechargement du flux ou retour au lobby via le menu flottant.

### Option B : Client Desktop Cross-Platform (Rust + Tauri v2) 🚀
Pour les utilisateurs avancés recherchant les performances natives de `kyclient` :
Une application de bureau multiplateforme (**Windows**, **Linux**, **macOS**) est disponible dans [`desktop-client/`](./desktop-client/) :
- Gestionnaire multi-serveurs avec ping asynchrone ultrarapide (<1 ms).
- Persistance standardisée (`~/.config/kyber` sur Linux, `%APPDATA%\kyber` sur Windows, `~/Library/Application Support/kyber` sur macOS).
- Redimensionnement dynamique de l'hôte (`/api/resize`) et supervision du cycle de vie du streaming.
- Pipeline GitHub Actions inclus pour compiler automatiquement les binaires Windows (`.exe`), Linux (`.AppImage` / `.deb`) et macOS (`.dmg`).

Pour lancer en développement :
```bash
cd desktop-client
cargo tauri dev
```



---

## ⚙️ Configuration & Environment Variables

All primary options are configurable in `docker-compose.yml`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `LAUNCHER` | `steam` | Application on boot: `steam` (Big Picture), `heroic`, or `desktop`. |
| `RESOLUTION` | `1920x1080` | Initial emulated resolution (`1920x1080`, `2560x1440`, `3840x2160`). |
| `REFRESH_RATE` | `60` | Display refresh rate (`60`, `120`, `144`). |
| `PUID` | `1000` | Internal user UID for volume permissions. |
| `PGID` | `1000` | Internal user GID for volume permissions. |

---

## 📁 Repository Structure

```text
kyber-gaming/
├── Dockerfile                      # Multi-stage build Ubuntu 24.04 (Kyber + Steam + Heroic)
├── docker-compose.yml              # Production-ready Compose deployment file
├── PLAN.md                         # Technical architecture and implementation plan
├── config/
│   ├── kyber/
│   │   └── kyber_config.toml       # Kyber parameters (NVENC, NVFBC, uinput, ports)
│   ├── supervisor/
│   │   └── supervisord.conf        # Process supervisor (DBus, Xorg, PipeWire, Kyber, Steam)
│   ├── xorg/
│   │   ├── xorg.nvidia.conf        # Headless Xorg for NVIDIA GPUs with virtual EDID
│   │   └── xorg.dummy.conf         # Xorg dummy fallback for AMD/Intel GPUs
│   ├── openbox/
│   │   ├── autostart               # Graphical session initialization script
│   │   └── rc.xml                  # Borderless window configuration
│   └── pipewire/
│       └── pipewire.conf.d/
│           └── 10-virtual-sink.conf# Virtual audio sink to capture game audio
└── scripts/
    ├── entrypoint.sh               # Container setup, GPU permissions, and TLS certificates
    ├── init_display.sh             # GPU detection, EDID generation, and Xorg startup
    ├── make_edid.py                # Binary EDID 1.4 gaming generator
    ├── run_kycontroller.sh         # Kyber controller startup wrapper
    ├── resizer_service.py          # Dynamic resolution resize REST API service
    ├── client_autoresize.js        # Browser client auto-resize reporting hook
    └── launch_game_session.sh      # Launcher manager for Steam / Heroic
```

---

## 🖥️ Dynamic Display Resizing

The container includes an integrated display resizer micro-service (`resizer_service.py` on port `8081`).
1. **Automatic**: When opening the Kyber web client, the injected `autoresize.js` script detects your browser viewport and requests the server to adapt the X11 display resolution live.
2. **Manual / REST API**: You can also force any custom resolution via HTTP:
   ```bash
   curl "http://<SERVER_IP>:8081/api/resize?width=2560&height=1440&rate=120"
   ```

---

## 🎮 Gamepads & Peripherals

Controllers connected to your client browser (via the HTML5 Gamepad API) are transmitted in real-time to Kyber, which injects them through `/dev/uinput` as virtual controllers recognized natively by Steam and Proton.

If you connect physical gamepads directly via USB to the host server, the `/dev/input` bind mount also allows Steam to recognize them directly.

---

## 💡 Troubleshooting & FAQ

### 1. No audio in the stream?
Verify in Steam or the game's audio settings that the output device is set to **"Kyber Virtual Audio Sink"** or default system output.

### 2. Container fails to start with NVIDIA GPU?
Ensure that `nvidia-container-toolkit` is working properly on the host:
```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
```

### 3. How to add non-Steam games or console emulators later?
The system utilizes Openbox and persistent volumes (`steam_data` and `heroic_data`). You can install emulators (RetroArch, PCSX2, RPCS3) or frontends (ES-DE) at any time by configuring them in supervisor or launching them through Steam as non-Steam shortcuts.
