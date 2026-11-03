# 🎮 Kyber Cloud Gaming (Headless)

Une solution de **Cloud Gaming headless** conteneurisée basée sur **Ubuntu 24.04 LTS**, propulsée par la technologie de streaming ultra-basse latence **[Kyber](https://kyber.tech/)** (écrite en Rust par l'équipe VideoLAN / VLC), avec émulation d'écran virtuel complète, **Steam (Big Picture)** et **Heroic Games Launcher**.

Inspiré de `docker-steam-headless`, cette image modernise l'expérience en remplaçant Sunshine/Moonlight par le protocole **QUIC / WebTransport** de Kyber, accessible directement depuis un simple navigateur web moderne sans nécessiter d'application tierce.

---

## 🚀 Caractéristiques

- 🖥️ **100% Headless** : Aucun écran physique, ni télévision, ni dongle HDMI "dummy" requis sur la machine hôte. L'écran et l'EDID sont simulés de façon logicielle avec accélération 3D matérielle complète.
- ⚡ **Technologie Kyber** :
  - Streaming QUIC / WebTransport à ultra-basse latence sur un **port unifié** (`8080/TCP+UDP`).
  - Interface web cliente intégrée servie nativement (`/webclient`).
  - Capture matérielle X11/NVFBC ou DRM/VA-API et encodage NVENC/VA-API.
- 🕹️ **Launchers PC intégrés** :
  - **Steam** (lancé nativement en mode *Big Picture*).
  - **Heroic Games Launcher** (Epic Games Store & GOG).
  - Mode bureau léger (Openbox) disponible.
- 🎮 **Support complet des manettes** : Injection uinput (Xbox 360, DualShock/DualSense) et souris/clavier à distance.
- 🔊 **Audio virtuel PipeWire** : Routage transparent du son des jeux vers le flux Opus/AAC de Kyber sans carte son physique.
- 📺 **Redimensionnement dynamique automatique** : L'écran virtuel s'adapte automatiquement à la dimension exacte de la fenêtre de votre navigateur ou de votre écran client grâce au micro-service de resize intégré (`port 8081`). Supporte également les résolutions manuelles (1080p, 1440p, 4K jusqu'à 144Hz).

---

## 📋 Prérequis

1. **Docker Engine & Docker Compose** (version récente avec Compose V2).
2. **Accélération graphique hôte** :
   * **NVIDIA** : [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installé et configuré.
   * **AMD / Intel** : Accès au nœud de rendu `/dev/dri`.
3. **Module noyau `uinput`** chargé sur l'hôte :
   ```bash
   sudo modprobe uinput
   echo "uinput" | sudo tee -a /etc/modules-load.d/uinput.conf
   ```

---

## 🛠️ Démarrage Rapide

### 1. Cloner le dépôt
```bash
git clone https://github.com/votre-user/kyber-gaming.git
cd kyber-gaming
```

### 2. Lancer avec Docker Compose
```bash
docker compose up -d --build
```

### 3. Suivre les logs de démarrage
```bash
docker compose logs -f
```

---

## 🌐 Connexion au Stream

Dès que le conteneur est prêt, ouvre ton navigateur web (Google Chrome, Microsoft Edge ou Chromium recommandé) :

👉 **`https://<IP_DU_SERVEUR>:8080/webclient`**

> **Note sur le certificat TLS** : Au premier démarrage, un certificat TLS auto-signé est généré dans `./kyber_tls`. Ton navigateur affichera un avertissement de sécurité que tu peux ignorer pour accéder à l'interface.

---

## ⚙️ Configuration & Variables d'Environnement

Toutes les options principales sont configurables dans le fichier `docker-compose.yml` :

| Variable | Valeur par défaut | Description |
| :--- | :--- | :--- |
| `LAUNCHER` | `steam` | Application au boot : `steam` (Big Picture), `heroic` ou `desktop`. |
| `RESOLUTION` | `1920x1080` | Résolution émulée (`1920x1080`, `2560x1440`, `3840x2160`). |
| `REFRESH_RATE` | `60` | Fréquence de rafraîchissement (`60`, `120`, `144`). |
| `PUID` | `1000` | UID de l'utilisateur interne pour les permissions de volumes. |
| `PGID` | `1000` | GID de l'utilisateur interne. |

---

## 📁 Architecture des Fichiers

```text
kyber-gaming/
├── Dockerfile                      # Multi-stage build Ubuntu 24.04 (Kyber + Steam + Heroic)
├── docker-compose.yml              # Fichier de déploiement type
├── PLAN.md                         # Plan d'architecture technique complet
├── config/
│   ├── kyber/
│   │   └── kyber_config.toml       # Paramètres Kyber (NVENC, NVFBC, uinput, ports)
│   ├── supervisor/
│   │   └── supervisord.conf        # Supervision (DBus, Xorg, PipeWire, Kyber, Steam)
│   ├── xorg/
│   │   ├── xorg.nvidia.conf        # Xorg headless pour GPU NVIDIA avec EDID virtuel
│   │   └── xorg.dummy.conf         # Xorg dummy fallback pour GPU AMD/Intel
│   ├── openbox/
│   │   ├── autostart               # Script d'init de session graphique
│   │   └── rc.xml                  # Paramètres fenêtre sans bordures
│   └── pipewire/
│       └── pipewire.conf.d/
│           └── 10-virtual-sink.conf# Sink audio virtuel pour capter le son des jeux
└── scripts/
    ├── entrypoint.sh               # Init du conteneur, permissions GPU et certificats TLS
    ├── init_display.sh             # Détection GPU, génération EDID et démarrage Xorg
    ├── make_edid.py                # Générateur binaire d'EDID 1.4 gaming
    ├── run_kycontroller.sh         # Wrapper de lancement du démon Kyber
    └── launch_game_session.sh      # Lancement conditionnel de Steam / Heroic
```

---

## 🖥️ Redimensionnement d'écran dynamique

Le conteneur intègre un micro-service de redimensionnement (`resizer_service.py` sur le port `8081`). 
1. **Automatique** : Dès que vous ouvrez le webclient Kyber, le script injecté `autoresize.js` détecte votre résolution et demande au serveur d'adapter l'affichage X11 à votre fenêtre en direct.
2. **Manuel / API** : Vous pouvez également forcer n'importe quelle résolution via un appel HTTP :
   ```bash
   curl "http://<IP_DU_SERVEUR>:8081/api/resize?width=2560&height=1440&rate=120"
   ```

---

## 🎮 Manettes & Périphériques

Les manettes connectées à votre navigateur client (via la Gamepad API) sont transmises en temps réel à Kyber, qui les injecte via `/dev/uinput` sous forme de manettes virtuelles reconnues nativement par Steam et Proton.

Si vous branchez des manettes physiques directement en USB sur le serveur hôte, le montage `/dev/input` permet également à Steam de les reconnaître directement.

---

## 💡 Dépannage & FAQ

### 1. Pas de son dans le stream ?
Vérifie dans Steam ou le jeu que la sortie audio sélectionnée est bien **"Kyber Virtual Audio Sink"** ou la sortie par défaut Pulse/PipeWire.

### 2. Le conteneur ne démarre pas sur GPU NVIDIA ?
Assure-toi que `nvidia-container-toolkit` est bien fonctionnel sur ton hôte :
```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
```

### 3. Comment ajouter des jeux non-Steam ou des consoles plus tard ?
Le système utilise Openbox et des volumes persistants (`steam_data` et `heroic_data`). Tu pourras ajouter des émulateurs (RetroArch, PCSX2, RPCS3) ou des frontends (ES-DE) à tout moment en les déclarant dans le superviseur ou en les lançant depuis Steam en tant que raccourcis non-Steam.
