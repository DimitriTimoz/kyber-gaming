/**
 * Kyber Desktop Client - Industrial UI Controller
 * Zero-emoji, dynamic resolution detector, cross-platform Tauri v2
 */

(function () {
    'use strict';

    // Tauri invoke wrapper
    async function tauriInvoke(cmd, args = {}) {
        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
            return await window.__TAURI__.core.invoke(cmd, args);
        } else if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
            return await window.__TAURI_INTERNALS__.invoke(cmd, args);
        }
        console.warn(`[mock-tauri] invoke('${cmd}')`, args);
        return null;
    }

    let servers = [];
    let settings = {};
    let editingServerId = null;

    // DOM Elements
    const navItems = document.querySelectorAll('.nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const serversGrid = document.getElementById('serversGrid');
    const quickServerCount = document.getElementById('quickServerCount');
    const btnRefreshPings = document.getElementById('btnRefreshPings');
    const btnAddServer = document.getElementById('btnAddServer');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const toast = document.getElementById('toast');

    // Modal Elements
    const serverModal = document.getElementById('serverModal');
    const modalTitle = document.getElementById('modalTitle');
    const btnModalClose = document.getElementById('btnModalClose');
    const btnModalCancel = document.getElementById('btnModalCancel');
    const btnModalSave = document.getElementById('btnModalSave');
    const serverNameInput = document.getElementById('serverNameInput');
    const serverHostInput = document.getElementById('serverHostInput');
    const serverPortInput = document.getElementById('serverPortInput');
    const serverUserInput = document.getElementById('serverUserInput');
    const serverPassInput = document.getElementById('serverPassInput');

    // Settings Input Elements
    const settingResolution = document.getElementById('settingResolution');
    const settingCustomResRow = document.getElementById('settingCustomResRow');
    const customInputW = document.getElementById('customInputW');
    const customInputH = document.getElementById('customInputH');
    const settingRefreshRate = document.getElementById('settingRefreshRate');
    const settingBitrate = document.getElementById('settingBitrate');
    const settingCodec = document.getElementById('settingCodec');
    const settingKymuxVideo = document.getElementById('settingKymuxVideo');
    const settingKymuxAudio = document.getElementById('settingKymuxAudio');
    const settingAudioBuffer = document.getElementById('settingAudioBuffer');
    const settingTlsSkip = document.getElementById('settingTlsSkip');
    const settingForceXbox = document.getElementById('settingForceXbox');
    const settingKeyboardGrab = document.getElementById('settingKeyboardGrab');

    // ROM Manager Elements
    const romServerSelect = document.getElementById('romServerSelect');
    const btnRefreshRoms = document.getElementById('btnRefreshRoms');
    const desktopRomSystemsBar = document.getElementById('desktopRomSystemsBar');
    const desktopRomBreadcrumbs = document.getElementById('desktopRomBreadcrumbs');
    const desktopRomSearchInput = document.getElementById('desktopRomSearchInput');
    const btnDesktopNewFolder = document.getElementById('btnDesktopNewFolder');
    const btnDesktopUploadFiles = document.getElementById('btnDesktopUploadFiles');
    const desktopRomFileInput = document.getElementById('desktopRomFileInput');
    const desktopRomUploadCard = document.getElementById('desktopRomUploadCard');
    const desktopRomUploadTitle = document.getElementById('desktopRomUploadTitle');
    const btnDesktopCancelUpload = document.getElementById('btnDesktopCancelUpload');
    const desktopRomUploadBar = document.getElementById('desktopRomUploadBar');
    const desktopRomUploadStatProgress = document.getElementById('desktopRomUploadStatProgress');
    const desktopRomUploadStatSpeed = document.getElementById('desktopRomUploadStatSpeed');
    const desktopRomUploadStatEta = document.getElementById('desktopRomUploadStatEta');
    const desktopRomDropTarget = document.getElementById('desktopRomDropTarget');
    const desktopRomCount = document.getElementById('desktopRomCount');
    const desktopRomPath = document.getElementById('desktopRomPath');
    const desktopRomTableBody = document.getElementById('desktopRomTableBody');
    const desktopRomEmpty = document.getElementById('desktopRomEmpty');

    let currentDesktopBrowsePath = 'eglantine/games';
    let currentDesktopDirData = null;
    let isDesktopUploadCancelled = false;

    async function init() {
        populateDetectedResolutions();
        bindNavigation();
        bindModalEvents();
        bindSettingsEvents();
        bindRomManagerEvents();

        // Load config from Rust backend
        await loadConfig();
        probeAllServers();
    }

    // ==========================================================================
    // Dynamic Screen Resolution Detection
    // ==========================================================================
    function getDisplayResolutionProfiles() {
        const dpr = window.devicePixelRatio || 1;
        const physW = Math.round(window.screen.width * dpr);
        const physH = Math.round(window.screen.height * dpr);
        const logW = window.screen.width;
        const logH = window.screen.height;
        return { physW, physH, logW, logH, dpr };
    }

    function populateDetectedResolutions() {
        const { physW, physH, logW, logH, dpr } = getDisplayResolutionProfiles();
        const detectedKey = `${physW}x${physH}`;

        settingResolution.innerHTML = '';

        // 1. Group: Detected Screen
        const optGroupDetected = document.createElement('optgroup');
        optGroupDetected.label = 'Detected Display (Recommended)';

        const optPhys = document.createElement('option');
        optPhys.value = detectedKey;
        optPhys.textContent = `Current Native: ${physW} x ${physH}${dpr > 1 ? ` (Retina ${dpr}x)` : ''}`;
        optGroupDetected.appendChild(optPhys);

        if (dpr > 1 && (physW !== logW || physH !== logH)) {
            const optLog = document.createElement('option');
            optLog.value = `${logW}x${logH}`;
            optLog.textContent = `Scaled Logical: ${logW} x ${logH}`;
            optGroupDetected.appendChild(optLog);
        }
        settingResolution.appendChild(optGroupDetected);

        // 2. Group: 16:10 (MacBook / Laptops / Deck)
        const optGroup1610 = document.createElement('optgroup');
        optGroup1610.label = '16:10 Aspect Ratio (MacBook / Deck / Laptops)';
        const res1610 = [
            { w: 3024, h: 1964, label: '3024 x 1964 (MacBook Pro 14")' },
            { w: 2880, h: 1800, label: '2880 x 1800 (MacBook Pro 15")' },
            { w: 2560, h: 1600, label: '2560 x 1600 (MacBook Retina 13"/14")' },
            { w: 1920, h: 1200, label: '1920 x 1200 (WUXGA)' },
            { w: 1280, h: 800, label: '1280 x 800 (Steam Deck)' }
        ];
        res1610.forEach(r => {
            if (`${r.w}x${r.h}` !== detectedKey) {
                const opt = document.createElement('option');
                opt.value = `${r.w}x${r.h}`;
                opt.textContent = r.label;
                optGroup1610.appendChild(opt);
            }
        });
        settingResolution.appendChild(optGroup1610);

        // 3. Group: 16:9 Standard
        const optGroup169 = document.createElement('optgroup');
        optGroup169.label = '16:9 Aspect Ratio (Standard)';
        const res169 = [
            { w: 3840, h: 2160, label: '3840 x 2160 (4K UHD)' },
            { w: 2560, h: 1440, label: '2560 x 1440 (1440p QHD)' },
            { w: 1920, h: 1080, label: '1920 x 1080 (1080p FHD)' },
            { w: 1280, h: 720, label: '1280 x 720 (720p HD)' }
        ];
        res169.forEach(r => {
            if (`${r.w}x${r.h}` !== detectedKey) {
                const opt = document.createElement('option');
                opt.value = `${r.w}x${r.h}`;
                opt.textContent = r.label;
                optGroup169.appendChild(opt);
            }
        });
        settingResolution.appendChild(optGroup169);

        // 4. Group: 21:9 Ultrawide
        const optGroup219 = document.createElement('optgroup');
        optGroup219.label = '21:9 Aspect Ratio (Ultrawide)';
        const res219 = [
            { w: 3440, h: 1440, label: '3440 x 1440 (UWQHD)' },
            { w: 2560, h: 1080, label: '2560 x 1080 (UWFHD)' }
        ];
        res219.forEach(r => {
            if (`${r.w}x${r.h}` !== detectedKey) {
                const opt = document.createElement('option');
                opt.value = `${r.w}x${r.h}`;
                opt.textContent = r.label;
                optGroup219.appendChild(opt);
            }
        });
        settingResolution.appendChild(optGroup219);

        // 5. Custom
        const optGroupCustom = document.createElement('optgroup');
        optGroupCustom.label = 'Manual';
        const optCustom = document.createElement('option');
        optCustom.value = 'custom';
        optCustom.textContent = 'Custom resolution...';
        optGroupCustom.appendChild(optCustom);
        settingResolution.appendChild(optGroupCustom);

        settingResolution.addEventListener('change', () => {
            settingCustomResRow.style.display = settingResolution.value === 'custom' ? 'flex' : 'none';
        });
    }

    async function loadConfig() {
        const config = await tauriInvoke('get_config');
        if (config) {
            servers = config.servers || [];
            settings = config.settings || {};
        } else {
            const { physW, physH } = getDisplayResolutionProfiles();
            servers = [
                { id: 'lan-main', name: 'Homelab Gaming (LAN)', host: '192.168.2.3', port: 8080 },
                { id: 'tailscale-remote', name: 'Serveur Distant (Tailscale)', host: '100.73.113.43', port: 8080 }
            ];
            settings = {
                resolution: `${physW}x${physH}`,
                refresh_rate: '60',
                bitrate: '40000000',
                codec: 'h264',
                kymux_video: 'gopstream',
                kymux_audio: 'unreliable_fec',
                audio_buffer: '80',
                tls_skip: true,
                force_xbox: true,
                keyboard_grab: true
            };
        }

        renderServers();
        applySettingsToUI();
    }

    async function saveCurrentConfig() {
        const config = {
            servers: servers,
            settings: settings
        };
        await tauriInvoke('save_config', { config });
    }

    // ==========================================================================
    // Navigation
    // ==========================================================================
    function bindNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                viewPanels.forEach(p => {
                    p.classList.remove('active');
                    if (p.id === `view${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`) {
                        p.classList.add('active');
                    }
                });

                if (viewId === 'roms') {
                    updateRomServerOptions();
                    loadDesktopDirectory(currentDesktopBrowsePath);
                }
            });
        });
    }

    // ==========================================================================
    // Servers Rendering & Ping
    // ==========================================================================
    function renderServers() {
        serversGrid.innerHTML = '';
        quickServerCount.textContent = `${servers.length} server${servers.length > 1 ? 's' : ''}`;

        servers.forEach(server => {
            const card = document.createElement('div');
            card.className = 'server-card';
            card.id = `card-${server.id}`;

            card.innerHTML = `
                <div class="server-card-top">
                    <div class="server-info-box">
                        <div class="server-name">${server.name}</div>
                        <div class="server-address">${server.host}:${server.port}</div>
                    </div>
                    <div class="server-status-pill status-${server.status || 'checking'}" id="status-${server.id}">
                        <span class="status-dot"></span>
                        <span class="status-label">${getStatusLabel(server)}</span>
                    </div>
                </div>

                <div class="server-card-bottom">
                    <div style="display:flex; gap:0.35rem;">
                        <button class="server-action-btn" onclick="window.editServer('${server.id}')">Edit</button>
                        <button class="server-action-btn" onclick="window.deleteServer('${server.id}')">Delete</button>
                    </div>
                    <button class="btn btn-primary" onclick="window.launchServerSession('${server.id}')">
                        Connect
                    </button>
                </div>
            `;
            serversGrid.appendChild(card);
        });
    }

    function getStatusLabel(server) {
        if (server.status === 'online') {
            return server.latency ? `${server.latency} ms` : 'Online';
        } else if (server.status === 'offline') {
            return 'Offline';
        }
        return 'Checking...';
    }

    async function probeServer(server) {
        server.status = 'checking';
        updateServerPill(server.id);

        try {
            const res = await tauriInvoke('ping_server', { host: server.host, port: server.port });
            if (res && res.online) {
                server.status = 'online';
                server.latency = res.latency_ms;
            } else {
                server.status = 'offline';
                server.latency = null;
            }
        } catch (e) {
            server.status = 'offline';
            server.latency = null;
        }

        updateServerPill(server.id);
    }

    function probeAllServers() {
        servers.forEach(s => probeServer(s));
    }

    function updateServerPill(serverId) {
        const s = servers.find(x => x.id === serverId);
        const pill = document.getElementById(`status-${serverId}`);
        if (s && pill) {
            pill.className = `server-status-pill status-${s.status || 'checking'}`;
            const label = pill.querySelector('.status-label');
            if (label) label.textContent = getStatusLabel(s);
        }
    }

    btnRefreshPings.addEventListener('click', probeAllServers);

    // ==========================================================================
    // Server Launch
    // ==========================================================================
    window.launchServerSession = async function (serverId) {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;

        showToast(`Connexion a ${server.name}...`);

        let chosenResolution = settingResolution.value;
        if (chosenResolution === 'custom') {
            const w = customInputW.value.trim() || '1920';
            const h = customInputH.value.trim() || '1080';
            chosenResolution = `${w}x${h}`;
        }

        const effectiveSettings = {
            ...settings,
            resolution: chosenResolution
        };

        try {
            await tauriInvoke('launch_session', {
                server: {
                    id: server.id,
                    name: server.name,
                    host: server.host,
                    port: server.port,
                    icon: null,
                    auth_user: server.auth_user || null,
                    auth_password: server.auth_password || null
                },
                settings: effectiveSettings
            });
            probeServer(server);
        } catch (err) {
            alert(`Launch error: ${err}`);
        }
    };

    // ==========================================================================
    // Server Modal
    // ==========================================================================
    function bindModalEvents() {
        btnAddServer.addEventListener('click', () => {
            editingServerId = null;
            modalTitle.textContent = 'Add Server';
            serverNameInput.value = '';
            serverHostInput.value = '';
            serverPortInput.value = '8080';
            serverUserInput.value = 'gamer';
            serverPassInput.value = '';
            serverModal.classList.add('active');
        });

        window.editServer = function (serverId) {
            const s = servers.find(x => x.id === serverId);
            if (!s) return;
            editingServerId = serverId;
            modalTitle.textContent = 'Edit Server';
            serverNameInput.value = s.name;
            serverHostInput.value = s.host;
            serverPortInput.value = s.port;
            serverUserInput.value = s.auth_user || 'gamer';
            serverPassInput.value = s.auth_password || '';
            serverModal.classList.add('active');
        };

        window.deleteServer = async function (serverId) {
            if (confirm('Remove this server from the list?')) {
                servers = servers.filter(s => s.id !== serverId);
                renderServers();
                await saveCurrentConfig();
            }
        };

        function closeModal() {
            serverModal.classList.remove('active');
        }

        btnModalClose.addEventListener('click', closeModal);
        btnModalCancel.addEventListener('click', closeModal);

        btnModalSave.addEventListener('click', async () => {
            const name = serverNameInput.value.trim() || 'Game Server';
            const host = serverHostInput.value.trim();
            const port = parseInt(serverPortInput.value, 10) || 8080;
            const auth_user = serverUserInput.value.trim() || 'gamer';
            const auth_password = serverPassInput.value;

            if (!host) {
                alert('Please provide an IP address or hostname.');
                return;
            }

            if (editingServerId) {
                const s = servers.find(x => x.id === editingServerId);
                if (s) {
                    s.name = name;
                    s.host = host;
                    s.port = port;
                    s.auth_user = auth_user;
                    s.auth_password = auth_password;
                }
            } else {
                servers.push({
                    id: 'srv-' + Date.now(),
                    name: name,
                    host: host,
                    port: port,
                    auth_user: auth_user,
                    auth_password: auth_password,
                    status: 'checking'
                });
            }

            closeModal();
            renderServers();
            await saveCurrentConfig();
            probeAllServers();
            showToast('Server saved.');
        });
    }

    // ==========================================================================
    // Settings Handling
    // ==========================================================================
    function applySettingsToUI() {
        if (settings.resolution) {
            if (Array.from(settingResolution.options).some(o => o.value === settings.resolution)) {
                settingResolution.value = settings.resolution;
            } else {
                settingResolution.value = 'custom';
                const parts = settings.resolution.split('x');
                if (parts.length === 2) {
                    customInputW.value = parts[0];
                    customInputH.value = parts[1];
                }
            }
        }
        settingCustomResRow.style.display = settingResolution.value === 'custom' ? 'flex' : 'none';

        if (settings.refresh_rate) settingRefreshRate.value = settings.refresh_rate;
        if (settings.bitrate) settingBitrate.value = settings.bitrate;
        if (settings.codec) settingCodec.value = settings.codec;
        if (settings.kymux_video) settingKymuxVideo.value = settings.kymux_video;
        if (settings.kymux_audio) settingKymuxAudio.value = settings.kymux_audio;
        if (settings.audio_buffer) settingAudioBuffer.value = settings.audio_buffer;
        settingTlsSkip.checked = settings.tls_skip !== false;
        settingForceXbox.checked = settings.force_xbox !== false;
        settingKeyboardGrab.checked = settings.keyboard_grab !== false;
    }

    function bindSettingsEvents() {
        btnSaveSettings.addEventListener('click', async () => {
            let resValue = settingResolution.value;
            if (resValue === 'custom') {
                const w = customInputW.value.trim() || '1920';
                const h = customInputH.value.trim() || '1080';
                resValue = `${w}x${h}`;
            }

            settings = {
                resolution: resValue,
                refresh_rate: settingRefreshRate.value,
                bitrate: settingBitrate.value,
                codec: settingCodec.value,
                kymux_video: settingKymuxVideo.value,
                kymux_audio: settingKymuxAudio.value,
                audio_buffer: settingAudioBuffer.value,
                tls_skip: settingTlsSkip.checked,
                force_xbox: settingForceXbox.checked,
                keyboard_grab: settingKeyboardGrab.checked
            };

            await saveCurrentConfig();
            showToast('Settings saved.');
        });
    }

    // ==========================================================================
    // ROM & Game Manager Controller (Desktop Client)
    // ==========================================================================
    const ROM_SYSTEM_LABELS = {
        switch: 'Switch / NX2',
        bios: 'Keys & Firmware'
    };

    function updateRomServerOptions() {
        romServerSelect.innerHTML = '';
        servers.forEach(srv => {
            const opt = document.createElement('option');
            opt.value = srv.id;
            opt.textContent = `${srv.name} (${srv.host})`;
            romServerSelect.appendChild(opt);
        });
    }

    function getSelectedRomServer() {
        const srvId = romServerSelect.value;
        return servers.find(s => s.id === srvId) || servers[0];
    }

    // ==========================================================================
    // ROM & Game Library Explorer Controller (Desktop Client - Hierarchical)
    // ==========================================================================
    const DESKTOP_PRESET_FOLDERS = [
        { id: 'switch_games', name: 'Switch Games', path: 'eglantine/games' },
        { id: 'switch_updates', name: 'Updates', path: 'eglantine/updates' },
        { id: 'switch_dlc', name: 'DLC Packs', path: 'eglantine/dlc' },
        { id: 'switch_keys', name: 'Keys', path: 'eglantine/keys' },
        { id: 'switch_firmware', name: 'Firmware', path: 'eglantine/firmware' },
        { id: 'switch_mods', name: 'Mods', path: 'eglantine/mods' },
        { id: 'saves', name: 'Saves', path: 'saves' },
        { id: 'all', name: 'All Folders', path: '' }
    ];

    const DESKTOP_FILE_ICONS = {
        folder: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
        rom: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.7 2C3.4 2 0 5.4 0 9.7v4.6C0 18.6 3.4 22 7.7 22H9V2H7.7zM6 9.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5S4.5 11.8 4.5 11s.7-1.5 1.5-1.5zm10.3-7.5H15v20h1.3c4.3 0 7.7-3.4 7.7-7.7V9.7C24 5.4 20.6 2 16.3 2zM18 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg>`,
        key: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 .65-.13 1.26-.36 1.83L18 17.17V20h-3v-2h-2v-2h-2.17l-1.01-1.01C9.26 15.37 8.15 16 7 16zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        archive: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-4v-2h4v2zm0-3h-4v-2h4v2zm0-3h-4V8h4v2z"/></svg>`,
        save: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>`,
        file: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
    };

    function renderDesktopPresetPills() {
        desktopRomSystemsBar.innerHTML = '';
        DESKTOP_PRESET_FOLDERS.forEach(preset => {
            const btn = document.createElement('button');
            const isActive = currentDesktopBrowsePath === preset.path || (preset.path !== '' && currentDesktopBrowsePath.startsWith(preset.path));
            btn.className = `rom-system-pill ${isActive ? 'active' : ''}`;
            btn.innerHTML = `<span>${preset.name}</span>`;
            btn.addEventListener('click', () => {
                loadDesktopDirectory(preset.path);
            });
            desktopRomSystemsBar.appendChild(btn);
        });
    }

    async function loadDesktopDirectory(relPath) {
        const server = getSelectedRomServer();
        if (!server) {
            desktopRomCount.textContent = 'No server configured.';
            desktopRomEmpty.style.display = 'block';
            desktopRomEmpty.textContent = 'Add a remote server in the SERVERS tab first.';
            return;
        }

        currentDesktopBrowsePath = relPath !== undefined ? relPath : currentDesktopBrowsePath;
        const controlPort = 8081;
        const authParams = (server.user && server.password)
            ? `&auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
            : '';

        const urlHttps = `https://${server.host}:${controlPort}/api/roms/browse?path=${encodeURIComponent(currentDesktopBrowsePath)}${authParams}`;
        const urlHttp = `http://${server.host}:${controlPort}/api/roms/browse?path=${encodeURIComponent(currentDesktopBrowsePath)}${authParams}`;

        try {
            let res = await fetch(urlHttps, { method: 'GET' }).catch(() => null);
            if (!res || !res.ok) {
                res = await fetch(urlHttp, { method: 'GET' });
            }

            if (res && res.ok) {
                currentDesktopDirData = await res.json();
                renderDesktopPresetPills();
                renderDesktopDirectoryView();
            } else {
                desktopRomCount.textContent = `Server responded with HTTP ${res ? res.status : 'error'}`;
            }
        } catch (err) {
            desktopRomCount.textContent = 'Could not connect to storage service on server.';
            desktopRomEmpty.style.display = 'block';
            desktopRomEmpty.textContent = `Unable to connect to https://${server.host}:${controlPort}. Ensure the server is reachable.`;
        }
    }

    function renderDesktopDirectoryView() {
        if (!currentDesktopDirData) return;

        // 1. Breadcrumbs
        desktopRomBreadcrumbs.innerHTML = '';
        (currentDesktopDirData.breadcrumbs || []).forEach((crumb, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const item = document.createElement('span');
            item.className = `rom-crumb-item ${isLast ? 'active' : ''}`;
            item.textContent = crumb.name;
            if (!isLast) {
                item.addEventListener('click', () => {
                    loadDesktopDirectory(crumb.path);
                });
            }
            desktopRomBreadcrumbs.appendChild(item);

            if (!isLast) {
                const sep = document.createElement('span');
                sep.className = 'rom-crumb-sep';
                sep.textContent = '/';
                desktopRomBreadcrumbs.appendChild(sep);
            }
        });

        // 2. Storage Header Info
        desktopRomCount.textContent = `${currentDesktopDirData.total_folders} folders, ${currentDesktopDirData.total_files} files (${currentDesktopDirData.total_size_formatted})`;
        desktopRomPath.textContent = `Storage: ${currentDesktopDirData.absolute_path}`;

        // 3. Search Filter
        const query = (desktopRomSearchInput ? desktopRomSearchInput.value : '').trim().toLowerCase();
        const folders = (currentDesktopDirData.folders || []).filter(f => !query || f.name.toLowerCase().includes(query));
        const files = (currentDesktopDirData.files || []).filter(f => !query || f.name.toLowerCase().includes(query));

        desktopRomTableBody.innerHTML = '';

        // Parent Directory row if not root
        if (currentDesktopBrowsePath !== '') {
            const parts = currentDesktopBrowsePath.split('/').filter(Boolean);
            parts.pop();
            const parentPath = parts.join('/');

            const trParent = document.createElement('tr');
            trParent.className = 'rom-folder-row';
            trParent.innerHTML = `
                <td class="rom-filename-cell" style="padding: 10px 18px;">
                    <span class="rom-item-icon" style="color:var(--text-muted);">${DESKTOP_FILE_ICONS.folder}</span>
                    <span class="rom-folder-link">.. [Up one directory]</span>
                </td>
                <td style="padding: 10px 18px;"><span class="rom-sys-badge">PARENT</span></td>
                <td class="rom-size-cell" style="padding: 10px 18px;">--</td>
                <td style="padding: 10px 18px; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">--</td>
                <td style="padding: 10px 18px; text-align: right;"></td>
            `;
            trParent.addEventListener('click', () => loadDesktopDirectory(parentPath));
            desktopRomTableBody.appendChild(trParent);
        }

        if (folders.length === 0 && files.length === 0) {
            desktopRomEmpty.style.display = 'block';
        } else {
            desktopRomEmpty.style.display = 'none';

            // Render folders
            folders.forEach(folder => {
                const tr = document.createElement('tr');
                tr.className = 'rom-folder-row';
                const count = folder.item_count !== undefined ? folder.item_count : (folder.items_count || 0);
                tr.innerHTML = `
                    <td class="rom-filename-cell" style="padding: 10px 18px;">
                        <span class="rom-item-icon" style="color:#60a5fa;">${DESKTOP_FILE_ICONS.folder}</span>
                        <span class="rom-folder-link">${escapeHtml(folder.name)}</span>
                    </td>
                    <td style="padding: 10px 18px;"><span class="rom-sys-badge" style="background:rgba(59,130,246,0.12);color:#93c5fd;">FOLDER</span></td>
                    <td class="rom-size-cell" style="padding: 10px 18px;">${folder.size_formatted} (${count} items)</td>
                    <td style="padding: 10px 18px; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${formatTimestamp(folder.modified)}</td>
                    <td style="padding: 10px 18px; text-align: right;">
                        <button class="rom-del-btn" title="Delete Folder">Delete</button>
                    </td>
                `;

                tr.querySelector('.rom-folder-link').addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadDesktopDirectory(folder.path);
                });

                tr.addEventListener('click', () => loadDesktopDirectory(folder.path));

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteDesktopStorageItem(folder.path, folder.name, true);
                });

                desktopRomTableBody.appendChild(tr);
            });

            // Render files
            const server = getSelectedRomServer();
            const controlPort = 8081;
            const authParams = (server && server.user && server.password)
                ? `&auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
                : '';

            files.forEach(file => {
                const fileType = file.type || file.kind || 'file';
                const fileExt = file.extension || file.ext || '';
                const iconSvg = DESKTOP_FILE_ICONS[fileType] || DESKTOP_FILE_ICONS.file;
                const tr = document.createElement('tr');
                tr.className = 'rom-file-row';

                let kindBadge = 'FILE';
                let kindBadgeStyle = '';
                if (fileType === 'rom') {
                    kindBadge = fileExt.replace('.', '').toUpperCase() || 'ROM';
                    kindBadgeStyle = 'background:rgba(239,68,68,0.12);color:#fca5a5;';
                } else if (fileType === 'key') {
                    kindBadge = 'KEY';
                    kindBadgeStyle = 'background:rgba(234,179,8,0.12);color:#fde047;';
                } else if (fileType === 'archive') {
                    kindBadge = 'ARCHIVE';
                    kindBadgeStyle = 'background:rgba(168,85,247,0.12);color:#d8b4fe;';
                }

                const downloadUrl = server ? `https://${server.host}:${controlPort}/api/roms/download?path=${encodeURIComponent(file.path)}${authParams}` : '#';

                tr.innerHTML = `
                    <td class="rom-filename-cell" style="padding: 10px 18px;">
                        <span class="rom-item-icon">${iconSvg}</span>
                        <span>${escapeHtml(file.name)}</span>
                    </td>
                    <td style="padding: 10px 18px;"><span class="rom-sys-badge" style="${kindBadgeStyle}">${kindBadge}</span></td>
                    <td class="rom-size-cell" style="padding: 10px 18px;">${file.size_formatted}</td>
                    <td style="padding: 10px 18px; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${formatTimestamp(file.modified)}</td>
                    <td style="padding: 10px 18px; text-align: right;">
                        <div class="rom-row-actions">
                            <a href="${downloadUrl}" class="rom-action-icon-btn" title="Download File" download target="_blank">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </a>
                            <button class="rom-del-btn" title="Delete File">Delete</button>
                        </div>
                    </td>
                `;

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteDesktopStorageItem(file.path, file.name, false);
                });

                desktopRomTableBody.appendChild(tr);
            });
        }
    }

    async function promptDesktopCreateFolder() {
        const folderName = window.prompt(`Create new folder inside "${currentDesktopBrowsePath || 'root'}":`);
        if (!folderName || !folderName.trim()) return;

        const server = getSelectedRomServer();
        if (!server) return;
        const controlPort = 8081;
        const authParams = (server.user && server.password)
            ? `?auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
            : '';

        try {
            const res = await fetch(`https://${server.host}:${controlPort}/api/roms/create_folder${authParams}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentDesktopBrowsePath,
                    folder_name: folderName.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast(`Created folder "${data.folder_name}"`);
                loadDesktopDirectory(data.created_path);
            } else {
                showToast(data.error || 'Failed to create folder');
            }
        } catch (err) {
            showToast('Network error while creating folder');
        }
    }

    async function deleteDesktopStorageItem(relPath, displayName, isFolder) {
        const server = getSelectedRomServer();
        if (!server) return;

        const label = isFolder ? `folder "${displayName}" and all its contents` : `file "${displayName}"`;
        if (!confirm(`Are you sure you want to delete ${label}?`)) return;

        const controlPort = 8081;
        const authParams = (server.user && server.password)
            ? `?auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
            : '';

        try {
            const res = await fetch(`https://${server.host}:${controlPort}/api/roms/delete${authParams}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast(`Deleted ${displayName}`);
                loadDesktopDirectory(currentDesktopBrowsePath);
            } else {
                showToast(data.error || 'Failed to delete item');
            }
        } catch (err) {
            showToast('Network error during file deletion');
        }
    }

    const DESKTOP_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

    async function uploadDesktopFilesChunked(files) {
        const server = getSelectedRomServer();
        if (!server || !files || files.length === 0) return;

        const fileArr = Array.from(files);
        isDesktopUploadCancelled = false;
        desktopRomUploadCard.style.display = 'block';

        let totalBytes = fileArr.reduce((sum, f) => sum + f.size, 0);
        let uploadedBytes = 0;
        let overallStartTime = performance.now();

        const controlPort = 8081;
        const authParams = (server.user && server.password)
            ? `&auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
            : '';

        for (let fileIdx = 0; fileIdx < fileArr.length; fileIdx++) {
            if (isDesktopUploadCancelled) {
                showToast('Upload was cancelled.');
                break;
            }

            const file = fileArr[fileIdx];
            const totalChunks = Math.ceil(file.size / DESKTOP_CHUNK_SIZE) || 1;
            const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            desktopRomUploadTitle.textContent = `Uploading ${file.name} (${fileIdx + 1} of ${fileArr.length})...`;

            for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
                if (isDesktopUploadCancelled) break;

                const start = chunkIdx * DESKTOP_CHUNK_SIZE;
                const end = Math.min(start + DESKTOP_CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);
                const chunkSize = end - start;

                try {
                    const uploadUrl = `https://${server.host}:${controlPort}/api/roms/upload_chunk?upload_id=${encodeURIComponent(uploadId)}&filename=${encodeURIComponent(file.name)}&target_path=${encodeURIComponent(currentDesktopBrowsePath)}&chunk_index=${chunkIdx}&total_chunks=${totalChunks}&total_size=${file.size}${authParams}`;

                    await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', uploadUrl, true);
                        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                const currentTotalUploaded = uploadedBytes + e.loaded;
                                const pct = Math.min(100, Math.round((currentTotalUploaded / totalBytes) * 100));

                                const elapsedSec = (performance.now() - overallStartTime) / 1000;
                                const speedBytesPerSec = elapsedSec > 0 ? (currentTotalUploaded / elapsedSec) : 0;
                                const speedMBps = (speedBytesPerSec / (1024 * 1024)).toFixed(1);

                                const remainingBytes = Math.max(0, totalBytes - currentTotalUploaded);
                                const etaSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;

                                desktopRomUploadBar.style.width = `${pct}%`;
                                desktopRomUploadStatProgress.textContent = `${pct}% (${formatBytes(currentTotalUploaded)} / ${formatBytes(totalBytes)})`;
                                desktopRomUploadStatSpeed.textContent = `${speedMBps} MB/s`;
                                desktopRomUploadStatEta.textContent = `ETA: ${formatSeconds(etaSec)}`;
                            }
                        };

                        xhr.onload = () => {
                            if (xhr.status === 200) resolve();
                            else reject(new Error(`HTTP ${xhr.status}`));
                        };

                        xhr.onerror = () => reject(new Error('Network error'));
                        xhr.send(chunkBlob);
                    });

                    uploadedBytes += chunkSize;
                } catch (err) {
                    desktopRomUploadCard.style.display = 'none';
                    showToast(`Error uploading ${file.name}: ${err.message}`);
                    loadDesktopDirectory(currentDesktopBrowsePath);
                    return;
                }
            }
        }

        desktopRomUploadCard.style.display = 'none';
        if (!isDesktopUploadCancelled) {
            showToast(`Uploaded ${fileArr.length} file(s) into ${currentDesktopBrowsePath || 'root'}.`);
            loadDesktopDirectory(currentDesktopBrowsePath);
        }
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatSeconds(secs) {
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}m ${remSecs}s`;
    }

    function formatTimestamp(ts) {
        if (!ts) return '--';
        if (typeof ts === 'number') {
            const d = new Date(ts * 1000);
            return d.toISOString().slice(0, 16).replace('T', ' ');
        }
        return String(ts);
    }

    function bindRomManagerEvents() {
        if (btnRefreshRoms) btnRefreshRoms.addEventListener('click', () => loadDesktopDirectory(currentDesktopBrowsePath));
        if (romServerSelect) romServerSelect.addEventListener('change', () => loadDesktopDirectory(currentDesktopBrowsePath));
        if (btnDesktopNewFolder) btnDesktopNewFolder.addEventListener('click', promptDesktopCreateFolder);
        if (btnDesktopUploadFiles) btnDesktopUploadFiles.addEventListener('click', () => desktopRomFileInput.click());
        if (desktopRomFileInput) desktopRomFileInput.addEventListener('change', (e) => uploadDesktopFilesChunked(e.target.files));

        if (btnDesktopCancelUpload) {
            btnDesktopCancelUpload.addEventListener('click', () => {
                isDesktopUploadCancelled = true;
                desktopRomUploadCard.style.display = 'none';
            });
        }

        if (desktopRomSearchInput) {
            desktopRomSearchInput.addEventListener('input', () => {
                renderDesktopDirectoryView();
            });
        }

        if (desktopRomDropTarget) {
            desktopRomDropTarget.addEventListener('dragover', (e) => {
                e.preventDefault();
                desktopRomDropTarget.classList.add('dragover');
            });
            desktopRomDropTarget.addEventListener('dragleave', () => {
                desktopRomDropTarget.classList.remove('dragover');
            });
            desktopRomDropTarget.addEventListener('drop', (e) => {
                e.preventDefault();
                desktopRomDropTarget.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files) {
                    uploadDesktopFilesChunked(e.dataTransfer.files);
                }
            });
        }
    }

    // ==========================================================================
    // Toast Notification
    // ==========================================================================
    let toastTimer = null;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
