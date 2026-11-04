/**
 * Kyber In-Game Performance HUD (Stats for Nerds)
 * Real-time render FPS, round-trip latency, telemetry, and stream stats.
 * Shortcut: Ctrl+Shift+S or F10 to toggle.
 * Zero-emoji, Geist Mono styling.
 */

(function () {
    'use strict';

    let hudVisible = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFps = 60;
    let pingLatency = null;
    let serverTelemetry = null;
    let pollInterval = null;

    // Check URL parameters for default HUD state
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('hud') === '1' || urlParams.get('hud') === 'true') {
        hudVisible = true;
    }

    // 1. Create HUD Container
    const hudContainer = document.createElement('div');
    hudContainer.id = 'kyberPerfHud';
    hudContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 260px;
        background: rgba(10, 10, 12, 0.88);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 12px 14px;
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        color: #ededed;
        z-index: 2147483647;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
        user-select: none;
        display: ${hudVisible ? 'block' : 'none'};
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

            <div id="hudVramRow" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888;">VRAM USAGE</span>
                <span id="hudVramVal" style="font-weight: 500; color: #aaa;">-- / --</span>
            </div>
        </div>
    `;

    document.body.appendChild(hudContainer);

    // Mini Toggle Badge in corner (discreet icon)
    const hudBadge = document.createElement('div');
    hudBadge.id = 'kyberPerfHudBadge';
    hudBadge.title = 'Toggle Performance HUD (Ctrl+Shift+S / F10)';
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
    hudBadge.addEventListener('click', toggleHud);
    document.body.appendChild(hudBadge);

    // Draggable behavior
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
        hudContainer.style.left = Math.max(10, Math.min(window.innerWidth - 270, initialLeft + dx)) + 'px';
        hudContainer.style.top = Math.max(10, Math.min(window.innerHeight - 150, initialTop + dy)) + 'px';
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('btnPerfHudClose').addEventListener('click', () => {
        setHudVisible(false);
    });

    function setHudVisible(visible) {
        hudVisible = visible;
        hudContainer.style.display = hudVisible ? 'block' : 'none';
        if (hudVisible) {
            startPolling();
        } else {
            stopPolling();
        }
    }

    function toggleHud() {
        setHudVisible(!hudVisible);
    }

    // Keyboard shortcut handler
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') || e.key === 'F10') {
            e.preventDefault();
            toggleHud();
        }
    });

    // 2. Client Render FPS counter loop
    function updateFpsLoop(now) {
        frameCount++;
        const delta = now - lastFpsTime;
        if (delta >= 500) {
            currentFps = Math.round((frameCount * 1000) / delta);
            frameCount = 0;
            lastFpsTime = now;

            const fpsVal = document.getElementById('hudFpsVal');
            if (fpsVal) {
                fpsVal.textContent = `${currentFps} FPS`;
                if (currentFps >= 55) {
                    fpsVal.style.color = '#22c55e'; // Green
                } else if (currentFps >= 30) {
                    fpsVal.style.color = '#eab308'; // Amber
                } else {
                    fpsVal.style.color = '#ef4444'; // Red
                }
            }
        }
        requestAnimationFrame(updateFpsLoop);
    }
    requestAnimationFrame(updateFpsLoop);

    // 3. Telemetry Polling (Host RTT & GPU)
    async function pollTelemetry() {
        const start = performance.now();
        const host = window.location.hostname || '127.0.0.1';
        const controlPort = 8081;

        try {
            const resp = await fetch(`https://${host}:${controlPort}/api/system`, {
                cache: 'no-store',
                mode: 'cors'
            });
            const rtt = Math.round(performance.now() - start);
            pingLatency = rtt;

            if (resp.ok) {
                serverTelemetry = await resp.json();
            }
        } catch (e) {
            // Fallback ping to current port
            try {
                await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
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
        if (pingVal && pingDot) {
            if (pingLatency !== null) {
                pingVal.textContent = `${pingLatency} ms`;
                if (pingLatency <= 25) {
                    pingDot.style.background = '#22c55e';
                    pingVal.style.color = '#22c55e';
                } else if (pingLatency <= 55) {
                    pingDot.style.background = '#eab308';
                    pingVal.style.color = '#eab308';
                } else {
                    pingDot.style.background = '#ef4444';
                    pingVal.style.color = '#ef4444';
                }
            } else {
                pingVal.textContent = 'Disconnected';
                pingDot.style.background = '#ef4444';
                pingVal.style.color = '#888';
            }
        }

        const profileVal = document.getElementById('hudProfileVal');
        if (profileVal) {
            const res = urlParams.get('res') || `${window.innerWidth}x${window.innerHeight}`;
            const fps = urlParams.get('fps') || '60';
            const codec = (urlParams.get('codec') || 'h264').toUpperCase();
            profileVal.textContent = `${res} @ ${fps}Hz (${codec})`;
        }

        const gpuVal = document.getElementById('hudGpuVal');
        const vramVal = document.getElementById('hudVramVal');
        if (serverTelemetry && serverTelemetry.gpu) {
            if (gpuVal) gpuVal.textContent = `${serverTelemetry.gpu.utilization_gpu_percent || 0}%`;
            if (vramVal) vramVal.textContent = `${serverTelemetry.gpu.memory_used_mb || 0} / ${serverTelemetry.gpu.memory_total_mb || 0} MB`;
        }
    }

    function startPolling() {
        if (!pollInterval) {
            pollTelemetry();
            pollInterval = setInterval(pollTelemetry, 2000);
        }
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    if (hudVisible) {
        startPolling();
    }

    // Auto-connect assistance and native screen adaptation
    window.addEventListener('DOMContentLoaded', () => {
        // Ensure default server resolution matches client native display
        if (!urlParams.get('res')) {
            const dpr = window.devicePixelRatio || 1;
            let w = Math.round(window.screen.width * dpr);
            let h = Math.round(window.screen.height * dpr);
            w = Math.floor(w / 2) * 2;
            h = Math.floor(h / 2) * 2;
            const host = window.location.hostname || '127.0.0.1';
            const controlPort = 8081;
            const u = urlParams.get('auth_user') || 'gamer';
            const p = urlParams.get('auth_pass') || 'kybergaming';
            console.log(`[kyber-hud] Adapting server display to client native screen: ${w}x${h}`);
            fetch(`https://${host}:${controlPort}/api/resize?width=${w}&height=${h}&rate=60&auth_user=${u}&auth_pass=${p}`, {
                mode: 'cors',
                cache: 'no-store'
            }).catch(() => {});
        }

        if (urlParams.get('auto_connect') === 'true') {
            const connectBtn = document.getElementById('connect');
            const authUser = urlParams.get('auth_user');
            const authPass = urlParams.get('auth_pass');

            // Pre-fill inputs if available
            const userInput = document.getElementById('auth-user');
            const passInput = document.getElementById('auth-pass');
            if (userInput && authUser) userInput.value = authUser;
            if (passInput && authPass) passInput.value = authPass;

            // Trigger connection after short initialization delay
            setTimeout(() => {
                if (connectBtn && !connectBtn.disabled) {
                    console.log('[kyber-hud] Auto-connecting in-app streaming session...');
                    connectBtn.click();
                }
            }, 600);
        }
    });
})();
