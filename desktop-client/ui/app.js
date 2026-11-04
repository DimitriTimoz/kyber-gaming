/**
 * Kyber Desktop Client - Cross-Platform UI Controller
 * Powered by Rust + Tauri v2
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

    async function init() {
        bindNavigation();
        bindModalEvents();
        bindSettingsEvents();

        // Load config from Rust backend
        await loadConfig();
        probeAllServers();
    }

    async function loadConfig() {
        const config = await tauriInvoke('get_config');
        if (config) {
            servers = config.servers || [];
            settings = config.settings || {};
        } else {
            // Default fallback
            servers = [
                { id: 'lan-main', name: 'Homelab Gaming (LAN)', host: '192.168.2.3', port: 8080, icon: '⚡' },
                { id: 'tailscale-remote', name: 'Serveur Distant (Tailscale)', host: '100.73.113.43', port: 8080, icon: '🌐' }
            ];
            settings = {
                resolution: '1920x1080',
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
            });
        });
    }

    // ==========================================================================
    // Servers Rendering & Ping
    // ==========================================================================
    function renderServers() {
        serversGrid.innerHTML = '';
        quickServerCount.textContent = `${servers.length} serveur${servers.length > 1 ? 's' : ''}`;

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
                    <div class="server-status-pill status-${server.status || 'checking'}" id="status-${server.id}">
                        <span class="pulse-dot"></span>
                        <span class="status-label">${getStatusLabel(server)}</span>
                    </div>
                </div>

                <div class="server-card-bottom">
                    <div style="display:flex; gap:0.25rem;">
                        <button class="server-action-btn" title="Modifier" onclick="window.editServer('${server.id}')">✏️</button>
                        <button class="server-action-btn" title="Supprimer" onclick="window.deleteServer('${server.id}')">🗑️</button>
                    </div>
                    <button class="btn btn-primary" onclick="window.launchServerSession('${server.id}')">
                        <span>Lancer</span> 🚀
                    </button>
                </div>
            `;
            serversGrid.appendChild(card);
        });
    }

    function getStatusLabel(server) {
        if (server.status === 'online') {
            return server.latency ? `${server.latency} ms` : 'En ligne';
        } else if (server.status === 'offline') {
            return 'Injoignable';
        }
        return 'Test...';
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

        showToast(`Connexion à ${server.name}...`);

        try {
            await tauriInvoke('launch_session', {
                server: {
                    id: server.id,
                    name: server.name,
                    host: server.host,
                    port: server.port,
                    icon: server.icon || null
                },
                settings: settings
            });
            probeServer(server);
        } catch (err) {
            alert(`Erreur de lancement : ${err}`);
        }
    };

    // ==========================================================================
    // Server Modal (Add / Edit / Delete)
    // ==========================================================================
    function bindModalEvents() {
        btnAddServer.addEventListener('click', () => {
            editingServerId = null;
            modalTitle.textContent = 'Ajouter un Serveur';
            serverNameInput.value = '';
            serverHostInput.value = '';
            serverPortInput.value = '8080';
            serverModal.classList.add('active');
        });

        window.editServer = function (serverId) {
            const s = servers.find(x => x.id === serverId);
            if (!s) return;
            editingServerId = serverId;
            modalTitle.textContent = 'Modifier le Serveur';
            serverNameInput.value = s.name;
            serverHostInput.value = s.host;
            serverPortInput.value = s.port;
            serverModal.classList.add('active');
        };

        window.deleteServer = async function (serverId) {
            if (confirm('Voulez-vous supprimer ce serveur ?')) {
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
            const name = serverNameInput.value.trim() || 'Serveur de Jeu';
            const host = serverHostInput.value.trim();
            const port = parseInt(serverPortInput.value, 10) || 8080;

            if (!host) {
                alert('Veuillez renseigner une adresse hôte ou IP valide.');
                return;
            }

            if (editingServerId) {
                const s = servers.find(x => x.id === editingServerId);
                if (s) {
                    s.name = name;
                    s.host = host;
                    s.port = port;
                }
            } else {
                servers.push({
                    id: 'srv-' + Date.now(),
                    name: name,
                    host: host,
                    port: port,
                    icon: host.startsWith('192.168.') || host.startsWith('10.') ? '⚡' : '🌐',
                    status: 'checking'
                });
            }

            closeModal();
            renderServers();
            await saveCurrentConfig();
            probeAllServers();
            showToast('Serveur enregistré !');
        });
    }

    // ==========================================================================
    // Settings Handling
    // ==========================================================================
    function applySettingsToUI() {
        if (settings.resolution) settingResolution.value = settings.resolution;
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
            settings = {
                resolution: settingResolution.value,
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
            showToast('Paramètres enregistrés !');
        });
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
