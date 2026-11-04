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
    build-essential cmake ninja-build pkg-config \
    llvm-18-dev libclang-18-dev clang libssl-dev \
    autoconf libtool curl git wget unzip \
    python3 python3-pip python3-setuptools python3-mako python3-venv \
    python3-jinja2 \
    lua5.4 liblua5.4-dev \
    autopoint gettext bison flex nasm help2man \
    libdrm-dev libgbm-dev glslang-dev liblcms2-dev libpulse-dev \
    libxcb-xkb-dev libxkbcommon-dev libxcb-xtest0-dev \
    libxcb-render0-dev libxcb-shape0-dev libxcb-xfixes0-dev \
    libwayland-dev wayland-protocols libvulkan-dev \
    libevdev-dev libudev-dev libinput-dev \
    libsdl2-dev libva-dev libvdpau-dev libasound2-dev \
    ca-certificates \
    && pip3 install --break-system-packages meson \
    && rm -rf /var/lib/apt/lists/*

# Install Rust & cargo-c
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.89.0 && \
    cargo install --locked cargo-c@0.10.15

# 1. Clone kyctl and checkout all dependencies (kymux, kyutil, kynput, kymedia) into /src
WORKDIR /src
RUN git clone --depth 1 https://gitlab.com/kyber.stream/core/kyctl.git && \
    cd kyctl && \
    sed -i 's|git@gitlab.com:${ROOT_NAMESPACE}/|https://gitlab.com/kyber.stream/|g' build-linux.sh && \
    sed -i 's|git@gitlab.com:|https://gitlab.com/|g' build-linux.sh && \
    sed -i 's|git clone |git clone --depth 1 |g' build-linux.sh && \
    mkdir -p /opt/kyber/bin /opt/kyber/lib && \
    ./build-linux.sh -k -s -o /opt/kyber build-kycontroller

# 2. Build kynput (kynputserver for remote input injection)
WORKDIR /src/kynput
RUN sed -i 's|git@gitlab.com:${ROOT_NAMESPACE}/|https://gitlab.com/kyber.stream/|g' build-linux.sh && \
    sed -i 's|git@gitlab.com:|https://gitlab.com/|g' build-linux.sh && \
    ./build-linux.sh -s -o /opt/kyber

# 3. Build kymedia (kyavserver for audio/video capture and encoding)
WORKDIR /src/kymedia
RUN apt-get update && apt-get install -y --no-install-recommends \
        libv4l-dev libxcb-shm0-dev libxcb-randr0-dev libedit-dev libcap-dev && \
    rm -rf /var/lib/apt/lists/* && \
    git submodule update --init --depth 1 subprojects/txproto subprojects/libavconv && \
    sed -i 's|git@gitlab.com:${ROOT_NAMESPACE}/|https://gitlab.com/kyber.stream/|g' build-linux.sh && \
    sed -i 's|git@gitlab.com:|https://gitlab.com/|g' build-linux.sh && \
    sed -i 's|"-Dbuild_server=enabled"|"-Dbuild_server=enabled" "-Dbuild_client=disabled"|g' build-linux.sh && \
    ./build-linux.sh -o /opt/kyber


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
    python3-tk \
    wmctrl \
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
    libv4l-0 \
    libsdl2-2.0-0 \
    libxcb-xkb1 \
    libxkbcommon0 \
    libxcb-xtest0 \
    libxcb-shm0 \
    libxcb-randr0 \
    zenity \
    xdg-utils \
    xserver-xorg-input-libinput \
    xserver-xorg-input-evdev \
    xinput \
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
    (ln -sf /usr/games/steam /usr/local/bin/steam || true) && \
    rm -rf /var/lib/apt/lists/*

# 6. Install Heroic Games Launcher
ARG HEROIC_VERSION="2.22.4"
RUN wget -q -O /tmp/heroic.deb "https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases/download/v${HEROIC_VERSION}/Heroic-${HEROIC_VERSION}-linux-amd64.deb" && \
    apt-get update && \
    apt-get install -y --no-install-recommends /tmp/heroic.deb && \
    rm -f /tmp/heroic.deb && \
    wget -q -O /tmp/chrome.deb "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" && \
    apt-get install -y --no-install-recommends /tmp/chrome.deb && \
    rm -f /tmp/chrome.deb && \
    rm -rf /var/lib/apt/lists/*

# 7. Create gamer user with sudo & device privileges (Ubuntu 24.04 has default 'ubuntu' user with UID 1000)
RUN if id -u ubuntu >/dev/null 2>&1; then userdel -f -r ubuntu 2>/dev/null || true; fi && \
    if getent group ubuntu >/dev/null 2>&1; then groupdel ubuntu 2>/dev/null || true; fi && \
    useradd -m -s /bin/bash -u 1000 gamer && \
    groupadd -f render && \
    usermod -aG video,audio,input,render,sudo gamer && \
    echo "gamer ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/gamer && \
    chmod 0440 /etc/sudoers.d/gamer

# 8. Copy Kyber from builder stage
COPY --from=kyber-builder /opt/kyber /opt/kyber
COPY webclient /opt/kyber/webclient
COPY hub /opt/kyber/hub

RUN echo -e "/opt/kyber/lib\n/opt/kyber/lib/x86_64-linux-gnu\n/opt/kyber/lib64" > /etc/ld.so.conf.d/kyber.conf && ldconfig

# 9. Setup directories and copy project configurations & scripts
RUN mkdir -p /etc/kyber/tls /etc/X11 /var/log/supervisor /run/user/1000 \
    /home/gamer/.config/openbox /home/gamer/.config/pipewire/pipewire.conf.d \
    /home/gamer/.local/share/Steam

COPY config/xorg/xorg.nvidia.conf /etc/kyber/xorg.nvidia.conf
COPY config/xorg/xorg.dummy.conf /etc/kyber/xorg.dummy.conf
COPY config/kyber/kyber_config.toml /etc/kyber/kyber_config.toml
COPY config/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY config/launchers.json /etc/kyber/launchers.json
COPY config/openbox/rc.xml /home/gamer/.config/openbox/rc.xml
COPY config/openbox/menu.xml /home/gamer/.config/openbox/menu.xml
COPY config/openbox/autostart /home/gamer/.config/openbox/autostart
COPY config/pipewire/pipewire.conf.d/ /home/gamer/.config/pipewire/pipewire.conf.d/

COPY scripts/make_edid.py /usr/local/bin/make_edid.py
COPY scripts/init_display.sh /usr/local/bin/init_display.sh
COPY scripts/run_kycontroller.sh /usr/local/bin/run_kycontroller.sh
COPY scripts/switch_launcher.sh /usr/local/bin/switch_launcher.sh
COPY scripts/kyber_console_hub.sh /usr/local/bin/kyber_console_hub.sh
COPY scripts/kyber_launcher_menu.py /usr/local/bin/kyber_launcher_menu.py
COPY scripts/launch_game_session.sh /usr/local/bin/launch_game_session.sh
COPY scripts/resizer_service.py /usr/local/bin/resizer_service.py
COPY scripts/install_nvidia_xorg.sh /usr/local/bin/install_nvidia_xorg.sh
COPY scripts/client_autoresize.js /opt/kyber/webclient/autoresize.js
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh

# Configure ld.so for Kyber shared libraries
RUN echo "/opt/kyber/lib/x86_64-linux-gnu" > /etc/ld.so.conf.d/kyber.conf && \
    echo "/opt/kyber/lib" >> /etc/ld.so.conf.d/kyber.conf && \
    ldconfig

RUN chmod +x /usr/local/bin/*.sh /usr/local/bin/*.py /home/gamer/.config/openbox/autostart && \
    chown -R gamer:gamer /home/gamer /etc/kyber /opt/kyber

# Expose Kyber unified port (HTTP/TCP & QUIC/UDP) and dynamic resizer port
EXPOSE 8080/tcp 8080/udp 8081/tcp

# Set working directory to gamer home
WORKDIR /home/gamer

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
