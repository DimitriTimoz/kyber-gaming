/**
 * Kyber Gaming Launcher - Client GUI Controller
 */

(function () {
    'use strict';

    // Default configuration
    const DEFAULT_SERVERS = [
        {
            id: 'lan-main',
            name: 'Homelab Gaming (LAN Direct)',
            host: '192.168.2.3',
            port: 8080,
            icon: '⚡',
            status: 'checking',
            latency: null
        },
        {
            id: 'tailscale-remote',
            name: 'Serveur Distant (Tailscale)',
            host: '100.73.113.43',
            port: 8080,
            icon: '🌐',
            status: 'checking',
            latency: null
        }
    ];

    const DEFAULT_SETTINGS = {
        resolution: '1920x1080',
        refreshRate: '60',
        bitrate: '40000000',
        codec: 'h264',
        kymuxVideo: 'gopstream',
        kymuxAudio: 'unreliable_fec',
        audioBuffer: '80',
        tlsSkip: true,
        forceXbox: true,
        keyboardGrab: true
    };

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

    // Settings Input Elements
    const settingResolution = document.getElementById('settingResolution');
    const settingRefreshRate = document.getElementById('settingRefreshRate');
    const settingBitrate = document.getElementById('settingBitrate');
    const settingCodec = document.getElementById('settingCodec');
    const settingKymuxVideo = document.getElementById('settingKymuxVideo');
    const settingKymuxAudio = document.getElementById('settingKymuxAudio');
    const settingAudioBuffer = document.getElementById('settingAudioBuffer');
    const settingTlsSkip = document.getElementById('settingTlsSkip');
    const settingForceXbox = document.getElementById('settingForceXbox');
    const settingKeyboardGrab = document.getElementById('settingKeyboardGrab');

    // ==========================================================================
    // Native Swift Communication Bridge
    // ==========================================================================
    function sendToNative(action, payload = {}) {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.kyber) {
            window.webkit.messageHandlers.kyber.postMessage({ action, ...payload });
        } else {
            console.log(`[native-mock] Action: ${action}`, payload);
        }
    }

    // Callback called by native Swift when a ping probe completes
    window.onServerPingResult = function (serverId, isOnline, latencyMs) {
        const s = servers.find(x => x.id === serverId);
        if (s) {
            s.status = isOnline ? 'online' : 'offline';
            s.latency = isOnline ? latencyMs : null;
            updateServerCardStatus(serverId);
        }
    };

    // Callback called by native Swift when stored config is loaded
    window.onLoadNativeConfig = function (loadedData) {
        if (loadedData) {
            if (loadedData.servers) servers = loadedData.servers;
            if (loadedData.settings) settings = loadedData.settings;
            applySettingsToUI();
            renderServers();
            probeAllServers();
        }
    };

    // ==========================================================================
    // Storage & Initialization
    // ==========================================================================
    function loadData() {
        try {
            const savedServers = localStorage.getItem('kyber_servers');
            servers = savedServers ? JSON.parse(savedServers) : DEFAULT_SERVERS;
        } catch (e) {
            servers = DEFAULT_SERVERS;
        }

        try {
            const savedSettings = localStorage.getItem('kyber_settings');
            settings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
        } catch (e) {
            settings = DEFAULT_SETTINGS;
        }

        applySettingsToUI();
        renderServers();

        // Request native config sync if available
        sendToNative('get_config');

        // Ping servers
        probeAllServers();
    }

    function saveLocalData() {
        try {
            localStorage.setItem('kyber_servers', JSON.stringify(servers));
            localStorage.setItem('kyber_settings', JSON.stringify(settings));
        } catch (e) {}

        sendToNative('save_config', { servers, settings });
    }

    // ==========================================================================
    // UI Navigation (Tabs)
    // ==========================================================================
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
        });
    });

    // ==========================================================================
    // Servers View Rendering & Probing
    // ==========================================================================
    function renderServers() {
        serversGrid.innerHTML = '';
        quickServerCount.textContent = `${servers.length} serveur${servers.length > 1 ? 's' : ''} configuré${servers.length > 1 ? 's' : ''}`;

        servers.forEach(server => {
            const card = document.createElement('div');
            card.className = 'server-card';
            card.id = `card-${server.id}`;

            card.innerHTML = `
                <div class="server-card-top">
                    <div class="server-info-box">
                        <div class="server-icon">${server.icon || '🖥️'}</div>
                        <div>
                            <div class="server-name">${server.name}</div>
                            <div class="server-address">${server.host}:${server.port}</div>
                        </div>
                    </div>
                    <div class="server-status-pill status-${server.status}" id="status-${server.id}">
                        <span class="status-dot"></span>
                        <span class="status-label">${getStatusLabel(server)}</span>
                    </div>
                </div>

                <div class="server-card-bottom">
                    <div class="server-actions-secondary">
                        <button class="server-action-btn" title="Modifier" onclick="window.editServer('${server.id}')">✏️</button>
                        <button class="server-action-btn btn-delete" title="Supprimer" onclick="window.deleteServer('${server.id}')">🗑️</button>
                    </div>
                    <button class="btn btn-primary" onclick="window.connectToServer('${server.id}')">
                        <span>Lancer la session</span> 🚀
                    </button>
                </div>
            `;

            serversGrid.appendChild(card);
        });
    }

    function getStatusLabel(server) {
        if (server.status === 'online') {
            return server.latency !== null ? `En ligne (${server.latency} ms)` : 'En ligne';
        } else if (server.status === 'offline') {
            return 'Injoignable';
        }
        return 'Test en cours...';
    }

    function updateServerCardStatus(serverId) {
        const server = servers.find(s => s.id === serverId);
        const pill = document.getElementById(`status-${serverId}`);
        if (server && pill) {
            pill.className = `server-status-pill status-${server.status}`;
            const label = pill.querySelector('.status-label');
            if (label) label.textContent = getStatusLabel(server);
        }
    }

    function probeAllServers() {
        servers.forEach(server => {
            server.status = 'checking';
            updateServerCardStatus(server.id);

            // Native ping probe
            sendToNative('ping_server', {
                serverId: server.id,
                host: server.host,
                port: server.port
            });

            // Browser fetch fallback probe
            testServerHttp(server);
        });
    }

    function testServerHttp(server) {
        const start = performance.now();
        const testUrl = `https://${server.host}:${server.port}/capabilities`;
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 2000);

        fetch(testUrl, { method: 'GET', signal: ctrl.signal, mode: 'no-cors' })
            .then(() => {
                clearTimeout(timeout);
                const latency = Math.round(performance.now() - start);
                window.onServerPingResult(server.id, true, latency);
            })
            .catch(() => {
                clearTimeout(timeout);
                // Also check resizer port 8081 fallback
                const resizerUrl = `https://${server.host}:8081/api/system`;
                const ctrl2 = new AbortController();
                const timeout2 = setTimeout(() => ctrl2.abort(), 1500);
                fetch(resizerUrl, { method: 'GET', signal: ctrl2.signal, mode: 'no-cors' })
                    .then(() => {
                        clearTimeout(timeout2);
                        const latency = Math.round(performance.now() - start);
                        window.onServerPingResult(server.id, true, latency);
                    })
                    .catch(() => {
                        clearTimeout(timeout2);
                        // If native ping didn't already succeed, mark offline
                        if (server.status === 'checking') {
                            window.onServerPingResult(server.id, false, null);
                        }
                    });
            });
    }

    btnRefreshPings.addEventListener('click', probeAllServers);

    // ==========================================================================
    // Server Connect Handler
    // ==========================================================================
    window.connectToServer = function (serverId) {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;

        showToast(`Connexion à ${server.name}...`);

        sendToNative('launch_session', {
            server: {
                host: server.host,
                port: server.port,
                name: server.name
            },
            settings: {
                ...settings
            }
        });
    };

    // ==========================================================================
    // Server Modal (Add / Edit / Delete)
    // ==========================================================================
    btnAddServer.addEventListener('click', () => {
        editingServerId = null;
        modalTitle.textContent = 'Ajouter un Serveur';
        serverNameInput.value = '';
        serverHostInput.value = '';
        serverPortInput.value = '8080';
        serverModal.classList.add('active');
    });

    window.editServer = function (serverId) {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;
        editingServerId = serverId;
        modalTitle.textContent = 'Modifier le Serveur';
        serverNameInput.value = server.name;
        serverHostInput.value = server.host;
        serverPortInput.value = server.port;
        serverModal.classList.add('active');
    };

    window.deleteServer = function (serverId) {
        if (confirm('Voulez-vous supprimer ce serveur de votre liste ?')) {
            servers = servers.filter(s => s.id !== serverId);
            saveLocalData();
            renderServers();
        }
    };

    function closeModal() {
        serverModal.classList.remove('active');
    }

    btnModalClose.addEventListener('click', closeModal);
    btnModalCancel.addEventListener('click', closeModal);

    btnModalSave.addEventListener('click', () => {
        const name = serverNameInput.value.trim() || 'Serveur de Jeu';
        const host = serverHostInput.value.trim();
        const port = parseInt(serverPortInput.value, 10) || 8080;

        if (!host) {
            alert('Veuillez renseigner une adresse IP ou un nom d’hôte valide.');
            return;
        }

        if (editingServerId) {
            const server = servers.find(s => s.id === editingServerId);
            if (server) {
                server.name = name;
                server.host = host;
                server.port = port;
            }
        } else {
            servers.push({
                id: 'srv-' + Date.now(),
                name: name,
                host: host,
                port: port,
                icon: host.startsWith('192.168.') || host.startsWith('10.') ? '⚡' : '🌐',
                status: 'checking',
                latency: null
            });
        }

        saveLocalData();
        renderServers();
        closeModal();
        probeAllServers();
        showToast('Serveur enregistré !');
    });

    // ==========================================================================
    // Settings Save & Apply
    // ==========================================================================
    function applySettingsToUI() {
        if (settings.resolution) settingResolution.value = settings.resolution;
        if (settings.refreshRate) settingRefreshRate.value = settings.refreshRate;
        if (settings.bitrate) settingBitrate.value = settings.bitrate;
        if (settings.codec) settingCodec.value = settings.codec;
        if (settings.kymuxVideo) settingKymuxVideo.value = settings.kymuxVideo;
        if (settings.kymuxAudio) settingKymuxAudio.value = settings.kymuxAudio;
        if (settings.audioBuffer) settingAudioBuffer.value = settings.audioBuffer;
        settingTlsSkip.checked = settings.tlsSkip !== false;
        settingForceXbox.checked = settings.forceXbox !== false;
        settingKeyboardGrab.checked = settings.keyboardGrab !== false;
    }

    btnSaveSettings.addEventListener('click', () => {
        settings = {
            resolution: settingResolution.value,
            refreshRate: settingRefreshRate.value,
            bitrate: settingBitrate.value,
            codec: settingCodec.value,
            kymuxVideo: settingKymuxVideo.value,
            kymuxAudio: settingKymuxAudio.value,
            audioBuffer: settingAudioBuffer.value,
            tlsSkip: settingTlsSkip.checked,
            forceXbox: settingForceXbox.checked,
            keyboardGrab: settingKeyboardGrab.checked
        };

        saveLocalData();
        showToast('Paramètres de streaming enregistrés avec succès !');
    });

    // ==========================================================================
    // Toast Helper
    // ==========================================================================
    let toastTimer = null;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Init
    loadData();
})();
