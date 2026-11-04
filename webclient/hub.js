/**
 * Kyber Cloud Gaming - Industrial Console Web Hub
 * Zero-emoji, dynamic resolution detector, foolproof session quit controller
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
        resolution: '',
        customWidth: 1920,
        customHeight: 1080,
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
                customWidth: state.customWidth,
                customHeight: state.customHeight,
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
    let selResolution, customResRow, inputCustomW, inputCustomH;
    let selFps, selBitrate, selCodec;
    let gamepadStatusLabel, btnVibrateGamepad;
    let btnPlayStream;
    let launcherButtons = [];

    function initUI() {
        createLobbyDOM();
        populateDetectedResolutions();
        bindEvents();
        updateFormValues();
        fetchSystemStatus();
        initGamepadListener();
        bindGlobalExitShortcuts();
    }

    // ==========================================================================
    // Dynamic Screen Resolution Detection
    // ==========================================================================
    function getDisplayResolutionProfiles() {
        const dpr = window.devicePixelRatio || 1;
        // Physical screen resolution
        const physW = Math.round(window.screen.width * dpr);
        const physH = Math.round(window.screen.height * dpr);

        // Logical CSS resolution
        const logW = window.screen.width;
        const logH = window.screen.height;

        return { physW, physH, logW, logH, dpr };
    }

    function gcd(a, b) {
        return b === 0 ? a : gcd(b, a % b);
    }

    function getAspectRatioLabel(w, h) {
        const divisor = gcd(w, h);
        const rw = w / divisor;
        const rh = h / divisor;

        // Approximate standard ratios
        const ratio = w / h;
        if (Math.abs(ratio - 16 / 10) < 0.05) return '16:10';
        if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
        if (Math.abs(ratio - 21 / 9) < 0.1 || Math.abs(ratio - 64 / 27) < 0.1) return '21:9';
        if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
        return `${rw}:${rh}`;
    }

    function populateDetectedResolutions() {
        const { physW, physH, logW, logH, dpr } = getDisplayResolutionProfiles();
        const detectedKey = `${physW}x${physH}`;
        const ratioLabel = getAspectRatioLabel(physW, physH);

        selResolution.innerHTML = '';

        // 1. Group: Detected Screen
        const optGroupDetected = document.createElement('optgroup');
        optGroupDetected.label = 'Ecran detecte (Recommande)';

        const optPhys = document.createElement('option');
        optPhys.value = detectedKey;
        optPhys.textContent = `Natif actuel: ${physW} x ${physH} (${ratioLabel}${dpr > 1 ? `, Retina ${dpr}x` : ''})`;
        optGroupDetected.appendChild(optPhys);

        if (dpr > 1 && (physW !== logW || physH !== logH)) {
            const optLog = document.createElement('option');
            optLog.value = `${logW}x${logH}`;
            optLog.textContent = `Logique reduit: ${logW} x ${logH} (${ratioLabel})`;
            optGroupDetected.appendChild(optLog);
        }
        selResolution.appendChild(optGroupDetected);

        // 2. Group: 16:10 (MacBook / Laptops / Steam Deck)
        const optGroup1610 = document.createElement('optgroup');
        optGroup1610.label = 'Format 16:10 (MacBook / Laptops / Deck)';
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
        selResolution.appendChild(optGroup1610);

        // 3. Group: 16:9 Standard
        const optGroup169 = document.createElement('optgroup');
        optGroup169.label = 'Format 16:9 (Standard)';
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
        selResolution.appendChild(optGroup169);

        // 4. Group: 21:9 Ultrawide
        const optGroup219 = document.createElement('optgroup');
        optGroup219.label = 'Format 21:9 (Ultrawide)';
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
        selResolution.appendChild(optGroup219);

        // 5. Custom
        const optGroupCustom = document.createElement('optgroup');
        optGroupCustom.label = 'Manuel';
        const optCustom = document.createElement('option');
        optCustom.value = 'custom';
        optCustom.textContent = 'Resolution personnalisee...';
        optGroupCustom.appendChild(optCustom);
        selResolution.appendChild(optGroupCustom);

        // Default selection: if previous resolution matches an option, keep it; else select detected
        if (state.resolution && Array.from(selResolution.options).some(o => o.value === state.resolution)) {
            selResolution.value = state.resolution;
        } else {
            state.resolution = detectedKey;
            selResolution.value = detectedKey;
        }

        toggleCustomResRow();
    }

    function toggleCustomResRow() {
        if (selResolution.value === 'custom') {
            customResRow.classList.add('visible');
        } else {
            customResRow.classList.remove('visible');
        }
    }

    // ==========================================================================
    // DOM Creation
    // ==========================================================================
    function createLobbyDOM() {
        lobbyEl = document.createElement('div');
        lobbyEl.id = 'kyber-lobby';
        lobbyEl.innerHTML = `
            <header class="lobby-header">
                <div class="lobby-brand">
                    <div class="lobby-brand-icon">K</div>
                    <div class="lobby-title-wrap">
                        <h1>Kyber Gaming</h1>
                        <p>Self-Hosted Headless Cloud Gaming</p>
                    </div>
                </div>
                <div class="lobby-host-status">
                    <div class="status-badge" id="hub-host-status">
                        <span class="status-dot"></span>
                        <span id="hub-status-text">Verification hote...</span>
                    </div>
                    <div class="host-specs-pill" id="hub-specs-pill">
                        GPU: Detection...
                    </div>
                </div>
            </header>

            <main class="lobby-grid">
                <!-- Card 1: Launcher -->
                <div class="lobby-card">
                    <h2 class="card-title">Environnement / Launcher</h2>
                    <div class="launcher-options">
                        <div class="launcher-btn active" data-launcher="menu">
                            <div>
                                <div class="launcher-name">Console OS Hub</div>
                                <div class="launcher-desc">Interface d'accueil console (Steam, Heroic, Emulateurs)</div>
                            </div>
                            <span class="launcher-tag">Defaut</span>
                        </div>
                        <div class="launcher-btn" data-launcher="steam">
                            <div>
                                <div class="launcher-name">Steam Big Picture</div>
                                <div class="launcher-desc">Session directe plein ecran pour manette</div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                        <div class="launcher-btn" data-launcher="heroic">
                            <div>
                                <div class="launcher-name">Heroic Games Launcher</div>
                                <div class="launcher-desc">Bibliotheque Epic Games et GOG</div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Resolution & Stream Settings -->
                <div class="lobby-card">
                    <h2 class="card-title">Affichage & Flux Video</h2>
                    <div class="setting-group">
                        <label class="setting-label">Resolution cible</label>
                        <select class="setting-select" id="hub-sel-resolution"></select>
                    </div>

                    <div class="custom-res-row" id="hub-custom-res-row">
                        <input type="number" class="custom-res-input" id="hub-input-w" placeholder="Largeur (ex: 2560)" value="2560">
                        <span style="color:var(--kh-text-dim);">&times;</span>
                        <input type="number" class="custom-res-input" id="hub-input-h" placeholder="Hauteur (ex: 1600)" value="1600">
                    </div>

                    <div style="display:flex; gap:0.75rem;">
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">Frequence</label>
                            <select class="setting-select" id="hub-sel-fps">
                                <option value="60">60 FPS</option>
                                <option value="120">120 FPS</option>
                                <option value="144">144 FPS</option>
                            </select>
                        </div>
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">Debit (Bitrate)</label>
                            <select class="setting-select" id="hub-sel-bitrate">
                                <option value="30000000">30 Mbps</option>
                                <option value="50000000">50 Mbps (Recommande)</option>
                                <option value="80000000">80 Mbps (LAN brut)</option>
                            </select>
                        </div>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">Codec Video</label>
                        <select class="setting-select" id="hub-sel-codec">
                            <option value="h264">H.264 (Faible latence & decodage rapide)</option>
                            <option value="hevc">HEVC / H.265 (Qualite accrue)</option>
                        </select>
                    </div>
                </div>

                <!-- Card 3: Controllers & Quit Instructions -->
                <div class="lobby-card">
                    <h2 class="card-title">Peripheriques & Raccourcis</h2>
                    <div class="gamepad-box">
                        <div class="gamepad-indicator" id="hub-gamepad-box">
                            <span class="status-dot"></span>
                            <span id="hub-gamepad-label">Aucune manette detectee</span>
                        </div>
                        <button class="gamepad-vibrate-btn" id="hub-btn-vibrate" style="display:none;">
                            Tester vibration
                        </button>
                    </div>

                    <div style="font-size:0.75rem; color:var(--kh-text-muted); line-height:1.5;">
                        <div style="font-weight:700; color:#fff; margin-bottom:0.35rem;">Comment quitter la session en jeu :</div>
                        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem;">
                            <li>Survolez le bord superieur de l'ecran pour afficher la barre de controle.</li>
                            <li>Appuyez sur <kbd>Echap</kbd> ou <kbd>Ctrl+Shift+Q</kbd>.</li>
                            <li>Cliquez sur le bouton rouge <strong>[Quitter]</strong>.</li>
                        </ul>
                    </div>
                </div>
            </main>

            <footer class="lobby-footer">
                <div class="lobby-hints">
                    Raccourci de sortie: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd> ou survolez la bordure superieure.
                </div>
                <button class="btn-play-stream" id="hub-btn-play">
                    Lancer la session
                </button>
            </footer>
        `;
        document.body.appendChild(lobbyEl);

        // In-game top control bar
        inGameBarEl = document.createElement('div');
        inGameBarEl.id = 'in-game-bar';
        inGameBarEl.style.display = 'none';
        inGameBarEl.innerHTML = `
            <span class="in-game-brand">KYBER</span>
            <span>|</span>
            <span id="ingame-status-fps">Stream actif</span>
            <span>|</span>
            <button class="in-game-btn" id="ingame-btn-fs">Plein ecran</button>
            <button class="in-game-btn" id="ingame-btn-launcher">Launcher</button>
            <button class="in-game-btn" id="ingame-btn-reload">Recharger flux</button>
            <span>|</span>
            <button class="in-game-btn btn-quit-danger" id="ingame-btn-quit">Quitter la session</button>
        `;
        document.body.appendChild(inGameBarEl);

        // Bind DOM references
        badgeHostStatus = document.getElementById('hub-host-status');
        hostSpecsPill = document.getElementById('hub-specs-pill');
        selResolution = document.getElementById('hub-sel-resolution');
        customResRow = document.getElementById('hub-custom-res-row');
        inputCustomW = document.getElementById('hub-input-w');
        inputCustomH = document.getElementById('hub-input-h');
        selFps = document.getElementById('hub-sel-fps');
        selBitrate = document.getElementById('hub-sel-bitrate');
        selCodec = document.getElementById('hub-sel-codec');
        gamepadStatusLabel = document.getElementById('hub-gamepad-label');
        btnVibrateGamepad = document.getElementById('hub-btn-vibrate');
        btnPlayStream = document.getElementById('hub-btn-play');
        launcherButtons = lobbyEl.querySelectorAll('.launcher-btn');
    }

    function updateFormValues() {
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

        selResolution.addEventListener('change', e => {
            state.resolution = e.target.value;
            toggleCustomResRow();
            saveSettings();
        });

        inputCustomW.addEventListener('input', e => {
            state.customWidth = parseInt(e.target.value, 10) || 1920;
            saveSettings();
        });

        inputCustomH.addEventListener('input', e => {
            state.customHeight = parseInt(e.target.value, 10) || 1080;
            saveSettings();
        });

        selFps.addEventListener('change', e => { state.refreshRate = e.target.value; saveSettings(); });
        selBitrate.addEventListener('change', e => { state.bitrate = e.target.value; saveSettings(); });
        selCodec.addEventListener('change', e => { state.codec = e.target.value; saveSettings(); });

        btnPlayStream.addEventListener('click', startStreamingSession);

        // Top bar buttons
        document.getElementById('ingame-btn-quit').addEventListener('click', stopStreamingSession);

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

        // Mouse hovering near the top edge shows in-game bar
        window.addEventListener('mousemove', e => {
            if (inGameBarEl.style.display !== 'none') {
                if (e.clientY <= 40) {
                    inGameBarEl.classList.add('active');
                } else if (e.clientY > 80) {
                    inGameBarEl.classList.remove('active');
                }
            }
        });
    }

    // ==========================================================================
    // Global Exit Hotkeys
    // ==========================================================================
    function bindGlobalExitShortcuts() {
        window.addEventListener('keydown', e => {
            // Ctrl+Shift+Q or Cmd+Shift+Q
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
                e.preventDefault();
                stopStreamingSession();
            }

            // F10 hotkey toggles in-game bar
            if (e.key === 'F10') {
                e.preventDefault();
                inGameBarEl.classList.toggle('active');
            }
        }, true);
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
                    const temp = data.gpu.temp ? ` [${data.gpu.temp}]` : '';
                    hostSpecsPill.textContent = `${data.gpu.name}${temp} | Ecran X11: ${data.active_resolution || '1080p'}`;
                }
            })
            .catch(() => {
                badgeHostStatus.className = 'status-badge offline';
                document.getElementById('hub-status-text').textContent = 'Hote injoignable';
                hostSpecsPill.textContent = 'Service resizer inactif';
            });
    }

    function switchHostLauncher(launcher) {
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/launcher?app=${encodeURIComponent(launcher)}`;
        fetch(url).catch(e => console.warn('Failed to switch launcher:', e));
    }

    function getTargetResolutionDimensions() {
        if (selResolution.value === 'custom') {
            const w = (parseInt(inputCustomW.value, 10) || 1920);
            const h = (parseInt(inputCustomH.value, 10) || 1080);
            return [w, h];
        }

        const parts = selResolution.value.split('x');
        if (parts.length === 2) {
            return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
        }
        return [1920, 1080];
    }

    function resizeHostScreen(w, h, fps) {
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/resize?width=${w}&height=${h}&rate=${fps}`;
        return fetch(url).catch(e => console.warn('Failed to resize display:', e));
    }

    // ==========================================================================
    // Session Lifecycle (Start & Stop)
    // ==========================================================================
    async function startStreamingSession() {
        btnPlayStream.disabled = true;
        btnPlayStream.textContent = 'Preparation session...';

        const [w, h] = getTargetResolutionDimensions();

        // 1. Resize remote host virtual display
        await resizeHostScreen(w, h, state.refreshRate);

        // 2. Switch launcher if requested
        switchHostLauncher(state.selectedLauncher);

        // 3. Inject settings into native Kyber WebClient fields
        applySettingsToWebClient();

        // 4. Hide Lobby, show in-game bar
        setTimeout(() => {
            lobbyEl.classList.add('hidden');
            inGameBarEl.style.display = 'flex';
            inGameBarEl.classList.add('active');
            setTimeout(() => inGameBarEl.classList.remove('active'), 4000);

            btnPlayStream.disabled = false;
            btnPlayStream.textContent = 'Lancer la session';

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

    function stopStreamingSession() {
        // 1. Release pointer lock
        if (document.exitPointerLock) {
            try { document.exitPointerLock(); } catch (e) {}
        }

        // 2. Exit fullscreen
        if (document.fullscreenElement && document.exitFullscreen) {
            try { document.exitFullscreen(); } catch (e) {}
        }

        // 3. Trigger native disconnect
        const btnDisconnect = document.getElementById('disconnect');
        if (btnDisconnect) {
            btnDisconnect.click();
        }

        // 4. Restore Lobby view
        lobbyEl.classList.remove('hidden');
        inGameBarEl.style.display = 'none';
        inGameBarEl.classList.remove('active');

        // 5. Refresh host status
        fetchSystemStatus();
    }

    function applySettingsToWebClient() {
        const bitrateInput = document.getElementById('bitrate');
        if (bitrateInput) bitrateInput.value = state.bitrate;

        const codecSelect = document.getElementById('video_codec');
        if (codecSelect) codecSelect.value = state.codec;

        const kymuxVideoSelect = document.getElementById('kymux_video');
        if (kymuxVideoSelect) kymuxVideoSelect.value = 'gopstream';

        const kymuxAudioSelect = document.getElementById('kymux_audio');
        if (kymuxAudioSelect) kymuxAudioSelect.value = 'unreliable_fec';

        const xboxCheckbox = document.getElementById('gamepad_force_xbox360');
        if (xboxCheckbox) xboxCheckbox.checked = true;

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
                        duration: 400,
                        weakMagnitude: 0.7,
                        strongMagnitude: 0.7
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
        const indicatorBox = document.getElementById('hub-gamepad-box');

        if (gamepads.length > 0) {
            const first = gamepads[0];
            gamepadStatusLabel.textContent = `${first.id} [${gamepads.length} active]`;
            if (indicatorBox) indicatorBox.classList.add('connected');
            if (first.vibrationActuator && btnVibrateGamepad) {
                btnVibrateGamepad.style.display = 'inline-block';
            }
        } else {
            gamepadStatusLabel.textContent = 'Aucune manette detectee (Brancher USB ou Bluetooth)';
            if (indicatorBox) indicatorBox.classList.remove('connected');
            if (btnVibrateGamepad) btnVibrateGamepad.style.display = 'none';
        }
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
