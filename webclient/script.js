// Project Kyber: script.js
// Copyright © 2022-2026 Kyber SAS
// SPDX-License-Identifier: LicenseRef-Kyber-Commercial OR AGPL-3.0-or-later
//
// This file is both under dual license: AGPLv3 and a Commercial one.
//
// ----
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import init, { AudioResumeState, AuthCredentials, Client, GamepadBlocklistEntry, StreamingConfig, StreamingConfigBuilder, supportedVideoCodecs } from './kyclient_wasm.js';
import { metricsManager } from './live_graph.js';

export { AudioResumeState };

const initPromise = init();
let client = null;
let streamingConfig = null;
// Incremented before calling stale.disconnect_and_stop() in cancelAndDisconnect so
// defaultClientListener ignores the resulting stopped event from the old client.
// A counter (not a boolean) handles rapid double-clicks that queue two stale stops.
let cancelInProgress = 0;

function getParam(urlParams, name, defaultValue) {
    let value = urlParams.get(name);
    if (value != null) {
        if (value === "true")
            return true;
        else if (value === "false")
            return false;
        else
            return value;
    } else {
        return defaultValue;
    }
}

export function toggleFullscreen() {
    let container = document.getElementById("container");

    container.requestFullscreen().then(() => {
        if (navigator.keyboard === undefined) {
            console.warn("navigator.keyboard not defined");
            return;
        }

        const keys = [
            'Escape',
        ];

        navigator.keyboard.lock(keys).then(() => {
            console.log("Keyboard locked !");
        }).catch(() => {
            console.log("Keyboard lock failed !");
        });
    });
}

async function logSupportedVideoCodecs() {
    let codecs = await supportedVideoCodecs();

    console.log("Supported video codecs");
    for (let codec of codecs) {
        console.log(`Codec: ${codec.codec} - yuv444: ${codec.yuv444} - Acceleration: '${codec.hardware_acceleration}'`);
    }
}

function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    let ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);

    return {
        width: srcWidth * ratio,
        height: srcHeight * ratio
    };
}

function resizeCanvas(container, canvasWidth, canvasHeight) {
    const canvas = document.getElementById('canvas');
    if (!canvas || !container) return;

    let size = calculateAspectRatioFit(
        canvasWidth,
        canvasHeight,
        container.clientWidth,
        container.clientHeight);

    canvas.style.height = `${size.height}px`;
    canvas.style.width = `${size.width}px`;
}

function canvasOnWindowResized() {
    let container = document.getElementById("container");

    let canvas = document.getElementById('canvas');
    if (canvas === null)
        return;

    resizeCanvas(container, canvas.width, canvas.height);
}

function createCanvas() {
    let container = document.getElementById("container");

    let canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.width = 800;
    canvas.height = 600;

    container.appendChild(canvas);

    resizeCanvas(container, canvas.width, canvas.height);
}

function deleteCanvas() {
    let canvas = document.getElementById("canvas");
    if (canvas === null)
        return;

    canvas.remove();
}

