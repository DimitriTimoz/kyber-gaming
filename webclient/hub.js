/**
 * Kyber Cloud Gaming - Web Hub & Pre-Flight Console Lobby Controller
 */

(function () {
    'use strict';

    // State
    const state = {
        host: window.location.hostname || '127.0.0.1',
        port: window.location.port || '8080',
        resizerPort: 8081,
        systemInfo: null,
        selectedLauncher: 'menu',
        resolution: '1920x1080',
        refreshRate: '60',
        bitrate: '50000000',
        codec: 'h264',
        audioBuffer: '80',
        gamepads: []
    };

    // Load persisted settings
    try {
        const saved = localStorage.getItem('kyber_web_settings');
        if (saved) {
            Object.assign(state, JSON.parse(saved));
        }
    } catch (e) {}

    function saveSettings() {
        try {
            localStorage.setItem('kyber_web_settings', JSON.stringify({
                selectedLauncher: state.selectedLauncher,
                resolution: state.resolution,
                refreshRate: state.refreshRate,
                bitrate: state.bitrate,
                codec: state.codec,
                audioBuffer: state.audioBuffer
            }));
        } catch (e) {}
    }

    // DOM Elements
    let lobbyEl, inGameBarEl;
    let badgeHostStatus, hostSpecsPill;
    let selResolution, selFps, selBitrate, selCodec;
    let gamepadStatusLabel, btnVibrateGamepad;
    let btnPlayStream;
    let launcherButtons = [];

    function initUI() {
        createLobbyDOM();
        bindEvents();
        updateFormValues();
        fetchSystemStatus();
        initGamepadListener();
    }

    function createLobbyDOM() {
        // Create Lobby Overlay
        lobbyEl = document.createElement('div');
        lobbyEl.id = 'kyber-lobby';
        lobbyEl.innerHTML = `
            <header class="lobby-header">
                <div class="lobby-brand">
                    <div class="lobby-logo">🎮</div>
                    <div class="lobby-title-wrap">
                        <h1>Kyber Cloud Gaming</h1>
                        <p>Console Homelab Headless &bull; Ultra-Low Latency</p>
                    </div>
                </div>
                <div class="lobby-host-status">
                    <div class="status-badge" id="hub-host-status">
                        <span class="status-dot"></span>
                        <span id="hub-status-text">Connexion à l'hôte...</span>
                    </div>
                    <div class="host-specs-pill" id="hub-specs-pill">
                        GPU: Détection...
                    </div>
                </div>
            </header>

            <main class="lobby-grid">
                <!-- Card 1: Experience / Launcher -->
                <div class="lobby-card">
                    <h2 class="card-title">🕹️ Mode de Jeu & Launcher</h2>
                    <div class="launcher-options">
                        <div class="launcher-btn active" data-launcher="menu">
                            <div class="launcher-btn-left">
                                <span style="font-size: 1.3rem;">🎮</span>
                                <div>
                                    <div>Console OS Hub</div>
                                    <div style="font-size:0.75rem; color:var(--kh-text-sub); font-weight:normal;">Dashboard kiosk (Steam, Heroic, Émulateurs)</div>
                                </div>
                            </div>
                            <span class="launcher-tag">Recommandé</span>
                        </div>
                        <div class="launcher-btn" data-launcher="steam">
                            <div class="launcher-btn-left">
                                <span style="font-size: 1.3rem;">🚀</span>
                                <div>
                                    <div>Steam Big Picture</div>
                                    <div style="font-size:0.75rem; color:var(--kh-text-sub); font-weight:normal;">Interface console 100% manette</div>
                                </div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                        <div class="launcher-btn" data-launcher="heroic">
                            <div class="launcher-btn-left">
                                <span style="font-size: 1.3rem;">🦸</span>
                                <div>
                                    <div>Heroic Games Launcher</div>
                                    <div style="font-size:0.75rem; color:var(--kh-text-sub); font-weight:normal;">Jeux Epic Games & GOG</div>
                                </div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Resolution & Stream Quality -->
                <div class="lobby-card">
                    <h2 class="card-title">🖥️ Affichage & Qualité Vidéo</h2>
                    <div class="setting-group">
                        <label class="setting-label">Résolution d'écran virtuelle</label>
                        <select class="setting-select" id="hub-sel-resolution">
                            <option value="1920x1080">1080p FHD (1920 × 1080)</option>
                            <option value="2560x1440">1440p 2K (2560 × 1440) — Haute netteté</option>
                            <option value="3840x2160">4K UHD (3840 × 2160) — Ultra net</option>
                            <option value="1280x720">720p HD (1280 × 720)</option>
                        </select>
                    </div>

                    <div style="display:flex; gap:1rem;">
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">FPS</label>
                            <select class="setting-select" id="hub-sel-fps">
                                <option value="60">60 FPS</option>
                                <option value="120">120 FPS</option>
                                <option value="144">144 FPS</option>
                            </select>
                        </div>
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">Débit (Bitrate)</label>
                            <select class="setting-select" id="hub-sel-bitrate">
                                <option value="30000000">30 Mbps (Standard)</option>
                                <option value="50000000">50 Mbps (Recommandé)</option>
                                <option value="80000000">80 Mbps (Ultra Net LAN)</option>
                            </select>
                        </div>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">Codec Vidéo</label>
                        <select class="setting-select" id="hub-sel-codec">
                            <option value="h264">H.264 (Compatibilité & Décodage ultra-rapide)</option>
                            <option value="hevc">HEVC / H.265 (Haute efficacité)</option>
                        </select>
                    </div>
                </div>

                <!-- Card 3: Controllers & Latency -->
                <div class="lobby-card">
                    <h2 class="card-title">🎮 Manettes & Périphériques</h2>
                    <div class="gamepad-box">
                        <div class="gamepad-indicator">
                            <span id="hub-gamepad-icon">🕹️</span>
                            <span id="hub-gamepad-label">Aucune manette détectée (Appuyez sur un bouton)</span>
                        </div>
                        <button class="gamepad-vibrate-btn" id="hub-btn-vibrate" style="display:none;">
                            📳 Tester la vibration
                        </button>
                    </div>
                    <div style="font-size:0.8rem; color:var(--kh-text-sub); line-height:1.4;">
                        Les manettes connectées (Xbox, DualShock, DualSense, Switch) sont reconnues automatiquement et transmises au serveur via l'API Web Gamepad.
                    </div>
                </div>
            </main>

            <footer class="lobby-footer">
                <div class="lobby-hints">
                    💡 Astuce : Passez le curseur en haut au centre de l'écran pendant la partie pour ouvrir la barre rapide.
                </div>
                <button class="btn-play-stream" id="hub-btn-play">
                    <span>Lancer la session</span> 🚀
                </button>
            </footer>
        `;
        document.body.appendChild(lobbyEl);

        // Create In-Game Floating Quick Bar
        inGameBarEl = document.createElement('div');
        inGameBarEl.id = 'in-game-bar';
        inGameBarEl.style.display = 'none';
        inGameBarEl.innerHTML = `
            <span style="color:#00d2ff; font-weight:700;">KYBER</span>
            <span>&bull;</span>
            <button class="in-game-btn" id="ingame-btn-lobby">🏠 Lobby</button>
            <span>&bull;</span>
            <button class="in-game-btn" id="ingame-btn-fs">⛶ Plein écran</button>
            <span>&bull;</span>
            <button class="in-game-btn" id="ingame-btn-launcher">🎮 Launcher</button>
            <span>&bull;</span>
            <button class="in-game-btn" id="ingame-btn-reload">🔄 Recharger</button>
        `;
        document.body.appendChild(inGameBarEl);

        // Bind DOM references
        badgeHostStatus = document.getElementById('hub-host-status');
        hostSpecsPill = document.getElementById('hub-specs-pill');
        selResolution = document.getElementById('hub-sel-resolution');
        selFps = document.getElementById('hub-sel-fps');
        selBitrate = document.getElementById('hub-sel-bitrate');
        selCodec = document.getElementById('hub-sel-codec');
        gamepadStatusLabel = document.getElementById('hub-gamepad-label');
        btnVibrateGamepad = document.getElementById('hub-btn-vibrate');
        btnPlayStream = document.getElementById('hub-btn-play');
        launcherButtons = lobbyEl.querySelectorAll('.launcher-btn');
    }

    function updateFormValues() {
        if (selResolution) selResolution.value = state.resolution;
        if (selFps) selFps.value = state.refreshRate;
        if (selBitrate) selBitrate.value = state.bitrate;
        if (selCodec) selCodec.value = state.codec;

        launcherButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.launcher === state.selectedLauncher);
        });
    }

    function bindEvents() {
        launcherButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                launcherButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.selectedLauncher = btn.dataset.launcher;
                saveSettings();
            });
        });

        selResolution.addEventListener('change', e => { state.resolution = e.target.value; saveSettings(); });
        selFps.addEventListener('change', e => { state.refreshRate = e.target.value; saveSettings(); });
        selBitrate.addEventListener('change', e => { state.bitrate = e.target.value; saveSettings(); });
        selCodec.addEventListener('change', e => { state.codec = e.target.value; saveSettings(); });

        btnPlayStream.addEventListener('click', startStreamingSession);

        // In-game bar buttons
        document.getElementById('ingame-btn-lobby').addEventListener('click', () => {
            // Stop streaming and return to lobby
            const btnDisconnect = document.getElementById('disconnect');
            if (btnDisconnect) btnDisconnect.click();
            lobbyEl.classList.remove('hidden');
            inGameBarEl.style.display = 'none';
        });

        document.getElementById('ingame-btn-fs').addEventListener('click', () => {
            const btnFs = document.getElementById('fullscreen');
            if (btnFs) btnFs.click();
            else if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        });

        document.getElementById('ingame-btn-launcher').addEventListener('click', () => {
            const nextLauncher = state.selectedLauncher === 'menu' ? 'steam' : 'menu';
            state.selectedLauncher = nextLauncher;
            switchHostLauncher(nextLauncher);
        });

        document.getElementById('ingame-btn-reload').addEventListener('click', () => {
            const btnRestart = document.getElementById('restart_streaming');
            if (btnRestart) btnRestart.click();
        });
    }

    // ==========================================================================
    // Host Communication & Dynamic Resizing
    // ==========================================================================
    function fetchSystemStatus() {
        const proto = window.location.protocol;
        const host = state.host;
        const resizerUrl = `${proto}//${host}:${state.resizerPort}/api/system`;

        const start = performance.now();
        fetch(resizerUrl)
            .then(r => r.json())
            .then(data => {
                const latency = Math.round(performance.now() - start);
                state.systemInfo = data;

                badgeHostStatus.className = 'status-badge';
                document.getElementById('hub-status-text').textContent = `En ligne (${latency} ms)`;

                if (data.gpu) {
                    const temp = data.gpu.temp ? ` • ${data.gpu.temp}` : '';
                    hostSpecsPill.textContent = `${data.gpu.name}${temp} [${data.active_resolution || '1080p'}]`;
                }
            })
            .catch(() => {
                badgeHostStatus.className = 'status-badge offline';
                document.getElementById('hub-status-text').textContent = 'Hôte injoignable';
                hostSpecsPill.textContent = 'Service resizer inactif';
            });
    }

    function switchHostLauncher(launcher) {
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/launcher?app=${encodeURIComponent(launcher)}`;
        fetch(url).catch(e => console.warn('Failed to switch launcher:', e));
    }

    function resizeHostScreen(resolution, fps) {
        const [w, h] = resolution.split('x');
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/resize?width=${w}&height=${h}&rate=${fps}`;
        return fetch(url).catch(e => console.warn('Failed to resize display:', e));
    }

    // ==========================================================================
    // Session Launching
    // ==========================================================================
    async function startStreamingSession() {
        btnPlayStream.disabled = true;
        btnPlayStream.innerHTML = `<span>Préparation de la session...</span> ⏳`;

        // 1. Resize remote host virtual display
        await resizeHostScreen(state.resolution, state.refreshRate);

        // 2. Switch launcher if requested
        switchHostLauncher(state.selectedLauncher);

        // 3. Inject settings into native Kyber WebClient fields
        applySettingsToWebClient();

        // 4. Hide Lobby, show in-game bar
        setTimeout(() => {
            lobbyEl.classList.add('hidden');
            inGameBarEl.style.display = 'flex';
            btnPlayStream.disabled = false;
            btnPlayStream.innerHTML = `<span>Lancer la session</span> 🚀`;

            // 5. Trigger WebClient connect
            const btnConnect = document.getElementById('connect');
            if (btnConnect) {
                btnConnect.click();
            }

            // 6. Request fullscreen
            try {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            } catch (e) {}
        }, 300);
    }

    function applySettingsToWebClient() {
        // Bitrate input if present
        const bitrateInput = document.getElementById('bitrate');
        if (bitrateInput) bitrateInput.value = state.bitrate;

        // Video codec input
        const codecSelect = document.getElementById('video_codec');
        if (codecSelect) codecSelect.value = state.codec;

        // Kymux video protocol
        const kymuxVideoSelect = document.getElementById('kymux_video');
        if (kymuxVideoSelect) kymuxVideoSelect.value = 'gopstream';

        // Kymux audio protocol
        const kymuxAudioSelect = document.getElementById('kymux_audio');
        if (kymuxAudioSelect) kymuxAudioSelect.value = 'unreliable_fec';

        // Gamepad Xbox 360 emulation
        const xboxCheckbox = document.getElementById('gamepad_force_xbox360');
        if (xboxCheckbox) xboxCheckbox.checked = true;

        // Audio buffer
        const audioBufferInput = document.getElementById('audio_buffer');
        if (audioBufferInput) audioBufferInput.value = state.audioBuffer;
    }

    // ==========================================================================
    // Gamepad API Handling
    // ==========================================================================
    function initGamepadListener() {
        window.addEventListener('gamepadconnected', onGamepadStateChange);
        window.addEventListener('gamepaddisconnected', onGamepadStateChange);

        setInterval(checkGamepads, 1000);

        if (btnVibrateGamepad) {
            btnVibrateGamepad.addEventListener('click', () => {
                const gp = navigator.getGamepads().find(g => g !== null);
                if (gp && gp.vibrationActuator) {
                    gp.vibrationActuator.playEffect('dual-rumble', {
                        startDelay: 0,
                        duration: 500,
                        weakMagnitude: 0.8,
                        strongMagnitude: 0.8
                    });
                }
            });
        }
    }

    function onGamepadStateChange() {
        checkGamepads();
    }

    function checkGamepads() {
        const gamepads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(g => g !== null);
        if (gamepads.length > 0) {
            const first = gamepads[0];
            gamepadStatusLabel.textContent = `${first.id} (${gamepads.length} connectée${gamepads.length > 1 ? 's' : ''})`;
            document.getElementById('hub-gamepad-icon').textContent = '✅';
            if (first.vibrationActuator && btnVibrateGamepad) {
                btnVibrateGamepad.style.display = 'inline-block';
            }
        } else {
            gamepadStatusLabel.textContent = 'Aucune manette détectée (Branchez une manette USB ou Bluetooth)';
            document.getElementById('hub-gamepad-icon').textContent = '🕹️';
            if (btnVibrateGamepad) btnVibrateGamepad.style.display = 'none';
        }
    }

    // Init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
