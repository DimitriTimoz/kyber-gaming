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
    const romUploadDropZoneEl = document.getElementById('romUploadDropZone');
    const romFileInputEl = document.getElementById('romFileInput');
    const btnBrowseRomEl = document.getElementById('btnBrowseRom');
    const romUploadProgressEl = document.getElementById('romUploadProgress');
    const romProgressFillEl = document.getElementById('romProgressFill');
    const romProgressTextEl = document.getElementById('romProgressText');
    const romInventoryCountEl = document.getElementById('romInventoryCount');
    const romPathHintEl = document.getElementById('romPathHint');
    const romTableBodyEl = document.getElementById('romTableBody');
    const romEmptyStateEl = document.getElementById('romEmptyState');
    let isRomModalOpen = false;
    let romInventory = null;
    let selectedRomSystem = 'all';

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
        headerStatusEl.textContent = isInstalled ? 'AVAILABLE' : 'NOT INSTALLED';
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
    // ROM & Game Manager Controller
    // ==========================================================================
    function openRomModal() {
        initAudio();
        isRomModalOpen = true;
        romModalEl.classList.add('active');
        fetchRomInventory();
    }

    function closeRomModal() {
        initAudio();
        isRomModalOpen = false;
        romModalEl.classList.remove('active');
    }

    function fetchRomInventory() {
        fetch('/api/roms')
            .then(res => res.json())
            .then(data => {
                romInventory = data;
                renderRomManager();
            })
            .catch(err => {
                console.warn('[hub] Error fetching ROM inventory:', err);
            });
    }

    function renderRomManager() {
        if (!romInventory) return;

        // Render system pills
        romSystemsBarEl.innerHTML = '';

        // All pill
        const allPill = document.createElement('button');
        allPill.className = `rom-system-pill ${selectedRomSystem === 'all' ? 'active' : ''}`;
        allPill.innerHTML = `<span>All Games</span> <span class="rom-pill-count">${romInventory.total_roms}</span>`;
        allPill.addEventListener('click', () => {
            selectedRomSystem = 'all';
            renderRomManager();
        });
        romSystemsBarEl.appendChild(allPill);

        // System pills
        const pillNames = {
            switch: 'Switch / NX2',
            bios: 'Keys & Firmware'
        };

        (romInventory.systems || []).forEach(sys => {
            const pill = document.createElement('button');
            pill.className = `rom-system-pill ${selectedRomSystem === sys.id ? 'active' : ''}`;
            const label = pillNames[sys.id] || sys.id.toUpperCase();
            pill.innerHTML = `<span>${label}</span> <span class="rom-pill-count">${sys.count}</span>`;
            pill.addEventListener('click', () => {
                selectedRomSystem = sys.id;
                renderRomManager();
            });
            romSystemsBarEl.appendChild(pill);
        });

        // BIOS & Keys pill
        const biosPill = document.createElement('button');
        biosPill.className = `rom-system-pill ${selectedRomSystem === 'bios' ? 'active' : ''}`;
        biosPill.innerHTML = `<span>Keys & Firmware</span> <span class="rom-pill-count">${romInventory.bios ? romInventory.bios.count : 0}</span>`;
        biosPill.addEventListener('click', () => {
            selectedRomSystem = 'bios';
            renderRomManager();
        });
        romSystemsBarEl.appendChild(biosPill);

        // Path hint & count
        if (selectedRomSystem === 'all') {
            romInventoryCountEl.textContent = `${romInventory.total_roms} games installed (${romInventory.total_size})`;
            romPathHintEl.textContent = `Storage path: ${romInventory.base_path}`;
        } else if (selectedRomSystem === 'bios') {
            const count = romInventory.bios ? romInventory.bios.count : 0;
            romInventoryCountEl.textContent = `${count} BIOS files installed`;
            romPathHintEl.textContent = `Storage path: ${romInventory.bios_path}`;
        } else {
            const currentSys = (romInventory.systems || []).find(s => s.id === selectedRomSystem);
            const count = currentSys ? currentSys.count : 0;
            romInventoryCountEl.textContent = `${count} games installed for ${currentSys ? currentSys.name : selectedRomSystem}`;
            romPathHintEl.textContent = `Storage path: ${romInventory.base_path}/${selectedRomSystem}`;
        }

        // Populate table
        romTableBodyEl.innerHTML = '';
        let displayList = [];

        if (selectedRomSystem === 'all') {
            (romInventory.systems || []).forEach(sys => {
                (sys.files || []).forEach(f => {
                    displayList.push({ ...f, system: sys.id, systemName: sys.name });
                });
            });
        } else if (selectedRomSystem === 'bios') {
            (romInventory.bios ? romInventory.bios.files : []).forEach(f => {
                displayList.push({ ...f, system: 'bios', systemName: 'BIOS Firmware' });
            });
        } else {
            const currentSys = (romInventory.systems || []).find(s => s.id === selectedRomSystem);
            if (currentSys) {
                (currentSys.files || []).forEach(f => {
                    displayList.push({ ...f, system: currentSys.id, systemName: currentSys.name });
                });
            }
        }

        if (displayList.length === 0) {
            romEmptyStateEl.style.display = 'block';
        } else {
            romEmptyStateEl.style.display = 'none';
            displayList.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="rom-sys-badge">${item.system.toUpperCase()}</span></td>
                    <td class="rom-filename-cell">${escapeHtml(item.name)}</td>
                    <td class="rom-size-cell">${item.size_formatted}</td>
                    <td style="text-align:right;">
                        <button class="rom-del-btn" data-system="${item.system}" data-filename="${escapeHtml(item.name)}">Delete</button>
                    </td>
                `;
                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteRomFile(item.system, item.name);
                });
                romTableBodyEl.appendChild(tr);
            });
        }
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    function deleteRomFile(system, filename) {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        fetch('/api/roms/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: system, filename: filename })
        })
        .then(r => r.json())
        .then(res => {
            if (res.status === 'ok') {
                showToast('File Removed', `Deleted ${filename}`);
                fetchRomInventory();
            } else {
                showToast('Delete Error', res.error || 'Failed to remove file');
            }
        })
        .catch(err => {
            showToast('Delete Error', 'Network error occurred');
        });
    }

    function detectSystemForFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        if (selectedRomSystem !== 'all') return selectedRomSystem;

        if (['.nsp', '.xci', '.nsz'].includes(ext)) return 'switch';
        if (['.keys', '.bin', '.dat'].includes(ext) || filename.toLowerCase().includes('key') || filename.toLowerCase().includes('firmware') || filename.toLowerCase().includes('bios')) return 'bios';
        return 'switch';
    }

    function uploadFilesSequentially(files) {
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        let index = 0;

        romUploadProgressEl.style.display = 'block';

        function uploadNext() {
            if (index >= fileArr.length) {
                romUploadProgressEl.style.display = 'none';
                showToast('Upload Complete', `Successfully uploaded ${fileArr.length} file(s).`);
                fetchRomInventory();
                return;
            }

            const file = fileArr[index];
            const targetSys = detectSystemForFile(file.name);
            const uploadUrl = `/api/roms/upload?system=${encodeURIComponent(targetSys)}&filename=${encodeURIComponent(file.name)}`;

            romProgressTextEl.textContent = `Uploading ${file.name} (${index + 1}/${fileArr.length})...`;
            romProgressFillEl.style.width = '0%';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    romProgressFillEl.style.width = `${pct}%`;
                    romProgressTextEl.textContent = `Uploading ${file.name} (${pct}%)...`;
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    index++;
                    uploadNext();
                } else {
                    romUploadProgressEl.style.display = 'none';
                    showToast('Upload Failed', `Error uploading ${file.name} (HTTP ${xhr.status})`);
                }
            };

            xhr.onerror = function() {
                romUploadProgressEl.style.display = 'none';
                showToast('Upload Failed', `Network error uploading ${file.name}`);
            };

            xhr.send(file);
        }

        uploadNext();
    }

    if (btnRomManagerEl) btnRomManagerEl.addEventListener('click', openRomModal);
    if (btnRomModalCloseEl) btnRomModalCloseEl.addEventListener('click', closeRomModal);
    if (btnBrowseRomEl) btnBrowseRomEl.addEventListener('click', () => romFileInputEl.click());
    if (romFileInputEl) romFileInputEl.addEventListener('change', (e) => uploadFilesSequentially(e.target.files));

    if (romUploadDropZoneEl) {
        romUploadDropZoneEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            romUploadDropZoneEl.classList.add('dragover');
        });
        romUploadDropZoneEl.addEventListener('dragleave', () => {
            romUploadDropZoneEl.classList.remove('dragover');
        });
        romUploadDropZoneEl.addEventListener('drop', (e) => {
            e.preventDefault();
            romUploadDropZoneEl.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) {
                uploadFilesSequentially(e.dataTransfer.files);
            }
        });
    }

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