async function defaultClientListener(name, event) {
    switch (name) {
        case "controlplane_connect_failed":
            console.warn(`Control plane connect failed: ${event}`);
            break;
        case "controlplane_connected":
            console.log("Connected to streamer. Start streaming session");
            try {
                await client.start_streaming("canvas", streamingConfig.clone());
            } catch (err) {
                alert(err);

                await client.stop();
                client = null;
                deleteCanvas();
            }
            break;
        case "reconnecting":
            console.log(`Reconnecting (attempt ${event.attempt}/${event.maxAttempts})`);
            break;
        case "reconnected":
            console.log("Reconnected successfully");

            if (event.shouldRestartStreaming) {
                console.log("Restarting streaming after reconnection");
                // Recreate canvas and restart streaming manually
                // The old canvas had its control transferred to offscreen and cannot be reused
                deleteCanvas();
                createCanvas();
                metricsManager.init();
                // Restart streaming manually with the new canvas
                try {
                    await client.start_streaming("canvas", streamingConfig.clone());
                } catch (err) {
                    console.error("Failed to restart streaming after reconnection:", err);
                }
            }
            break;
        case "reconnection_failed":
            console.log("Reconnection failed after all attempts");

            if (client != null) {
                let stoppingClient = client;
                client = null;
                await stoppingClient.stop();
                client = null;
            }

            deleteCanvas();
            break;
        case "canvas_resized":
            let container = document.getElementById("container");

            let canvas = document.getElementById('canvas');
            if (canvas !== null)
                resizeCanvas(container, event.width, event.height);
            break;
        case "streaming_stopped":
            deleteCanvas();
            createCanvas();

            await client.start_streaming("canvas", streamingConfig.clone());
            break;
        case "stopped":
            const reason = event.reason();
            // Stopped is terminal: the SDK reconnects internally and only emits
            // it once reconnection is disabled/exhausted (or for requested/decode_error).
            const isError = reason === "decode_error"
                || reason === "controlplane_io_error"
                || reason === "controlplane_timeout";
            (isError ? console.warn : console.log)(`Client stopped - exiting. Reason: ${reason}`);

            if (cancelInProgress > 0) {
                // This stopped event comes from a client cancelled by
                // cancelAndDisconnect(). The new connection is already
                // starting; skip all cleanup here.
                cancelInProgress--;
                break;
            }

            if (client != null) {
                let stoppingClient = client;
                client = null;
                await stoppingClient.stop();
                client = null;
            }

            deleteCanvas();
            break;
        case "streamer_pipeline_event":
            console.log(`Got StreamerPipelineEvent: Type: ${event.type} - Stage: ${event.stage} - Event: ${event.event}`)
            break;
        case "image_decoded":
            const image_time = event.pts;
            break;
        case "gamepad_plugged":
            console.log(`Gamepad (index ${event.index}) plugged: ${event.name}`)
            break;
        case "gamepad_unplugged":
            console.log(`Gamepad (index ${event.index}) unplugged: ${event.name}`)
            break;
        case "display_list_updated":
            console.log(`Display list updated: ${JSON.stringify(event.displays)}`);
            break;
    }
}

export const StreamingConfigParameters = {
    protocol : {
        name: "Protocol",
        type: String,
        description: "The protocol to use.",
        default: "kymux",
        allowed: ["kymux", "websocket"]},
    kymux_video : {
        name: "Video strategy",
        type: String,
        description: "video protocol strategy.",
        default: "reliable",
        allowed: ["reliable", "gopstream", "unreliable", "unreliable_fec"]},
    kymux_audio : {
        name: "Audio strategy",
        type: String,
        description: "audio protocol strategy.",
        default: "reliable",
        allowed: ["reliable", "unreliable", "unreliable_fec"]},
    bitrate : {
        name: "Connection bitrate",
        type: Number,
        description: "connection bitrate, in bits/second.",
        default: "20000000"},
    codec : {
        name: "Video codec",
        type: String,
        description: "Video codec to use.",
        default: "h264",
        allowed: ["h264", "hevc"]},
    display_index : {
        name: "Display",
        type: Number,
        description: "The index of the display to grab.",
        default: 0},
    yuv444 : {
        name: "Enable 4:4:4",
        type: Boolean,
        description: "Enable 4:4:4 chroma.",
        default: false},
    software_decode : {
        name: "Force software decoding",
        type: Boolean,
        description: "Force software decoding.",
        default: false},
    audio : {
        name: "Enable audio",
        type: Boolean,
        description: "Enable audio.",
        default: true},
    audio_buffer : {
        name: "Audio buffering",
        type: Number,
        description: "Audio buffering, in milliseconds.",
        default: null},
    video_buffer : {
        name: "Video buffering",
        type: Number,
        description: "Video buffering, in milliseconds.",
        default: 0},
    inputs : {
        name: "Enable inputs",
        type: Boolean,
        description: "Enable inputs forwarding (keyboard, mouse, gamepad, etc.)",
        default: true},
    intra_refresh : {
        name: "Enable intra refresh",
        type: Boolean,
        description: "Enable video codec intra refresh.",
        default: true},
    gamepad_force_xbox360: {
        name: "Force XBox360 gamepad",
        type: Boolean,
        description: "Force xbox360 gamepad management.",
        default: true},
    clipboard: {
        name: "Enable clipboard",
        type: Boolean,
        description: "Enable Clipboard support.",
        default: true},
    metrics_checkbox:{
        name: "Enable metrics",
        type: Boolean,
        description: "Enable metrics collection.",
        default: false},
    metrics_mode:{
        name: "Metrics mode",
        type: String,
        description: "Select metrics output mode.",
        default: "both",
        allowed: ["live", "json", "both"]},
}

