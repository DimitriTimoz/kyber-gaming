// Project Kyber: ui.js
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

import * as script from "./script.js";
import { METRIC_KEYS } from './metrics_structure.js';
import { metricsManager } from './live_graph.js';
import { detectHandoff, startHandoff } from "./handoff.js";

// OidcManager and @openid/appauth are loaded on demand so non-OIDC users pay
// no bundle cost. oidc is null until the first OIDC operation.
let oidc = null;
// Ends the handoff renewal; set while a portal handoff drives the connection.
let stopHandoff = null;
// Read and strip the #kyber= fragment now, before the load handler, so the
// token leaves the address bar while the page is still loading.
const handoff = detectHandoff();
async function ensureOidc() {
    if (!oidc) {
        const { OidcManager } = await import("./oidc/manager.js");
        oidc = new OidcManager({
            updateStatus,
            updateConfig,
            getConfigValue: (key) =>
                key === "oidc_popup"
                    ? (getConfigValue(key) ?? oidcPopupDefault)
                    : getConfigValue(key),
        });
    }
    return oidc;
}

/*
 * Sidebar show/hide management
 */

// The idea is the:
// - inhibit the propagation of the "click" event out of the sidebar, so that a
//   click inside the sidebar does not reach the other parts of the DOM
// - register a click listener on the root document only when the sidebar is
//   visible.
// - this way, whenever the sidebar is visible, any non-sidebar click event will
//   hide the sidebar
document.getElementById("sidebar").addEventListener("click", function(event){
  event.stopPropagation();
});
function hideSidebar() {
  document.getElementById("sidebar").classList.add("nosidebar");
  enableSidebarEventsPropagation();
  document.removeEventListener("click", hideSidebar);
}
function showSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.remove("nosidebar");
  disableSidebarEventsPropagation();

  //pin the sidebar
  const pinCheckbox = document.getElementById("pin_sidebar_checkbox");

  if (pinCheckbox) {
    const savedState = localStorage.getItem("sidebarPinned");
    if (savedState === "true") {
      pinCheckbox.checked = true;
      sidebar.classList.add("pinned");
      document.removeEventListener("click", hideSidebar);
    } else {
      pinCheckbox.checked = false;
      sidebar.classList.remove("pinned");
      document.addEventListener("click", hideSidebar);
    }
  }

}

function isSidebarVisible() {
  return !document.getElementById("sidebar").classList.contains("nosidebar");
}

function toggleSidebar() {
  if (isSidebarVisible()) {
    hideSidebar()
  } else {
    showSidebar()
  }
}

/**
 * Initialises HUD mode: when the #hud-mode-toggle checkbox is checked,
 * the graph overlay is detached from the sidebar and appended to document.body
 * as a floating, movable element. Unchecking restores it to its original position.
 */
function initHudMode() {
  const hudCheckbox = document.getElementById('hud-mode-toggle');
  const movableWrapper = document.getElementById('graph-overlay-wrapper');
  const pillsContainer = document.getElementById('metrics-toggles');
  if (!hudCheckbox || !movableWrapper || !pillsContainer) return;

  function updateHud(visible) {
    if (visible) {
      //only the graph
      document.body.appendChild(movableWrapper);
      movableWrapper.classList.add('hud-active');
      hideSidebar();
      document.activeElement.blur();
    } else {
      movableWrapper.classList.remove('hud-active');
      pillsContainer.insertAdjacentElement('afterend', movableWrapper);
    }
  }

  hudCheckbox.addEventListener('change', (e) => {
    updateHud(e.target.checked);
  });
  updateHud(hudCheckbox.checked);
}

// Creates a human friendly representation of a keyboard event
// Only takes into account: Alt, Ctrl, Meta, Shift, and Key.
function humanizeKeyboardEvent(event) {
  let human = "";
  human += event.altKey ? "Alt+" : "";
  human += event.ctrlKey ? "Ctrl+" : "";
  human += event.metaKey ? "Meta+" : "";
  human += event.shiftKey ? "Shift+" : "";
  human += (typeof event.key === "undefined") ? "" : event.key.toLowerCase();
  return human;
}

