/**
 * Kyber Console OS - Modern Gamepad-Ready Dashboard Hub
 * High-performance horizontal carousel with synthesized Web Audio effects.
 */

(function () {
    'use strict';

    // Launcher Items Data
    const ITEMS = [
        {
            id: 'steam',
            tag: 'BUREAU & MAGASIN',
            title: 'STEAM',
            desc: 'Bibliothèque complète de jeux, magasin, amis, chat vocal et téléchargements.',
            theme: 'theme-steam',
            logo: '🎮'
        },
        {
            id: 'steam-bigpicture',
            tag: 'CONSOLE TV & DECK',
            title: 'BIG PICTURE',
            desc: 'L\'interface Steam Deck optimisée pour écran de télévision et manette sans fil.',
            theme: 'theme-bigpicture',
            logo: '📺'
        },
        {
            id: 'heroic',
            tag: 'EPIC GAMES & GOG',
            title: 'HEROIC',
            desc: 'Vos jeux Epic Games Store et GOG avec synchronisation des sauvegardes cloud.',
            theme: 'theme-heroic',
            logo: '🦸'
        },
        {
            id: 'desktop',
            tag: 'MODE LIBRE',
            title: 'BUREAU LINUX',
            desc: 'Accédez directement au bureau graphique complet, gestionnaire de fenêtres et terminal.',
            theme: 'theme-desktop',
            logo: '🖥️'
        }
    ];

    let currentIndex = 0;
    let isLaunching = false;

    // Elements
    const body = document.body;
    const cards = document.querySelectorAll('.card');
    const headerTag = document.getElementById('headerTag');
    const headerTitle = document.getElementById('headerTitle');
    const headerDesc = document.getElementById('headerDesc');
    const clockEl = document.getElementById('clock');
    const displayResEl = document.getElementById('displayRes');
    const controllerPill = document.getElementById('controllerPill');
    const controllerText = document.getElementById('controllerText');
    const launchOverlay = document.getElementById('launchOverlay');
    const launchTitle = document.getElementById('launchTitle');
    const launchSub = document.getElementById('launchSub');
    const launchLogo = document.getElementById('launchLogo');
    const btnRestartSteam = document.getElementById('btnRestartSteam');

    // ==========================================================================
    // Synthesized Console Sound Effects (Web Audio API)
    // Zero audio files needed, zero latency, runs instantly
    // ==========================================================================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Gentle cursor tick (like PS5/Switch card focus)
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

    // Rich two-tone chime when launching
    function playLaunchSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;

            // Tone 1: C5 (523Hz)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);

            // Tone 2: E5 (659Hz) slightly delayed
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.06);
            gain2.gain.setValueAtTime(0.14, now + 0.06);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(now + 0.06);
            osc2.stop(now + 0.5);
        } catch (e) {}
    }

    // Soft downward chirp on back / cancel
    function playBackSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    // ==========================================================================
    // Carousel State & Navigation
    // ==========================================================================
    function setFocusIndex(index, playSound = true) {
        if (isLaunching) return;

        // Wrap index
        if (index < 0) index = ITEMS.length - 1;
        if (index >= ITEMS.length) index = 0;

        currentIndex = index;
        const currentItem = ITEMS[currentIndex];

        // Update Theme
        body.className = currentItem.theme;

        // Update Header
        headerTag.textContent = currentItem.tag;
        headerTitle.textContent = currentItem.title;
        headerDesc.textContent = currentItem.desc;

        // Update Cards
        cards.forEach((card, idx) => {
            if (idx === currentIndex) {
                card.classList.add('active');
                card.focus();
            } else {
                card.classList.remove('active');
            }
        });

        if (playSound) {
            playFocusSound();
        }
    }

    // ==========================================================================
    // Launcher Action Execution
    // ==========================================================================
    function launch(launcherId) {
        if (isLaunching) return;
        isLaunching = true;

        const item = ITEMS.find(i => i.id === launcherId) || {
            title: launcherId.toUpperCase(),
            desc: 'Démarrage...',
            logo: '🚀'
        };

        playLaunchSound();

        // Show Launch Splash Overlay
        launchTitle.textContent = `LANCEMENT DE ${item.title}...`;
        launchSub.textContent = item.desc;
        launchLogo.textContent = item.logo || '🎮';
        launchOverlay.classList.add('active');

        // Request backend switch via Resizer HTTP API
        const targetUrl = `/api/launcher?app=${encodeURIComponent(launcherId)}`;
        console.log(`[hub] Launching session: ${launcherId} via ${targetUrl}`);

        fetch(targetUrl, { method: 'GET' })
            .then(res => res.json())
            .then(data => {
                console.log('[hub] Launch switch response:', data);
            })
            .catch(err => {
                console.warn('[hub] Fetch error, continuing fallback:', err);
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
            controllerPill.classList.remove('disconnected');
            // Clean controller name
            let name = activePad.id;
            if (name.includes('Xbox')) name = 'Xbox Controller';
            else if (name.includes('DualSense') || name.includes('054c')) name = 'DualSense PS5';
            else if (name.includes('DualShock') || name.includes('Sony')) name = 'PlayStation Pad';
            else if (name.length > 20) name = name.substring(0, 18) + '...';
            controllerText.textContent = name;
        } else {
            controllerPill.classList.add('disconnected');
            controllerText.textContent = 'Clavier / Souris';
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
                    setFocusIndex(currentIndex + 1);
                    lastNavTime = now;
                } else if (axisX < -0.4) {
                    setFocusIndex(currentIndex - 1);
                    lastNavTime = now;
                }
            }

            // D-Pad and Buttons Check
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
                    setFocusIndex(currentIndex + 1);
                    lastNavTime = now;
                } else if (btn(14)) {
                    setFocusIndex(currentIndex - 1);
                    lastNavTime = now;
                }
            }

            // Bumpers: LB (4) / RB (5)
            if (btnJustPressed(4)) setFocusIndex(currentIndex - 1);
            if (btnJustPressed(5)) setFocusIndex(currentIndex + 1);

            // Button 0 (A / Cross): Select / Launch
            if (btnJustPressed(0)) {
                launch(ITEMS[currentIndex].id);
            }

            // Button 1 (B / Circle): Back / Desktop
            if (btnJustPressed(1)) {
                playBackSound();
                launch('desktop');
            }

            // Quick Hotkeys: Button 2 (X / Square) -> Heroic
            if (btnJustPressed(2)) {
                launch('heroic');
            }

            // Quick Hotkeys: Button 3 (Y / Triangle) -> Steam Big Picture
            if (btnJustPressed(3)) {
                launch('steam-bigpicture');
            }

            // Button 9 (Start / Menu): Reload Steam
            if (btnJustPressed(9)) {
                launch('restart-steam');
            }
        }

        requestAnimationFrame(gamepadLoop);
    }

    // ==========================================================================
    // Keyboard & Mouse Navigation
    // ==========================================================================
    window.addEventListener('keydown', (e) => {
        initAudio();
        if (isLaunching) return;

        switch (e.key) {
            case 'ArrowRight':
            case 'Tab':
                e.preventDefault();
                setFocusIndex(currentIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setFocusIndex(currentIndex - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                launch(ITEMS[currentIndex].id);
                break;
            case '1':
                e.preventDefault();
                launch('steam');
                break;
            case '2':
                e.preventDefault();
                launch('steam-bigpicture');
                break;
            case '3':
                e.preventDefault();
                launch('heroic');
                break;
            case '4':
                e.preventDefault();
                launch('desktop');
                break;
            case 'Escape':
                e.preventDefault();
                playBackSound();
                launch('desktop');
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                launch('restart-steam');
                break;
        }
    });

    // Card Mouse Events
    cards.forEach((card, idx) => {
        card.addEventListener('mouseenter', () => {
            initAudio();
            setFocusIndex(idx);
        });

        card.addEventListener('click', () => {
            initAudio();
            launch(ITEMS[idx].id);
        });
    });

    // Restart Steam Button
    btnRestartSteam.addEventListener('click', () => {
        initAudio();
        launch('restart-steam');
    });

    // ==========================================================================
    // Clock & Resolution Updates
    // ==========================================================================
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hrs}:${mins}`;
    }

    function updateResolution() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        let label = `${w}x${h}`;
        if (w >= 3800) label = '4K 60Hz';
        else if (w >= 2500) label = '1440p 60Hz';
        else if (w >= 1900) label = '1080p 60Hz';
        displayResEl.textContent = label;
    }

    // Init
    setInterval(updateClock, 1000);
    updateClock();
    updateResolution();
    window.addEventListener('resize', updateResolution);

    // Initial focus on Steam
    setFocusIndex(0, false);

    // Start Gamepad Loop
    window.addEventListener('gamepadconnected', () => {
        updateGamepadStatus();
        playFocusSound();
    });
    window.addEventListener('gamepaddisconnected', updateGamepadStatus);
    requestAnimationFrame(gamepadLoop);

    // Focus window to capture keyboard input
    window.focus();
})();