export function getHostAndPortFromURLParams() {
    // Parse host and port from the domain that served this page, handling
    // IPv6 addresses in brackets. These defaults can be overridden by query
    // parameters.
    // e.g. "[::1]:8080" => ["[::1]", "8080"], "example.com:443" => ["example.com", "443"]
    const hostPortStr = window.location.host;
    const hostMatches = hostPortStr.match(/(\[[^\]]+\])|([^:]+)/);
    let defaultHost = hostMatches[1] || hostMatches[2];

    const portMatches = hostPortStr.match(/\:(\d+)$/);
    let defaultPort = portMatches ? portMatches[1] : '443';

    // Override by query parameters
    const urlParams = new URLSearchParams(window.location.search);
    let host = getParam(urlParams, "host", defaultHost);
    let port = getParam(urlParams, "port", defaultPort);

    // Strip IPv6 brackets (e.g. "[::1]" => "::1")
    return [host.replace(/^\[|\]$/g, ''), port];
}

export function getMetricsParams() {
    const checkbox = document.getElementById("metrics_checkbox");
    const isChecked = checkbox?.checked ?? false;
    let selectedMode = "none";

    if (isChecked){
        const modeSelect = document.getElementById("metrics_mode");
        selectedMode = modeSelect?.value ?? "both";
    }
    return {enabled: isChecked, mode: selectedMode };
}

export function getAutoReconnectParam() {
    const checkbox = document.getElementById("auto_reconnect");
    return checkbox ? checkbox.checked : true;
}

// Update the global module streaming configuration.
// any property from the `config` argument that is not known
// or does not have the proper type will be ignored.
export async function updateStreamingConfig(config) {
    await initPromise;

    let streamingConfigBuilder = new StreamingConfigBuilder();
    
    // Example: Configure gamepad blocklist to block specific gamepads
    //
    // Microsoft vendor id: 0x045e
    // Sony vendor id: 0x054c
    // 
    // Uncomment the following lines to block specific gamepads:
    // const gamepadBlocklist = [
    //     new GamepadBlocklistEntry(0x054c, 0x09cc),  // Sony Interactive Entertainment Wireless Controller
    //     GamepadBlocklistEntry.vendor_only(0x045e),  // All devices from Microsoft Corp.
    // ];
    // streamingConfigBuilder.set_gamepad_blocklist(gamepadBlocklist);


    for (const name in config) {
        let value = config[name];
        let definition = StreamingConfigParameters[name];
        if (typeof definition === 'undefined') {
            console.log(`${name} config parameter unkwown, ignoring`);
            continue
        }
        if (typeof definition.type() !== typeof value) {
            console.log(`${name} config parameter value type (${typeof value}) mismatch, ignoring`);
            continue
        }
        if (typeof definition.allowed !== 'undefined' &&
            !definition.allowed.includes(value)) {
            console.log(`${name} config parameter value (${value}) not in allowed values, ignoring`);
            continue
        }

        // Ignore empty "Number" text fields
        if (typeof definition.type() == "number" && isNaN(value))
            continue;

        Reflect.set(streamingConfigBuilder, name, value);
    }

    streamingConfig = streamingConfigBuilder.build();
}

// extract streaming config parameters from URL params
export function getConfigFromURLParams() {
    let config = {}

    const urlParams = new URLSearchParams(window.location.search);
    for (let [name, value] of urlParams) {
        if (name === "host" || name === "port" || name === "metrics") {
            continue
        }
        if (name === "video_codec") {
            // Exception: codec parameter is called "video_codec" in URL
            // parameters
            name = "codec";
        }
        let definition = StreamingConfigParameters[name];
        if (typeof definition === "undefined") {
            console.log(`${name} URL parameter unkwown, ignoring`)
            continue
        }
        switch (definition.type) {
            case String:
                if (typeof definition.allowed !== "undefined" &&
                    !definition.allowed.includes(value)) {
                    console.log(`${name} URL parameter value not in allowed values, ignoring`);
                    break
                }
                config[name] = value
                break
            case Number:
                config[name] = parseInt(value)
                break
            case Boolean:
                if (value !== "true" && value !== "false") {
                    console.log(`${name} URL parameter not a boolean, ignoring`);
                    break
                }
                config[name] = (value === "true");
                break
        }
    }
    return config;
}