// Global overlay configuration
const overlayConfiguration = {
  toggleShortcut: "Alt+Ctrl+m"
}
// Default popup-vs-redirect choice for OIDC, before any UI control exists.
// configureOverlayFromURLParams updates it from the oidc_popup URL param.
let oidcPopupDefault = true;
// Capture mode: in capture mode, do not toggle the sidebar and set the toggle
// shortcut
let captureMode = false;

// If some URL parameters are set for the overlay, use them
function configureOverlayFromURLParams() {
  let urlParams = new URLSearchParams(window.location.search);
  for (let [name, value] of urlParams) {
    switch (name) {
      case "overlay_toggle_shortcut":
        overlayConfiguration.toggleShortcut = value;
        break;
      case "auth_method":
        if (value === "jwt" || value === "basic" || value === "oidc") {
          document.getElementById("auth-method").value = value;
          updateAuthFieldsVisibility();
        }
        break;
      case "oidc_popup":
        if (value === "true" || value === "false") {
          oidcPopupDefault = (value === "true");
          const cb = document.getElementById("oidc_popup");
          if (cb) cb.checked = oidcPopupDefault;
        }
        break;
    }
  }
}

// Set toggle shortcut and reset capture button
function setToggleShortcut(shortcut, setInURL) {
  if (shortcut == "") { return; }
  console.log("Setting overlay toggle shortcut to: ", shortcut);
  overlayConfiguration.toggleShortcut = shortcut;
  document.getElementById("overlay_toggle_shortcut").value = shortcut;
  document.getElementById("capture_shortcut").disabled = false;
  captureMode = false;
  // add or set parameter in URL
  if (setInURL) {
    let queryParams = new URLSearchParams(window.location.search);
    queryParams.set("overlay_toggle_shortcut", shortcut);
    window.history.replaceState(null, null, "?"+queryParams.toString());
  }
}

setToggleShortcut(overlayConfiguration.toggleShortcut, false);

// Setup capture button to trigger capture mode
document.getElementById("capture_shortcut").addEventListener("click", function (event) {
  captureMode = true;
  event.target.disabled = true;
  document.getElementById("overlay_toggle_shortcut").value = "";
});

// Returns true if event is Ctrl + Alt + m
function isEventToggleShortcut(event) {
  return humanizeKeyboardEvent(event) == overlayConfiguration.toggleShortcut;
}

// Sidebar toggle keyboard shortcut
// Capture mode will bypass the toggle action
document.addEventListener('keyup', function (event) {
  if (captureMode) {
    setToggleShortcut(humanizeKeyboardEvent(event), true);
  } else if (isEventToggleShortcut(event)) {
    toggleSidebar();
  }
})


/*
 * Inner sidebar management
 */

// Section folding management

Array.from(document.getElementsByClassName("nav-section-header")).forEach(function(element) {
  element.addEventListener('click', function() {
    element.classList.toggle("unfold");
  });
})

// Client status update

function updateStatus(text) {
  document.getElementById("sidebar-client-status").textContent = text;
}

// Polls audio_try_resume until either the AudioContext is running or the
// browser refuses to resume (no user gesture). The AudioWorklet is created
// when the first audio packet decodes, which can lag the streaming-started
// event by several seconds, so we keep polling until streaming is shut
// down again. Shows the click-to-unmute overlay as soon as the resume is
// refused; if the context never appears (audio disabled), the overlay
// stays hidden.
async function probeAudioAndMaybeShowOverlay() {
  while (script.isClientActive()) {
    const result = await script.tryResumeAudio();
    if (result === script.AudioResumeState.Running) return;
    if (result === script.AudioResumeState.Suspended) {
      showClickToStart(() => script.audioResume());
      return;
    }
    await new Promise((r) => setTimeout(r, 200));  // Absent, retry
  }
}

