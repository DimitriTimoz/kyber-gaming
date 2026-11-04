/**
 * Kyber Console OS - Data-Driven Console Hub & Emulator Frontend
 * Dynamically renders launchers and console emulators from configuration.
 * 100% controller-driven with synthesized audio and category filtering.
 */

(function () {
    'use strict';

    // SVG Icons Registry
    const ICONS = {
        steam: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.41 2.87 8.14 6.84 9.47l2.18-3.15c-.32-.23-.62-.48-.88-.77l-4.59.8c-.37-.73-.62-1.52-.72-2.35l4.31-.75c.03-.49.14-.96.32-1.4L7.15 11.2C7.05 10.82 7 10.42 7 10c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.45-1.76 4.47-4.08 4.91l-1.92 2.77c.45.19.95.32 1.48.32 2.21 0 4-1.79 4-4 0-.34-.05-.67-.13-.98l2.9-1.28C19.7 11.23 20 11.6 20 12c0 4.41-3.59 8-8 8-1.07 0-2.09-.21-3.02-.6L6.5 22.37C8.16 23.4 10.01 24 12 24c6.63 0 12-5.37 12-12S18.63 2 12 2z"/></svg>`,
        gamepad: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
        heroic: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>`,
        retroarch: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 7h7v2h-7zm-3 4h13v2H5.5zm1.5 4h10v2H7zm-5-9h2v12h-2zm18 0h2v12h-2zM4 4h16v2H4zm0 14h16v2H4z"/></svg>`,
        playstation: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.58 16.48l3.42-1.74v-5.6l-3.42 1.53v5.81zm12.92-2.1c-.26-.85-1.2-1.52-2.42-1.72l-5.08-.82v2.79l3.37.56c.64.11.8.31.78.47-.04.28-.48.56-1.13.56-1.04 0-2.47-.44-3.02-.68v2.6c1.19.46 2.49.65 3.76.65 1.77 0 3.32-.47 3.66-1.59.06-.21.08-.55.08-.82zm-9.5-8.88l-6 2.76v2.85l3.42-1.53v1.89l-3.42 1.53v2.85l6-2.76V5.5zm-5.5 12.38c.6.24 1.74.56 2.58.56.84 0 1.25-.17 1.25-.43 0-.17-.18-.33-.67-.44l-3.16-.54v-2.74l4.89.84c1.14.2 2.11.82 2.37 1.63.26.85-.2 1.74-1.68 2.22-1.06.35-2.28.49-3.58.49-1.39 0-2.77-.2-3.79-.65l1.79-.94z"/></svg>`,
        dolphin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.1 1.41 5.88 3.64 7.73l1.83-2.61C6.2 15.89 5.5 14.04 5.5 12c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5c0 1.23-.34 2.38-.94 3.36l1.89 2.12C20.47 16.03 21 14.1 21 12c0-5.52-4.48-10-10-10zm-1 6v3H8v2h3v3h2v-3h3v-2h-3V8h-2z"/></svg>`,
        browser: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
        desktop: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>`
    };

    // Global State
    let categories = [];
    let allItems = [];
    let filteredItems = [];
    let currentCategoryIndex = 0;
    let currentItemIndex = 0;
    let isLaunching = false;

    // Elements
    const body = document.body;
    const categoryTabsEl = document.getElementById('categoryTabs');
    const carouselTrackEl = document.getElementById('carouselTrack');
    const headerTagEl = document.getElementById('headerTag');
    const headerTitleEl = document.getElementById('headerTitle');
    const headerDescEl = document.getElementById('headerDesc');
    const headerStatusEl = document.getElementById('headerStatus');
    const clockEl = document.getElementById('clock');
    const displayResEl = document.getElementById('displayRes');
    const gpuTextEl = document.getElementById('gpuText');
    const controllerPillEl = document.getElementById('controllerPill');
    const controllerTextEl = document.getElementById('controllerText');
    const launchOverlayEl = document.getElementById('launchOverlay');
    const launchTitleEl = document.getElementById('launchTitle');
    const launchSubEl = document.getElementById('launchSub');
    const launchLogoEl = document.getElementById('launchLogo');
    const toastModalEl = document.getElementById('toastModal');
    const toastTitleEl = document.getElementById('toastTitle');
    const toastDescEl = document.getElementById('toastDesc');
    const btnRestartSteamEl = document.getElementById('btnRestartSteam');

    // ==========================================================================
    // Synthesized Web Audio API Sound Effects
    // ==========================================================================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Tactile silky focus tick
    function playFocusSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(540, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {}
    }

    // Upward sweep when switching category tabs
    function playTabSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(380, now);
            osc.frequency.exponentialRampToValueAtTime(680, now + 0.07);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    // Rich harmonic console triad chord (C-E-G) on launch
    function playLaunchSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                const startTime = now + idx * 0.04;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.45);
            });
        } catch (e) {}
    }

    // Warning double-tap if uninstalled
    function playAlertSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            [280, 220].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                const startTime = now + idx * 0.08;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.07, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.07);
            });
        } catch (e) {}
    }

    // ==========================================================================
    // Fetch Configuration & System Metrics
    // ==========================================================================
    async function loadData() {
        // 1. Fetch Dynamic System Metrics
        try {
            const res = await fetch('/api/system');
            if (res.ok) {
                const sys = await res.json();
                if (sys.gpu) gpuTextEl.textContent = sys.gpu;
                if (sys.resolution) displayResEl.textContent = sys.resolution;
            }
        } catch (e) {
            console.warn('[hub] System API unavailable:', e);
        }

        // 2. Fetch Launchers & Emulators Configuration
        let config = null;
        try {
            const res = await fetch('/api/launchers');
            if (res.ok) config = await res.json();
        } catch (e) {}

        // Fallback to static launchers.json
        if (!config || !config.items || config.items.length === 0) {
            try {
                const res = await fetch('launchers.json');
                if (res.ok) config = await res.json();
            } catch (e) {}
        }

        if (config) {
            categories = config.categories || [{ id: 'all', name: 'Tous' }];
            allItems = config.items || [];
        }

        renderCategoryTabs();
        filterAndRenderCards(0);
    }

    // ==========================================================================
    // Category Tabs Rendering & Switching
    // ==========================================================================
    function renderCategoryTabs() {
        categoryTabsEl.innerHTML = '';
        categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${idx === currentCategoryIndex ? 'active' : ''}`;
            btn.textContent = cat.name;
            btn.addEventListener('click', () => {
                initAudio();
                setCategoryIndex(idx);
            });
            categoryTabsEl.appendChild(btn);
        });
    }

    function setCategoryIndex(index) {
        if (isLaunching) return;
        if (index < 0) index = categories.length - 1;
        if (index >= categories.length) index = 0;

        currentCategoryIndex = index;
        playTabSound();

        const tabs = categoryTabsEl.querySelectorAll('.tab-btn');
        tabs.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === currentCategoryIndex);
        });

        filterAndRenderCards(0);
    }

    // ==========================================================================
    // Cards Rendering & Dynamic Filtering
    // ==========================================================================
    function filterAndRenderCards(selectIdx = 0) {
        const activeCatId = categories[currentCategoryIndex]?.id || 'all';

        if (activeCatId === 'all') {
            filteredItems = allItems;
        } else {
            filteredItems = allItems.filter(item => item.category === activeCatId);
        }

        carouselTrackEl.innerHTML = '';

        filteredItems.forEach((item, idx) => {
            const card = document.createElement('div');
            const installed = item.installed !== false;
            card.className = `card ${!installed ? 'uninstalled' : ''}`;
            card.dataset.index = idx;
            card.dataset.id = item.id;
            card.tabIndex = 0;

            const coverClass = `cover-${item.icon || 'steam'}`;
            const svgIcon = ICONS[item.icon] || ICONS.gamepad;

            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-cover ${coverClass}">
                        <div class="card-tag">${item.tag || 'EXPÉRIENCE'}</div>
                        <div class="card-icon">${svgIcon}</div>
                    </div>
                    <div class="card-meta">
                        <div class="meta-title">${item.name}</div>
                        <div class="meta-sub">${installed ? (item.category === 'emulators' ? 'Émulateur' : 'Prêt à lancer') : 'À installer'}</div>
                    </div>
                    <div class="card-badge">
                        <span class="badge-key">${item.badge_key || (idx + 1)}</span>
                        <span class="badge-pad">${item.badge_pad || 'A'}</span>
                    </div>
                </div>
            `;

            card.addEventListener('mouseenter', () => {
                initAudio();
                setItemIndex(idx);
            });

            card.addEventListener('click', () => {
                initAudio();
                handleItemAction(item);
            });

            carouselTrackEl.appendChild(card);
        });

        setItemIndex(selectIdx, false);
    }

    function setItemIndex(index, playSound = true) {
        if (isLaunching || filteredItems.length === 0) return;

        if (index < 0) index = filteredItems.length - 1;
        if (index >= filteredItems.length) index = 0;

        currentItemIndex = index;
        const currentItem = filteredItems[currentItemIndex];

        // Apply Dynamic Palette
        const accentColor = currentItem.color || '#00d2ff';
        const glowColor = currentItem.color_glow || 'rgba(0, 210, 255, 0.45)';
        document.documentElement.style.setProperty('--active-accent', accentColor);
        document.documentElement.style.setProperty('--active-glow', glowColor);

        // Update Header
        headerTagEl.textContent = currentItem.tag || currentItem.category.toUpperCase();
        headerTitleEl.textContent = currentItem.name.toUpperCase();
        headerDescEl.textContent = currentItem.desc;

        const isInstalled = currentItem.installed !== false;
        headerStatusEl.textContent = isInstalled ? 'DISPONIBLE' : 'À INSTALLER';
        headerStatusEl.className = `header-status-badge ${!isInstalled ? 'missing' : ''}`;

        // Update Cards Focus & Smooth Scroll
        const cards = carouselTrackEl.querySelectorAll('.card');
        cards.forEach((card, idx) => {
            if (idx === currentItemIndex) {
                card.classList.add('active');
                card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            } else {
                card.classList.remove('active');
            }
        });

        if (playSound) playFocusSound();
    }

    // ==========================================================================
    // Launch Action & Missing Item Toast
    // ==========================================================================
    let toastTimeout = null;

    function showToast(title, desc) {
        playAlertSound();
        toastTitleEl.textContent = title;
        toastDescEl.textContent = desc;
        toastModalEl.classList.add('visible');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastModalEl.classList.remove('visible');
        }, 4000);
    }

    function handleItemAction(item) {
        if (isLaunching) return;

        if (item.installed === false) {
            showToast(
                `${item.name} n'est pas encore installé`,
                `Pour l'activer dans votre homelab, installez le paquet ou copiez son binaire dans le conteneur.`
            );
            return;
        }

        isLaunching = true;
        playLaunchSound();

        launchTitleEl.textContent = `LANCEMENT DE ${item.name.toUpperCase()}...`;
        launchSubEl.textContent = item.desc;
        launchLogoEl.innerHTML = ICONS[item.icon] || ICONS.gamepad;
        launchOverlayEl.classList.add('active');

        const targetUrl = `/api/launcher?app=${encodeURIComponent(item.id)}`;
        console.log(`[hub] Launching session: ${item.id} via ${targetUrl}`);

        // Safety timer to auto-dismiss overlay if launch is delayed or fails
        const safetyTimer = setTimeout(() => {
            isLaunching = false;
            launchOverlayEl.classList.remove('active');
        }, 8000);

        fetch(targetUrl, { method: 'GET' })
            .then(res => {
                if (!res.ok) {
                    clearTimeout(safetyTimer);
                    isLaunching = false;
                    launchOverlayEl.classList.remove('active');
                    showToast('Erreur de lancement', `Impossible de lancer ${item.name} (Code HTTP ${res.status}).`);
                }
            })
            .catch(err => {
                console.warn('[hub] Fetch error, continuing fallback:', err);
                clearTimeout(safetyTimer);
                isLaunching = false;
                launchOverlayEl.classList.remove('active');
                showToast('Erreur reseau', 'Le service resizer/launcher ne repond pas.');
            });
    }

    // ==========================================================================
    // Gamepad API Navigation Loop
    // ==========================================================================
    let lastNavTime = 0;
    const NAV_COOLDOWN_MS = 220;
    let prevButtonsState = {};

    function updateGamepadStatus() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let activePad = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                activePad = gamepads[i];
                break;
            }
        }

        if (activePad) {
            controllerPillEl.classList.remove('disconnected');
            let name = activePad.id;
            if (name.includes('Xbox')) name = 'Xbox Controller';
            else if (name.includes('DualSense') || name.includes('054c')) name = 'DualSense PS5';
            else if (name.includes('DualShock') || name.includes('Sony')) name = 'PlayStation Pad';
            else if (name.length > 20) name = name.substring(0, 18) + '...';
            controllerTextEl.textContent = name;
        } else {
            controllerPillEl.classList.add('disconnected');
            controllerTextEl.textContent = 'Clavier / Souris';
        }

        return activePad;
    }

    function gamepadLoop() {
        const pad = updateGamepadStatus();
        const now = performance.now();

        if (pad && !isLaunching) {
            // Analog stick navigation (Axis 0)
            const axisX = pad.axes[0] || 0;
            if (now - lastNavTime > NAV_COOLDOWN_MS) {
                if (axisX > 0.4) {
                    setItemIndex(currentItemIndex + 1);
                    lastNavTime = now;
                } else if (axisX < -0.4) {
                    setItemIndex(currentItemIndex - 1);
                    lastNavTime = now;
                }
            }

            const btn = (index) => pad.buttons[index] && pad.buttons[index].pressed;
            const btnJustPressed = (index) => {
                const pressed = btn(index);
                const justPressed = pressed && !prevButtonsState[index];
                prevButtonsState[index] = pressed;
                return justPressed;
            };

            // D-Pad Left (14) / Right (15)
            if (now - lastNavTime > NAV_COOLDOWN_MS) {
                if (btn(15)) {
                    setItemIndex(currentItemIndex + 1);
                    lastNavTime = now;
                } else if (btn(14)) {
                    setItemIndex(currentItemIndex - 1);
                    lastNavTime = now;
                }
            }

            // Bumpers: LB (4) / RB (5) -> Cycle Category Tabs
            if (btnJustPressed(4)) setCategoryIndex(currentCategoryIndex - 1);
            if (btnJustPressed(5)) setCategoryIndex(currentCategoryIndex + 1);

            // Button 0 (A / Cross): Launch active item
            if (btnJustPressed(0) && filteredItems[currentItemIndex]) {
                handleItemAction(filteredItems[currentItemIndex]);
            }

            // Button 1 (B / Circle): Desktop
            if (btnJustPressed(1)) {
                const desktopItem = allItems.find(i => i.id === 'desktop');
                if (desktopItem) handleItemAction(desktopItem);
            }

            // Button 9 (Start / Menu): Reload Steam
            if (btnJustPressed(9)) {
                handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Nettoyage du cache...' });
            }
        }

        requestAnimationFrame(gamepadLoop);
    }

    // ==========================================================================
    // Keyboard Navigation
    // ==========================================================================
    window.addEventListener('keydown', (e) => {
        // Prevent accidental closing of the Hub kiosk tab
        if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        initAudio();
        if (isLaunching) {
            if (e.key === 'Escape') {
                e.preventDefault();
                isLaunching = false;
                launchOverlayEl.classList.remove('active');
            }
            return;
        }

        switch (e.key) {
            case 'ArrowRight':
            case 'Tab':
                e.preventDefault();
                setItemIndex(currentItemIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setItemIndex(currentItemIndex - 1);
                break;
            case 'q':
            case 'Q':
                e.preventDefault();
                setCategoryIndex(currentCategoryIndex - 1);
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                setCategoryIndex(currentCategoryIndex + 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (filteredItems[currentItemIndex]) handleItemAction(filteredItems[currentItemIndex]);
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                const matched = allItems.find(i => i.badge_key === e.key);
                if (matched) {
                    e.preventDefault();
                    handleItemAction(matched);
                }
                break;
            case 'Escape':
                e.preventDefault();
                const desk = allItems.find(i => i.id === 'desktop');
                if (desk) handleItemAction(desk);
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Nettoyage du cache...' });
                break;
        }
    });

    btnRestartSteamEl.addEventListener('click', () => {
        initAudio();
        handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Nettoyage du cache...' });
    });

    // Clock
    function updateClock() {
        const now = new Date();
        clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Start
    loadData();
    window.addEventListener('gamepadconnected', () => {
        updateGamepadStatus();
        playFocusSound();
    });
    window.addEventListener('gamepaddisconnected', updateGamepadStatus);
    requestAnimationFrame(gamepadLoop);
    window.focus();
})();
