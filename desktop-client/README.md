# Kyber Gaming Desktop Client

Cross-platform native desktop client (Windows, macOS, Linux) built with Rust and Tauri v2 for orchestrating low-latency game streaming with Kyber.

---

## Features

- Server Registry: Save and manage remote Kyber hosts (LAN, Tailscale IP, or public endpoints) with real-time asynchronous ping latency monitoring (<1 ms).
- Dynamic Screen Resolution & Viewport Adjustment:
  - 1080p, 1440p (2K), 4K UHD, or auto-detected display dimensions matching your physical screen.
  - Automatically notifies the server's X11 virtual display via the `/api/resize` REST API before session start.
- Stream Quality & Peripherals Configuration:
  - Framerate: 60, 120 (ProMotion / high-refresh), 144 FPS.
  - Bitrate: 20 to 80 Mbps.
  - Video Codecs: H.264, HEVC / H.265, AV1.
  - Audio Buffer: 50 ms to 120 ms with buffer-underrun protection.
  - Controller Emulation: Automatic Xbox 360 virtual device injection (`--gamepad-force-xbox360 true`).
- ROM & Emulator Game Manager:
  - Dedicated storage interface to view, upload, and delete ROMs and firmware BIOS files on the connected server.
  - Direct file drag-and-drop with console system auto-detection.
- Standardized Operating System Persistence:
  - Linux: `~/.config/kyber/config.json`
  - Windows: `%APPDATA%\kyber\config.json`
  - macOS: `~/Library/Application Support/kyber/config.json`
- Session Lifecycle Management:
  - Launches `kyclient` with specified display and network parameters.
  - Minimizes client window during gameplay and restores upon exit.
  - Clean exit shortcut: use `Ctrl+Q` (or `Cmd+Q` on macOS) to quit streaming and return to the launcher.

---

## Building & Development

### Prerequisites

1. Rust toolchain: [rustup.rs](https://rustup.rs) (stable).
2. Tauri CLI v2:
   ```bash
   cargo install tauri-cli --version "^2.0.0" --locked
   ```

### Run in Development Mode

```bash
cd desktop-client
cargo tauri dev
```

### Build Production Packages Locally

```bash
cd desktop-client
cargo tauri build
```

Bundle output locations:
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg` (or universal binary with `--target universal-apple-darwin`)
- Linux: `src-tauri/target/release/bundle/deb/*.deb` and `appimage/*.AppImage`
- Windows: `src-tauri/target/release/bundle/msi/*.msi` and `nsis/*.exe`

---

## Automated CI Packaging

Binaries are automatically compiled and published through GitHub Actions workflows:
- Matrix compilation for macOS, Linux, and Windows: `.github/workflows/desktop.yml`
- Tagged releases with SHA256 checksums: `.github/workflows/release.yml`