// Shows an overlay that blocks until the user clicks, then calls asyncFn.
// The click provides a user gesture so the suspended AudioContext inside
// the Wasm player can resume when asyncFn calls audio_resume().
function showClickToStart(asyncFn) {
  const notice = document.getElementById("audio-notice");
  notice.toggleAttribute("hidden", false);

  const go = () => {
    notice.toggleAttribute("hidden", true);
    document.removeEventListener("click", go);
    document.removeEventListener("keydown", go);
    asyncFn().catch((err) => {
      console.error("Unmute failed:", err);
      updateStatus("Audio resume error: " + err.message);
    });
  };
  document.addEventListener("click", go);
  document.addEventListener("keydown", go);
}

async function uiClientListener(name, event) {
  switch (name) {
    case "controlplane_connect_failed": {
      const reasons = {
        network_error: "Network error",
        timeout: "Timeout",
        unauthorized: "Unauthorized",
        server_error: "Server error",
        tls_verification: "TLS verification failed",
        tls_configuration: "TLS configuration error",
        websocket: "WebSocket error",
        protocol: "Protocol error",
      };
      const message = reasons[event] ?? "Connection failed";
      updateStatus(message)
      break;
    }
    case "controlplane_connected":
      updateStatus("Connected")
      break;
    case "reconnecting":
      updateStatus(`Reconnecting (${event.attempt}/${event.maxAttempts})`)
      break;
    case "reconnected":
      updateStatus("Reconnected")
      break;
    case "authentication_required":
      await oidc?.onAuthenticationRequired(event, uiClientListener);
      break;
    case "reconnection_failed":
      updateStatus("Reconnection failed")
      oidc?.onReconnectionFailed();
      break;
    case "streaming_started":
      updateStatus("Streaming")
      break;
    case "streaming_stopped":
      updateStatus("Streaming stopped")
      break;
    case "streaming_start_failed":
      updateStatus("Streaming failed")
      oidc?.onStreamingStartFailed();
      break;
    case "stopped":
      updateStatus(`Stopped (${event.reason()})`);
      stopHandoff?.();
      oidc?.onClientStopped(event.reason());
      break;
  }
}

// Buttons management

function onClickId(elementId, fn) {
  document.getElementById(elementId).addEventListener('click', fn);
}
// Hide sidebar button
onClickId("hide_sidebar_btn", hideSidebar);
onClickId("connect", async function() {
  await updateConfig();
  const authType = getConfigValue("auth-method");
  const host = getConfigValue("host");
  const port = getConfigValue("port");

  // Reset OIDC state from any previous connection, and cancel the live client
  // if one is running. When oidc is null, OIDC was never used this session so
  // there is no OIDC state to reset; cancel the client directly instead.
  stopHandoff?.();
  if (oidc) {
    oidc.cancelInFlight();
  } else if (script.isClientActive()) {
    script.cancelAndDisconnect();
  }

  if (authType === "oidc") {
    // Load the OIDC module now, while the user gesture is still active, so
    // prepareOidcConnect can open the popup synchronously.
    const o = await ensureOidc();
    if (!o.prepareOidcConnect()) return;
  }

  let credentials;
  if (authType === "oidc") {
    // Empty-token probe: the controller fires authentication_required with
    // the IdP challenge so the manager can start the OIDC flow.
    credentials = { type: "oidc", token: "" };
  } else if (authType === "jwt") {
    credentials = { type: "jwt", token: getConfigValue("auth-token") };
  } else {
    credentials = { type: "basic", username: getConfigValue("auth-user"), password: getConfigValue("auth-pass") };
  }

  try {
    await script.doConnect(uiClientListener, host, port, credentials);
  } catch (err) {
    oidc?.onConnectFailed();
    console.error("Connect failed:", err);
    updateStatus("Connection error: " + err.message);
  }
});
// link the other buttons
onClickId("disconnect", async function() {
  stopHandoff?.();
  oidc?.onDisconnect();
  await script.doDisconnect();
});
onClickId("restart_streaming", async function () {
  await updateConfig();
  await script.doRestartStreaming();
});
onClickId("fullscreen", script.toggleFullscreen);
onClickId("send_ctrl_alt_del", script.sendCtrlAltDel);
onClickId("download_logs", async function() {
    try {
        await script.flushLogs();

        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle("metrics.json");
        const file = await fileHandle.getFile();

        const url = URL.createObjectURL(file);

        const a = document.createElement("a");
        a.href = url;
        a.download = "metrics.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Error downloading metrics.json:", err);
    }
});

