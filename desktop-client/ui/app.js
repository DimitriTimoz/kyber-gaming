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
    const desktopRomDropZone = document.getElementById('desktopRomDropZone');
    const desktopRomFileInput = document.getElementById('desktopRomFileInput');
    const btnDesktopBrowseRom = document.getElementById('btnDesktopBrowseRom');
    const desktopRomUploadProgress = document.getElementById('desktopRomUploadProgress');
    const desktopRomProgressFill = document.getElementById('desktopRomProgressFill');
    const desktopRomProgressText = document.getElementById('desktopRomProgressText');
    const desktopRomCount = document.getElementById('desktopRomCount');
    const desktopRomPath = document.getElementById('desktopRomPath');
    const desktopRomTableBody = document.getElementById('desktopRomTableBody');
    const desktopRomEmpty = document.getElementById('desktopRomEmpty');

    let currentRomInventory = null;
    let selectedDesktopRomSystem = 'all';

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
                    fetchServerRoms();
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
        ps3: 'PS3',
        ps2: 'PS2',
        psx: 'PS1',
        gamecube: 'GameCube',
        wii: 'Wii',
        switch: 'Switch',
        snes: 'SNES',
        nes: 'NES',
        gba: 'GBA',
        gbc: 'GBC',
        genesis: 'Genesis',
        n64: 'N64',
        arcade: 'Arcade'
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

    async function fetchServerRoms() {
        const server = getSelectedRomServer();
        if (!server) {
            desktopRomCount.textContent = 'No server configured.';
            desktopRomEmpty.style.display = 'block';
            desktopRomEmpty.textContent = 'Add a remote server in the SERVERS tab first.';
            return;
        }

        const resizerPort = 8081;
        const proto = 'https:';
        const url = `${proto}//${server.host}:${resizerPort}/api/roms`;

        try {
            const res = await fetch(url, { method: 'GET' });
            if (res.ok) {
                currentRomInventory = await res.json();
                renderDesktopRoms();
            } else {
                desktopRomCount.textContent = `Server responded with HTTP ${res.status}`;
            }
        } catch (err) {
            // Fallback to http if https failed
            try {
                const resHttp = await fetch(`http://${server.host}:${resizerPort}/api/roms`, { method: 'GET' });
                if (resHttp.ok) {
                    currentRomInventory = await resHttp.json();
                    renderDesktopRoms();
                    return;
                }
            } catch (e) {}
            desktopRomCount.textContent = 'Could not connect to ROM service on server.';
            desktopRomEmpty.style.display = 'block';
            desktopRomEmpty.textContent = `Unable to connect to https://${server.host}:${resizerPort}/api/roms. Ensure the container is online and port 8081 is open.`;
        }
    }

    function renderDesktopRoms() {
        if (!currentRomInventory) return;

        // Render system pills
        desktopRomSystemsBar.innerHTML = '';

        // All pill
        const allPill = document.createElement('button');
        allPill.className = `rom-system-pill ${selectedDesktopRomSystem === 'all' ? 'active' : ''}`;
        allPill.innerHTML = `<span>All Games</span> <span class="rom-pill-count">${currentRomInventory.total_roms}</span>`;
        allPill.addEventListener('click', () => {
            selectedDesktopRomSystem = 'all';
            renderDesktopRoms();
        });
        desktopRomSystemsBar.appendChild(allPill);

        // Individual systems
        (currentRomInventory.systems || []).forEach(sys => {
            const pill = document.createElement('button');
            pill.className = `rom-system-pill ${selectedDesktopRomSystem === sys.id ? 'active' : ''}`;
            const label = ROM_SYSTEM_LABELS[sys.id] || sys.id.toUpperCase();
            pill.innerHTML = `<span>${label}</span> <span class="rom-pill-count">${sys.count}</span>`;
            pill.addEventListener('click', () => {
                selectedDesktopRomSystem = sys.id;
                renderDesktopRoms();
            });
            desktopRomSystemsBar.appendChild(pill);
        });

        // BIOS pill
        const biosPill = document.createElement('button');
        biosPill.className = `rom-system-pill ${selectedDesktopRomSystem === 'bios' ? 'active' : ''}`;
        const biosCount = currentRomInventory.bios ? currentRomInventory.bios.count : 0;
        biosPill.innerHTML = `<span>BIOS</span> <span class="rom-pill-count">${biosCount}</span>`;
        biosPill.addEventListener('click', () => {
            selectedDesktopRomSystem = 'bios';
            renderDesktopRoms();
        });
        desktopRomSystemsBar.appendChild(biosPill);

        // Info headers
        if (selectedDesktopRomSystem === 'all') {
            desktopRomCount.textContent = `${currentRomInventory.total_roms} games installed (${currentRomInventory.total_size})`;
            desktopRomPath.textContent = `Storage: ${currentRomInventory.base_path}`;
        } else if (selectedDesktopRomSystem === 'bios') {
            desktopRomCount.textContent = `${biosCount} BIOS files installed`;
            desktopRomPath.textContent = `Storage: ${currentRomInventory.bios_path}`;
        } else {
            const curSys = (currentRomInventory.systems || []).find(s => s.id === selectedDesktopRomSystem);
            const count = curSys ? curSys.count : 0;
            desktopRomCount.textContent = `${count} games installed for ${curSys ? curSys.name : selectedDesktopRomSystem}`;
            desktopRomPath.textContent = `Storage: ${currentRomInventory.base_path}/${selectedDesktopRomSystem}`;
        }

        // Table
        desktopRomTableBody.innerHTML = '';
        let list = [];

        if (selectedDesktopRomSystem === 'all') {
            (currentRomInventory.systems || []).forEach(sys => {
                (sys.files || []).forEach(f => list.push({ ...f, system: sys.id }));
            });
        } else if (selectedDesktopRomSystem === 'bios') {
            (currentRomInventory.bios ? currentRomInventory.bios.files : []).forEach(f => {
                list.push({ ...f, system: 'bios' });
            });
        } else {
            const curSys = (currentRomInventory.systems || []).find(s => s.id === selectedDesktopRomSystem);
            if (curSys) {
                (curSys.files || []).forEach(f => list.push({ ...f, system: curSys.id }));
            }
        }

        if (list.length === 0) {
            desktopRomEmpty.style.display = 'block';
        } else {
            desktopRomEmpty.style.display = 'none';
            list.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px 18px;"><span class="rom-sys-badge">${item.system.toUpperCase()}</span></td>
                    <td class="rom-filename-cell" style="padding: 10px 18px;">${escapeHtml(item.name)}</td>
                    <td class="rom-size-cell" style="padding: 10px 18px;">${item.size_formatted}</td>
                    <td style="padding: 10px 18px; text-align: right;">
                        <button class="rom-del-btn">Delete</button>
                    </td>
                `;
                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', () => deleteDesktopRom(item.system, item.name));
                desktopRomTableBody.appendChild(tr);
            });
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    async function deleteDesktopRom(system, filename) {
        const server = getSelectedRomServer();
        if (!server) return;
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        const authParams = (server.user && server.password)
            ? `?auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
            : '';

        try {
            const res = await fetch(`https://${server.host}:8081/api/roms/delete${authParams}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system, filename })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast(`Deleted ${filename}`);
                fetchServerRoms();
            } else {
                showToast(data.error || 'Failed to delete file.');
            }
        } catch (err) {
            showToast('Network error during file deletion.');
        }
    }

    function detectDesktopSystem(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        if (selectedDesktopRomSystem !== 'all') return selectedDesktopRomSystem;

        if (['.pkg', '.rap'].includes(ext)) return 'ps3';
        if (['.iso'].includes(ext)) return 'ps2';
        if (['.rvz', '.gcm'].includes(ext)) return 'gamecube';
        if (['.wbfs'].includes(ext)) return 'wii';
        if (['.nsp', '.xci', '.nsz'].includes(ext)) return 'switch';
        if (['.sfc', '.smc'].includes(ext)) return 'snes';
        if (['.nes'].includes(ext)) return 'nes';
        if (['.gba'].includes(ext)) return 'gba';
        if (['.gbc', '.gb'].includes(ext)) return 'gbc';
        if (['.md', '.gen'].includes(ext)) return 'genesis';
        if (['.n64', '.z64', '.v64'].includes(ext)) return 'n64';
        if (['.chd', '.pbp'].includes(ext)) return 'psx';
        if (filename.toLowerCase().includes('bios')) return 'bios';
        return 'arcade';
    }

    function uploadDesktopFilesSequentially(files) {
        const server = getSelectedRomServer();
        if (!server || !files || files.length === 0) return;

        const fileArr = Array.from(files);
        let index = 0;

        desktopRomUploadProgress.style.display = 'block';

        function uploadNext() {
            if (index >= fileArr.length) {
                desktopRomUploadProgress.style.display = 'none';
                showToast(`Successfully uploaded ${fileArr.length} file(s).`);
                fetchServerRoms();
                return;
            }

            const file = fileArr[index];
            const targetSys = detectDesktopSystem(file.name);
            const authParams = (server.user && server.password)
                ? `&auth_user=${encodeURIComponent(server.user)}&auth_pass=${encodeURIComponent(server.password)}`
                : '';
            const uploadUrl = `https://${server.host}:8081/api/roms/upload?system=${encodeURIComponent(targetSys)}&filename=${encodeURIComponent(file.name)}${authParams}`;

            desktopRomProgressText.textContent = `Uploading ${file.name} (${index + 1}/${fileArr.length})...`;
            desktopRomProgressFill.style.width = '0%';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    desktopRomProgressFill.style.width = `${pct}%`;
                    desktopRomProgressText.textContent = `Uploading ${file.name} (${pct}%)...`;
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    index++;
                    uploadNext();
                } else {
                    desktopRomUploadProgress.style.display = 'none';
                    showToast(`Error uploading ${file.name} (HTTP ${xhr.status})`);
                }
            };

            xhr.onerror = function() {
                desktopRomUploadProgress.style.display = 'none';
                showToast(`Network error uploading ${file.name}`);
            };

            xhr.send(file);
        }

        uploadNext();
    }

    function bindRomManagerEvents() {
        if (btnRefreshRoms) btnRefreshRoms.addEventListener('click', fetchServerRoms);
        if (romServerSelect) romServerSelect.addEventListener('change', fetchServerRoms);
        if (btnDesktopBrowseRom) btnDesktopBrowseRom.addEventListener('click', () => desktopRomFileInput.click());
        if (desktopRomFileInput) desktopRomFileInput.addEventListener('change', (e) => uploadDesktopFilesSequentially(e.target.files));

        if (desktopRomDropZone) {
            desktopRomDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                desktopRomDropZone.classList.add('dragover');
            });
            desktopRomDropZone.addEventListener('dragleave', () => {
                desktopRomDropZone.classList.remove('dragover');
            });
            desktopRomDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                desktopRomDropZone.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files) {
                    uploadDesktopFilesSequentially(e.dataTransfer.files);
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
