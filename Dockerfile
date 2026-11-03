# ==============================================================================
# Multi-stage Dockerfile for Headless Cloud Gaming with Kyber, Steam & Heroic
# Target OS: Ubuntu 24.04 LTS (Noble Numbat)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Kyber Desktop Host and Web Client
# ------------------------------------------------------------------------------
FROM ubuntu:24.04 AS kyber-builder

ENV DEBIAN_FRONTEND=noninteractive

# Install compilation prerequisites
RUN apt-get update && apt-get install -y \
    build-essential cmake meson ninja-build pkg-config \
    llvm-dev libclang-dev clang libssl-dev \
    autoconf libtool curl git wget unzip \
    python3 python3-setuptools python3-mako python3-venv \
    python3-jinja2 \
    lua5.4 liblua5.4-dev \
    autopoint gettext bison flex nasm help2man \
    libdrm-dev libgbm-dev glslang-dev liblcms2-dev libpulse-dev \
    libxcb-xkb-dev libxkbcommon-dev libxcb-xtest0-dev \
    libxcb-render0-dev libxcb-shape0-dev libxcb-xfixes0-dev \
    libwayland-dev wayland-protocols libvulkan-dev \
    libevdev-dev libudev-dev libinput-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust & cargo-c
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.89.0 && \
    cargo install --locked cargo-c@0.10.15

# Clone Kyber Desktop & patch build script to use HTTPS instead of SSH
WORKDIR /src
RUN git clone --depth 1 https://gitlab.com/kyber.stream/apps/kyber-desktop.git && \
    cd kyber-desktop && \
    sed -i 's|git@gitlab.com:|https://gitlab.com/|g' build-linux.sh && \
    sed -i 's|git clone |git clone --depth 1 |g' build-linux.sh || true

# Build Kyber host components (or fallback packaging)
WORKDIR /src/kyber-desktop
RUN ./build-linux.sh -o /opt/kyber || ( \
        echo "Building Kyber host via cargo fallback..." && \
        mkdir -p /opt/kyber/bin /opt/kyber/lib && \
        cargo build --release && \
        cp target/release/ky* /opt/kyber/bin/ 2>/dev/null || true \
    )