// Connection parameter generation

// Snapshot of streaming-config values from the URL. Refreshed after an OIDC
// redirect callback because handleRedirectCallback restores the original
// query string only after this module has finished loading.
let defaultConfig = script.getConfigFromURLParams();

function genConfigInput(param, definition = null) {
  if (definition == null) {
    definition = script.StreamingConfigParameters[param];
  }
  let rootElement = document.createElement("div");
  rootElement.title = definition.description;
  rootElement.classList.add("input-row");
  let label = document.createElement("label");
  label.setAttribute("for", param);
  label.innerHTML = definition.name;
  rootElement.appendChild(label);
  let input = null;
  let defaultValue = defaultConfig[param];
  if (typeof defaultValue === "undefined") {
    defaultValue = definition.default;
  }
  switch (definition.type) {
    case String:
      if (typeof definition.allowed === "undefined") {
        input = document.createElement("input");
        input.type = "text";
        input.value = defaultValue;
      } else {
        input = document.createElement("select");
        for (const allowed of definition.allowed) {
          let opt = document.createElement('option');
          opt.value = allowed;
          opt.innerHTML = allowed;
          if (allowed == defaultValue) {
            opt.selected = true;
          }
          input.appendChild(opt);
        }
      }
      break;
    case Boolean:
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = defaultValue;
      break;
    case Number:
      input = document.createElement("input");
      input.type = "number";
      input.value = defaultValue;
      break;
  }
  input.id = param;
  rootElement.appendChild(input);
  document.getElementById("connection-parameters").appendChild(rootElement);
}

function updateAuthFieldsVisibility() {
  const authType = getConfigValue("auth-method");
  document.getElementById("auth-basic-fields").style.display =
      authType === "basic" ? "block" : "none";
  document.getElementById("auth-jwt-fields").style.display =
      authType === "jwt" ? "block" : "none";
  document.getElementById("auth-oidc-fields").style.display =
      authType === "oidc" ? "block" : "none";
}

// Configuration management

// get value from sidebar form
function getConfigValue(param) {
  let input = document.getElementById(param);
  if (input === null) {
    return null;
  }
  switch (input.tagName) {
    case "SELECT":
        return input.value;
    case "INPUT":
      switch (input.type) {
        case "text":
        case "password":
          return input.value;
        case "checkbox":
          return input.checked;
        case "number":
          return parseInt(input.value);
      }
  }
}

async function updateConfig() {
  let config = {}
  for (const name in script.StreamingConfigParameters) {
    let valueFromSidebar = getConfigValue(name);
    let defaultValue = defaultConfig[name];
    if (valueFromSidebar !== null) {
      config[name] = getConfigValue(name);
    } else if (typeof defaultValue !== "undefined") {
      config[name] = defaultValue;
    }
  }
  console.log("Updating streaming config:", config)
  await script.updateStreamingConfig(config);
}

/**
 * Creates a toggle pill button for each metric key in METRIC_KEYS and appends
 * them to the #metrics-toggles container. Each pill calls
 * metricsManager.toggleSeries() when clicked.
 */
