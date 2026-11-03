# Spécification Technique & Plan d'Implémentation : Kyber Cloud Gaming Headless

Ce document décrit l'architecture, les spécifications techniques et les étapes de réalisation d'un conteneur Docker dédié au **Cloud Gaming headless**, basé sur **Ubuntu 24.04 LTS**, utilisant la technologie de streaming **Kyber** (`kyber.tech` / `gitlab.com/kyber/kyber`), sans aucun écran physique branché, intégrant **Steam** et des launchers PC alternatifs (**Heroic**).

---

## 1. Contexte & Objectifs

L'objectif est de reproduire et moderniser l'approche de projets comme `docker-steam-headless` :
* **Remplacement de Sunshine par Kyber** : Kyber est un moteur de streaming et de contrôle à ultra-basse latence écrit en Rust par l'équipe VLC, utilisant les protocoles modernes **QUIC** et **WebTransport**, et accessible directement depuis un navigateur web moderne ou une application cliente.
* **Fonctionnement 100% Headless** : Aucun écran physique, ni télévision, ni dongle HDMI/DisplayPort factice ("dummy plug") n'est requis sur la machine hôte. L'affichage et l'EDID sont simulés de manière logicielle avec accélération 3D matérielle complète.
* **Socle** : **Ubuntu 24.04 LTS**.
* **Launchers** : **Steam** (mode Big Picture) et **Heroic Games Launcher** (Epic Games Store & GOG). *(Les émulateurs de consoles sont différés à une phase ultérieure).*

---

## 2. Architecture Système

```mermaid
flowchart TD
    subgraph Host["Hôte (Serveur Linux / Proxmox)"]
        GPU["GPU (Nvidia NVENC / AMD VA-API)"]
        Uinput["Périphérique /dev/uinput (Manettes & Clavier)"]
    end

    subgraph Container["Conteneur Ubuntu 24.04 LTS"]
        subgraph Core["Affichage & Audio Virtuel"]
            EDID["Générateur EDID (1080p, 1440p, 4K @ 60/120/144Hz)"]
            Xorg["Xorg Headless (AllowEmptyInitialConfiguration / Dummy)"]
            Openbox["Gestionnaire de fenêtres léger (Openbox)"]
            Pipewire["PipeWire + Sink virtuel null-audio"]
        end

        subgraph StreamingEngine["Moteur de Streaming"]
            Kyber["Kyber Server (Rust / WebTransport / QUIC)"]
        end

        subgraph Launchers["Applications Gaming"]
            Steam["Steam (Big Picture)"]
            Heroic["Heroic Games Launcher"]
        end

        Supervisor["Superviseur de processus (Supervisord)"]
    end

    subgraph Client["Périphérique Joueur"]
        Browser["Navigateur Web (Chrome/Edge/Firefox) ou Client Kyber"]
        Controller["Manette physique (Xbox / PlayStation)"]
    end

    GPU --> Core
    Uinput --> StreamingEngine
    Core --> Launchers
    Core --> StreamingEngine
    StreamingEngine <-->|Port 8080 UDP/TCP (QUIC + HTTPS)| Browser
    Controller --> Browser
```

---

## 3. Détail des Composants Techniques

### 3.1. Émulation de l'Affichage (Headless Display)
Sur un serveur sans écran, le GPU refuse souvent d'initialiser les contextes de rendu ou les accélérateurs matériels d'encodage (NVENC). Pour pallier cela :
1. **Profil EDID virtuel** :
   * Création d'un bloc EDID binaire (`edid.bin`) injecté dans le serveur X.
   * Définition des modes d'affichage :
     * `1920x1080` @ 60Hz, 120Hz, 144Hz
     * `2560x1440` @ 60Hz, 120Hz, 144Hz
     * `3840x2160` @ 60Hz, 120Hz
2. **Configuration Xorg (`xorg.conf`)** :
   * **Profil NVIDIA** :
     * `ConnectedMonitor "DFP-0"`
     * `CustomEDID "DFP-0:/etc/X11/edid.bin"`
     * `AllowEmptyInitialConfiguration "True"`
     * `UseDisplayDevice "None"`
   * **Profil Dummy (AMD / Fallback)** :
     * Pilote `xserver-xorg-video-dummy` avec Modelines personnalisées haute fréquence.
3. **Résolution dynamique** :
   * Utilisation de `xrandr` pour basculer à la volée vers la résolution native demandée par le client distant.