export async function doConnect(optionalClientListener = null, host = null, port = null, authCredentials) {
    if (client !== null) {
        return;
    }

    // supportedVideoCodecs() and the rest of the connect touch the wasm module.
    // In the handoff flow doConnect runs at page load, before init has resolved,
    // so wait for it here; otherwise the codec probe reads an undefined module.
    await initPromise;

    logSupportedVideoCodecs();
    createCanvas();

    let [defaultHost, defaultPort] = getHostAndPortFromURLParams();
    if (host === null) {
        host = defaultHost;
    }
    if (port === null) {
        port = defaultPort;
    }
    if (streamingConfig === null) {
        await updateStreamingConfig(getConfigFromURLParams());
    }

    let credentials;
    switch (authCredentials.type) {
        case "jwt":
            credentials = AuthCredentials.jwt(authCredentials.token);
            break;
        case "oidc":
            credentials = AuthCredentials.oidc(authCredentials.token);
            break;
        default:
            credentials = AuthCredentials.basic(authCredentials.username, authCredentials.password);
            break;
    }

    let listener = defaultClientListener;
    if (optionalClientListener !== null) {
      listener = async function(type, name) {
        await defaultClientListener(type, name);
        await optionalClientListener(type, name);
      }
    }

    let metrics = getMetricsParams();
    let autoReconnect = getAutoReconnectParam();

    let metricsCallback;
    if (metrics.enabled && (metrics.mode === "live" || metrics.mode === "both")) {
        metricsManager.init();
        metricsCallback = (obj) => {
            try {
                metricsManager.processFrameMetric(obj);
            } catch (error) {
                console.error('Failed to process metrics event:', error);
                console.error('Metrics event:', obj);
            }
        };
    }

    client = await Client.new(
        host,
        port,
        credentials,
        listener,
        metrics.enabled,
        metrics.mode,
        metricsCallback,
        autoReconnect,
    );

    client.connect();
    return client;
}

export async function doDisconnect() {
    client?.disconnect();
}

// Updates credentials on the existing client and returns it, or null if no
// client is active. Used by the authentication_required handler to hand new
// OIDC tokens to a client that is already reconnecting with a stale/empty token.
export function updateCredentials(authCredentials) {
    if (client === null) return null;

    let credentials;
    switch (authCredentials.type) {
        case "jwt":
            credentials = AuthCredentials.jwt(authCredentials.token);
            break;
        case "oidc":
            credentials = AuthCredentials.oidc(authCredentials.token);
            break;
        default:
            credentials = AuthCredentials.basic(authCredentials.username, authCredentials.password);
            break;
    }

    client.update_credentials(credentials);
    // After authentication_required the client pauses and waits for new
    // credentials. connect() triggers the next attempt with the fresh token.
    try {
        client.connect();
    } catch (err) {
        console.warn("connect() after credential update failed:", err);
    }
    return client;
}

export function isClientActive() {
    return client !== null;
}

export function getWasmClient() {
    return client;
}

export function cancelAndDisconnect() {
    if (client !== null) {
        const stale = client;
        client = null;
        cancelInProgress++;
        stale.disconnect_and_stop(false).catch(err => console.error("Failed to stop stale client:", err));
    }
    deleteCanvas();
}

export async function doRestartStreaming() {
    client?.stop_streaming();
}

export function sendCtrlAltDel() {
    client?.send_ctrl_alt_del();
}

// Tries to resume the AudioContext if it was left suspended after the page
// loaded (typical after the OIDC redirect roundtrip). With no active client
// there is nothing to resume, so we report Running.
export async function tryResumeAudio() {
    return await (client?.audio_try_resume() ?? Promise.resolve(AudioResumeState.Running));
}

export async function audioResume() {
    await client?.audio_resume();
}

export async function flushLogs() {
    await client?.flush_logs();
}

window.addEventListener('resize', canvasOnWindowResized);