export function initMetricToggles() {
  const root = document.getElementById("metrics-toggles");
  if (!root) return;

  root.innerHTML = "";

  for (const k of METRIC_KEYS) {
    const pill = document.createElement("button");
    pill.classList.add("metric-pill", k);
    pill.textContent = k;
    pill.dataset.key = k;
    pill.dataset.active = "true";

    pill.addEventListener("click", () => {
      const active = pill.dataset.active === "true";
      pill.dataset.active = String(!active);
      metricsManager.toggleSeries(k, !active);
    });

    root.appendChild(pill);
  }
}


/*
* Kyber and Sidebar Events management
*/

// When Kyber's canvas is active, it prevents several mouse and key events
// to interact with the other elements by calling the event.preventDefault()
// function.
// As we still want the sidebar to work with the canvas, we block the mouse
// events propagation out of the sidebar, so that the event.preventDefault()
// is not triggered.
// This will also prevent Kyber's canvas to interpret sidebar keyboard/mouse
// interactions (insertions in input, etc.) as "real" inputs to be send to the
// remote server.
function stopPropagation(event) {
  // Of course, do not block the global sidebar event keyboard shortcut.
  if (!isEventToggleShortcut(event)) {
    event.stopPropagation();
  }
}

// Disable propagation of events generated by sidebar and consumed by Kyber
function disableSidebarEventsPropagation() {
  for (const eventType of ["mousedown", "mouseup", "mousewheel", "keydown", "keyup"]) {
    document.getElementById("sidebar").addEventListener(eventType, stopPropagation);
  }
}

// Enable propagation of events generated by sidebar and consumed by Kyber
function enableSidebarEventsPropagation() {
  for (const eventType of ["mousedown", "mouseup", "mousewheel", "keydown", "keyup"]) {
    document.getElementById("sidebar").removeEventListener(eventType, stopPropagation);
  }
}

function buildSidebar(defaultHost, defaultPort) {
  genConfigInput("host", {name: "Host", type: String, description: "Server host you want to connect on.", default: defaultHost});
  genConfigInput("port", {name: "Port", type: Number, description: "Server port you want to connect on.", default: defaultPort});
  genConfigInput("auto_reconnect", {name: "Auto reconnect", type: Boolean, description: "Automatically reconnect on connection loss.", default: true});

  const hiddenParameters = ["intra_refresh", "gamepad_force_xbox360"];
  for (const param in script.StreamingConfigParameters) {
    if (hiddenParameters.includes(param)) continue;
    genConfigInput(param);
  }

  document.getElementById("auth-method").addEventListener("change", () => {
    // Pre-load the OIDC module as soon as the user selects OIDC so the
    // module is cached before the Connect click. prepareOidcConnect opens
    // the popup synchronously inside the click handler; if the module were
    // loaded there for the first time, the async import could expire the
    // transient activation window before window.open is reached.
    if (getConfigValue("auth-method") === "oidc") ensureOidc().catch(() => {});
    updateAuthFieldsVisibility();
  });
  updateAuthFieldsVisibility();
  configureOverlayFromURLParams();

  // Sidebar is visible by default, register everything
  initMetricToggles();
  initHudMode();
  showSidebar();
}

