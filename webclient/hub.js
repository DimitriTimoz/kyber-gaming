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
        controlPort: 8081,
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
        controllerLayout: localStorage.getItem('kyber_controller_layout') || 'xbox',
        streamVolume: parseInt(localStorage.getItem('kyber_stream_volume') || '100', 10),
        gamepads: []
    };

    const urlParams = new URLSearchParams(window.location.search);

    // Load persisted settings & auth
    try {
        const savedSettings = localStorage.getItem('kyber_web_settings');
        if (savedSettings) {
            Object.assign(state, JSON.parse(savedSettings));
        }

        const savedLayout = localStorage.getItem('kyber_controller_layout');
        if (savedLayout) state.controllerLayout = savedLayout;

        const savedVol = localStorage.getItem('kyber_stream_volume');
        if (savedVol) state.streamVolume = parseInt(savedVol, 10);

        const savedUser = localStorage.getItem('kyber_auth_user');
        const savedPass = localStorage.getItem('kyber_auth_pass');
        if (savedUser && savedPass) {
            state.authUser = savedUser;
            state.authPass = savedPass;
        }

        if (urlParams.get('auth_user')) {
            state.authUser = urlParams.get('auth_user');
        }
        if (urlParams.get('auth_pass')) {
            state.authPass = urlParams.get('auth_pass');
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
            localStorage.setItem('kyber_controller_layout', state.controllerLayout);
            localStorage.setItem('kyber_stream_volume', state.streamVolume.toString());
        } catch (e) {}
    }

    // DOM Elements
    let lobbyEl, inGameBarEl, authGateEl, loadingEl;
    let badgeHostStatus, hostSpecsPill, userAuthBadge;
    let selResolution, customResRow, inputCustomW, inputCustomH;
    let selFps, selBitrate, selCodec;
    let gamepadStatusLabel, btnVibrateGamepad;
    let btnPlayStream;
    let launcherButtons = [];

    // Auth Elements
    let inputAuthUser, inputAuthPass, checkRememberAuth, btnAuthSubmit, authErrorBanner;
    let loadingTimer = null;

    const LAUNCHER_DISPLAY_NAMES = {
        'menu': 'Console OS Hub',
        'steam': 'Steam',
        'steam-bigpicture': 'Steam Big Picture',
        'heroic': 'Heroic Games Launcher',
        'retroarch': 'RetroArch Multi-System',
        'eglantine': 'Eglantine Switch NX2',
        'browser': 'Web Browser',
        'desktop': 'Openbox Desktop'
    };

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function showLoadingScreen(title, desc, maxDurationMs = 3500) {
        if (!loadingEl) return;
        const titleEl = document.getElementById('kyber-loading-title');
        const descEl = document.getElementById('kyber-loading-desc');
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        loadingEl.classList.remove('hidden');

        if (loadingTimer) clearTimeout(loadingTimer);
        loadingTimer = setTimeout(() => {
            hideLoadingScreen();
        }, maxDurationMs);
    }

    function hideLoadingScreen() {
        if (!loadingEl) return;
        loadingEl.classList.add('hidden');
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
        }
    }
    window.kyberLoading = { show: showLoadingScreen, hide: hideLoadingScreen };

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

    // Helper to stop all events from bubbling up to Kyber WASM / Canvas listener
    function isolateUiEvents(element) {
        if (!element) return;
        const stopProp = (e) => {
            e.stopPropagation();
        };
        const events = [
            'mousedown', 'mouseup', 'pointerdown', 'pointerup',
            'click', 'dblclick', 'keydown', 'keyup', 'keypress',
            'touchstart', 'touchend', 'touchmove', 'contextmenu', 'wheel'
        ];
        events.forEach(evt => {
            element.addEventListener(evt, stopProp, false);
        });
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
                    <input type="text" class="setting-input" id="hub-input-user" placeholder="e.g. gamer">
                </div>

                <div class="setting-group">
                    <label class="setting-label">Password</label>
                    <div style="position: relative; display: flex; align-items: center; width: 100%;">
                        <input type="password" class="setting-input" id="hub-input-pass" placeholder="Password" autocomplete="current-password" style="padding-right: 4.5rem; width: 100%;">
                        <button type="button" id="hub-btn-toggle-pass" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: #161b26; border: 1px solid var(--kh-border); color: var(--kh-text-dim); padding: 4px 8px; font-size: 0.72rem; border-radius: 3px; cursor: pointer;">Show</button>
                    </div>
                </div>

                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.76rem; color:var(--kh-text-muted); cursor:pointer;">
                    <input type="checkbox" id="hub-check-remember" checked>
                    <span>Remember on this device</span>
                </label>

                <button class="auth-btn-submit" id="hub-btn-login">Unlock Console</button>
            </div>
        `;
        document.body.appendChild(authGateEl);
        const userEl = document.getElementById('hub-input-user');
        const passEl = document.getElementById('hub-input-pass');
        if (userEl) userEl.value = state.authUser || 'gamer';
        if (passEl) passEl.value = state.authPass || '';
        isolateUiEvents(authGateEl);

        inputAuthUser = document.getElementById('hub-input-user');
        inputAuthPass = document.getElementById('hub-input-pass');
        checkRememberAuth = document.getElementById('hub-check-remember');
        btnAuthSubmit = document.getElementById('hub-btn-login');
        authErrorBanner = document.getElementById('hub-auth-error');

        const btnTogglePass = document.getElementById('hub-btn-toggle-pass');
        if (btnTogglePass && inputAuthPass) {
            btnTogglePass.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (inputAuthPass.type === 'password') {
                    inputAuthPass.type = 'text';
                    btnTogglePass.textContent = 'Hide';
                } else {
                    inputAuthPass.type = 'password';
                    btnTogglePass.textContent = 'Show';
                }
                inputAuthPass.focus();
            });
        }

        [inputAuthUser, inputAuthPass].forEach(input => {
            if (!input) return;
            isolateUiEvents(input);
            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                input.focus();
            });
            input.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                input.focus();
            });
            input.addEventListener('click', (e) => {
                e.stopPropagation();
                input.focus();
            });
        });

        inputAuthUser.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                if (inputAuthPass) inputAuthPass.focus();
            }
        });

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

    function getApiEndpoint(endpointPath) {
        const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
        const loc = window.location;
        const host = state.host || loc.hostname || '127.0.0.1';
        if (!loc.port || loc.port === '443' || loc.port === '80') {
            return `${loc.protocol}//${host}${cleanPath}`;
        }
        if (loc.port === '8080' || state.port === '8080') {
            return `${loc.protocol}//${host}:${state.resizerPort || 8081}${cleanPath}`;
        }
        return `${loc.protocol}//${loc.host}${cleanPath}`;
    }

    function getAuthHeaders(user, pass) {
        const u = user || state.authUser;
        const p = pass || state.authPass;
        const headers = {};
        if (u && p) {
            try {
                headers['Authorization'] = 'Basic ' + btoa(u + ':' + p);
            } catch (e) {}
        }
        return headers;
    }

    async function verifyCredentials(user, pass) {
        const base = getApiEndpoint('/api/auth/verify');
        const url = `${base}?auth_user=${encodeURIComponent(user)}&auth_pass=${encodeURIComponent(pass)}`;
        try {
            const res = await fetch(url, { headers: getAuthHeaders(user, pass) });
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
        setTimeout(() => {
            if (inputAuthUser) {
                if (!inputAuthUser.value) {
                    inputAuthUser.focus();
                } else if (inputAuthPass) {
                    inputAuthPass.focus();
                }
            }
        }, 80);
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
                <!-- Card 1: Resolution & Stream Settings -->
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

                <!-- Card 2: Controllers & Shortcuts -->
                <div class="lobby-card">
                    <h2 class="card-title">Controllers & Layout</h2>
                    <div class="input-row" style="margin-bottom:0.6rem;">
                        <label for="hub-sel-layout">Button Layout</label>
                        <select id="hub-sel-layout">
                            <option value="xbox">Xbox / Standard (A=Bottom, B=Right)</option>
                            <option value="nintendo">Nintendo Switch (A=Right, B=Bottom)</option>
                        </select>
                    </div>

                    <div style="font-size:0.75rem; color:var(--kh-text-muted); margin-bottom:0.4rem; font-weight:600;">
                        Connected Controllers (Up to 4 Players):
                    </div>
                    <div id="hub-controller-slots" class="controller-slots-list">
                        <div class="gamepad-box">
                            <div class="gamepad-indicator" id="hub-gamepad-box">
                                <span class="status-dot"></span>
                                <span id="hub-gamepad-label">No controller detected</span>
                            </div>
                            <button class="gamepad-vibrate-btn" id="hub-btn-vibrate" style="display:none;">
                                Test Vibration
                            </button>
                        </div>
                    </div>

                    <div style="font-size:0.75rem; color:var(--kh-text-muted); line-height:1.5; margin-top:0.8rem;">
                        <div style="font-weight:700; color:#fff; margin-bottom:0.35rem;">In-Game Quick Menu:</div>
                        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem;">
                            <li>Press <kbd>Guide / Home</kbd> on controller at any time.</li>
                            <li>Or hold <kbd>Select + Start</kbd> for 1.2s to open Quick Menu.</li>
                            <li>Keyboard: Press <kbd>F10</kbd> or hover top screen edge.</li>
                        </ul>
                    </div>
                </div>
            </main>

            <footer class="lobby-footer">
                <div class="lobby-hints">
                    Exit shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd> or hover the top screen edge.
                </div>
                <button class="btn-play-stream" id="hub-btn-play">
                    Connect to Stream
                </button>
            </footer>
        `;
        document.body.appendChild(lobbyEl);
        isolateUiEvents(lobbyEl);

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
            <button class="in-game-btn" id="ingame-btn-launcher">Console Hub</button>
            <button class="in-game-btn" id="ingame-btn-reload">Reload Stream</button>
            <span>|</span>
            <button class="in-game-btn btn-quit-danger" id="ingame-btn-quit">Quit Session</button>
        `;
        document.body.appendChild(inGameBarEl);
        isolateUiEvents(inGameBarEl);

        // Loading Overlay
        loadingEl = document.createElement('div');
        loadingEl.id = 'kyber-loading-overlay';
        loadingEl.className = 'hidden';
        loadingEl.innerHTML = `
            <div class="loading-box">
                <div class="loading-spinner"></div>
                <div class="loading-title" id="kyber-loading-title">CONNECTING TO STREAM</div>
                <div class="loading-desc" id="kyber-loading-desc">Synchronizing display and establishing stream...</div>
                <div class="loading-bar"><div class="loading-bar-fill"></div></div>
            </div>
        `;
        document.body.appendChild(loadingEl);

        // Hold indicator for Select+Start combo
        const holdIndicatorEl = document.createElement('div');
        holdIndicatorEl.id = 'kyber-hold-indicator';
        holdIndicatorEl.innerHTML = `
            <svg class="hold-ring-svg" viewBox="0 0 68 68">
                <circle class="hold-ring-bg" cx="34" cy="34" r="30"></circle>
                <circle id="kyber-hold-circle" class="hold-ring-progress" cx="34" cy="34" r="30"></circle>
            </svg>
            <div class="hold-label">HOLD FOR MENU</div>
        `;
        document.body.appendChild(holdIndicatorEl);

        // Kyber In-Game Quick Menu
        const quickMenuEl = document.createElement('div');
        quickMenuEl.id = 'kyber-quick-menu';
        quickMenuEl.className = 'hidden';
        quickMenuEl.innerHTML = `
            <div class="qm-backdrop" id="qm-backdrop"></div>
            <div class="qm-modal">
                <div class="qm-header">
                    <div class="qm-brand">KYBER QUICK MENU</div>
                    <div class="qm-clock" id="qm-clock">--:--</div>
                </div>
                <div class="qm-session-bar">
                    <span id="qm-active-session">Active Game: Standby</span>
                    <span id="qm-active-res">1080p 60Hz</span>
                </div>
                <div class="qm-list" id="qm-list">
                    <div class="qm-item active" data-action="resume">
                        <span class="qm-item-label">Resume Game</span>
                        <span class="qm-item-value">Back to play</span>
                    </div>
                    <div class="qm-item" data-action="hub">
                        <span class="qm-item-label">Return to Console Hub</span>
                        <span class="qm-item-value">Suspend & Menu</span>
                    </div>
                    <div class="qm-item" data-action="close_game">
                        <span class="qm-item-label">Close Active Game</span>
                        <span class="qm-item-value danger">Force Quit</span>
                    </div>
                    <div class="qm-item" data-action="hud">
                        <span class="qm-item-label">Performance HUD</span>
                        <span class="qm-item-value" id="qm-val-hud">Off</span>
                    </div>
                    <div class="qm-item" data-action="layout">
                        <span class="qm-item-label">Controller Layout</span>
                        <span class="qm-item-value" id="qm-val-layout">Xbox Standard</span>
                    </div>
                    <div class="qm-item" data-action="resolution">
                        <span class="qm-item-label">Display Resolution</span>
                        <span class="qm-item-value" id="qm-val-res">1080p 60Hz</span>
                    </div>
                    <div class="qm-item" data-action="volume">
                        <span class="qm-item-label">Host Volume</span>
                        <span class="qm-item-value" id="qm-val-vol">100%</span>
                    </div>
                    <div class="qm-item" data-action="disconnect">
                        <span class="qm-item-label">Disconnect Stream</span>
                        <span class="qm-item-value danger">Exit to Lobby</span>
                    </div>
                </div>
                <div class="qm-footer" id="qm-footer-hints">
                    <span class="qm-hint"><span class="qm-glyph" id="qm-hint-confirm">A</span> Select</span>
                    <span class="qm-hint"><span class="qm-glyph" id="qm-hint-cancel">B</span> Close</span>
                    <span class="qm-hint"><span class="qm-glyph">&larr;&rarr;</span> Adjust</span>
                    <span class="qm-hint"><span class="qm-glyph">&uarr;&darr;</span> Move</span>
                </div>
            </div>
        `;
        document.body.appendChild(quickMenuEl);
        isolateUiEvents(quickMenuEl);

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

        document.getElementById('hub-btn-logout').addEventListener('click', performLogout);

        [inputCustomW, inputCustomH].forEach(inp => {
            if (!inp) return;
            inp.addEventListener('click', () => inp.focus());
        });
    }

    function updateFormValues() {
        if (selFps) selFps.value = state.refreshRate;
        if (selBitrate) selBitrate.value = state.bitrate;
        if (selCodec) selCodec.value = state.codec;
    }

    function bindEvents() {
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
            switchHostLauncher('menu');
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

            // F9 hotkey toggles in-game bar (F10 is reserved for Quick Menu)
            if (e.key === 'F9') {
                e.preventDefault();
                inGameBarEl.classList.toggle('active');
            }
        }, true);
    }

    // ==========================================================================
    // Host Communication & Dynamic Resizing
    // ==========================================================================
    function fetchSystemStatus() {
        const resizerUrl = getApiEndpoint('/api/system');

        const start = performance.now();
        fetch(resizerUrl, { headers: getAuthHeaders() })
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
                    const gpuLabel = typeof data.gpu === 'string' ? data.gpu : (data.gpu.name || 'Accelerated GPU');
                    const temp = (typeof data.gpu === 'object' && data.gpu.temp) ? ` [${data.gpu.temp}]` : '';
                    const resLabel = data.resolution || data.active_resolution || '1080p';
                    hostSpecsPill.textContent = `${gpuLabel}${temp} | X11 Display: ${resLabel}`;
                }
            })
            .catch(() => {
                badgeHostStatus.className = 'status-badge offline';
                document.getElementById('hub-status-text').textContent = 'Host unreachable';
                hostSpecsPill.textContent = 'Resizer service inactive';
            });
    }

    function switchHostLauncher(launcher) {
        const base = getApiEndpoint('/api/launcher');
        const url = `${base}?app=${encodeURIComponent(launcher)}&auth_user=${encodeURIComponent(state.authUser)}&auth_pass=${encodeURIComponent(state.authPass)}`;
        const name = LAUNCHER_DISPLAY_NAMES[launcher] || launcher;
        showLoadingScreen('SWITCHING ENVIRONMENT', `Launching ${name}...`, 3000);
        fetch(url, { headers: getAuthHeaders() }).catch(e => console.warn('Failed to switch launcher:', e));
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
        const base = getApiEndpoint('/api/resize');
        const url = `${base}?width=${w}&height=${h}&rate=${fps}&auth_user=${encodeURIComponent(state.authUser)}&auth_pass=${encodeURIComponent(state.authPass)}`;
        return fetch(url, { headers: getAuthHeaders() }).catch(e => console.warn('Failed to resize display:', e));
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
        btnPlayStream.textContent = 'Connecting...';

        showLoadingScreen('CONNECTING TO STREAM', 'Synchronizing display and establishing stream...', 3500);

        const [w, h] = getTargetResolutionDimensions();

        // 1. Resize remote host virtual display
        await resizeHostScreen(w, h, state.refreshRate);

        // 2. Inject settings into native Kyber WebClient fields
        applySettingsToWebClient();

        // 3. Hide Lobby, show in-game bar
        setTimeout(() => {
            lobbyEl.classList.add('hidden');
            inGameBarEl.style.display = 'flex';
            inGameBarEl.classList.add('active');
            setTimeout(() => inGameBarEl.classList.remove('active'), 4000);

            btnPlayStream.disabled = false;
            btnPlayStream.textContent = 'Connect to Stream';

            // 4. Trigger WebClient connect
            const btnConnect = document.getElementById('connect');
            if (btnConnect) {
                btnConnect.click();
            }

            // 5. Request fullscreen
            try {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            } catch (e) {}
        }, 300);
    }

    function stopStreamingSession() {
        hideLoadingScreen();
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
    // Gamepad API, Multi-Controllers & In-Game Quick Menu
    // ==========================================================================
    let quickMenuVisible = false;
    let quickMenuIndex = 0;
    let holdStartTime = 0;
    let comboTriggered = false;
    let lastGuidePressed = false;
    let navThrottleTime = 0;
    let sfxAudioCtx = null;

    const RESOLUTION_OPTIONS = ['1080p 60Hz', '1080p 120Hz', '1440p 60Hz', '1440p 120Hz', '4K 60Hz'];
    let currentResOptionIdx = 0;

    const QUICK_MENU_ITEMS = [
        { id: 'resume', label: 'Resume Game', type: 'action' },
        { id: 'hub', label: 'Return to Console Hub', type: 'action' },
        { id: 'close_game', label: 'Close Active Game', type: 'action', danger: true },
        { id: 'hud', label: 'Performance HUD', type: 'value' },
        { id: 'layout', label: 'Controller Layout', type: 'value' },
        { id: 'resolution', label: 'Display Resolution', type: 'value' },
        { id: 'volume', label: 'Host Volume', type: 'value' },
        { id: 'disconnect', label: 'Disconnect Stream', type: 'action', danger: true }
    ];

    function playQuickMenuSound(type) {
        try {
            if (!sfxAudioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) sfxAudioCtx = new AudioCtx();
            }
            if (!sfxAudioCtx || sfxAudioCtx.state === 'suspended') {
                sfxAudioCtx?.resume().catch(() => {});
            }
            if (!sfxAudioCtx) return;

            const osc = sfxAudioCtx.createOscillator();
            const gain = sfxAudioCtx.createGain();
            osc.connect(gain);
            gain.connect(sfxAudioCtx.destination);
            const now = sfxAudioCtx.currentTime;

            if (type === 'nav') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'select') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(660, now + 0.03);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'close') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.start(now);
                osc.stop(now + 0.06);
            }
        } catch (e) {}
    }

    function vibrateGamepad(index, duration = 250, strength = 0.6) {
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g !== null) : [];
        const gp = pads.find(g => g.index === index) || pads[0];
        if (gp && gp.vibrationActuator) {
            gp.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: duration,
                weakMagnitude: strength,
                strongMagnitude: strength
            }).catch(() => {});
        }
    }

    function initGamepadListener() {
        window.addEventListener('gamepadconnected', checkGamepads);
        window.addEventListener('gamepaddisconnected', checkGamepads);

        const selLayout = document.getElementById('hub-sel-layout');
        if (selLayout) {
            selLayout.value = state.controllerLayout;
            selLayout.addEventListener('change', () => {
                state.controllerLayout = selLayout.value;
                saveSettings();
                updateQuickMenuValues();
            });
        }

        // Quick menu backdrop click to close
        const qmBackdrop = document.getElementById('qm-backdrop');
        if (qmBackdrop) {
            qmBackdrop.addEventListener('click', closeQuickMenu);
        }

        // Click handlers on quick menu items
        const qmItems = document.querySelectorAll('.qm-item');
        qmItems.forEach((item, idx) => {
            item.addEventListener('click', () => {
                quickMenuIndex = idx;
                updateQuickMenuSelection();
                executeQuickMenuAction();
            });
        });

        // Keyboard hotkeys for Quick Menu
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F10' || (e.shiftKey && e.key === 'Escape') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o')) {
                e.preventDefault();
                toggleQuickMenu();
            } else if (quickMenuVisible) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveQuickMenu(-1);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveQuickMenu(1);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    adjustQuickMenuValue(-1);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    adjustQuickMenuValue(1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    executeQuickMenuAction();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeQuickMenu();
                }
            }
        });

        // Start animation frame loop for gamepad shortcut detection & quick menu control
        requestAnimationFrame(pollInGameGamepads);
        checkGamepads();
    }

    function checkGamepads() {
        const gamepads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(g => g !== null);
        const slotsContainer = document.getElementById('hub-controller-slots');
        if (!slotsContainer) return;

        if (gamepads.length === 0) {
            slotsContainer.innerHTML = `
                <div class="gamepad-box">
                    <div class="gamepad-indicator" id="hub-gamepad-box">
                        <span class="status-dot"></span>
                        <span id="hub-gamepad-label">No controller detected (Connect via USB or Bluetooth)</span>
                    </div>
                </div>
            `;
            return;
        }

        slotsContainer.innerHTML = '';
        gamepads.slice(0, 4).forEach((gp, idx) => {
            const row = document.createElement('div');
            row.className = 'controller-slot-row';
            row.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="controller-slot-tag">P${idx + 1}</span>
                    <span style="font-weight:600; color:#ededed; max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(gp.id)}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="in-game-btn" data-vibrate-idx="${gp.index}" style="font-size:10px; padding:2px 8px;">Test Rumble</button>
                </div>
            `;
            const vibBtn = row.querySelector(`[data-vibrate-idx="${gp.index}"]`);
            if (vibBtn) {
                vibBtn.addEventListener('click', () => {
                    vibrateGamepad(gp.index);
                });
            }
            slotsContainer.appendChild(row);
        });
    }

    // ==========================================================================
    // Quick Menu UI Management
    // ==========================================================================
    function openQuickMenu() {
        quickMenuVisible = true;
        const qmEl = document.getElementById('kyber-quick-menu');
        if (qmEl) qmEl.classList.remove('hidden');

        // Update Clock in header
        const clockEl = document.getElementById('qm-clock');
        if (clockEl) {
            const d = new Date();
            clockEl.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }

        // Update active app name
        const sessEl = document.getElementById('qm-active-session');
        if (sessEl) {
            const name = LAUNCHER_DISPLAY_NAMES[state.selectedLauncher] || 'Steam Session';
            sessEl.textContent = `Active: ${name}`;
        }

        updateQuickMenuValues();
        updateQuickMenuSelection();
        playQuickMenuSound('select');
    }

    function closeQuickMenu() {
        if (!quickMenuVisible) return;
        quickMenuVisible = false;
        const qmEl = document.getElementById('kyber-quick-menu');
        if (qmEl) qmEl.classList.add('hidden');
        playQuickMenuSound('close');
    }

    function toggleQuickMenu() {
        if (quickMenuVisible) {
            closeQuickMenu();
        } else {
            openQuickMenu();
        }
    }

    function updateQuickMenuSelection() {
        const items = document.querySelectorAll('.qm-item');
        items.forEach((item, idx) => {
            item.classList.toggle('active', idx === quickMenuIndex);
        });
    }

    function updateQuickMenuValues() {
        // 1. HUD value
        const hudValEl = document.getElementById('qm-val-hud');
        if (hudValEl) {
            const mode = window.KyberPerfHUD?.getMode() || 'off';
            hudValEl.textContent = mode === 'bar' ? 'Top Bar' : (mode === 'card' ? 'Full Card' : 'Off');
        }

        // 2. Controller Layout value
        const layoutValEl = document.getElementById('qm-val-layout');
        if (layoutValEl) {
            layoutValEl.textContent = state.controllerLayout === 'nintendo' ? 'Nintendo Switch' : 'Xbox Standard';
        }

        // 3. Resolution value
        const resValEl = document.getElementById('qm-val-res');
        const sessionResEl = document.getElementById('qm-active-res');
        const currentRes = RESOLUTION_OPTIONS[currentResOptionIdx];
        if (resValEl) resValEl.textContent = currentRes;
        if (sessionResEl) sessionResEl.textContent = currentRes;

        // 4. Volume value
        const volValEl = document.getElementById('qm-val-vol');
        if (volValEl) {
            volValEl.textContent = state.streamVolume === 0 ? 'Muted' : `${state.streamVolume}%`;
        }

        // 5. Button hint labels based on layout
        const confirmHint = document.getElementById('qm-hint-confirm');
        const cancelHint = document.getElementById('qm-hint-cancel');
        if (confirmHint && cancelHint) {
            if (state.controllerLayout === 'nintendo') {
                confirmHint.textContent = 'A (Right)';
                cancelHint.textContent = 'B (Bottom)';
            } else {
                confirmHint.textContent = 'A (Bottom)';
                cancelHint.textContent = 'B (Right)';
            }
        }
    }

    function moveQuickMenu(delta) {
        quickMenuIndex = (quickMenuIndex + delta + QUICK_MENU_ITEMS.length) % QUICK_MENU_ITEMS.length;
        updateQuickMenuSelection();
        playQuickMenuSound('nav');
    }

    function adjustQuickMenuValue(delta) {
        const item = QUICK_MENU_ITEMS[quickMenuIndex];
        if (!item) return;

        if (item.id === 'hud') {
            if (window.KyberPerfHUD) {
                window.KyberPerfHUD.cycleMode();
            }
        } else if (item.id === 'layout') {
            state.controllerLayout = state.controllerLayout === 'xbox' ? 'nintendo' : 'xbox';
            const selLayout = document.getElementById('hub-sel-layout');
            if (selLayout) selLayout.value = state.controllerLayout;
            saveSettings();
        } else if (item.id === 'resolution') {
            currentResOptionIdx = (currentResOptionIdx + delta + RESOLUTION_OPTIONS.length) % RESOLUTION_OPTIONS.length;
            const chosen = RESOLUTION_OPTIONS[currentResOptionIdx];
            applyQuickResolution(chosen);
        } else if (item.id === 'volume') {
            state.streamVolume = Math.max(0, Math.min(100, state.streamVolume + delta * 25));
            saveSettings();
            applyQuickVolume(state.streamVolume);
        }

        updateQuickMenuValues();
        playQuickMenuSound('nav');
    }

    function executeQuickMenuAction() {
        const item = QUICK_MENU_ITEMS[quickMenuIndex];
        if (!item) return;

        playQuickMenuSound('select');

        if (item.id === 'resume') {
            closeQuickMenu();
        } else if (item.id === 'hub') {
            closeQuickMenu();
            state.selectedLauncher = 'menu';
            switchHostLauncher('menu');
        } else if (item.id === 'close_game') {
            closeQuickMenu();
            switchHostLauncher('kill-apps');
        } else if (item.id === 'hud') {
            adjustQuickMenuValue(1);
        } else if (item.id === 'layout') {
            adjustQuickMenuValue(1);
        } else if (item.id === 'resolution') {
            adjustQuickMenuValue(1);
        } else if (item.id === 'volume') {
            adjustQuickMenuValue(1);
        } else if (item.id === 'disconnect') {
            closeQuickMenu();
            stopStreamingSession();
        }
    }

    async function applyQuickResolution(resString) {
        let w = 1920, h = 1080, rate = 60;
        if (resString.includes('1080p')) {
            w = 1920; h = 1080;
        } else if (resString.includes('1440p')) {
            w = 2560; h = 1440;
        } else if (resString.includes('4K')) {
            w = 3840; h = 2160;
        }
        if (resString.includes('120Hz')) rate = 120;

        await resizeHostScreen(w, h, rate);
    }

    function applyQuickVolume(volPercent) {
        const base = getApiEndpoint('/api/volume');
        const sep = base.includes('?') ? '&' : '?';
        fetch(`${base}${sep}level=${encodeURIComponent(volPercent)}`, {
            headers: getAuthHeaders(),
            mode: 'cors',
            cache: 'no-store'
        }).catch(() => {});
    }

    // ==========================================================================
    // Gamepad In-Game Polling Loop (Guide Button & Select+Start Hold Combo)
    // ==========================================================================
    function pollInGameGamepads() {
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g !== null) : [];
        const now = performance.now();

        if (pads.length > 0) {
            // Check combo and Guide button on all gamepads
            let guidePressed = false;
            let comboHeld = false;
            let activePad = null;

            for (const pad of pads) {
                // Button 16 is Guide / Home on Standard Gamepad spec
                if (pad.buttons[16] && (pad.buttons[16].pressed || pad.buttons[16].value > 0.5)) {
                    guidePressed = true;
                    activePad = pad;
                    break;
                }

                // Combo: Select (btn 8) + Start (btn 9)
                const selectPressed = pad.buttons[8] && (pad.buttons[8].pressed || pad.buttons[8].value > 0.5);
                const startPressed = pad.buttons[9] && (pad.buttons[9].pressed || pad.buttons[9].value > 0.5);

                if (selectPressed && startPressed) {
                    comboHeld = true;
                    activePad = pad;
                    break;
                }
            }

            // Handle Guide Button trigger
            if (guidePressed) {
                if (!lastGuidePressed) {
                    lastGuidePressed = true;
                    toggleQuickMenu();
                }
            } else {
                lastGuidePressed = false;
            }

            // Handle Select+Start hold indicator
            const holdIndicatorEl = document.getElementById('kyber-hold-indicator');
            const holdCircle = document.getElementById('kyber-hold-circle');

            if (comboHeld) {
                if (holdStartTime === 0) {
                    holdStartTime = now;
                    comboTriggered = false;
                    if (holdIndicatorEl) holdIndicatorEl.classList.add('active');
                }

                const elapsed = now - holdStartTime;
                const progress = Math.min(1.0, elapsed / 1200);

                if (holdCircle) {
                    // Circumference: 2 * PI * 30 = ~188.5
                    const dashoffset = 188.5 * (1.0 - progress);
                    holdCircle.style.strokeDashoffset = `${dashoffset}`;
                }

                if (elapsed >= 1200 && !comboTriggered) {
                    comboTriggered = true;
                    if (activePad) vibrateGamepad(activePad.index, 300, 0.8);
                    toggleQuickMenu();
                    if (holdIndicatorEl) holdIndicatorEl.classList.remove('active');
                }
            } else {
                if (holdStartTime !== 0) {
                    holdStartTime = 0;
                    comboTriggered = false;
                    if (holdIndicatorEl) holdIndicatorEl.classList.remove('active');
                }
            }

            // If Quick Menu is currently open, capture gamepad navigation from active or first connected pad
            const navPad = activePad || pads[0];
            if (quickMenuVisible && navPad) {
                const isNintendo = state.controllerLayout === 'nintendo';

                // Button mapping based on layout:
                // Xbox: Confirm = btn 0 (A), Cancel = btn 1 (B)
                // Nintendo: Confirm = btn 1 (A), Cancel = btn 0 (B)
                const confirmPressed = isNintendo ? navPad.buttons[1]?.pressed : navPad.buttons[0]?.pressed;
                const cancelPressed = isNintendo ? navPad.buttons[0]?.pressed : navPad.buttons[1]?.pressed;

                // D-Pad buttons
                const dUp = navPad.buttons[12]?.pressed;
                const dDown = navPad.buttons[13]?.pressed;
                const dLeft = navPad.buttons[14]?.pressed;
                const dRight = navPad.buttons[15]?.pressed;

                // Analog stick axes
                const stickY = navPad.axes[1] || 0;
                const stickX = navPad.axes[0] || 0;

                if (now > navThrottleTime) {
                    if (dUp || stickY < -0.55) {
                        moveQuickMenu(-1);
                        navThrottleTime = now + 190;
                    } else if (dDown || stickY > 0.55) {
                        moveQuickMenu(1);
                        navThrottleTime = now + 190;
                    } else if (dLeft || stickX < -0.55) {
                        adjustQuickMenuValue(-1);
                        navThrottleTime = now + 210;
                    } else if (dRight || stickX > 0.55) {
                        adjustQuickMenuValue(1);
                        navThrottleTime = now + 210;
                    } else if (confirmPressed) {
                        executeQuickMenuAction();
                        navThrottleTime = now + 260;
                    } else if (cancelPressed) {
                        closeQuickMenu();
                        navThrottleTime = now + 260;
                    }
                }
            }
        }

        requestAnimationFrame(pollInGameGamepads);
    }

    // Init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
