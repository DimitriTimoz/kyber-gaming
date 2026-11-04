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
        switch: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.7 2C3.4 2 0 5.4 0 9.7v4.6C0 18.6 3.4 22 7.7 22H9V2H7.7zM6 9.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5S4.5 11.8 4.5 11s.7-1.5 1.5-1.5zm10.3-7.5H15v20h1.3c4.3 0 7.7-3.4 7.7-7.7V9.7C24 5.4 20.6 2 16.3 2zM18 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg>`,
        browser: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.1 1.41 5.88 3.64 7.73l1.83-2.61C6.2 15.89 5.5 14.04 5.5 12c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5c0 1.23-.34 2.38-.94 3.36l1.89 2.12C20.47 16.03 21 14.1 21 12c0-5.52-4.48-10-10-10zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
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
    const btnRomManagerEl = document.getElementById('btnRomManager');
    const romModalEl = document.getElementById('romModal');
    const btnRomModalCloseEl = document.getElementById('btnRomModalClose');
    const romSystemsBarEl = document.getElementById('romSystemsBar');
    const romBreadcrumbsEl = document.getElementById('romBreadcrumbs');
    const romSearchInputEl = document.getElementById('romSearchInput');
    const btnNewFolderEl = document.getElementById('btnNewFolder');
    const btnUploadFilesEl = document.getElementById('btnUploadFiles');
    const romFileInputEl = document.getElementById('romFileInput');
    const romFolderInputEl = document.getElementById('romFolderInput');
    const romUploadCardEl = document.getElementById('romUploadCard');
    const romUploadCardTitleEl = document.getElementById('romUploadCardTitle');
    const btnCancelUploadEl = document.getElementById('btnCancelUpload');
    const romUploadCardBarEl = document.getElementById('romUploadCardBar');
    const romUploadStatProgressEl = document.getElementById('romUploadStatProgress');
    const romUploadStatSpeedEl = document.getElementById('romUploadStatSpeed');
    const romUploadStatEtaEl = document.getElementById('romUploadStatEta');
    const romDropTargetEl = document.getElementById('romDropTarget');
    const romTableBodyEl = document.getElementById('romTableBody');
    const romEmptyStateEl = document.getElementById('romEmptyState');
    const romStorageHintEl = document.getElementById('romStorageHint');
    let isRomModalOpen = false;
    let currentBrowsePath = 'eglantine/games';
    let currentDirData = null;
    let isUploadCancelled = false;

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

    // Tactile silky console focus tick (Nintendo Switch / PS5 style)
    function playFocusSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(860, now);
            osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
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
                        <div class="meta-sub">${installed ? (item.category === 'emulators' ? 'Emulator' : 'Ready to launch') : 'Not installed'}</div>
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

        // Position track immediately on initial render
        updateTrackPosition();
        setItemIndex(selectIdx, false);
    }

    function updateTrackPosition() {
        if (!carouselTrackEl || filteredItems.length === 0) return;
        const container = carouselTrackEl.parentElement;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const cards = carouselTrackEl.querySelectorAll('.card');
        const activeCard = cards[currentItemIndex];
        if (!activeCard) return;

        // Mathematical center calculation: moves active card exactly to viewport center
        const cardCenter = activeCard.offsetLeft + (activeCard.offsetWidth / 2);
        const targetX = (containerWidth / 2) - cardCenter;
        carouselTrackEl.style.transform = `translate3d(${targetX}px, 0, 0)`;

        // Update card classes for 3D depth and perspective hierarchy
        cards.forEach((card, idx) => {
            card.classList.remove('active', 'neighbor-prev', 'neighbor-next', 'distant');
            if (idx === currentItemIndex) {
                card.classList.add('active');
            } else if (idx === currentItemIndex - 1) {
                card.classList.add('neighbor-prev');
            } else if (idx === currentItemIndex + 1) {
                card.classList.add('neighbor-next');
            } else {
                card.classList.add('distant');
            }
        });
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

        // Update Header with fluid slide-fade animation
        headerTagEl.textContent = currentItem.tag || currentItem.category.toUpperCase();
        headerTitleEl.textContent = currentItem.name.toUpperCase();
        headerDescEl.textContent = currentItem.desc;

        [headerTagEl, headerTitleEl, headerDescEl].forEach(el => {
            if (el) {
                el.classList.remove('slide-enter');
                void el.offsetWidth;
                el.classList.add('slide-enter');
            }
        });

        const isInstalled = currentItem.installed !== false;
        headerStatusEl.textContent = isInstalled ? 'AVAILABLE' : 'NOT INSTALLED';
        headerStatusEl.className = `header-status-badge ${!isInstalled ? 'missing' : ''}`;

        updateTrackPosition();

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

        if (item.id === 'rom-manager') {
            openRomModal();
            return;
        }

        if (item.installed === false) {
            showToast(
                `${item.name} is not installed`,
                `To enable it in your homelab, install the corresponding package or binary in the container.`
            );
            return;
        }

        isLaunching = true;
        playLaunchSound();

        launchTitleEl.textContent = `LAUNCHING ${item.name.toUpperCase()}...`;
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
                    showToast('Launch Error', `Unable to launch ${item.name} (HTTP code ${res.status}).`);
                }
            })
            .catch(err => {
                console.warn('[hub] Fetch error, continuing fallback:', err);
                clearTimeout(safetyTimer);
                isLaunching = false;
                launchOverlayEl.classList.remove('active');
                showToast('Network Error', 'The launcher service did not respond.');
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
            controllerTextEl.textContent = 'Keyboard / Mouse';
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
                if (isRomModalOpen) {
                    closeRomModal();
                    break;
                }
                const desk = allItems.find(i => i.id === 'desktop');
                if (desk) handleItemAction(desk);
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                if (isRomModalOpen) closeRomModal();
                else openRomModal();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Nettoyage du cache...' });
                break;
        }
    });

    // ==========================================================================
    // ROM & Game Library Explorer Controller (Hierarchical & Chunked Upload)
    // ==========================================================================
    const PRESET_FOLDERS = [
        { id: 'switch_games', name: 'Switch Games', path: 'eglantine/games' },
        { id: 'switch_updates', name: 'Updates', path: 'eglantine/updates' },
        { id: 'switch_dlc', name: 'DLC Packs', path: 'eglantine/dlc' },
        { id: 'switch_keys', name: 'Keys', path: 'eglantine/keys' },
        { id: 'switch_firmware', name: 'Firmware', path: 'eglantine/firmware' },
        { id: 'switch_mods', name: 'Mods', path: 'eglantine/mods' },
        { id: 'saves', name: 'Saves', path: 'saves' },
        { id: 'all', name: 'All Folders', path: '' }
    ];

    const FILE_ICONS = {
        folder: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
        rom: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.7 2C3.4 2 0 5.4 0 9.7v4.6C0 18.6 3.4 22 7.7 22H9V2H7.7zM6 9.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5S4.5 11.8 4.5 11s.7-1.5 1.5-1.5zm10.3-7.5H15v20h1.3c4.3 0 7.7-3.4 7.7-7.7V9.7C24 5.4 20.6 2 16.3 2zM18 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg>`,
        key: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 .65-.13 1.26-.36 1.83L18 17.17V20h-3v-2h-2v-2h-2.17l-1.01-1.01C9.26 15.37 8.15 16 7 16zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        archive: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-4v-2h4v2zm0-3h-4v-2h4v2zm0-3h-4V8h4v2z"/></svg>`,
        save: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>`,
        file: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
    };

    function openRomModal() {
        initAudio();
        isRomModalOpen = true;
        romModalEl.classList.add('active');
        renderPresetPills();
        loadDirectory(currentBrowsePath);
    }

    function closeRomModal() {
        initAudio();
        isRomModalOpen = false;
        romModalEl.classList.remove('active');
    }

    function renderPresetPills() {
        romSystemsBarEl.innerHTML = '';
        PRESET_FOLDERS.forEach(preset => {
            const btn = document.createElement('button');
            const isActive = currentBrowsePath === preset.path || (preset.path !== '' && currentBrowsePath.startsWith(preset.path));
            btn.className = `rom-system-pill ${isActive ? 'active' : ''}`;
            btn.innerHTML = `<span>${preset.name}</span>`;
            btn.addEventListener('click', () => {
                initAudio();
                loadDirectory(preset.path);
            });
            romSystemsBarEl.appendChild(btn);
        });
    }

    async function loadDirectory(relPath) {
        currentBrowsePath = relPath || '';
        try {
            const res = await fetch(`/api/roms/browse?path=${encodeURIComponent(currentBrowsePath)}`);
            if (res.ok) {
                const data = await res.json();
                currentDirData = data;
                renderDirectoryView();
                renderPresetPills();
            } else {
                showToast('Browse Error', 'Failed to read directory');
            }
        } catch (e) {
            console.warn('[hub] Failed to browse directory:', e);
            showToast('Network Error', 'Unable to reach backend storage service');
        }
    }

    function renderDirectoryView() {
        if (!currentDirData) return;

        // 1. Breadcrumbs
        romBreadcrumbsEl.innerHTML = '';
        (currentDirData.breadcrumbs || []).forEach((crumb, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const item = document.createElement('span');
            item.className = `rom-crumb-item ${isLast ? 'active' : ''}`;
            item.textContent = crumb.name;
            if (!isLast) {
                item.addEventListener('click', () => {
                    initAudio();
                    loadDirectory(crumb.path);
                });
            }
            romBreadcrumbsEl.appendChild(item);

            if (!isLast) {
                const sep = document.createElement('span');
                sep.className = 'rom-crumb-sep';
                sep.textContent = '/';
                romBreadcrumbsEl.appendChild(sep);
            }
        });

        // 2. Storage Hint
        const currentPath = currentDirData.current_path !== undefined ? currentDirData.current_path : (currentDirData.path || '');
        const storageRoot = currentDirData.storage_root || currentDirData.absolute_path || '/home/gamer/roms';
        const totalSize = currentDirData.total_size || currentDirData.total_size_formatted || '0 B';

        if (romStorageHintEl) {
            romStorageHintEl.textContent = `Location: ${storageRoot}/${currentPath} (${currentDirData.total_folders || 0} folders, ${currentDirData.total_files || 0} files, ${totalSize})`;
        }

        // 3. Search Filter
        const query = (romSearchInputEl ? romSearchInputEl.value : '').trim().toLowerCase();

        const folders = (currentDirData.folders || []).filter(f => !query || f.name.toLowerCase().includes(query));
        const files = (currentDirData.files || []).filter(f => !query || f.name.toLowerCase().includes(query));

        romTableBodyEl.innerHTML = '';

        // Parent Directory row if not at root
        if (currentBrowsePath !== '') {
            const parentParts = currentBrowsePath.split('/').filter(Boolean);
            parentParts.pop();
            const parentPath = parentParts.join('/');

            const trParent = document.createElement('tr');
            trParent.className = 'rom-folder-row';
            trParent.innerHTML = `
                <td class="rom-filename-cell">
                    <span class="rom-item-icon" style="color:var(--text-muted);">${FILE_ICONS.folder}</span>
                    <span class="rom-folder-link">.. [Up one directory]</span>
                </td>
                <td><span class="rom-sys-badge">PARENT</span></td>
                <td class="rom-size-cell">--</td>
                <td class="rom-date-cell">--</td>
                <td style="text-align:right;"></td>
            `;
            trParent.addEventListener('click', () => {
                initAudio();
                loadDirectory(parentPath);
            });
            romTableBodyEl.appendChild(trParent);
        }

        if (folders.length === 0 && files.length === 0) {
            romEmptyStateEl.style.display = 'block';
        } else {
            romEmptyStateEl.style.display = 'none';

            // Render folders
            folders.forEach(folder => {
                const tr = document.createElement('tr');
                tr.className = 'rom-folder-row';
                const count = folder.item_count !== undefined ? folder.item_count : (folder.items_count || 0);
                tr.innerHTML = `
                    <td class="rom-filename-cell">
                        <span class="rom-item-icon" style="color:#60a5fa;">${FILE_ICONS.folder}</span>
                        <span class="rom-folder-link">${escapeHtml(folder.name)}</span>
                    </td>
                    <td><span class="rom-sys-badge" style="background:rgba(59,130,246,0.12);color:#93c5fd;">FOLDER</span></td>
                    <td class="rom-size-cell">${folder.size_formatted} (${count} items)</td>
                    <td class="rom-date-cell">${formatTimestamp(folder.modified)}</td>
                    <td style="text-align:right;">
                        <button class="rom-del-btn" title="Delete Folder">Delete</button>
                    </td>
                `;

                tr.querySelector('.rom-folder-link').addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    loadDirectory(folder.path);
                });

                tr.addEventListener('click', () => {
                    initAudio();
                    loadDirectory(folder.path);
                });

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    deleteStorageItem(folder.path, folder.name, true);
                });

                romTableBodyEl.appendChild(tr);
            });

            // Render files
            files.forEach(file => {
                const fileType = file.type || file.kind || 'file';
                const fileExt = file.extension || file.ext || '';
                const iconSvg = FILE_ICONS[fileType] || FILE_ICONS.file;
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

                tr.innerHTML = `
                    <td class="rom-filename-cell">
                        <span class="rom-item-icon">${iconSvg}</span>
                        <span class="rom-file-name">${escapeHtml(file.name)}</span>
                    </td>
                    <td><span class="rom-sys-badge" style="${kindBadgeStyle}">${kindBadge}</span></td>
                    <td class="rom-size-cell">${file.size_formatted}</td>
                    <td class="rom-date-cell">${formatTimestamp(file.modified)}</td>
                    <td style="text-align:right;">
                        <div class="rom-row-actions">
                            ${(fileType === 'archive' || fileExt === '.iso') ? `<button class="rom-extract-btn" style="background:rgba(168,85,247,0.15);color:#d8b4fe;border:1px solid rgba(168,85,247,0.3);padding:2px 8px;font-size:0.7rem;font-weight:600;border-radius:4px;cursor:pointer;margin-right:6px;" title="Extract Disc Image or Archive">EXTRACT</button>` : ''}
                            <a href="/api/roms/download?path=${encodeURIComponent(file.path)}" class="rom-action-icon-btn" title="Download File" download>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </a>
                            <button class="rom-del-btn" title="Delete File">Delete</button>
                        </div>
                    </td>
                `;

                const extractBtn = tr.querySelector('.rom-extract-btn');
                if (extractBtn) {
                    extractBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        initAudio();
                        extractStorageArchive(file.path, file.name);
                    });
                }

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    deleteStorageItem(file.path, file.name, false);
                });

                romTableBodyEl.appendChild(tr);
            });
        }
    }

    async function extractStorageArchive(relPath, filename) {
        showRomToast(`Extraction: ${filename}...`);
        try {
            const res = await fetch('/api/roms/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath, delete_archive: false })
            });
            const data = await res.json();
            if (data && data.status === 'ok') {
                showRomToast(`Extraction terminee: ${filename}`);
                loadDirectory(currentBrowsePath);
            } else {
                showRomToast(`Echec d'extraction: ${(data && data.error) || 'Erreur'}`);
            }
        } catch (err) {
            showRomToast(`Erreur d'extraction: ${err}`);
        }
    }

    function formatTimestamp(ts) {
        if (!ts) return '--';
        if (typeof ts === 'number') {
            const d = new Date(ts * 1000);
            return d.toISOString().slice(0, 16).replace('T', ' ');
        }
        return String(ts);
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    // Create New Folder
    async function promptCreateFolder() {
        const folderName = window.prompt(`Create new folder inside "${currentBrowsePath || 'root'}":`);
        if (!folderName || !folderName.trim()) return;

        try {
            const res = await fetch('/api/roms/create_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentBrowsePath,
                    folder_name: folderName.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast('Folder Created', `Created folder "${data.folder_name}"`);
                loadDirectory(data.created_path);
            } else {
                showToast('Folder Error', data.error || 'Failed to create folder');
            }
        } catch (e) {
            showToast('Network Error', 'Failed to reach server');
        }
    }

    // Delete item (file or folder)
    async function deleteStorageItem(relPath, displayName, isFolder) {
        const label = isFolder ? `folder "${displayName}" and all its contents` : `file "${displayName}"`;
        if (!confirm(`Are you sure you want to delete ${label}?`)) return;

        try {
            const res = await fetch('/api/roms/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast('Deleted', `Removed ${displayName}`);
                loadDirectory(currentBrowsePath);
            } else {
                showToast('Delete Error', data.error || 'Failed to delete item');
            }
        } catch (e) {
            showToast('Delete Error', 'Network error occurred');
        }
    }

    // ==========================================================================
    // Chunked High-Performance File Uploader Engine (10 MB chunks with telemetry)
    // ==========================================================================
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks

    async function uploadFilesChunked(files) {
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        isUploadCancelled = false;

        romUploadCardEl.style.display = 'block';

        let totalBytesAllFiles = fileArr.reduce((sum, f) => sum + f.size, 0);
        let uploadedBytesOverall = 0;
        let overallStartTime = performance.now();

        for (let fileIdx = 0; fileIdx < fileArr.length; fileIdx++) {
            if (isUploadCancelled) {
                showToast('Upload Cancelled', 'File upload was aborted.');
                break;
            }

            const file = fileArr[fileIdx];
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
            const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            romUploadCardTitleEl.textContent = `Uploading ${file.name} (${fileIdx + 1} of ${fileArr.length})...`;

            for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
                if (isUploadCancelled) break;

                const start = chunkIdx * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);
                const chunkSize = end - start;

                const chunkStartTime = performance.now();

                try {
                    const uploadUrl = `/api/roms/upload_chunk?upload_id=${encodeURIComponent(uploadId)}&filename=${encodeURIComponent(file.name)}&target_path=${encodeURIComponent(currentBrowsePath)}&chunk_index=${chunkIdx}&total_chunks=${totalChunks}&total_size=${file.size}`;

                    await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', uploadUrl, true);
                        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                const currentChunkLoaded = e.loaded;
                                const currentTotalUploaded = uploadedBytesOverall + currentChunkLoaded;
                                const pct = Math.min(100, Math.round((currentTotalUploaded / totalBytesAllFiles) * 100));

                                const elapsedSec = (performance.now() - overallStartTime) / 1000;
                                const speedBytesPerSec = elapsedSec > 0 ? (currentTotalUploaded / elapsedSec) : 0;
                                const speedMBps = (speedBytesPerSec / (1024 * 1024)).toFixed(1);

                                const remainingBytes = Math.max(0, totalBytesAllFiles - currentTotalUploaded);
                                const etaSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
                                const etaFormatted = formatSeconds(etaSec);

                                romUploadCardBarEl.style.width = `${pct}%`;
                                romUploadStatProgressEl.textContent = `${pct}% (${formatBytes(currentTotalUploaded)} / ${formatBytes(totalBytesAllFiles)})`;
                                romUploadStatSpeedEl.textContent = `${speedMBps} MB/s`;
                                romUploadStatEtaEl.textContent = `ETA: ${etaFormatted}`;
                            }
                        };

                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                resolve();
                            } else {
                                reject(new Error(`Server returned HTTP ${xhr.status}`));
                            }
                        };

                        xhr.onerror = () => reject(new Error('Network transport error'));
                        xhr.send(chunkBlob);
                    });

                    uploadedBytesOverall += chunkSize;
                } catch (err) {
                    romUploadCardEl.style.display = 'none';
                    showToast('Upload Error', `Failed on ${file.name}: ${err.message}`);
                    loadDirectory(currentBrowsePath);
                    return;
                }
            }
        }

        romUploadCardEl.style.display = 'none';
        if (!isUploadCancelled) {
            showToast('Upload Finished', `Successfully saved ${fileArr.length} file(s) into ${currentBrowsePath || 'root'}.`);
            loadDirectory(currentBrowsePath);
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

    // Event Bindings
    if (btnRomManagerEl) btnRomManagerEl.addEventListener('click', openRomModal);
    if (btnRomModalCloseEl) btnRomModalCloseEl.addEventListener('click', closeRomModal);
    if (btnNewFolderEl) btnNewFolderEl.addEventListener('click', promptCreateFolder);
    if (btnUploadFilesEl) btnUploadFilesEl.addEventListener('click', () => romFileInputEl.click());
    if (romFileInputEl) romFileInputEl.addEventListener('change', (e) => uploadFilesChunked(e.target.files));

    if (btnCancelUploadEl) {
        btnCancelUploadEl.addEventListener('click', () => {
            isUploadCancelled = true;
            romUploadCardEl.style.display = 'none';
        });
    }

    if (romSearchInputEl) {
        romSearchInputEl.addEventListener('input', () => {
            renderDirectoryView();
        });
    }

    if (romDropTargetEl) {
        romDropTargetEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            romDropTargetEl.classList.add('dragover');
        });
        romDropTargetEl.addEventListener('dragleave', () => {
            romDropTargetEl.classList.remove('dragover');
        });
        romDropTargetEl.addEventListener('drop', (e) => {
            e.preventDefault();
            romDropTargetEl.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) {
                uploadFilesChunked(e.dataTransfer.files);
            }
        });
    }

    btnRestartSteamEl.addEventListener('click', () => {
        initAudio();
        handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Nettoyage du cache...' });
    });

    const btnDesktopModeEl = document.getElementById('btnDesktopMode');
    if (btnDesktopModeEl) {
        btnDesktopModeEl.addEventListener('click', () => {
            initAudio();
            handleItemAction({ id: 'desktop', name: 'Linux Desktop Mode', desc: 'Accès au bureau et gestionnaire de fenêtres' });
        });
    }

    // Running Application Polling & Indicators
    let currentRunningApps = {};
    async function pollLauncherStatus() {
        try {
            const res = await fetch('/api/launcher/status');
            if (res.ok) {
                currentRunningApps = await res.json();
                updateRunningAppBadges();
            }
        } catch (e) {}
    }

    function updateRunningAppBadges() {
        const cards = carouselTrackEl.querySelectorAll('.card');
        let activeTitle = null;
        let activeId = null;

        cards.forEach(card => {
            const id = card.dataset.id;
            let isRunning = false;
            if ((id === 'steam' || id === 'steam-bigpicture') && currentRunningApps.steam) isRunning = true;
            if (id === 'heroic' && currentRunningApps.heroic) isRunning = true;
            if (id === 'browser' && currentRunningApps.browser) isRunning = true;
            if (id === 'eglantine' && currentRunningApps.eglantine) isRunning = true;

            const cover = card.querySelector('.card-cover');
            let badge = card.querySelector('.running-badge');
            if (isRunning) {
                activeTitle = card.querySelector('.meta-title')?.textContent || id;
                activeId = id;
                if (!badge && cover) {
                    badge = document.createElement('div');
                    badge.className = 'running-badge';
                    badge.innerHTML = '<span class="pulse-dot"></span> EN COURS';
                    cover.appendChild(badge);
                }
            } else if (badge) {
                badge.remove();
            }
        });

        const pill = document.getElementById('runningAppPill');
        const text = document.getElementById('runningAppText');
        if (pill && text) {
            if (activeTitle) {
                text.textContent = `${activeTitle}`;
                pill.style.display = 'flex';
                pill.onclick = (e) => {
                    if (e.target.id === 'btnKillRunningApp') return;
                    handleItemAction({ id: activeId, name: activeTitle });
                };
            } else {
                pill.style.display = 'none';
            }
        }
    }

    const btnKillRunningAppEl = document.getElementById('btnKillRunningApp');
    if (btnKillRunningAppEl) {
        btnKillRunningAppEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await fetch('/api/launcher?app=menu');
                showToast('Fermeture en cours', "L'application a été arrêtée.");
                setTimeout(pollLauncherStatus, 800);
            } catch (err) {}
        });
    }

    // Window Resize Handling for Transform Centering
    window.addEventListener('resize', () => {
        updateTrackPosition();
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
    setInterval(pollLauncherStatus, 3000);
    pollLauncherStatus();

    window.addEventListener('gamepadconnected', () => {
        updateGamepadStatus();
        playFocusSound();
    });
    window.addEventListener('gamepaddisconnected', updateGamepadStatus);
    requestAnimationFrame(gamepadLoop);
    window.focus();
})();