// Handles the OIDC redirect/popup callback on page load. Returns true if OIDC
// took over the page (popup close, redirect complete, or popup error) and
// normal init should be skipped. Returns false to continue with normal init
// (stale URL params, redirect error, or no OIDC callback detected).
async function handleOidcPageLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOidcCallback = (urlParams.has("code") || urlParams.has("error")) && urlParams.has("state");
  if (!isOidcCallback) return false;

  const o = await ensureOidc();
  o.purgeStaleResults();
  updateStatus("Completing OIDC login...");
  const cb = await o.handleCallback();
  if (cb.kind === "popup") {
    // The popup posted the result to the opener and called window.close();
    // the close races out before any further UI shows.
    return true;
  }
  if (cb.kind === "popup-error") {
    console.error("OIDC callback failed:", cb.err);
    document.body.innerHTML = `<div style="font-family:sans-serif;padding:2em">
      <p style="color:#c00">Login error: ${cb.err.message}</p>
      <p>Close this window and click Connect again.</p>
    </div>`;
    return true;
  }
  if (cb.kind === "redirect") {
    // handleRedirectCallback has restored the original query string; refresh
    // the snapshot so the sidebar inputs pick up audio=, inputs=, etc.
    defaultConfig = script.getConfigFromURLParams();
    buildSidebar(cb.result.host, cb.result.port);
    document.getElementById("auth-method").value = "oidc";
    updateAuthFieldsVisibility();
    await updateConfig();
    updateStatus("Logged in");
    // Connect immediately so streaming starts. If the redirect roundtrip
    // was fast enough that the original Connect click still counts as a
    // user gesture, the AudioContext resumes silently and no overlay is
    // needed; otherwise it stays Suspended and we show click-to-unmute.
    // The AudioWorklet is created after the first audio packet decodes,
    // so poll briefly for its existence before deciding.
    await o.finalizeRedirectLogin(cb.result, uiClientListener);
    // Fire-and-forget: keeps polling in the background until the
    // AudioContext settles or the client disconnects.
    probeAudioAndMaybeShowOverlay();
    return true;
  }
  if (cb.kind === "redirect-error") {
    console.error("OIDC callback failed:", cb.err);
    updateStatus("OIDC error: " + cb.err.message);
  }
  // cb.kind === "stale": fall through to normal init.
  return false;
}

window.addEventListener("load", async () => {
  if (handoff) {
    // The user came from the portal and configures nothing here, so hide the
    // sidebar once streaming starts. Kept visible until then so a connection
    // error (shown in the sidebar status) stays readable.
    const handoffUiListener = async (name, event) => {
      if (name === "streaming_started") hideSidebar();
      await uiClientListener(name, event);
    };
    stopHandoff = await startHandoff(handoff, handoffUiListener, updateStatus);
    // Handoff auto-connects on page load with no user gesture, like the OIDC
    // redirect case, so the AudioContext stays suspended. Poll and show the
    // click-to-unmute overlay; the click also unblocks pointer lock.
    probeAudioAndMaybeShowOverlay();
    return;
  }
  if (await handleOidcPageLoad()) return;

  const [defaultHost, defaultPort] = script.getHostAndPortFromURLParams();
  buildSidebar(defaultHost, defaultPort);

  const pinCheckbox = document.getElementById("pin_sidebar_checkbox");
  const sidebar = document.getElementById("sidebar");
  if (pinCheckbox) {
    pinCheckbox.addEventListener("change", () => {
      if (pinCheckbox.checked) {
        sidebar.classList.add("pinned");
        document.removeEventListener("click", hideSidebar);
        localStorage.setItem("sidebarPinned", "true");
      } else {
        sidebar.classList.remove("pinned");
        document.addEventListener("click", hideSidebar);
        localStorage.setItem("sidebarPinned", "false");
      }
    });
  }

  const metricsCheckbox = document.getElementById("metrics_checkbox");
  const metricsModeSelect = document.getElementById("metrics_mode");
  if (metricsCheckbox) {
    const urlParams = new URLSearchParams(window.location.search);
    const metricsParam = urlParams.get("metrics");
    if (metricsParam !== null) {
      metricsCheckbox.checked = metricsParam === "true";
    } else if (typeof defaultConfig["metrics_checkbox"] === "undefined") {
      metricsCheckbox.checked = localStorage.getItem("metricsEnabled") === "true";
    }

    if (metricsModeSelect) {
      const metricsModeRow = metricsModeSelect.closest('.input-row');

      function updateMetricsVisibility() {
        if (metricsCheckbox.checked) {
          metricsModeRow.style.display = "flex";
        } else {
          metricsModeRow.style.display = "none";
        }
      }

      metricsCheckbox.addEventListener("change", updateMetricsVisibility);
      updateMetricsVisibility();
    }

    metricsCheckbox.addEventListener("change", () => {
      localStorage.setItem("metricsEnabled", String(metricsCheckbox.checked));
    });
  }
});
