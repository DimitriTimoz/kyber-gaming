/**
 * Kyber In-Game Performance HUD (Stats for Nerds)
 * Real-time render FPS, round-trip latency, telemetry, and stream stats.
 * Shortcut: Ctrl+Shift+S or F10 to toggle.
 * Zero-emoji, Geist Mono styling.
 */

(function () {
    'use strict';

    // HUD Mode: 'off', 'bar' (compact MangoHud horizontal line), or 'card' (detailed stats window)
    let hudMode = 'off';
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFps = 60;
    let pingLatency = null;
    let serverTelemetry = null;
    let pollInterval = null;

    // Check URL parameters for default HUD state
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('hud') === '1' || urlParams.get('hud') === 'true') {
        hudMode = 'bar';
    } else if (urlParams.get('hud') === 'card') {
        hudMode = 'card';
    }

    // 1. Create Compact MangoHud-style Top Bar (#kyberPerfBar)
    const perfBar = document.createElement('div');
    perfBar.id = 'kyberPerfBar';
    perfBar.style.cssText = `
        position: fixed;
        top: 10px;
        right: 14px;
        display: ${hudMode === 'bar' ? 'flex' : 'none'};
        align-items: center;
        gap: 12px;
        background: rgba(10, 12, 16, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 4px;
        padding: 4px 10px;
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        font-weight: 600;
        color: #ededed;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        user-select: none;
        pointer-events: auto;
        cursor: pointer;
    `;
    perfBar.title = 'Click to switch to detailed view (or Ctrl+Shift+S)';
    perfBar.innerHTML = `
        <span style="color:#38bdf8; font-weight:700;">KYBER</span>
        <span>FPS <span id="barFpsVal" style="color:#22c55e;">60</span></span>
        <span>RTT <span id="barPingVal" style="color:#eab308;">--ms</span></span>
        <span id="barGpuItem" style="display:none;">GPU <span id="barGpuVal" style="color:#ededed;">--%</span> <span id="barGpuTempVal" style="color:#888;"></span></span>
        <span id="barCpuItem" style="display:none;">CPU <span id="barCpuVal" style="color:#ededed;">--%</span></span>
    `;
    perfBar.addEventListener('click', () => {
        cycleHudMode();
    });
    document.body.appendChild(perfBar);

    // 2. Create Detailed HUD Container (#kyberPerfHud)
    const hudContainer = document.createElement('div');
    hudContainer.id = 'kyberPerfHud';
    hudContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 270px;
        background: rgba(10, 10, 12, 0.90);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        padding: 12px 14px;
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        color: #ededed;
        z-index: 2147483647;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
        user-select: none;
        display: ${hudMode === 'card' ? 'block' : 'none'};
        cursor: move;
    `;

    hudContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 6px; margin-bottom: 8px;">
            <div style="font-weight: 700; font-size: 11px; letter-spacing: 0.05em; color: #fff;">
                KYBER TELEMETRY
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <span style="font-size: 9px; color: #888;">Ctrl+Shift+S</span>
                <button id="btnPerfHudClose" style="background: none; border: none; color: #888; font-size: 14px; cursor: pointer; padding: 0 2px; line-height: 1;">&times;</button>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">RENDER FPS</span>
                <span id="hudFpsVal" style="font-weight: 600; color: #22c55e;">-- FPS</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">NETWORK RTT</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span id="hudPingDot" style="width: 6px; height: 6px; border-radius: 50%; background: #eab308; display: inline-block;"></span>
                    <span id="hudPingVal" style="font-weight: 600;">-- ms</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">STREAM PROFILE</span>
                <span id="hudProfileVal" style="font-weight: 500; color: #ddd;">--</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">TRANSPORT</span>
                <span style="font-weight: 500; color: #3b82f6;">QUIC WebTransport</span>
            </div>

            <div id="hudGpuRow" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 2px;">
                <span style="color: #888;">HOST GPU LOAD</span>
                <span id="hudGpuVal" style="font-weight: 600; color: #ededed;">--%</span>
            </div>

            <div id="hudGpuTempRow" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">GPU TEMP</span>
                <span id="hudGpuTempVal" style="font-weight: 500; color: #aaa;">-- °C</span>
            </div>

            <div id="hudVramRow" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">VRAM USAGE</span>
                <span id="hudVramVal" style="font-weight: 500; color: #aaa;">-- / --</span>
            </div>

            <div id="hudCpuRow" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">HOST CPU LOAD</span>
                <span id="hudCpuVal" style="font-weight: 500; color: #aaa;">--%</span>
            </div>

            <div id="hudRamRow" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">HOST RAM</span>
                <span id="hudRamVal" style="font-weight: 500; color: #aaa;">-- / --</span>
            </div>
        </div>
    `;

    document.body.appendChild(hudContainer);

    // Mini Toggle Badge in corner (discreet icon)
    const hudBadge = document.createElement('div');
    hudBadge.id = 'kyberPerfHudBadge';
    hudBadge.title = 'Cycle Performance HUD (Ctrl+Shift+S / F10)';
    hudBadge.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        background: rgba(10, 10, 12, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: 'Geist Mono', monospace;
        font-size: 10px;
        color: #aaa;
        z-index: 2147483646;
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(4px);
        transition: all 0.15s ease;
    `;
    hudBadge.textContent = 'HUD';
    hudBadge.addEventListener('mouseenter', () => { hudBadge.style.color = '#fff'; hudBadge.style.borderColor = 'rgba(255,255,255,0.4)'; });
    hudBadge.addEventListener('mouseleave', () => { hudBadge.style.color = '#aaa'; hudBadge.style.borderColor = 'rgba(255,255,255,0.15)'; });
    hudBadge.addEventListener('click', cycleHudMode);
    document.body.appendChild(hudBadge);

    // Draggable behavior for detailed card
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    hudContainer.addEventListener('mousedown', (e) => {
        if (e.target.id === 'btnPerfHudClose') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hudContainer.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        hudContainer.style.right = 'auto';
        hudContainer.style.left = initialLeft + 'px';
        hudContainer.style.top = initialTop + 'px';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        hudContainer.style.left = Math.max(10, Math.min(window.innerWidth - 280, initialLeft + dx)) + 'px';
        hudContainer.style.top = Math.max(10, Math.min(window.innerHeight - 200, initialTop + dy)) + 'px';
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('btnPerfHudClose').addEventListener('click', () => {
        setHudMode('off');
    });

    function setHudMode(mode) {
        hudMode = mode;
        if (hudMode === 'bar') {
            perfBar.style.display = 'flex';
            hudContainer.style.display = 'none';
            startPolling();
        } else if (hudMode === 'card') {
            perfBar.style.display = 'none';
            hudContainer.style.display = 'block';
            startPolling();
        } else {
            hudMode = 'off';
            perfBar.style.display = 'none';
            hudContainer.style.display = 'none';
            stopPolling();
        }
    }

    function cycleHudMode() {
        if (hudMode === 'off') {
            setHudMode('bar');
        } else if (hudMode === 'bar') {
            setHudMode('card');
        } else {
            setHudMode('off');
        }
    }

    // Keyboard shortcut handler
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')) {
            e.preventDefault();
            cycleHudMode();
        }
    });

    // Client Render FPS counter loop
    function updateFpsLoop(now) {
        frameCount++;
        const delta = now - lastFpsTime;
        if (delta >= 500) {
            currentFps = Math.round((frameCount * 1000) / delta);
            frameCount = 0;
            lastFpsTime = now;

            const fpsVal = document.getElementById('hudFpsVal');
            const barFps = document.getElementById('barFpsVal');
            const fpsColor = currentFps >= 55 ? '#22c55e' : (currentFps >= 30 ? '#eab308' : '#ef4444');
            if (fpsVal) {
                fpsVal.textContent = `${currentFps} FPS`;
                fpsVal.style.color = fpsColor;
            }
            if (barFps) {
                barFps.textContent = `${currentFps}`;
                barFps.style.color = fpsColor;
            }
        }
        requestAnimationFrame(updateFpsLoop);
    }
    requestAnimationFrame(updateFpsLoop);

    // Telemetry Polling (Host RTT & GPU via /api/telemetry)
    async function pollTelemetry() {
        const start = performance.now();
        const host = window.location.hostname || '127.0.0.1';
        const controlPort = 8081;

        try {
            const resp = await fetch(`https://${host}:${controlPort}/api/telemetry`, {
                cache: 'no-store',
                mode: 'cors'
            });
            const rtt = Math.round(performance.now() - start);
            pingLatency = rtt;

            if (resp.ok) {
                serverTelemetry = await resp.json();
            }
        } catch (e) {
            // Fallback ping
            try {
                await fetch(`https://${host}:${controlPort}/api/system`, { cache: 'no-store', mode: 'cors' });
                pingLatency = Math.round(performance.now() - start);
            } catch (err) {
                pingLatency = null;
            }
        }

        renderTelemetryUI();
    }

    function renderTelemetryUI() {
        const pingVal = document.getElementById('hudPingVal');
        const pingDot = document.getElementById('hudPingDot');
        const barPing = document.getElementById('barPingVal');
        const rttText = pingLatency !== null ? `${pingLatency}ms` : '--';
        const rttColor = (pingLatency !== null && pingLatency <= 25) ? '#22c55e' : ((pingLatency !== null && pingLatency <= 55) ? '#eab308' : '#ef4444');

        if (pingVal && pingDot) {
            pingVal.textContent = rttText;
            pingVal.style.color = rttColor;
            pingDot.style.background = rttColor;
        }
        if (barPing) {
            barPing.textContent = rttText;
            barPing.style.color = rttColor;
        }

        const profileVal = document.getElementById('hudProfileVal');
        if (profileVal) {
            const res = urlParams.get('res') || `${window.innerWidth}x${window.innerHeight}`;
            const fps = urlParams.get('fps') || '60';
            const codec = (urlParams.get('codec') || 'h264').toUpperCase();
            profileVal.textContent = `${res} @ ${fps}Hz (${codec})`;
        }

        if (serverTelemetry) {
            const gpu = serverTelemetry.gpu || {};
            const gpuVal = document.getElementById('hudGpuVal');
            const gpuTempVal = document.getElementById('hudGpuTempVal');
            const vramVal = document.getElementById('hudVramVal');
            const cpuVal = document.getElementById('hudCpuVal');
            const ramVal = document.getElementById('hudRamVal');

            const barGpuItem = document.getElementById('barGpuItem');
            const barGpuVal = document.getElementById('barGpuVal');
            const barGpuTempVal = document.getElementById('barGpuTempVal');
            const barCpuItem = document.getElementById('barCpuItem');
            const barCpuVal = document.getElementById('barCpuVal');

            if (gpu.gpu_load !== null && gpu.gpu_load !== undefined) {
                if (gpuVal) gpuVal.textContent = `${gpu.gpu_load}%`;
                if (barGpuVal) barGpuVal.textContent = `${gpu.gpu_load}%`;
                if (barGpuItem) barGpuItem.style.display = 'inline';
            }
            if (gpu.gpu_temp !== null && gpu.gpu_temp !== undefined) {
                if (gpuTempVal) gpuTempVal.textContent = `${gpu.gpu_temp} °C`;
                if (barGpuTempVal) barGpuTempVal.textContent = `(${gpu.gpu_temp}°C)`;
            }
            if (gpu.vram_used !== null && gpu.vram_total !== null) {
                if (vramVal) vramVal.textContent = `${gpu.vram_used} / ${gpu.vram_total} MB`;
            }

            if (serverTelemetry.cpu_load !== null && serverTelemetry.cpu_load !== undefined) {
                if (cpuVal) cpuVal.textContent = `${serverTelemetry.cpu_load}%`;
                if (barCpuVal) barCpuVal.textContent = `${serverTelemetry.cpu_load}%`;
                if (barCpuItem) barCpuItem.style.display = 'inline';
            }

            if (serverTelemetry.ram_used_mb && serverTelemetry.ram_total_mb) {
                if (ramVal) ramVal.textContent = `${serverTelemetry.ram_used_mb} / ${serverTelemetry.ram_total_mb} MB`;
            }
        }
    }

    function startPolling() {
        if (!pollInterval) {
            pollTelemetry();
            pollInterval = setInterval(pollTelemetry, 1500);
        }
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    if (hudMode !== 'off') {
        startPolling();
    }

    // Expose global controller API for Quick Menu and Hub
    window.KyberPerfHUD = {
        getMode: () => hudMode,
        setMode: (m) => setHudMode(m),
        cycleMode: () => cycleHudMode(),
        toggle: () => {
            if (hudMode === 'off') setHudMode('bar');
            else setHudMode('off');
        }
    };

    // Auto-connect assistance and native screen adaptation
    function initAutoConnectAndDisplay() {
        const u = urlParams.get('auth_user') || 'gamer';
        const p = urlParams.get('auth_pass') || 'kybergaming';
        const host = window.location.hostname || '127.0.0.1';
        const controlPort = 8081;

        // Ensure default server resolution matches requested or client native display
        const requestedRes = urlParams.get('res');
        let targetW, targetH;
        if (requestedRes && requestedRes.includes('x')) {
            const parts = requestedRes.split('x');
            targetW = parseInt(parts[0], 10);
            targetH = parseInt(parts[1], 10);
        } else {
            const dpr = window.devicePixelRatio || 1;
            targetW = Math.round(window.screen.width * dpr);
            targetH = Math.round(window.screen.height * dpr);
        }

        if (targetW && targetH) {
            targetW = Math.floor(targetW / 2) * 2;
            targetH = Math.floor(targetH / 2) * 2;
            console.log(`[kyber-hud] Adapting server display: ${targetW}x${targetH}`);
            fetch(`https://${host}:${controlPort}/api/resize?width=${targetW}&height=${targetH}&rate=60&auth_user=${u}&auth_pass=${p}`, {
                mode: 'cors',
                cache: 'no-store'
            }).catch(() => {});
        }

        if (urlParams.get('auto_connect') === 'true') {
            let attempts = 0;
            const tryAutoConnect = () => {
                attempts++;
                const hostInput = document.getElementById('host');
                const userInput = document.getElementById('auth-user');
                const passInput = document.getElementById('auth-pass');
                const connectBtn = document.getElementById('connect');

                if (userInput) userInput.value = u;
                if (passInput) passInput.value = p;

                if (hostInput && connectBtn && !connectBtn.disabled) {
                    console.log('[kyber-hud] Auto-connecting in-app streaming session...');
                    connectBtn.click();
                } else if (attempts < 50) {
                    setTimeout(tryAutoConnect, 100);
                }
            };

            setTimeout(tryAutoConnect, 150);
        }
    }

    if (document.readyState === 'complete') {
        initAutoConnectAndDisplay();
    } else {
        window.addEventListener('load', initAutoConnectAndDisplay);
    }
})();
