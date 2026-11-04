# 🖥️ Kyber Gaming Desktop Client (Cross-Platform)

Client de bureau natif multiplateforme (**Windows**, **macOS**, **Linux**) propulsé par **Rust** et **Tauri v2** pour piloter le streaming de jeux [Kyber](https://kyber.tech/).

---

## 🚀 Fonctionnalités

- 🌐 **Gestionnaire de serveurs** : Enregistrez vos hôtes (LAN direct, IP Tailscale, homelab) avec test de latence asynchrone en temps réel (<1 ms).
- ⚙️ **Réglages avancés** :
  - **Résolution dynamique** : 1080p, 1440p (2K), 4K UHD avec envoi automatique de la commande de redimensionnement de l'écran virtuel du serveur via l'API `/api/resize`.
  - **Framerate** : 60, 120 (ProMotion/High-refresh), 144 FPS.
  - **Débit réseau (Bitrate)** : 20 à 80 Mbps (qualité brute sans artefacts).
  - **Codec vidéo** : H.264, HEVC / H.265, AV1.
  - **Protocole Kymux** : `gopstream` (ultra-faible latence), `unreliable_fec`.
  - **Tampon audio** : 50 ms à 120 ms avec protection anti-drop.
  - **Émulation manette** : Activation automatique de l'émulation Xbox 360 (`--gamepad-force-xbox360 true`).
- 📁 **Persistance standardisée des configurations** :
  - **Linux** : `~/.config/kyber/config.json`
  - **Windows** : `%APPDATA%\kyber\config.json`
  - **macOS** : `~/Library/Application Support/kyber/config.json`
- 🎯 **Supervision de session** : Minimise la fenêtre du client pendant le jeu et la restaure automatiquement dès la fin de la session.

---

## 🛠️ Compilation & Exécution

### Prérequis
1. **Rust & Cargo** : [rustup.rs](https://rustup.rs)
2. **Tauri CLI** :
   ```bash
   cargo install tauri-cli --version "^2.0.0"
   ```

### Lancer en mode développement
```bash
cd desktop-client
cargo tauri dev
```

### Compiler pour la production
```bash
cd desktop-client
cargo tauri build
```

Les installeurs et binaires générés se trouvent dans :
- **Windows** : `src-tauri/target/release/bundle/nsis/` (`.exe`) ou `msi/`
- **Linux** : `src-tauri/target/release/bundle/deb/` (`.deb`) ou `appimage/` (`.AppImage`)
- **macOS** : `src-tauri/target/release/bundle/dmg/` (`.dmg`) ou `macos/` (`.app`)