# Clone Kyber Web Client
WORKDIR /src
RUN git clone --depth 1 https://gitlab.com/kyber.stream/apps/kyber-web.git && \
    mkdir -p /opt/kyber/webclient && \
    cp -r kyber-web/html/* /opt/kyber/webclient/ || true


# ------------------------------------------------------------------------------
# Stage 2: Final Runtime Gaming Image
# ------------------------------------------------------------------------------
FROM ubuntu:24.04

LABEL maintainer="Antigravity Cloud Gaming" \
      description="Headless Cloud Gaming Docker container with Kyber streaming, Steam, and Heroic"

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    DISPLAY=:0 \
    DISPLAY_NUM=:0 \
    RESOLUTION=1920x1080 \
    REFRESH_RATE=60 \
    LAUNCHER=steam \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=all \
    PULSE_SERVER=unix:/run/user/1000/pulse/native \
    XDG_RUNTIME_DIR=/run/user/1000

# 1. Enable 32-bit multiarch, multiverse & locales
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends software-properties-common locales curl wget ca-certificates && \
    add-apt-repository -y multiverse && \
    locale-gen en_US.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

# 2. Install Xorg headless, Openbox, Supervisor, DBus and system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    xserver-xorg \
    xserver-xorg-video-dummy \
    x11-xserver-utils \
    xinit \
    xdotool \
    x11-utils \
    openbox \
    dbus \
    dbus-x11 \
    supervisor \
    openssl \
    python3 \
    sudo \
    pciutils \
    psmisc \
    procps \
    udev \
    libevdev2 \
    libinput10 \
    libva-x11-2 \
    libva-drm2 \
    libva2 \
    libvdpau1 \
    zenity \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 3. Install PipeWire audio stack
RUN apt-get update && apt-get install -y --no-install-recommends \
    pipewire \
    pipewire-pulse \
    wireplumber \
    libspa-0.2-modules \
    pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*

# 4. Install 32-bit and 64-bit GPU OpenGL / Vulkan runtimes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-dri \
    libgl1-mesa-dri:i386 \
    libgl1:i386 \
    libgl1 \
    libegl1 \
    libegl1:i386 \
    libvulkan1 \
    libvulkan1:i386 \
    mesa-vulkan-drivers \
    mesa-vulkan-drivers:i386 \
    mesa-va-drivers \
    && rm -rf /var/lib/apt/lists/*

# 5. Install Steam
RUN apt-get update && \
    echo "steam steam/question select I AGREE" | debconf-set-selections && \
    echo "steam steam/license note ''" | debconf-set-selections && \
    (apt-get install -y --no-install-recommends steam-installer || \
     (wget -q -O /tmp/steam.deb https://repo.steampowered.com/steam/archive/stable/steam_latest.deb && \
      apt-get install -y --no-install-recommends /tmp/steam.deb && rm -f /tmp/steam.deb)) && \
    rm -rf /var/lib/apt/lists/*

# 6. Install Heroic Games Launcher
RUN HEROIC_DEB_URL=$(curl -s https://api.github.com/repos/Heroic-Games-Launcher/HeroicGamesLauncher/releases/latest | grep "browser_download_url.*amd64.deb" | cut -d : -f 2,3 | tr -d '\"' | head -n 1) && \
    if [ -n "$HEROIC_DEB_URL" ]; then \
        wget -q -O /tmp/heroic.deb "$HEROIC_DEB_URL" && \
        apt-get update && apt-get install -y --no-install-recommends /tmp/heroic.deb && \
        rm -f /tmp/heroic.deb && rm -rf /var/lib/apt/lists/* ; \
    fi

# 7. Create gamer user with sudo & device privileges
RUN useradd -m -s /bin/bash -u 1000 gamer && \
    groupadd -f render && \
    usermod -aG video,audio,input,render,sudo gamer && \
    echo "gamer ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/gamer && \
    chmod 0440 /etc/sudoers.d/gamer

# 8. Copy Kyber from builder stage
COPY --from=kyber-builder /opt/kyber /opt/kyber

# 9. Setup directories and copy project configurations & scripts
RUN mkdir -p /etc/kyber/tls /etc/X11 /var/log/supervisor /run/user/1000 \
    /home/gamer/.config/openbox /home/gamer/.config/pipewire/pipewire.conf.d \
    /home/gamer/.local/share/Steam

COPY config/xorg/xorg.nvidia.conf /etc/kyber/xorg.nvidia.conf
COPY config/xorg/xorg.dummy.conf /etc/kyber/xorg.dummy.conf
COPY config/kyber/kyber_config.toml /etc/kyber/kyber_config.toml
COPY config/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY config/openbox/rc.xml /home/gamer/.config/openbox/rc.xml
COPY config/openbox/autostart /home/gamer/.config/openbox/autostart
COPY config/pipewire/pipewire.conf.d/10-virtual-sink.conf /home/gamer/.config/pipewire/pipewire.conf.d/10-virtual-sink.conf

COPY scripts/make_edid.py /usr/local/bin/make_edid.py
COPY scripts/init_display.sh /usr/local/bin/init_display.sh
COPY scripts/run_kycontroller.sh /usr/local/bin/run_kycontroller.sh
COPY scripts/launch_game_session.sh /usr/local/bin/launch_game_session.sh
COPY scripts/resizer_service.py /usr/local/bin/resizer_service.py
COPY scripts/client_autoresize.js /opt/kyber/webclient/autoresize.js
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh

# Inject auto-resizer script into webclient index.html if present
RUN if [ -f /opt/kyber/webclient/index.html ]; then \
        sed -i 's|</body>|<script src="autoresize.js"></script></body>|g' /opt/kyber/webclient/index.html; \
    fi

RUN chmod +x /usr/local/bin/*.sh /usr/local/bin/*.py /home/gamer/.config/openbox/autostart && \
    chown -R gamer:gamer /home/gamer /etc/kyber /opt/kyber

# Expose Kyber unified port (HTTP/TCP & QUIC/UDP) and dynamic resizer port
EXPOSE 8080/tcp 8080/udp 8081/tcp

# Set working directory to gamer home
WORKDIR /home/gamer

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