### 3.2. Moteur Audio Headless
* **PipeWire** remplace avantageusement PulseAudio classique :
  * Démarrage d'un démon PipeWire conteneurisé.
  * Création d'un **sink virtuel** (`pactl load-module module-null-sink sink_name=KyberAudioSink`).
  * Tout le son généré par Proton, Wine et les jeux natifs est routé automatiquement vers ce sink virtuel.
  * Kyber Server capture la sortie moniteur de ce sink pour encoder le flux audio (Opus / AAC).

### 3.3. Intégration de Kyber
* **Binaire & Dépendances** :
  * Multi-stage build Docker compilant `kyber-server` depuis la source officielle GitLab (`gitlab.com/kyber/kyber`) ou intégrant les binaires officiels si disponibles.
* **Configuration `kyber_config.toml`** :
  * Capture vidéo : Capture directe X11 / NVFBC (Nvidia Framebuffer Capture) / PipeWire.
  * Encodage matériel : `h264_nvenc` / `hevc_nvenc` (Nvidia) ou `vaapi` (AMD/Intel).
  * Capture audio : PipeWire Monitor.
  * Entrées : Injection d'événements souris, clavier et manettes Xbox 360 / DualShock virtuelles via `/dev/uinput`.
  * Réseau : Écoute sur le port unifié `8080` (UDP pour QUIC/WebTransport, TCP pour signalisation/HTTP).
  * Sécurité : Certificats TLS auto-générés ou montés, authentification par token ou mot de passe.

### 3.4. Gestionnaire de Session & Launchers
* **Openbox** : Gestionnaire de fenêtres ultra-léger (zéro consommation CPU, aucun compositeur lourd inutile).
* **Steam** :
  * Paquet officiel Steam multi-architecture (`amd64` + `i386`).
  * Support de Proton et Steam Runtime.
  * Option de lancement direct en mode Big Picture (`steam -bigpicture`).
* **Heroic Games Launcher** :
  * Installation via paquet `.deb` officiel ou AppImage.
  * Support d'Epic Games Store, GOG et Amazon Prime Gaming via Wine-GE / Proton-GE.

### 3.5. Superviseur de Processus
* Utilisation de **Supervisord** pour orchestrer et surveiller les processus dans le bon ordre :
  1. `dbus-daemon`
  2. `init-display` (génération EDID + lancement `Xorg :0`)
  3. `pipewire` & `pipewire-pulse`
  4. `openbox`
  5. `kyber-server`
  6. `steam` (ou launcher configuré dans les variables d'environnement)

---

## 4. Structure du Projet

```text
kyber-gaming/
├── Dockerfile                  # Multi-stage build Ubuntu 24.04 (Rust builder + Runtime)
├── docker-compose.yml          # Déploiement type avec GPU pass-through et volumes
├── PLAN.md                     # Copie locale de ce document de référence
├── config/
│   ├── kyber/
│   │   └── kyber_config.toml   # Configuration audio, vidéo, réseau et uinput de Kyber
│   ├── supervisor/
│   │   └── supervisord.conf    # Définition des services et ordre de boot
│   ├── xorg/
│   │   ├── xorg.nvidia.conf    # Conf Xorg pour GPU Nvidia avec EDID simulé
│   │   └── xorg.dummy.conf     # Conf Xorg fallback / AMD
│   ├── openbox/
│   │   └── autostart           # Script de démarrage de l'environnement graphique
│   └── pipewire/
│       └── pipewire.conf.d/    # Configuration du sink audio virtuel
└── scripts/
    ├── entrypoint.sh           # Script d'entrée Docker (droits, détection GPU, certificats)
    ├── init_display.sh         # Préparation de l'écran virtuel et injection EDID
    └── make_edid.py            # Générateur d'EDID 1080p/1440p/4K @ 60/120/144Hz
```

---

## 5. Feuille de Route d'Exécution

| Étape | Description | Livrables |
| :--- | :--- | :--- |
| **Étape 1** | Création de la structure et des scripts d'émulation d'écran (EDID, configurations Xorg) | `scripts/make_edid.py`, `config/xorg/*` |
| **Étape 2** | Configuration audio PipeWire headless | `config/pipewire/*` |
| **Étape 3** | Configuration du serveur Kyber et de son superviseur | `config/kyber/kyber_config.toml`, `config/supervisor/supervisord.conf` |
| **Étape 4** | Rédaction du `Dockerfile` (Ubuntu 24.04, i386, Nvidia/Mesa, Steam, Heroic, Kyber) | `Dockerfile` |
| **Étape 5** | Rédaction du `docker-compose.yml` et guide d'utilisation (`README.md`) | `docker-compose.yml`, `README.md` |
