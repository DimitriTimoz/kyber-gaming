/**
 * Kyber Cloud Gaming - Industrial Console Web Hub
 * Zero-emoji, Geist typography, authenticated lock gate, dynamic resolution detection
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
        authUser: '',
        authPass: '',
        isAuthenticated: false,
        gamepads: []
    };

    // Load persisted settings & auth
    try {
        const savedSettings = localStorage.getItem('kyber_web_settings');
        if (savedSettings) {
            Object.assign(state, JSON.parse(savedSettings));
        }

        const savedUser = localStorage.getItem('kyber_auth_user');
        const savedPass = localStorage.getItem('kyber_auth_pass');
        if (savedUser && savedPass) {
            state.authUser = savedUser;
            state.authPass = savedPass;
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
    let lobbyEl, inGameBarEl, authGateEl;
    let badgeHostStatus, hostSpecsPill, userAuthBadge;
    let selResolution, customResRow, inputCustomW, inputCustomH;
    let selFps, selBitrate, selCodec;
    let gamepadStatusLabel, btnVibrateGamepad;
    let btnPlayStream;
    let launcherButtons = [];

    // Auth Elements
    let inputAuthUser, inputAuthPass, checkRememberAuth, btnAuthSubmit, authErrorBanner;

    function initUI() {
        createLobbyDOM();
        createAuthGateDOM();
        populateDetectedResolutions();
        bindEvents();
        updateFormValues();
        fetchSystemStatus();
        initGamepadListener();
        bindGlobalExitShortcuts();

        // Check authentication
        checkAuthOnBoot();
    }

    // ==========================================================================
    // Authentication Gate Handling
    // ==========================================================================
    function createAuthGateDOM() {
        authGateEl = document.createElement('div');
        authGateEl.id = 'hub-auth-gate';
        authGateEl.className = 'auth-gate-overlay';
        authGateEl.innerHTML = `
            <div class="auth-gate-box">
                <div>
                    <h2 class="auth-gate-title">Secure Connection</h2>
                    <p class="auth-gate-subtitle">Enter your credentials to access the Kyber Gaming host.</p>
                </div>

                <div class="auth-error-banner" id="hub-auth-error">Invalid credentials.</div>

                <div class="setting-group">
                    <label class="setting-label">Username</label>
                    <input type="text" class="setting-input" id="hub-input-user" value="${state.authUser || 'gamer'}" placeholder="e.g. gamer">
                </div>

                <div class="setting-group">
                    <label class="setting-label">Password</label>
                    <input type="password" class="setting-input" id="hub-input-pass" value="${state.authPass || ''}" placeholder="Password">
                </div>

                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.76rem; color:var(--kh-text-muted); cursor:pointer;">
                    <input type="checkbox" id="hub-check-remember" checked>
                    <span>Remember on this device</span>
                </label>

                <button class="auth-btn-submit" id="hub-btn-login">Unlock Console</button>
            </div>
        `;
        document.body.appendChild(authGateEl);

        inputAuthUser = document.getElementById('hub-input-user');
        inputAuthPass = document.getElementById('hub-input-pass');
        checkRememberAuth = document.getElementById('hub-check-remember');
        btnAuthSubmit = document.getElementById('hub-btn-login');
        authErrorBanner = document.getElementById('hub-auth-error');

        btnAuthSubmit.addEventListener('click', performLogin);
        inputAuthPass.addEventListener('keydown', e => {
            if (e.key === 'Enter') performLogin();
        });
    }

    async function checkAuthOnBoot() {
        if (state.authUser && state.authPass) {
            const ok = await verifyCredentials(state.authUser, state.authPass);
            if (ok) {
                unlockConsole(state.authUser, state.authPass);
                return;
            }
        }
        lockConsole();
    }

    async function verifyCredentials(user, pass) {
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/auth/verify?auth_user=${encodeURIComponent(user)}&auth_pass=${encodeURIComponent(pass)}`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                return data.authenticated === true;
            }
        } catch (e) {
            // If offline, check if user matches default
            console.warn('Auth verification unreachable, checking local validation:', e);
        }
        return false;
    }

    async function performLogin() {
        const user = inputAuthUser.value.trim();
        const pass = inputAuthPass.value;

        if (!user || !pass) {
            showAuthError('Please enter both username and password.');
            return;
        }

        btnAuthSubmit.disabled = true;
        btnAuthSubmit.textContent = 'Verifying...';
        authErrorBanner.classList.remove('show');

        const ok = await verifyCredentials(user, pass);
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = 'Unlock Console';

        if (ok) {
            if (checkRememberAuth.checked) {
                try {
                    localStorage.setItem('kyber_auth_user', user);
                    localStorage.setItem('kyber_auth_pass', pass);
                } catch (e) {}
            } else {
                try {
                    localStorage.removeItem('kyber_auth_user');
                    localStorage.removeItem('kyber_auth_pass');
                } catch (e) {}
            }
            unlockConsole(user, pass);
        } else {
            showAuthError('Invalid credentials.');
        }
    }

    function showAuthError(msg) {
        authErrorBanner.textContent = msg;
        authErrorBanner.classList.add('show');
    }

    function lockConsole() {
        state.isAuthenticated = false;
        authGateEl.classList.add('active');
        if (userAuthBadge) userAuthBadge.style.display = 'none';
        if (btnPlayStream) btnPlayStream.disabled = true;
    }

    function unlockConsole(user, pass) {
        state.authUser = user;
        state.authPass = pass;
        state.isAuthenticated = true;

        authGateEl.classList.remove('active');
        if (userAuthBadge) {
            userAuthBadge.style.display = 'inline-flex';
            document.getElementById('hub-username-label').textContent = user;
        }
        if (btnPlayStream) btnPlayStream.disabled = false;

        // Apply to webclient input fields
        const inputU = document.getElementById('auth-user');
        const inputP = document.getElementById('auth-pass');
        if (inputU) inputU.value = user;
        if (inputP) inputP.value = pass;
    }

    function performLogout() {
        try {
            localStorage.removeItem('kyber_auth_user');
            localStorage.removeItem('kyber_auth_pass');
        } catch (e) {}
        state.authUser = '';
        state.authPass = '';

        const btnDisconnect = document.getElementById('disconnect');
        if (btnDisconnect) btnDisconnect.click();

        lockConsole();
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

    function gcd(a, b) {
        return b === 0 ? a : gcd(b, a % b);
    }

    function getAspectRatioLabel(w, h) {
        const divisor = gcd(w, h);
        const rw = w / divisor;
        const rh = h / divisor;
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

        // 1. Detected Screen
        const optGroupDetected = document.createElement('optgroup');
        optGroupDetected.label = 'Detected Display (Recommended)';

        const optPhys = document.createElement('option');
        optPhys.value = detectedKey;
        optPhys.textContent = `Current Native: ${physW} x ${physH} (${ratioLabel}${dpr > 1 ? `, Retina ${dpr}x` : ''})`;
        optGroupDetected.appendChild(optPhys);

        if (dpr > 1 && (physW !== logW || physH !== logH)) {
            const optLog = document.createElement('option');
            optLog.value = `${logW}x${logH}`;
            optLog.textContent = `Scaled Logical: ${logW} x ${logH} (${ratioLabel})`;
            optGroupDetected.appendChild(optLog);
        }
        selResolution.appendChild(optGroupDetected);

        // 2. 16:10 (MacBook / Deck)
        const optGroup1610 = document.createElement('optgroup');
        optGroup1610.label = '16:10 Aspect Ratio (MacBook / Laptops / Deck)';
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

        // 3. 16:9 Standard
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
        selResolution.appendChild(optGroup169);

        // 4. 21:9 Ultrawide
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
        selResolution.appendChild(optGroup219);

        // 5. Custom
        const optGroupCustom = document.createElement('optgroup');
        optGroupCustom.label = 'Manual';
        const optCustom = document.createElement('option');
        optCustom.value = 'custom';
        optCustom.textContent = 'Custom resolution...';
        optGroupCustom.appendChild(optCustom);
        selResolution.appendChild(optGroupCustom);

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
                        <span id="hub-status-text">Checking host...</span>
                    </div>
                    <div class="host-specs-pill" id="hub-specs-pill">
                        GPU: Detecting...
                    </div>
                    <div class="user-auth-badge" id="hub-user-badge" style="display:none;">
                        <span>Session: <strong id="hub-username-label">gamer</strong></span>
                        <button class="user-logout-btn" id="hub-btn-logout">Sign out</button>
                    </div>
                </div>
            </header>

            <main class="lobby-grid">
                <!-- Card 1: Launcher -->
                <div class="lobby-card">
                    <h2 class="card-title">Environment / Launcher</h2>
                    <div class="launcher-options">
                        <div class="launcher-btn active" data-launcher="menu">
                            <div>
                                <div class="launcher-name">Console OS Hub</div>
                                <div class="launcher-desc">Console home interface (Steam, Heroic, Emulators)</div>
                            </div>
                            <span class="launcher-tag">Default</span>
                        </div>
                        <div class="launcher-btn" data-launcher="steam">
                            <div>
                                <div class="launcher-name">Steam Big Picture</div>
                                <div class="launcher-desc">Direct fullscreen session optimized for gamepad</div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                        <div class="launcher-btn" data-launcher="heroic">
                            <div>
                                <div class="launcher-name">Heroic Games Launcher</div>
                                <div class="launcher-desc">Epic Games and GOG libraries</div>
                            </div>
                            <span class="launcher-tag">Direct</span>
                        </div>
                        <div class="launcher-btn" data-launcher="browser">
                            <div>
                                <div class="launcher-name">Web Browser</div>
                                <div class="launcher-desc">Google Chrome for browsing, wikis, and Discord</div>
                            </div>
                            <span class="launcher-tag">App</span>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Resolution & Stream Settings -->
                <div class="lobby-card">
                    <h2 class="card-title">Display & Video Stream</h2>
                    <div class="setting-group">
                        <label class="setting-label">Target Resolution</label>
                        <select class="setting-select" id="hub-sel-resolution"></select>
                    </div>

                    <div class="custom-res-row" id="hub-custom-res-row">
                        <input type="number" class="custom-res-input" id="hub-input-w" placeholder="Width (e.g. 2560)" value="2560">
                        <span style="color:var(--kh-text-dim);">&times;</span>
                        <input type="number" class="custom-res-input" id="hub-input-h" placeholder="Height (e.g. 1600)" value="1600">
                    </div>

                    <div style="display:flex; gap:0.75rem;">
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">Refresh Rate</label>
                            <select class="setting-select" id="hub-sel-fps">
                                <option value="60">60 FPS</option>
                                <option value="120">120 FPS</option>
                                <option value="144">144 FPS</option>
                            </select>
                        </div>
                        <div class="setting-group" style="flex:1;">
                            <label class="setting-label">Bitrate</label>
                            <select class="setting-select" id="hub-sel-bitrate">
                                <option value="30000000">30 Mbps</option>
                                <option value="50000000">50 Mbps (Recommended)</option>
                                <option value="80000000">80 Mbps (Raw LAN)</option>
                            </select>
                        </div>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">Video Codec</label>
                        <select class="setting-select" id="hub-sel-codec">
                            <option value="h264">H.264 (Low latency & fast decode)</option>
                            <option value="hevc">HEVC / H.265 (Higher fidelity)</option>
                        </select>
                    </div>
                </div>

                <!-- Card 3: Controllers & Quit Instructions -->
                <div class="lobby-card">
                    <h2 class="card-title">Controllers & Shortcuts</h2>
                    <div class="gamepad-box">
                        <div class="gamepad-indicator" id="hub-gamepad-box">
                            <span class="status-dot"></span>
                            <span id="hub-gamepad-label">No controller detected</span>
                        </div>
                        <button class="gamepad-vibrate-btn" id="hub-btn-vibrate" style="display:none;">
                            Test Vibration
                        </button>
                    </div>

                    <div style="font-size:0.75rem; color:var(--kh-text-muted); line-height:1.5;">
                        <div style="font-weight:700; color:#fff; margin-bottom:0.35rem;">How to exit in-game session:</div>
                        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem;">
                            <li>Hover near the top edge of the screen to reveal the control bar.</li>
                            <li>Press <kbd>Esc</kbd> or <kbd>Ctrl+Shift+Q</kbd>.</li>
                            <li>Click the red <strong>[Quit Session]</strong> button.</li>
                        </ul>
                    </div>
                </div>
            </main>

            <footer class="lobby-footer">
                <div class="lobby-hints">
                    Exit shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd> or hover the top screen edge.
                </div>
                <button class="btn-play-stream" id="hub-btn-play">
                    Start Session
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
            <span id="ingame-status-fps">Active stream</span>
            <span>|</span>
            <button class="in-game-btn" id="ingame-btn-fs">Fullscreen</button>
            <button class="in-game-btn" id="ingame-btn-launcher">Launcher</button>
            <button class="in-game-btn" id="ingame-btn-reload">Reload Stream</button>
            <span>|</span>
            <button class="in-game-btn btn-quit-danger" id="ingame-btn-quit">Quit Session</button>
        `;
        document.body.appendChild(inGameBarEl);

        // Bind DOM references
        badgeHostStatus = document.getElementById('hub-host-status');
        hostSpecsPill = document.getElementById('hub-specs-pill');
        userAuthBadge = document.getElementById('hub-user-badge');
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

        document.getElementById('hub-btn-logout').addEventListener('click', performLogout);
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
                document.getElementById('hub-status-text').textContent = `Online (${latency} ms)`;

                if (data.tls && data.tls.fingerprint_sha256) {
                    state.tlsFingerprint = data.tls.fingerprint_sha256;
                    window.KYBER_TLS_FINGERPRINT = data.tls.fingerprint_sha256;
                }

                if (data.gpu) {
                    const temp = data.gpu.temp ? ` [${data.gpu.temp}]` : '';
                    hostSpecsPill.textContent = `${data.gpu.name}${temp} | X11 Display: ${data.active_resolution || '1080p'}`;
                }
            })
            .catch(() => {
                badgeHostStatus.className = 'status-badge offline';
                document.getElementById('hub-status-text').textContent = 'Host unreachable';
                hostSpecsPill.textContent = 'Resizer service inactive';
            });
    }

    function switchHostLauncher(launcher) {
        const proto = window.location.protocol;
        const url = `${proto}//${state.host}:${state.resizerPort}/api/launcher?app=${encodeURIComponent(launcher)}&auth_user=${encodeURIComponent(state.authUser)}&auth_pass=${encodeURIComponent(state.authPass)}`;
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
        const url = `${proto}//${state.host}:${state.resizerPort}/api/resize?width=${w}&height=${h}&rate=${fps}&auth_user=${encodeURIComponent(state.authUser)}&auth_pass=${encodeURIComponent(state.authPass)}`;
        return fetch(url).catch(e => console.warn('Failed to resize display:', e));
    }

    // ==========================================================================
    // Session Lifecycle (Start & Stop)
    // ==========================================================================
    async function startStreamingSession() {
        if (!state.isAuthenticated) {
            lockConsole();
            return;
        }

        btnPlayStream.disabled = true;
        btnPlayStream.textContent = 'Preparing session...';

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
            btnPlayStream.textContent = 'Start Session';

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
        if (document.exitPointerLock) {
            try { document.exitPointerLock(); } catch (e) {}
        }

        if (document.fullscreenElement && document.exitFullscreen) {
            try { document.exitFullscreen(); } catch (e) {}
        }

        const btnDisconnect = document.getElementById('disconnect');
        if (btnDisconnect) {
            btnDisconnect.click();
        }

        lobbyEl.classList.remove('hidden');
        inGameBarEl.style.display = 'none';
        inGameBarEl.classList.remove('active');

        fetchSystemStatus();
    }

    function applySettingsToWebClient() {
        const inputU = document.getElementById('auth-user');
        const inputP = document.getElementById('auth-pass');
        if (inputU) inputU.value = state.authUser;
        if (inputP) inputP.value = state.authPass;

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
            gamepadStatusLabel.textContent = 'No controller detected (Connect via USB or Bluetooth)';
            if (indicatorBox) indicatorBox.classList.remove('connected');
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
