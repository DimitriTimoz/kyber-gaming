var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// html/metrics_structure.js
var METRIC_KEYS;
var init_metrics_structure = __esm({
  "html/metrics_structure.js"() {
    METRIC_KEYS = [
      "acquired",
      "encoding",
      "encoded",
      "sent",
      "received",
      "decoding",
      "decoded",
      "skipped",
      "prepared",
      "displayed"
    ];
  }
});

// html/live_graph.js
var DOM_UPDATE_INTERVAL, MAX_POINTS, RingBuffer, Metric, MetricsManager, metricsManager;
var init_live_graph = __esm({
  "html/live_graph.js"() {
    init_metrics_structure();
    DOM_UPDATE_INTERVAL = 200;
    MAX_POINTS = 90;
    RingBuffer = class {
      /**
       * @param {number} size - Maximum number of elements the buffer can hold.
       */
      constructor(size) {
        this.buffer = new Float32Array(size);
        this.head = 0;
        this.size = size;
        this.count = 0;
        this.viewCache = new Float32Array(size);
      }
      /**
       * Appends a value, overwriting the oldest entry when the buffer is full.
       * @param {number} val - Numeric value to push.
       */
      push(val) {
        this.buffer[this.head] = val;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) this.count++;
      }
      /**
       * Returns a typed-array view of the buffer contents in chronological order.
       * If not yet full, only the filled portion is returned.
       * @returns {Float32Array}
       */
      getView() {
        if (this.count < this.size) {
          return this.buffer.subarray(0, this.count);
        }
        for (let i = 0; i < this.size; i++) {
          this.viewCache[i] = this.buffer[(this.head + i) % this.size];
        }
        return this.viewCache;
      }
      /**
       * Returns a plain JS Array copy of the buffer in chronological order.
       * @returns {number[]}
       */
      toArray() {
        return Array.from(this.getView());
      }
      /**
       * Resets the buffer to empty without deallocating memory.
       */
      clear() {
        this.head = 0;
        this.count = 0;
      }
    };
    Metric = class {
      constructor() {
        this.data = new RingBuffer(MAX_POINTS);
        this.color = "#888";
      }
    };
    MetricsManager = class {
      constructor() {
        this.metricsChart = null;
        this.lastChartUpdate = 0;
        this.metrics = new Map(
          METRIC_KEYS.map((k) => [k, new Metric()])
        );
        this.labelsBuffer = new RingBuffer(MAX_POINTS);
        this.activeSeries = new Set(METRIC_KEYS);
        this.updateScheduled = false;
        this.yAvg = 30;
        this.lastDomUpdate = 0;
        this.totalFramesProcessed = 0;
        this.totalFramesDropped = 0;
      }
      /**
       * Initialises (or reinitialises) the Chart.js instance on the #metricsChart
       * canvas and resets all ring buffers.
       * Must be called after the DOM is ready and before processing any frames.
       */
      init() {
        this.cacheMetricColors();
        this.reset();
        const ctx = document.getElementById("metricsChart");
        if (!ctx) {
          console.warn("metricsChart canvas NOT FOUND.");
          return;
        }
        this.metricsChart?.destroy();
        this.metricsChart = new Chart(ctx, {
          type: "line",
          data: { labels: [], datasets: [] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: {
                beginAtZero: true,
                min: 0,
                max: this.yAvg,
                ticks: { color: "#333", font: { size: 13 } }
              }
            }
          }
        });
        for (const k of METRIC_KEYS) {
          this.ensureDataset(k, this.activeSeries.has(k));
        }
        this.metricsChart.update("none");
      }
      /**
       * Shows or hides a metric series on the chart.
       * @param {string}  key    A key from METRIC_KEYS.
       * @param {boolean} active true to show the series, false to hide it.
       */
      toggleSeries(key, active) {
        if (active) this.activeSeries.add(key);
        else this.activeSeries.delete(key);
        const ds = this.metricsChart.data.datasets.find((d) => d.label === key);
        if (ds) ds.hidden = !active;
        this.scheduleChartUpdate();
      }
      /**
       * Reset the chart.
       */
      reset() {
        this.totalFramesProcessed = 0;
        this.totalFramesDropped = 0;
        this.yAvg = 30;
        this.labelsBuffer?.clear();
        for (const metrics of this.metrics.values()) {
          metrics.data.clear();
        }
      }
      /**
       * Processes a metric event received from the Rust backend.
       * @param {Object} obj
       */
      processFrameMetric(obj) {
        if (!("pts" in obj)) {
          console.warn("Live metrics : Invalid frame (no pts)", obj);
          return;
        }
        this.updateRingBufferAndChart(obj);
        this.totalFramesProcessed++;
      }
      /**
       * Destroys the Chart.js instance, logs session statistics, and resets state.
       */
      destroy() {
        this.metricsChart?.destroy();
        this.metricsChart = null;
        console.log(
          `Live metrics : Session stats - Processed: ${this.totalFramesProcessed}, Dropped: ${this.totalFramesDropped} (${this.totalFramesProcessed > 0 ? (this.totalFramesDropped / this.totalFramesProcessed * 100).toFixed(1) : "0"}%)`
        );
        this.reset();
      }
      /**
       * Reads the CSS left border colour of each .metric-pill element and caches it
       * in each metric.
       */
      cacheMetricColors() {
        for (const [k, metric] of this.metrics) {
          metric.color = this.cssColorForMetric(k);
        }
      }
      /**
       * Resolves the display colour for a metric from its .metric-pill DOM element.
       * @param {string} key
       * @returns {string}
       */
      cssColorForMetric(key) {
        const pill = document.querySelector(`.metric-pill.${key}`);
        return pill ? getComputedStyle(pill).borderLeftColor : "#888";
      }
      /**
       * Schedules a chart data refresh on the next animation frame.
       * Subject to an 80 ms minimum interval to avoid excessive redraws.
       * Subsequent calls before the scheduled frame fire are no-ops.
       * @returns
       */
      scheduleChartUpdate() {
        if (this.updateScheduled) return;
        const now = performance.now();
        if (now - this.lastChartUpdate < 80) return;
        this.updateScheduled = true;
        requestAnimationFrame(() => {
          this.lastChartUpdate = performance.now();
          if (this.metricsChart) {
            this.metricsChart.data.labels = this.labelsBuffer.toArray();
            this.metricsChart.data.datasets.forEach((ds) => {
              const metric = this.metrics.get(ds.label);
              if (metric) {
                ds.data = Array.from(metric.data.getView());
              }
            });
            this.metricsChart.update("none");
          }
          this.updateScheduled = false;
        });
      }
      /**
       * Ensures a Chart.js dataset exists for the given key, creating it if absent.
       *
       * @param {string} key A key from METRIC_KEYS.
       * @param {boolean} visible dataset should be visible on creation or no
       */
      ensureDataset(key, visible) {
        const color = this.metrics.get(key).color;
        let ds = this.metricsChart.data.datasets.find((d) => d.label === key);
        if (!ds) {
          ds = {
            label: key,
            data: [],
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            spanGaps: true,
            hidden: !visible
          };
          this.metricsChart.data.datasets.push(ds);
        } else {
          ds.hidden = !visible;
        }
      }
      /**
       * Pushes a frame's values into the ring buffers and schedules a chart update.
       * Each timestamp is normalised relative to the earliest timestamp in the frame.
       *
       * @param {Object} frame
       */
      updateRingBufferAndChart(frame) {
        if (!this.metricsChart) return;
        try {
          let minTs = Infinity;
          for (const key of METRIC_KEYS) {
            const val = frame[key];
            if (val != null && isFinite(val) && val > 0 && val < minTs) {
              minTs = val;
            }
          }
          if (minTs === Infinity) {
            console.warn("Live metrics : No valid timestamps found in frame");
            return;
          }
          this.labelsBuffer.push(frame.pts);
          for (const [key, metric] of this.metrics) {
            const val = frame[key];
            let finalVal = NaN;
            if (val !== null && isFinite(val) && val > 0) {
              finalVal = (val - minTs) / 1e3;
            }
            metric.data.push(finalVal);
          }
          let yIdeal = 0;
          for (const key of this.activeSeries) {
            const metric = this.metrics.get(key);
            if (!metric) continue;
            const view = metric.data.getView();
            for (let i = 0; i < view.length; i++) {
              if (isFinite(view[i]) && view[i] > yIdeal) yIdeal = view[i];
            }
          }
          if (yIdeal > 0) {
            this.yAvg = (this.yAvg * 250 + yIdeal) / 251;
          }
          if (this.metricsChart.options.scales.y.max !== this.yAvg) {
            this.metricsChart.options.scales.y.max = Math.floor(this.yAvg);
          }
          this.scheduleChartUpdate();
          this.updateSidebarStats(frame);
        } catch (error) {
          console.error("Chart Error:", error);
        }
      }
      /**
       * Computes latencies from frame's timestamps.
       * @param {Object} frame
       * @returns {serverLat, networkLat, clientLat, totalLat}
       * Latencies in milliseconds, or null if required timestamps are missing.
       */
      calculateLatencies(frame) {
        const acquiredTs = frame.acquired;
        const sentTs = frame.sent;
        const receivedTs = frame.received;
        const displayedTs = frame.displayed;
        const preparedTs = frame.prepared;
        if (acquiredTs == null || sentTs == null || receivedTs == null || !isFinite(acquiredTs) || !isFinite(sentTs) || !isFinite(receivedTs)) {
          return null;
        }
        const serverLat = (sentTs - acquiredTs) / 1e3;
        const networkLat = (receivedTs - sentTs) / 1e3;
        const endTs = displayedTs ?? preparedTs;
        if (endTs == null || !isFinite(endTs)) return null;
        const clientLat = (endTs - receivedTs) / 1e3;
        const totalLat = serverLat + networkLat + clientLat;
        return { serverLat, networkLat, clientLat, totalLat };
      }
      /**
       * Updates the sidebar latency DOM elements with the provided values.
       * Writes "--- ms" to each field when latencies is null.
       *
       * @param {{ serverLat, networkLat, clientLat, totalLat }|null} latencies
       * @returns
       */
      updateLatencyDisplay(latencies) {
        if (!latencies) {
          ["latency-value", "latency-server", "latency-network", "latency-client"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = "--- ms";
          });
          return;
        }
        const updates = {
          "latency-value": latencies.totalLat,
          "latency-server": latencies.serverLat,
          "latency-network": latencies.networkLat,
          "latency-client": latencies.clientLat
        };
        Object.entries(updates).forEach(([id, val]) => {
          const el = document.getElementById(id);
          if (el) {
            el.textContent = `${val.toFixed(1)} ms`;
          }
        });
      }
      /**
       * Throttled entry point for sidebar DOM updates (max once per DOM_UPDATE_INTERVAL ms).
       * Calls calculateLatencies then updateLatencyDisplay.
       *
       * @param {Object} frame
       */
      updateSidebarStats(frame) {
        const perfNow = performance.now();
        if (perfNow - this.lastDomUpdate > DOM_UPDATE_INTERVAL) {
          this.lastDomUpdate = perfNow;
          const latencies = this.calculateLatencies(frame);
          this.updateLatencyDisplay(latencies);
        }
      }
    };
    metricsManager = new MetricsManager();
  }
});

// html/script.js
import init, { AudioResumeState, AuthCredentials, Client, GamepadBlocklistEntry, StreamingConfig, StreamingConfigBuilder, supportedVideoCodecs } from "./kyclient_wasm.js";
function getParam(urlParams, name, defaultValue) {
  let value = urlParams.get(name);
  if (value != null) {
    if (value === "true")
      return true;
    else if (value === "false")
      return false;
    else
      return value;
  } else {
    return defaultValue;
  }
}
function toggleFullscreen() {
  let container = document.getElementById("container");
  container.requestFullscreen().then(() => {
    if (navigator.keyboard === void 0) {
      console.warn("navigator.keyboard not defined");
      return;
    }
    const keys = [
      "Escape"
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
  let size = calculateAspectRatioFit(
    canvasWidth,
    canvasHeight,
    container.clientWidth,
    container.clientHeight
  );
  canvas.style.height = `${size.height}px`;
  canvas.style.width = `${size.width}px`;
}
function canvasOnWindowResized() {
  let container = document.getElementById("container");
  let canvas2 = document.getElementById("canvas");
  if (canvas2 === null)
    return;
  resizeCanvas(container, canvas2.width, canvas2.height);
}
function createCanvas() {
  let container = document.getElementById("container");
  let canvas2 = document.createElement("canvas");
  canvas2.id = "canvas";
  canvas2.width = 800;
  canvas2.height = 600;
  container.appendChild(canvas2);
  resizeCanvas(container, canvas2.width, canvas2.height);
}
function deleteCanvas() {
  let canvas2 = document.getElementById("canvas");
  if (canvas2 === null)
    return;
  canvas2.remove();
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
        deleteCanvas();
        createCanvas();
        metricsManager.init();
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
      let canvas2 = document.getElementById("canvas");
      if (canvas2 !== null)
        resizeCanvas(container, event.width, event.height);
      break;
    case "streaming_stopped":
      deleteCanvas();
      createCanvas();
      await client.start_streaming("canvas", streamingConfig.clone());
      break;
    case "stopped":
      const reason = event.reason();
      const isError = reason === "decode_error" || reason === "controlplane_io_error" || reason === "controlplane_timeout";
      (isError ? console.warn : console.log)(`Client stopped - exiting. Reason: ${reason}`);
      if (cancelInProgress > 0) {
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
      console.log(`Got StreamerPipelineEvent: Type: ${event.type} - Stage: ${event.stage} - Event: ${event.event}`);
      break;
    case "image_decoded":
      const image_time = event.pts;
      break;
    case "gamepad_plugged":
      console.log(`Gamepad (index ${event.index}) plugged: ${event.name}`);
      break;
    case "gamepad_unplugged":
      console.log(`Gamepad (index ${event.index}) unplugged: ${event.name}`);
      break;
    case "display_list_updated":
      console.log(`Display list updated: ${JSON.stringify(event.displays)}`);
      break;
  }
}
function getHostAndPortFromURLParams() {
  const hostPortStr = window.location.host;
  const hostMatches = hostPortStr.match(/(\[[^\]]+\])|([^:]+)/);
  let defaultHost = hostMatches[1] || hostMatches[2];
  const portMatches = hostPortStr.match(/\:(\d+)$/);
  let defaultPort = portMatches ? portMatches[1] : "443";
  const urlParams = new URLSearchParams(window.location.search);
  let host = getParam(urlParams, "host", defaultHost);
  let port = getParam(urlParams, "port", defaultPort);
  return [host.replace(/^\[|\]$/g, ""), port];
}
function getMetricsParams() {
  const checkbox = document.getElementById("metrics_checkbox");
  const isChecked = checkbox?.checked ?? false;
  let selectedMode = "none";
  if (isChecked) {
    const modeSelect = document.getElementById("metrics_mode");
    selectedMode = modeSelect?.value ?? "both";
  }
  return { enabled: isChecked, mode: selectedMode };
}
function getAutoReconnectParam() {
  const checkbox = document.getElementById("auto_reconnect");
  return checkbox ? checkbox.checked : true;
}
async function updateStreamingConfig(config) {
  await initPromise;
  let streamingConfigBuilder = new StreamingConfigBuilder();
  for (const name in config) {
    let value = config[name];
    let definition = StreamingConfigParameters[name];
    if (typeof definition === "undefined") {
      console.log(`${name} config parameter unkwown, ignoring`);
      continue;
    }
    if (typeof definition.type() !== typeof value) {
      console.log(`${name} config parameter value type (${typeof value}) mismatch, ignoring`);
      continue;
    }
    if (typeof definition.allowed !== "undefined" && !definition.allowed.includes(value)) {
      console.log(`${name} config parameter value (${value}) not in allowed values, ignoring`);
      continue;
    }
    if (typeof definition.type() == "number" && isNaN(value))
      continue;
    Reflect.set(streamingConfigBuilder, name, value);
  }
  streamingConfig = streamingConfigBuilder.build();
}
function getConfigFromURLParams() {
  let config = {};
  const urlParams = new URLSearchParams(window.location.search);
  for (let [name, value] of urlParams) {
    if (name === "host" || name === "port" || name === "metrics") {
      continue;
    }
    if (name === "video_codec") {
      name = "codec";
    }
    let definition = StreamingConfigParameters[name];
    if (typeof definition === "undefined") {
      console.log(`${name} URL parameter unkwown, ignoring`);
      continue;
    }
    switch (definition.type) {
      case String:
        if (typeof definition.allowed !== "undefined" && !definition.allowed.includes(value)) {
          console.log(`${name} URL parameter value not in allowed values, ignoring`);
          break;
        }
        config[name] = value;
        break;
      case Number:
        config[name] = parseInt(value);
        break;
      case Boolean:
        if (value !== "true" && value !== "false") {
          console.log(`${name} URL parameter not a boolean, ignoring`);
          break;
        }
        config[name] = value === "true";
        break;
    }
  }
  return config;
}
async function doConnect(optionalClientListener = null, host = null, port = null, authCredentials) {
  if (client !== null) {
    return;
  }
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
    };
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
        console.error("Failed to process metrics event:", error);
        console.error("Metrics event:", obj);
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
    autoReconnect
  );
  client.connect();
  return client;
}
async function doDisconnect() {
  client?.disconnect();
}
function updateCredentials(authCredentials) {
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
  try {
    client.connect();
  } catch (err) {
    console.warn("connect() after credential update failed:", err);
  }
  return client;
}
function isClientActive() {
  return client !== null;
}
function getWasmClient() {
  return client;
}
function cancelAndDisconnect() {
  if (client !== null) {
    const stale = client;
    client = null;
    cancelInProgress++;
    stale.disconnect_and_stop(false).catch((err) => console.error("Failed to stop stale client:", err));
  }
  deleteCanvas();
}
async function doRestartStreaming() {
  client?.stop_streaming();
}
function sendCtrlAltDel() {
  client?.send_ctrl_alt_del();
}
async function tryResumeAudio() {
  return await (client?.audio_try_resume() ?? Promise.resolve(AudioResumeState.Running));
}
async function audioResume() {
  await client?.audio_resume();
}
async function flushLogs() {
  await client?.flush_logs();
}
var initPromise, client, streamingConfig, cancelInProgress, StreamingConfigParameters;
var init_script = __esm({
  "html/script.js"() {
    init_live_graph();
    initPromise = init();
    client = null;
    streamingConfig = null;
    cancelInProgress = 0;
    StreamingConfigParameters = {
      protocol: {
        name: "Protocol",
        type: String,
        description: "The protocol to use.",
        default: "kymux",
        allowed: ["kymux", "websocket"]
      },
      kymux_video: {
        name: "Video strategy",
        type: String,
        description: "video protocol strategy.",
        default: "reliable",
        allowed: ["reliable", "gopstream", "unreliable", "unreliable_fec"]
      },
      kymux_audio: {
        name: "Audio strategy",
        type: String,
        description: "audio protocol strategy.",
        default: "reliable",
        allowed: ["reliable", "unreliable", "unreliable_fec"]
      },
      bitrate: {
        name: "Connection bitrate",
        type: Number,
        description: "connection bitrate, in bits/second.",
        default: "20000000"
      },
      codec: {
        name: "Video codec",
        type: String,
        description: "Video codec to use.",
        default: "h264",
        allowed: ["h264", "hevc"]
      },
      display_index: {
        name: "Display",
        type: Number,
        description: "The index of the display to grab.",
        default: 0
      },
      yuv444: {
        name: "Enable 4:4:4",
        type: Boolean,
        description: "Enable 4:4:4 chroma.",
        default: false
      },
      software_decode: {
        name: "Force software decoding",
        type: Boolean,
        description: "Force software decoding.",
        default: false
      },
      audio: {
        name: "Enable audio",
        type: Boolean,
        description: "Enable audio.",
        default: true
      },
      audio_buffer: {
        name: "Audio buffering",
        type: Number,
        description: "Audio buffering, in milliseconds.",
        default: null
      },
      video_buffer: {
        name: "Video buffering",
        type: Number,
        description: "Video buffering, in milliseconds.",
        default: 0
      },
      inputs: {
        name: "Enable inputs",
        type: Boolean,
        description: "Enable inputs forwarding (keyboard, mouse, gamepad, etc.)",
        default: true
      },
      intra_refresh: {
        name: "Enable intra refresh",
        type: Boolean,
        description: "Enable video codec intra refresh.",
        default: true
      },
      gamepad_force_xbox360: {
        name: "Force XBox360 gamepad",
        type: Boolean,
        description: "Force xbox360 gamepad management.",
        default: false
      },
      clipboard: {
        name: "Enable clipboard",
        type: Boolean,
        description: "Enable Clipboard support.",
        default: true
      },
      metrics_checkbox: {
        name: "Enable metrics",
        type: Boolean,
        description: "Enable metrics collection.",
        default: false
      },
      metrics_mode: {
        name: "Metrics mode",
        type: String,
        description: "Select metrics output mode.",
        default: "both",
        allowed: ["live", "json", "both"]
      }
    };
    window.addEventListener("resize", canvasOnWindowResized);
  }
});

// node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/base64-js/index.js"(exports) {
    "use strict";
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// node_modules/@openid/appauth/built/errors.js
var require_errors = __commonJS({
  "node_modules/@openid/appauth/built/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AppAuthError = void 0;
    var AppAuthError = (
      /** @class */
      /* @__PURE__ */ function() {
        function AppAuthError2(message, extras) {
          this.message = message;
          this.extras = extras;
        }
        return AppAuthError2;
      }()
    );
    exports.AppAuthError = AppAuthError;
  }
});

// node_modules/@openid/appauth/built/crypto_utils.js
var require_crypto_utils = __commonJS({
  "node_modules/@openid/appauth/built/crypto_utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefaultCrypto = exports.textEncodeLite = exports.urlSafe = exports.bufferToString = void 0;
    var base64 = require_base64_js();
    var errors_1 = require_errors();
    var HAS_CRYPTO = typeof window !== "undefined" && !!window.crypto;
    var HAS_SUBTLE_CRYPTO = HAS_CRYPTO && !!window.crypto.subtle;
    var CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    function bufferToString(buffer) {
      var state = [];
      for (var i = 0; i < buffer.byteLength; i += 1) {
        var index = buffer[i] % CHARSET.length;
        state.push(CHARSET[index]);
      }
      return state.join("");
    }
    exports.bufferToString = bufferToString;
    function urlSafe(buffer) {
      var encoded = base64.fromByteArray(new Uint8Array(buffer));
      return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }
    exports.urlSafe = urlSafe;
    function textEncodeLite(str) {
      var buf = new ArrayBuffer(str.length);
      var bufView = new Uint8Array(buf);
      for (var i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return bufView;
    }
    exports.textEncodeLite = textEncodeLite;
    var DefaultCrypto = (
      /** @class */
      function() {
        function DefaultCrypto2() {
        }
        DefaultCrypto2.prototype.generateRandom = function(size) {
          var buffer = new Uint8Array(size);
          if (HAS_CRYPTO) {
            window.crypto.getRandomValues(buffer);
          } else {
            for (var i = 0; i < size; i += 1) {
              buffer[i] = Math.random() * CHARSET.length | 0;
            }
          }
          return bufferToString(buffer);
        };
        DefaultCrypto2.prototype.deriveChallenge = function(code) {
          if (code.length < 43 || code.length > 128) {
            return Promise.reject(new errors_1.AppAuthError("Invalid code length."));
          }
          if (!HAS_SUBTLE_CRYPTO) {
            return Promise.reject(new errors_1.AppAuthError("window.crypto.subtle is unavailable."));
          }
          return new Promise(function(resolve, reject) {
            crypto.subtle.digest("SHA-256", textEncodeLite(code)).then(function(buffer) {
              return resolve(urlSafe(new Uint8Array(buffer)));
            }, function(error) {
              return reject(error);
            });
          });
        };
        return DefaultCrypto2;
      }()
    );
    exports.DefaultCrypto = DefaultCrypto;
  }
});

// node_modules/@openid/appauth/built/flags.js
var require_flags = __commonJS({
  "node_modules/@openid/appauth/built/flags.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.IS_PROFILE = exports.IS_LOG = exports.setFlag = exports.Flags = void 0;
    exports.Flags = {
      /* Logging turned on ? */
      IS_LOG: true,
      /* Profiling turned on ? */
      IS_PROFILE: false
    };
    function setFlag(flag, value) {
      exports.Flags[flag] = value;
    }
    exports.setFlag = setFlag;
    exports.IS_LOG = exports.Flags.IS_LOG, exports.IS_PROFILE = exports.Flags.IS_PROFILE;
  }
});

// node_modules/@openid/appauth/built/logger.js
var require_logger = __commonJS({
  "node_modules/@openid/appauth/built/logger.js"(exports) {
    "use strict";
    var __spreadArray = exports && exports.__spreadArray || function(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.profile = exports.log = void 0;
    var flags_1 = require_flags();
    function log(message) {
      var args = [];
      for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
      }
      if (flags_1.Flags.IS_LOG) {
        var length_1 = args ? args.length : 0;
        if (length_1 > 0) {
          console.log.apply(console, __spreadArray([message], args, false));
        } else {
          console.log(message);
        }
      }
    }
    exports.log = log;
    var NATIVE_PROFILE_SUPPORT = typeof window !== "undefined" && !!window.performance && !!console.profile;
    function profile(target, propertyKey, descriptor) {
      if (flags_1.Flags.IS_PROFILE) {
        return performProfile(target, propertyKey, descriptor);
      } else {
        return descriptor;
      }
    }
    exports.profile = profile;
    function performProfile(target, propertyKey, descriptor) {
      var originalCallable = descriptor.value;
      var name = originalCallable.name;
      if (!name) {
        name = "anonymous function";
      }
      if (NATIVE_PROFILE_SUPPORT) {
        descriptor.value = function(args) {
          console.profile(name);
          var startTime = window.performance.now();
          var result = originalCallable.call.apply(originalCallable, __spreadArray([this || window], args, false));
          var duration = window.performance.now() - startTime;
          console.log("".concat(name, " took ").concat(duration, " ms"));
          console.profileEnd();
          return result;
        };
      } else {
        descriptor.value = function(args) {
          log("Profile start ".concat(name));
          var start = Date.now();
          var result = originalCallable.call.apply(originalCallable, __spreadArray([this || window], args, false));
          var duration = Date.now() - start;
          log("Profile end ".concat(name, " took ").concat(duration, " ms."));
          return result;
        };
      }
      return descriptor;
    }
  }
});

// node_modules/@openid/appauth/built/authorization_request.js
var require_authorization_request = __commonJS({
  "node_modules/@openid/appauth/built/authorization_request.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthorizationRequest = void 0;
    var crypto_utils_1 = require_crypto_utils();
    var logger_1 = require_logger();
    var SIZE = 10;
    var newState = function(crypto2) {
      return crypto2.generateRandom(SIZE);
    };
    var AuthorizationRequest2 = (
      /** @class */
      function() {
        function AuthorizationRequest3(request, crypto2, usePkce) {
          if (crypto2 === void 0) {
            crypto2 = new crypto_utils_1.DefaultCrypto();
          }
          if (usePkce === void 0) {
            usePkce = true;
          }
          this.crypto = crypto2;
          this.usePkce = usePkce;
          this.clientId = request.client_id;
          this.redirectUri = request.redirect_uri;
          this.scope = request.scope;
          this.responseType = request.response_type || AuthorizationRequest3.RESPONSE_TYPE_CODE;
          this.state = request.state || newState(crypto2);
          this.extras = request.extras;
          this.internal = request.internal;
        }
        AuthorizationRequest3.prototype.setupCodeVerifier = function() {
          var _this = this;
          if (!this.usePkce) {
            return Promise.resolve();
          } else {
            var codeVerifier_1 = this.crypto.generateRandom(128);
            var challenge = this.crypto.deriveChallenge(codeVerifier_1).catch(function(error) {
              (0, logger_1.log)("Unable to generate PKCE challenge. Not using PKCE", error);
              return void 0;
            });
            return challenge.then(function(result) {
              if (result) {
                _this.internal = _this.internal || {};
                _this.internal["code_verifier"] = codeVerifier_1;
                _this.extras = _this.extras || {};
                _this.extras["code_challenge"] = result;
                _this.extras["code_challenge_method"] = "S256";
              }
            });
          }
        };
        AuthorizationRequest3.prototype.toJson = function() {
          var _this = this;
          return this.setupCodeVerifier().then(function() {
            return {
              response_type: _this.responseType,
              client_id: _this.clientId,
              redirect_uri: _this.redirectUri,
              scope: _this.scope,
              state: _this.state,
              extras: _this.extras,
              internal: _this.internal
            };
          });
        };
        AuthorizationRequest3.RESPONSE_TYPE_TOKEN = "token";
        AuthorizationRequest3.RESPONSE_TYPE_CODE = "code";
        return AuthorizationRequest3;
      }()
    );
    exports.AuthorizationRequest = AuthorizationRequest2;
  }
});

// node_modules/@openid/appauth/built/url_validator.js
var require_url_validator = __commonJS({
  "node_modules/@openid/appauth/built/url_validator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requireValidUrl = void 0;
    var errors_1 = require_errors();
    function requireValidUrl(input) {
      try {
        new URL(input);
        return input;
      } catch (error) {
        throw new errors_1.AppAuthError("Invalid input url ".concat(input));
      }
    }
    exports.requireValidUrl = requireValidUrl;
  }
});

// node_modules/@openid/appauth/built/authorization_request_handler.js
var require_authorization_request_handler = __commonJS({
  "node_modules/@openid/appauth/built/authorization_request_handler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthorizationRequestHandler = exports.BUILT_IN_PARAMETERS = exports.AuthorizationNotifier = void 0;
    var logger_1 = require_logger();
    var url_validator_1 = require_url_validator();
    var AuthorizationNotifier = (
      /** @class */
      function() {
        function AuthorizationNotifier2() {
          this.listener = null;
        }
        AuthorizationNotifier2.prototype.setAuthorizationListener = function(listener) {
          this.listener = listener;
        };
        AuthorizationNotifier2.prototype.onAuthorizationComplete = function(request, response, error) {
          if (this.listener) {
            this.listener(request, response, error);
          }
        };
        return AuthorizationNotifier2;
      }()
    );
    exports.AuthorizationNotifier = AuthorizationNotifier;
    exports.BUILT_IN_PARAMETERS = ["redirect_uri", "client_id", "response_type", "state", "scope"];
    var AuthorizationRequestHandler = (
      /** @class */
      function() {
        function AuthorizationRequestHandler2(utils, crypto2) {
          this.utils = utils;
          this.crypto = crypto2;
          this.notifier = null;
        }
        AuthorizationRequestHandler2.prototype.buildRequestUrl = function(configuration, request) {
          var requestMap = {
            "redirect_uri": request.redirectUri,
            "client_id": request.clientId,
            "response_type": request.responseType,
            "state": request.state,
            "scope": request.scope
          };
          if (request.extras) {
            for (var extra in request.extras) {
              if (request.extras.hasOwnProperty(extra)) {
                if (exports.BUILT_IN_PARAMETERS.indexOf(extra) < 0) {
                  requestMap[extra] = request.extras[extra];
                }
              }
            }
          }
          var query = this.utils.stringify(requestMap);
          var baseUrl = (0, url_validator_1.requireValidUrl)(configuration.authorizationEndpoint);
          var url = "".concat(baseUrl, "?").concat(query);
          return url;
        };
        AuthorizationRequestHandler2.prototype.completeAuthorizationRequestIfPossible = function() {
          var _this = this;
          (0, logger_1.log)("Checking to see if there is an authorization response to be delivered.");
          if (!this.notifier) {
            (0, logger_1.log)("Notifier is not present on AuthorizationRequest handler.\n          No delivery of result will be possible");
          }
          return this.completeAuthorizationRequest().then(function(result) {
            if (!result) {
              (0, logger_1.log)("No result is available yet.");
            }
            if (result && _this.notifier) {
              _this.notifier.onAuthorizationComplete(result.request, result.response, result.error);
            }
          });
        };
        AuthorizationRequestHandler2.prototype.setAuthorizationNotifier = function(notifier) {
          this.notifier = notifier;
          return this;
        };
        ;
        return AuthorizationRequestHandler2;
      }()
    );
    exports.AuthorizationRequestHandler = AuthorizationRequestHandler;
  }
});

// node_modules/@openid/appauth/built/authorization_response.js
var require_authorization_response = __commonJS({
  "node_modules/@openid/appauth/built/authorization_response.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthorizationError = exports.AuthorizationResponse = void 0;
    var AuthorizationResponse = (
      /** @class */
      function() {
        function AuthorizationResponse2(response) {
          this.code = response.code;
          this.state = response.state;
        }
        AuthorizationResponse2.prototype.toJson = function() {
          return { code: this.code, state: this.state };
        };
        return AuthorizationResponse2;
      }()
    );
    exports.AuthorizationResponse = AuthorizationResponse;
    var AuthorizationError = (
      /** @class */
      function() {
        function AuthorizationError2(error) {
          this.error = error.error;
          this.errorDescription = error.error_description;
          this.errorUri = error.error_uri;
          this.state = error.state;
        }
        AuthorizationError2.prototype.toJson = function() {
          return {
            error: this.error,
            error_description: this.errorDescription,
            error_uri: this.errorUri,
            state: this.state
          };
        };
        return AuthorizationError2;
      }()
    );
    exports.AuthorizationError = AuthorizationError;
  }
});

// node_modules/@openid/appauth/built/xhr.js
var require_xhr = __commonJS({
  "node_modules/@openid/appauth/built/xhr.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TestRequestor = exports.FetchRequestor = exports.JQueryRequestor = exports.Requestor = void 0;
    var errors_1 = require_errors();
    var Requestor = (
      /** @class */
      /* @__PURE__ */ function() {
        function Requestor2() {
        }
        return Requestor2;
      }()
    );
    exports.Requestor = Requestor;
    var JQueryRequestor = (
      /** @class */
      function(_super) {
        __extends(JQueryRequestor2, _super);
        function JQueryRequestor2() {
          return _super !== null && _super.apply(this, arguments) || this;
        }
        JQueryRequestor2.prototype.xhr = function(settings) {
          var xhr = $.ajax(settings);
          return new Promise(function(resolve, reject) {
            xhr.then(function(data, textStatus, jqXhr) {
              resolve(data);
            }, function(jqXhr, textStatus, error) {
              reject(new errors_1.AppAuthError(error));
            });
          });
        };
        return JQueryRequestor2;
      }(Requestor)
    );
    exports.JQueryRequestor = JQueryRequestor;
    var FetchRequestor2 = (
      /** @class */
      function(_super) {
        __extends(FetchRequestor3, _super);
        function FetchRequestor3() {
          return _super !== null && _super.apply(this, arguments) || this;
        }
        FetchRequestor3.prototype.xhr = function(settings) {
          if (!settings.url) {
            return Promise.reject(new errors_1.AppAuthError("A URL must be provided."));
          }
          var url = new URL(settings.url);
          var requestInit = {};
          requestInit.method = settings.method;
          requestInit.mode = "cors";
          if (settings.data) {
            if (settings.method && settings.method.toUpperCase() === "POST") {
              requestInit.body = settings.data;
            } else {
              var searchParams = new URLSearchParams(settings.data);
              searchParams.forEach(function(value, key) {
                url.searchParams.append(key, value);
              });
            }
          }
          requestInit.headers = {};
          if (settings.headers) {
            for (var i in settings.headers) {
              if (settings.headers.hasOwnProperty(i)) {
                requestInit.headers[i] = settings.headers[i];
              }
            }
          }
          var isJsonDataType = settings.dataType && settings.dataType.toLowerCase() === "json";
          if (isJsonDataType) {
            requestInit.headers["Accept"] = "application/json, text/javascript, */*; q=0.01";
          }
          return fetch(url.toString(), requestInit).then(function(response) {
            if (response.status >= 200 && response.status < 300) {
              var contentType = response.headers.get("content-type");
              if (isJsonDataType || contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
              } else {
                return response.text();
              }
            } else {
              return Promise.reject(new errors_1.AppAuthError(response.status.toString(), response.statusText));
            }
          });
        };
        return FetchRequestor3;
      }(Requestor)
    );
    exports.FetchRequestor = FetchRequestor2;
    var TestRequestor = (
      /** @class */
      function(_super) {
        __extends(TestRequestor2, _super);
        function TestRequestor2(promise) {
          var _this = _super.call(this) || this;
          _this.promise = promise;
          return _this;
        }
        TestRequestor2.prototype.xhr = function(settings) {
          return this.promise;
        };
        return TestRequestor2;
      }(Requestor)
    );
    exports.TestRequestor = TestRequestor;
  }
});

// node_modules/@openid/appauth/built/authorization_service_configuration.js
var require_authorization_service_configuration = __commonJS({
  "node_modules/@openid/appauth/built/authorization_service_configuration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AuthorizationServiceConfiguration = void 0;
    var xhr_1 = require_xhr();
    var WELL_KNOWN_PATH = ".well-known";
    var OPENID_CONFIGURATION = "openid-configuration";
    var AuthorizationServiceConfiguration3 = (
      /** @class */
      function() {
        function AuthorizationServiceConfiguration4(request) {
          this.authorizationEndpoint = request.authorization_endpoint;
          this.tokenEndpoint = request.token_endpoint;
          this.revocationEndpoint = request.revocation_endpoint;
          this.userInfoEndpoint = request.userinfo_endpoint;
          this.endSessionEndpoint = request.end_session_endpoint;
        }
        AuthorizationServiceConfiguration4.prototype.toJson = function() {
          return {
            authorization_endpoint: this.authorizationEndpoint,
            token_endpoint: this.tokenEndpoint,
            revocation_endpoint: this.revocationEndpoint,
            end_session_endpoint: this.endSessionEndpoint,
            userinfo_endpoint: this.userInfoEndpoint
          };
        };
        AuthorizationServiceConfiguration4.fetchFromIssuer = function(openIdIssuerUrl, requestor2) {
          var fullUrl = "".concat(openIdIssuerUrl, "/").concat(WELL_KNOWN_PATH, "/").concat(OPENID_CONFIGURATION);
          var requestorToUse = requestor2 || new xhr_1.JQueryRequestor();
          return requestorToUse.xhr({ url: fullUrl, dataType: "json", method: "GET" }).then(function(json) {
            return new AuthorizationServiceConfiguration4(json);
          });
        };
        return AuthorizationServiceConfiguration4;
      }()
    );
    exports.AuthorizationServiceConfiguration = AuthorizationServiceConfiguration3;
  }
});

// node_modules/@openid/appauth/built/query_string_utils.js
var require_query_string_utils = __commonJS({
  "node_modules/@openid/appauth/built/query_string_utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BasicQueryStringUtils = void 0;
    var BasicQueryStringUtils = (
      /** @class */
      function() {
        function BasicQueryStringUtils2() {
        }
        BasicQueryStringUtils2.prototype.parse = function(input, useHash) {
          if (useHash) {
            return this.parseQueryString(input.hash);
          } else {
            return this.parseQueryString(input.search);
          }
        };
        BasicQueryStringUtils2.prototype.parseQueryString = function(query) {
          var result = {};
          query = query.trim().replace(/^(\?|#|&)/, "");
          var params = query.split("&");
          for (var i = 0; i < params.length; i += 1) {
            var param = params[i];
            var parts = param.split("=");
            if (parts.length >= 2) {
              var key = decodeURIComponent(parts.shift());
              var value = parts.length > 0 ? parts.join("=") : null;
              if (value) {
                result[key] = decodeURIComponent(value);
              }
            }
          }
          return result;
        };
        BasicQueryStringUtils2.prototype.stringify = function(input) {
          var encoded = [];
          for (var key in input) {
            if (input.hasOwnProperty(key) && input[key]) {
              encoded.push("".concat(encodeURIComponent(key), "=").concat(encodeURIComponent(input[key])));
            }
          }
          return encoded.join("&");
        };
        return BasicQueryStringUtils2;
      }()
    );
    exports.BasicQueryStringUtils = BasicQueryStringUtils;
  }
});

// node_modules/@openid/appauth/built/storage.js
var require_storage = __commonJS({
  "node_modules/@openid/appauth/built/storage.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LocalStorageBackend = exports.StorageBackend = void 0;
    var StorageBackend = (
      /** @class */
      /* @__PURE__ */ function() {
        function StorageBackend2() {
        }
        return StorageBackend2;
      }()
    );
    exports.StorageBackend = StorageBackend;
    var LocalStorageBackend = (
      /** @class */
      function(_super) {
        __extends(LocalStorageBackend2, _super);
        function LocalStorageBackend2(storage) {
          var _this = _super.call(this) || this;
          _this.storage = storage || window.localStorage;
          return _this;
        }
        LocalStorageBackend2.prototype.getItem = function(name) {
          var _this = this;
          return new Promise(function(resolve, reject) {
            var value = _this.storage.getItem(name);
            if (value) {
              resolve(value);
            } else {
              resolve(null);
            }
          });
        };
        LocalStorageBackend2.prototype.removeItem = function(name) {
          var _this = this;
          return new Promise(function(resolve, reject) {
            _this.storage.removeItem(name);
            resolve();
          });
        };
        LocalStorageBackend2.prototype.clear = function() {
          var _this = this;
          return new Promise(function(resolve, reject) {
            _this.storage.clear();
            resolve();
          });
        };
        LocalStorageBackend2.prototype.setItem = function(name, value) {
          var _this = this;
          return new Promise(function(resolve, reject) {
            _this.storage.setItem(name, value);
            resolve();
          });
        };
        return LocalStorageBackend2;
      }(StorageBackend)
    );
    exports.LocalStorageBackend = LocalStorageBackend;
  }
});

// node_modules/@openid/appauth/built/redirect_based_handler.js
var require_redirect_based_handler = __commonJS({
  "node_modules/@openid/appauth/built/redirect_based_handler.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    }();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RedirectRequestHandler = void 0;
    var authorization_request_1 = require_authorization_request();
    var authorization_request_handler_1 = require_authorization_request_handler();
    var authorization_response_1 = require_authorization_response();
    var crypto_utils_1 = require_crypto_utils();
    var logger_1 = require_logger();
    var query_string_utils_1 = require_query_string_utils();
    var storage_1 = require_storage();
    var authorizationRequestKey = function(handle) {
      return "".concat(handle, "_appauth_authorization_request");
    };
    var authorizationServiceConfigurationKey = function(handle) {
      return "".concat(handle, "_appauth_authorization_service_configuration");
    };
    var AUTHORIZATION_REQUEST_HANDLE_KEY = "appauth_current_authorization_request";
    var RedirectRequestHandler2 = (
      /** @class */
      function(_super) {
        __extends(RedirectRequestHandler3, _super);
        function RedirectRequestHandler3(storageBackend, utils, locationLike, crypto2) {
          if (storageBackend === void 0) {
            storageBackend = new storage_1.LocalStorageBackend();
          }
          if (utils === void 0) {
            utils = new query_string_utils_1.BasicQueryStringUtils();
          }
          if (locationLike === void 0) {
            locationLike = window.location;
          }
          if (crypto2 === void 0) {
            crypto2 = new crypto_utils_1.DefaultCrypto();
          }
          var _this = _super.call(this, utils, crypto2) || this;
          _this.storageBackend = storageBackend;
          _this.locationLike = locationLike;
          return _this;
        }
        RedirectRequestHandler3.prototype.performAuthorizationRequest = function(configuration, request) {
          var _this = this;
          var handle = this.crypto.generateRandom(10);
          var persisted = Promise.all([
            this.storageBackend.setItem(AUTHORIZATION_REQUEST_HANDLE_KEY, handle),
            // Calling toJson() adds in the code & challenge when possible
            request.toJson().then(function(result) {
              return _this.storageBackend.setItem(authorizationRequestKey(handle), JSON.stringify(result));
            }),
            this.storageBackend.setItem(authorizationServiceConfigurationKey(handle), JSON.stringify(configuration.toJson()))
          ]);
          persisted.then(function() {
            var url = _this.buildRequestUrl(configuration, request);
            (0, logger_1.log)("Making a request to ", request, url);
            _this.locationLike.assign(url);
          });
        };
        RedirectRequestHandler3.prototype.completeAuthorizationRequest = function() {
          var _this = this;
          return this.storageBackend.getItem(AUTHORIZATION_REQUEST_HANDLE_KEY).then(function(handle) {
            if (handle) {
              return _this.storageBackend.getItem(authorizationRequestKey(handle)).then(function(result) {
                return JSON.parse(result);
              }).then(function(json) {
                return new authorization_request_1.AuthorizationRequest(json);
              }).then(function(request) {
                var currentUri = "".concat(_this.locationLike.origin).concat(_this.locationLike.pathname);
                var queryParams = _this.utils.parse(
                  _this.locationLike,
                  true
                  /* use hash */
                );
                var state = queryParams["state"];
                var code = queryParams["code"];
                var error = queryParams["error"];
                (0, logger_1.log)("Potential authorization request ", currentUri, queryParams, state, code, error);
                var shouldNotify = state === request.state;
                var authorizationResponse = null;
                var authorizationError = null;
                if (shouldNotify) {
                  if (error) {
                    var errorUri = queryParams["error_uri"];
                    var errorDescription = queryParams["error_description"];
                    authorizationError = new authorization_response_1.AuthorizationError({
                      error,
                      error_description: errorDescription,
                      error_uri: errorUri,
                      state
                    });
                  } else {
                    authorizationResponse = new authorization_response_1.AuthorizationResponse({ code, state });
                  }
                  return Promise.all([
                    _this.storageBackend.removeItem(AUTHORIZATION_REQUEST_HANDLE_KEY),
                    _this.storageBackend.removeItem(authorizationRequestKey(handle)),
                    _this.storageBackend.removeItem(authorizationServiceConfigurationKey(handle))
                  ]).then(function() {
                    (0, logger_1.log)("Delivering authorization response");
                    return {
                      request,
                      response: authorizationResponse,
                      error: authorizationError
                    };
                  });
                } else {
                  (0, logger_1.log)("Mismatched request (state and request_uri) dont match.");
                  return Promise.resolve(null);
                }
              });
            } else {
              return null;
            }
          });
        };
        return RedirectRequestHandler3;
      }(authorization_request_handler_1.AuthorizationRequestHandler)
    );
    exports.RedirectRequestHandler = RedirectRequestHandler2;
  }
});

// node_modules/@openid/appauth/built/revoke_token_request.js
var require_revoke_token_request = __commonJS({
  "node_modules/@openid/appauth/built/revoke_token_request.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RevokeTokenRequest = void 0;
    var RevokeTokenRequest = (
      /** @class */
      function() {
        function RevokeTokenRequest2(request) {
          this.token = request.token;
          this.tokenTypeHint = request.token_type_hint;
          this.clientId = request.client_id;
          this.clientSecret = request.client_secret;
        }
        RevokeTokenRequest2.prototype.toJson = function() {
          var json = { token: this.token };
          if (this.tokenTypeHint) {
            json["token_type_hint"] = this.tokenTypeHint;
          }
          if (this.clientId) {
            json["client_id"] = this.clientId;
          }
          if (this.clientSecret) {
            json["client_secret"] = this.clientSecret;
          }
          return json;
        };
        RevokeTokenRequest2.prototype.toStringMap = function() {
          var json = this.toJson();
          return json;
        };
        return RevokeTokenRequest2;
      }()
    );
    exports.RevokeTokenRequest = RevokeTokenRequest;
  }
});

// node_modules/@openid/appauth/built/token_request.js
var require_token_request = __commonJS({
  "node_modules/@openid/appauth/built/token_request.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TokenRequest = exports.GRANT_TYPE_REFRESH_TOKEN = exports.GRANT_TYPE_AUTHORIZATION_CODE = void 0;
    exports.GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";
    exports.GRANT_TYPE_REFRESH_TOKEN = "refresh_token";
    var TokenRequest3 = (
      /** @class */
      function() {
        function TokenRequest4(request) {
          this.clientId = request.client_id;
          this.redirectUri = request.redirect_uri;
          this.grantType = request.grant_type;
          this.code = request.code;
          this.refreshToken = request.refresh_token;
          this.extras = request.extras;
        }
        TokenRequest4.prototype.toJson = function() {
          return {
            grant_type: this.grantType,
            code: this.code,
            refresh_token: this.refreshToken,
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            extras: this.extras
          };
        };
        TokenRequest4.prototype.toStringMap = function() {
          var map = {
            grant_type: this.grantType,
            client_id: this.clientId,
            redirect_uri: this.redirectUri
          };
          if (this.code) {
            map["code"] = this.code;
          }
          if (this.refreshToken) {
            map["refresh_token"] = this.refreshToken;
          }
          if (this.extras) {
            for (var extra in this.extras) {
              if (this.extras.hasOwnProperty(extra) && !map.hasOwnProperty(extra)) {
                map[extra] = this.extras[extra];
              }
            }
          }
          return map;
        };
        return TokenRequest4;
      }()
    );
    exports.TokenRequest = TokenRequest3;
  }
});

// node_modules/@openid/appauth/built/token_response.js
var require_token_response = __commonJS({
  "node_modules/@openid/appauth/built/token_response.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TokenError = exports.TokenResponse = exports.nowInSeconds = void 0;
    var AUTH_EXPIRY_BUFFER = 10 * 60 * -1;
    var nowInSeconds = function() {
      return Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
    };
    exports.nowInSeconds = nowInSeconds;
    var TokenResponse = (
      /** @class */
      function() {
        function TokenResponse2(response) {
          this.accessToken = response.access_token;
          this.tokenType = response.token_type || "bearer";
          if (response.expires_in) {
            this.expiresIn = parseInt(response.expires_in, 10);
          }
          this.refreshToken = response.refresh_token;
          this.scope = response.scope;
          this.idToken = response.id_token;
          this.issuedAt = response.issued_at || (0, exports.nowInSeconds)();
        }
        TokenResponse2.prototype.toJson = function() {
          var _a;
          return {
            access_token: this.accessToken,
            id_token: this.idToken,
            refresh_token: this.refreshToken,
            scope: this.scope,
            token_type: this.tokenType,
            issued_at: this.issuedAt,
            expires_in: (_a = this.expiresIn) === null || _a === void 0 ? void 0 : _a.toString()
          };
        };
        TokenResponse2.prototype.isValid = function(buffer) {
          if (buffer === void 0) {
            buffer = AUTH_EXPIRY_BUFFER;
          }
          if (this.expiresIn) {
            var now = (0, exports.nowInSeconds)();
            return now < this.issuedAt + this.expiresIn + buffer;
          } else {
            return true;
          }
        };
        return TokenResponse2;
      }()
    );
    exports.TokenResponse = TokenResponse;
    var TokenError = (
      /** @class */
      function() {
        function TokenError2(tokenError) {
          this.error = tokenError.error;
          this.errorDescription = tokenError.error_description;
          this.errorUri = tokenError.error_uri;
        }
        TokenError2.prototype.toJson = function() {
          return {
            error: this.error,
            error_description: this.errorDescription,
            error_uri: this.errorUri
          };
        };
        return TokenError2;
      }()
    );
    exports.TokenError = TokenError;
  }
});

// node_modules/@openid/appauth/built/token_request_handler.js
var require_token_request_handler = __commonJS({
  "node_modules/@openid/appauth/built/token_request_handler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BaseTokenRequestHandler = void 0;
    var errors_1 = require_errors();
    var query_string_utils_1 = require_query_string_utils();
    var token_response_1 = require_token_response();
    var xhr_1 = require_xhr();
    var BaseTokenRequestHandler3 = (
      /** @class */
      function() {
        function BaseTokenRequestHandler4(requestor2, utils) {
          if (requestor2 === void 0) {
            requestor2 = new xhr_1.JQueryRequestor();
          }
          if (utils === void 0) {
            utils = new query_string_utils_1.BasicQueryStringUtils();
          }
          this.requestor = requestor2;
          this.utils = utils;
        }
        BaseTokenRequestHandler4.prototype.isTokenResponse = function(response) {
          return response.error === void 0;
        };
        BaseTokenRequestHandler4.prototype.performRevokeTokenRequest = function(configuration, request) {
          var revokeTokenResponse = this.requestor.xhr({
            url: configuration.revocationEndpoint,
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: this.utils.stringify(request.toStringMap())
          });
          return revokeTokenResponse.then(function(response) {
            return true;
          });
        };
        BaseTokenRequestHandler4.prototype.performTokenRequest = function(configuration, request) {
          var _this = this;
          var tokenResponse = this.requestor.xhr({
            url: configuration.tokenEndpoint,
            method: "POST",
            dataType: "json",
            // adding implicit dataType
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: this.utils.stringify(request.toStringMap())
          });
          return tokenResponse.then(function(response) {
            if (_this.isTokenResponse(response)) {
              return new token_response_1.TokenResponse(response);
            } else {
              return Promise.reject(new errors_1.AppAuthError(response.error, new token_response_1.TokenError(response)));
            }
          });
        };
        return BaseTokenRequestHandler4;
      }()
    );
    exports.BaseTokenRequestHandler = BaseTokenRequestHandler3;
  }
});

// node_modules/@openid/appauth/built/types.js
var require_types = __commonJS({
  "node_modules/@openid/appauth/built/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@openid/appauth/built/index.js
var require_built = __commonJS({
  "node_modules/@openid/appauth/built/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_authorization_request(), exports);
    __exportStar(require_authorization_request_handler(), exports);
    __exportStar(require_authorization_response(), exports);
    __exportStar(require_authorization_service_configuration(), exports);
    __exportStar(require_crypto_utils(), exports);
    __exportStar(require_errors(), exports);
    __exportStar(require_flags(), exports);
    __exportStar(require_logger(), exports);
    __exportStar(require_query_string_utils(), exports);
    __exportStar(require_redirect_based_handler(), exports);
    __exportStar(require_revoke_token_request(), exports);
    __exportStar(require_storage(), exports);
    __exportStar(require_token_request(), exports);
    __exportStar(require_token_request_handler(), exports);
    __exportStar(require_token_response(), exports);
    __exportStar(require_types(), exports);
    __exportStar(require_xhr(), exports);
  }
});

// html/oidc/core.js
function buildRedirectUri() {
  const pathname = window.location.pathname.replace(/\/+/g, "/");
  return window.location.origin + pathname;
}
function generateNonce() {
  return crypto.getRandomValues(new Uint8Array(32)).toBase64({
    alphabet: "base64url",
    omitPadding: true
  });
}
function decodeJwtPayload(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  try {
    const bytes = Uint8Array.fromBase64(parts[1], { alphabet: "base64url" });
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("JWT payload is not valid base64-encoded JSON");
  }
}
async function prepareAuthRequest(config, clientId, redirectUri) {
  const nonce = generateNonce();
  const request = new import_appauth.AuthorizationRequest({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid email offline_access",
    response_type: import_appauth.AuthorizationRequest.RESPONSE_TYPE_CODE,
    extras: { nonce }
  });
  const url = await Promise.race([
    new Promise((resolve) => {
      const noopStorage = {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
        clear: () => Promise.resolve()
      };
      const captureLocation = { assign: resolve, hash: "", href: "", origin: "" };
      new import_appauth.RedirectRequestHandler(noopStorage, void 0, captureLocation).performAuthorizationRequest(config, request);
    }),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("AppAuth-JS did not produce an authorization URL")),
      5e3
    ))
  ]);
  return {
    state: request.state,
    codeVerifier: request.internal.code_verifier,
    url,
    nonce
  };
}
async function buildAuthSession(host, port, issuer, clientId) {
  const config = await import_appauth.AuthorizationServiceConfiguration.fetchFromIssuer(issuer, requestor);
  const redirectUri = buildRedirectUri();
  const { state, codeVerifier, url, nonce } = await prepareAuthRequest(config, clientId, redirectUri);
  const session = {
    host,
    port,
    clientId,
    issuer,
    state,
    nonce,
    codeVerifier,
    redirectUri,
    configJson: config.toJson()
  };
  return { authUrl: url, session };
}
function readCallbackParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    code: urlParams.get("code"),
    state: urlParams.get("state"),
    error: urlParams.get("error"),
    errorDescription: urlParams.get("error_description")
  };
}
async function exchangeAuthCode(session, code) {
  const config = new import_appauth.AuthorizationServiceConfiguration(session.configJson);
  const tokenRequest = new import_appauth.TokenRequest({
    client_id: session.clientId,
    redirect_uri: session.redirectUri,
    grant_type: import_appauth.GRANT_TYPE_AUTHORIZATION_CODE,
    code,
    extras: { code_verifier: session.codeVerifier }
  });
  const tokenHandler = new import_appauth.BaseTokenRequestHandler(requestor);
  const tokens = await tokenHandler.performTokenRequest(config, tokenRequest);
  if (!tokens.idToken) throw new Error("IdP did not return an ID token");
  const payload = decodeJwtPayload(tokens.idToken);
  if (payload.nonce !== session.nonce) throw new Error("ID token nonce mismatch");
  const exp = tokens.issuedAt + (tokens.expiresIn ?? 0);
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken ?? null,
    host: session.host,
    port: parseInt(session.port, 10),
    exp,
    clientId: session.clientId,
    issuer: session.issuer,
    providerMetadata: {
      tokenEndpoint: config.tokenEndpoint,
      authorizationEndpoint: config.authorizationEndpoint
    }
  };
}
var import_appauth, OIDC_SESSION_KEY, requestor;
var init_core = __esm({
  "html/oidc/core.js"() {
    import_appauth = __toESM(require_built(), 1);
    OIDC_SESSION_KEY = "kyber_oidc";
    requestor = new import_appauth.FetchRequestor();
  }
});

// html/oidc/renewal.js
import { AuthCredentials as AuthCredentials2 } from "./kyclient_wasm.js";
async function refreshOidcToken(clientId, refreshToken, providerMetadata) {
  const config = new import_appauth2.AuthorizationServiceConfiguration({
    authorization_endpoint: providerMetadata.authorizationEndpoint,
    token_endpoint: providerMetadata.tokenEndpoint
  });
  const tokenRequest = new import_appauth2.TokenRequest({
    client_id: clientId,
    grant_type: import_appauth2.GRANT_TYPE_REFRESH_TOKEN,
    refresh_token: refreshToken
  });
  const handler = new import_appauth2.BaseTokenRequestHandler(requestor);
  const tokens = await handler.performTokenRequest(config, tokenRequest);
  const exp = tokens.issuedAt + (tokens.expiresIn ?? 0);
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken ?? null,
    refreshToken: tokens.refreshToken ?? refreshToken,
    exp
  };
}
async function tryRefreshWithRetry(context) {
  const totalAttempts = RETRY_DELAYS_SEC.length + 1;
  for (const [attempt, delay] of [...RETRY_DELAYS_SEC, null].entries()) {
    try {
      return await refreshOidcToken(
        context.clientId,
        context.refreshToken,
        context.providerMetadata
      );
    } catch (err) {
      if (delay !== null) {
        console.warn(`OIDC token refresh failed (attempt ${attempt + 1}/${totalAttempts}), retrying in ${delay}s:`, err);
        await new Promise((resolve) => setTimeout(resolve, delay * 1e3));
      } else {
        console.error("OIDC token refresh failed after all retries, stopping renewal:", err);
        return null;
      }
    }
  }
}
async function applyFreshToken(context, client2, accessToken) {
  client2.update_credentials(AuthCredentials2.oidc(accessToken));
  const hostPart = context.host.includes(":") && !context.host.startsWith("[") ? `[${context.host}]` : context.host;
  const resp = await fetch(
    `https://${hostPart}:${context.port}/session/renew?auth=oidc`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
      signal: AbortSignal.timeout(RENEW_TIMEOUT_MS)
    }
  );
  return { ok: resp.ok, status: resp.status };
}
function scheduleTokenRenewal(context, client2, onExhausted) {
  if (!context.refreshToken) {
    console.warn("No refresh token available, token renewal disabled");
    return null;
  }
  function scheduleNext() {
    const nowSec = Math.floor(Date.now() / 1e3);
    const delaySec = Math.max(context.exp - nowSec - 60, 5);
    console.log(`OIDC token renewal scheduled in ${delaySec}s`);
    return setTimeout(async () => {
      const refreshed = await tryRefreshWithRetry(context);
      if (!refreshed) {
        context.timerId = null;
        onExhausted?.();
        return;
      }
      context.accessToken = refreshed.accessToken;
      context.refreshToken = refreshed.refreshToken;
      context.exp = refreshed.exp;
      try {
        const stored = sessionStorage.getItem(OIDC_SESSION_KEY);
        if (stored) {
          const session = JSON.parse(stored);
          session.refreshToken = refreshed.refreshToken;
          sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(session));
        }
      } catch (err) {
        console.error("OIDC session persistence failed:", err);
      }
      try {
        const { ok, status } = await applyFreshToken(context, client2, refreshed.accessToken);
        if (!ok) {
          console.warn(`Session renewal failed (${status}), credentials updated for next reconnect`);
        }
      } catch (err) {
        console.error("OIDC session renewal failed:", err);
      }
      context.timerId = scheduleNext();
    }, delaySec * 1e3);
  }
  context.timerId = scheduleNext();
  return context;
}
function stopTokenRenewal(context) {
  if (context?.timerId) {
    clearTimeout(context.timerId);
    context.timerId = null;
  }
}
var import_appauth2, RETRY_DELAYS_SEC, RENEW_TIMEOUT_MS;
var init_renewal = __esm({
  "html/oidc/renewal.js"() {
    import_appauth2 = __toESM(require_built(), 1);
    init_core();
    RETRY_DELAYS_SEC = [30, 60, 120];
    RENEW_TIMEOUT_MS = 1e4;
  }
});

// html/oidc/popup.js
function popupWindowFeatures() {
  const w = Math.min(Math.max(500, Math.floor(screen.availWidth * 0.4)), 800);
  const h = Math.min(Math.max(700, Math.floor(screen.availHeight * 0.7)), 900);
  const left = Math.max(0, Math.floor((screen.availWidth - w) / 2));
  const top = Math.max(0, Math.floor((screen.availHeight - h) / 2));
  return `width=${w},height=${h},left=${left},top=${top}`;
}
async function startOidcFlowPopup(host, port, issuer, clientId, preOpenedPopup = null) {
  let popup = preOpenedPopup;
  if (!popup) {
    popup = window.open("about:blank", "kyber_oidc_login", popupWindowFeatures());
    if (!popup) {
      throw new Error("Popup blocked, allow popups for this site");
    }
  }
  try {
    const { authUrl, session } = await buildAuthSession(host, port, issuer, clientId);
    return await runPopupFlow(authUrl, session, popup);
  } catch (err) {
    if (!popup.closed) popup.close();
    throw err;
  }
}
function runPopupFlow(authUrl, session, popup) {
  localStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(session));
  popup.location.href = authUrl;
  const resultKey = `${OIDC_RESULT_KEY}_${session.state}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      try {
        if (!popup.closed) popup.close();
      } catch {
      }
    }
    function handleResult(data) {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    }
    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (!event.data) return;
      if (event.data.type !== "oidc_result") return;
      if (event.data.state !== session.state) return;
      handleResult(event.data);
    }
    function onStorage(event) {
      if (event.key !== resultKey || event.newValue === null) return;
      localStorage.removeItem(resultKey);
      try {
        handleResult(JSON.parse(event.newValue));
      } catch (err) {
        cleanup();
        reject(new Error(`Corrupt OIDC result: ${err.message}`));
      }
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    timeoutId = setTimeout(() => {
      cleanup();
      localStorage.removeItem(OIDC_SESSION_KEY);
      reject(new Error("OIDC login timed out"));
    }, POPUP_LOGIN_TIMEOUT_MS);
  });
}
async function handleOidcCallback() {
  const { code, state: returnedState, error, errorDescription } = readCallbackParams();
  if (!code && !error) return null;
  const stored = localStorage.getItem(OIDC_SESSION_KEY);
  if (!stored) {
    window.close();
    return null;
  }
  const session = JSON.parse(stored);
  if (returnedState !== session.state) {
    window.close();
    return null;
  }
  localStorage.removeItem(OIDC_SESSION_KEY);
  const postBack = (payload) => {
    const message = { type: "oidc_result", state: session.state, ...payload };
    if (window.opener) {
      window.opener.postMessage(message, window.location.origin);
    } else {
      const resultKey = `${OIDC_RESULT_KEY}_${session.state}`;
      localStorage.setItem(resultKey, JSON.stringify({ ...payload, ts: Date.now() }));
    }
    window.close();
  };
  if (error) {
    postBack({ error: `IdP denied login: ${errorDescription ?? error}` });
    return null;
  }
  try {
    const result = await exchangeAuthCode(session, code);
    postBack({ result });
  } catch (err) {
    postBack({ error: err.message });
  }
  return null;
}
function purgeStaleOidcResults() {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(`${OIDC_RESULT_KEY}_`)) continue;
    try {
      const { ts } = JSON.parse(localStorage.getItem(key));
      if (typeof ts !== "number" || now - ts > RESULT_TTL_MS) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}
var OIDC_RESULT_KEY, POPUP_LOGIN_TIMEOUT_MS, RESULT_TTL_MS;
var init_popup = __esm({
  "html/oidc/popup.js"() {
    init_core();
    OIDC_RESULT_KEY = "kyber_oidc_result";
    POPUP_LOGIN_TIMEOUT_MS = 2 * 60 * 1e3;
    RESULT_TTL_MS = 5 * 60 * 1e3;
  }
});

// html/oidc/redirect.js
async function startOidcFlow(host, port, issuer, clientId) {
  const { authUrl, session } = await buildAuthSession(host, port, issuer, clientId);
  sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify({
    ...session,
    urlSearch: window.location.search
  }));
  window.location.href = authUrl;
}
function stripOidcParamsFromUrl() {
  const url = new URL(window.location.href);
  for (const k of ["code", "state", "error", "error_description", "session_state", "iss"]) {
    url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
function restoreUrlSearch(session) {
  if (typeof session.urlSearch !== "string") {
    stripOidcParamsFromUrl();
    return;
  }
  window.history.replaceState(null, "", window.location.pathname + session.urlSearch + window.location.hash);
}
async function handleRedirectCallback() {
  const { code, state: returnedState, error, errorDescription } = readCallbackParams();
  if (!code && !error) return null;
  const stored = sessionStorage.getItem(OIDC_SESSION_KEY);
  if (!stored) {
    stripOidcParamsFromUrl();
    return null;
  }
  const session = JSON.parse(stored);
  if (returnedState !== session.state) {
    stripOidcParamsFromUrl();
    return null;
  }
  sessionStorage.removeItem(OIDC_SESSION_KEY);
  restoreUrlSearch(session);
  if (error) throw new Error(`IdP denied login: ${errorDescription || error}`);
  return await exchangeAuthCode(session, code);
}
var init_redirect = __esm({
  "html/oidc/redirect.js"() {
    init_core();
  }
});

// html/oidc/manager.js
var manager_exports = {};
__export(manager_exports, {
  OidcManager: () => OidcManager
});
var OidcManager;
var init_manager = __esm({
  "html/oidc/manager.js"() {
    init_core();
    init_popup();
    init_redirect();
    init_renewal();
    init_script();
    OidcManager = class {
      #updateStatus;
      #updateConfig;
      #getConfigValue;
      #renewalContext = null;
      #flowInProgress = false;
      // Incremented each time the client stops or Connect cancels. Async
      // handlers capture the value at entry; if it changes while they are
      // awaiting, they abort without touching shared state.
      #generation = 0;
      // Cached result for the current session. After the first popup login,
      // subsequent authentication_required events reuse this token instead
      // of opening another popup. Cleared on disconnect.
      #storedResult = null;
      // Popup opened synchronously in the Connect button handler while the
      // user gesture is still active. Consumed once by the
      // authentication_required handler.
      #pendingPopup = null;
      // When Connect cancels a live client, the async stopped event fires
      // shortly after. This flag tells the stopped handler to skip the
      // generation reset so it does not clobber the new connection.
      #suppressNextStopped = false;
      constructor({ updateStatus: updateStatus2, updateConfig: updateConfig2, getConfigValue: getConfigValue2 }) {
        this.#updateStatus = updateStatus2;
        this.#updateConfig = updateConfig2;
        this.#getConfigValue = getConfigValue2;
      }
      purgeStaleResults() {
        purgeStaleOidcResults();
      }
      // Called from the Connect button handler before doConnect runs, regardless
      // of which auth method the user picked. Resets state left over from any
      // previous connect (OIDC or not) and asks script.cancelAndDisconnect to
      // tear down the live client without the stopped event triggering OIDC
      // cleanup on the new generation.
      cancelInFlight() {
        this.#generation++;
        this.#flowInProgress = false;
        this.#storedResult = null;
        this.#stopRenewal();
        this.#closePendingPopup();
        if (isClientActive()) {
          this.#suppressNextStopped = true;
          cancelAndDisconnect();
        }
      }
      // Called only when the active auth method is OIDC, after cancelInFlight.
      // Pre-opens the popup synchronously while the user gesture is still active
      // and primes Chrome's sticky-activation flag for AudioContext. Returns
      // false if the popup was blocked (caller should not proceed with doConnect).
      prepareOidcConnect() {
        new AudioContext().close();
        if (!this.#getConfigValue("oidc_popup")) return true;
        const popup = window.open("about:blank", "kyber_oidc_login", popupWindowFeatures());
        if (!popup) {
          this.#updateStatus("Popup blocked. Allow popups for this site.");
          return false;
        }
        try {
          popup.document.write("<!DOCTYPE html><html><head><title>Authenticating...</title></head><body style='font-family:sans-serif;padding:2em'><p>Connecting to identity provider...</p><script>sessionStorage.setItem('kyber_oidc_popup','1');<\/script></body></html>");
          popup.document.close();
        } catch {
        }
        this.#pendingPopup = popup;
        return true;
      }
      onConnectFailed() {
        this.#closePendingPopup();
      }
      onDisconnect() {
        this.#stopRenewal();
      }
      async onAuthenticationRequired(event, uiClientListener2) {
        if (this.#flowInProgress) return;
        if (this.#storedResult) {
          this.#stopRenewal();
          const client2 = updateCredentials({ type: "oidc", token: this.#storedResult.accessToken });
          if (client2) this.#renewalContext = scheduleTokenRenewal(this.#storedResult, client2, () => this.#onRenewalExhausted());
          return;
        }
        this.#stopRenewal();
        this.#flowInProgress = true;
        const gen = this.#generation;
        const popup = this.#pendingPopup;
        this.#pendingPopup = null;
        const usePopup = this.#getConfigValue("oidc_popup");
        let result = null;
        try {
          result = usePopup ? await startOidcFlowPopup(
            this.#getConfigValue("host"),
            this.#getConfigValue("port"),
            event.issuer,
            event.clientId,
            popup
          ) : await startOidcFlow(
            this.#getConfigValue("host"),
            this.#getConfigValue("port"),
            event.issuer,
            event.clientId
          );
        } catch (err) {
          console.error("OIDC flow failed:", err);
          this.#updateStatus("OIDC error: " + err.message);
          if (gen === this.#generation) {
            this.#flowInProgress = false;
            await doDisconnect();
          }
          return;
        }
        if (gen !== this.#generation) return;
        if (!result) {
          this.#flowInProgress = false;
          return;
        }
        await this.#completeLogin(result, uiClientListener2, gen);
      }
      async #completeLogin(result, uiClientListener2, gen) {
        this.#stopRenewal();
        this.#persistRefreshToken(result);
        this.#storedResult = result;
        this.#updateStatus("Logged in");
        try {
          await this.#updateConfig();
          const credentials = { type: "oidc", token: result.accessToken };
          const client2 = updateCredentials(credentials);
          if (client2) {
            this.#renewalContext = scheduleTokenRenewal(result, client2, () => this.#onRenewalExhausted());
          } else {
            const connected = await doConnect(uiClientListener2, result.host, result.port, credentials);
            if (connected) this.#renewalContext = scheduleTokenRenewal(result, connected, () => this.#onRenewalExhausted());
          }
        } finally {
          if (gen === this.#generation) this.#flowInProgress = false;
        }
      }
      #onRenewalExhausted() {
        this.#updateStatus("OIDC token refresh failed; reconnect to re-authenticate");
      }
      onReconnectionFailed() {
        this.#stopRenewal();
        this.#flowInProgress = false;
        this.#generation++;
      }
      onStreamingStartFailed() {
        this.#stopRenewal();
      }
      onClientStopped(reason) {
        if (reason !== "requested" && reason !== "decode_error") return;
        if (this.#suppressNextStopped) {
          this.#suppressNextStopped = false;
          return;
        }
        this.#closePendingPopup();
        this.#stopRenewal();
        this.#storedResult = null;
        this.#flowInProgress = false;
        this.#generation++;
      }
      // Called from the page load handler when ?code= or ?error= is in the URL.
      // Returns one of:
      //   { kind: "popup" }                   - popup is closing, ui should return
      //   { kind: "popup-error", err }        - popup callback threw, ui should render error
      //   { kind: "redirect", result }        - redirect callback returned a result, ui should build sidebar
      //   { kind: "redirect-error", err }     - redirect callback threw, ui should show error
      //   { kind: "stale" }                   - not a recognized callback, continue normal init
      async handleCallback() {
        const inPopup = window.opener !== null || window.name === "kyber_oidc_login" || sessionStorage.getItem("kyber_oidc_popup") === "1";
        if (inPopup) {
          try {
            await handleOidcCallback();
            return { kind: "popup" };
          } catch (err) {
            return { kind: "popup-error", err };
          }
        }
        try {
          const result = await handleRedirectCallback();
          if (result) return { kind: "redirect", result };
          return { kind: "stale" };
        } catch (err) {
          return { kind: "redirect-error", err };
        }
      }
      // Called from the page bootstrap when handleCallback returned a redirect
      // result. Persists the refresh token, caches the result, and connects.
      // Runs inside a click-to-start gesture provided by the caller.
      async finalizeRedirectLogin(result, uiClientListener2) {
        const gen = this.#generation;
        await this.#completeLogin(result, uiClientListener2, gen);
      }
      #stopRenewal() {
        if (this.#renewalContext) stopTokenRenewal(this.#renewalContext);
        this.#renewalContext = null;
      }
      #closePendingPopup() {
        if (this.#pendingPopup) {
          try {
            this.#pendingPopup.close();
          } catch {
          }
          this.#pendingPopup = null;
        }
      }
      #persistRefreshToken(result) {
        if (!result.refreshToken) return;
        sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify({
          host: result.host,
          port: result.port,
          clientId: result.clientId,
          issuer: result.issuer,
          refreshToken: result.refreshToken,
          providerMetadata: result.providerMetadata
        }));
      }
    };
  }
});

// html/ui.js
init_script();
init_metrics_structure();
init_live_graph();

// html/handoff.js
init_script();
init_renewal();

// node_modules/valibot/dist/index.mjs
var store$4;
var DEFAULT_CONFIG = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function getGlobalConfig(config$1) {
  if (!config$1 && !store$4) return DEFAULT_CONFIG;
  return {
    lang: config$1?.lang ?? store$4?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$4?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$4?.abortPipeEarly
  };
}
var store$3;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage(lang) {
  return store$3?.get(lang);
}
var store$2;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage(lang) {
  return store$2?.get(lang);
}
var store$1;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage(reference, lang) {
  return store$1?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
// @__NO_SIDE_EFFECTS__
function _isSameValueZero(value1, value2) {
  return value1 === value2 || Number.isNaN(value1) && Number.isNaN(value2);
}
// @__NO_SIDE_EFFECTS__
function _joinExpects(values$1, separator) {
  const list = [...new Set(values$1)];
  if (list.length > 1) return `(${list.join(` ${separator} `)})`;
  return list[0] ?? "never";
}
function _standardSchema(schema) {
  schema["~standard"] = {
    version: 1,
    vendor: "valibot",
    validate: (value$1) => schema["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig())
  };
  return schema;
}
// @__NO_SIDE_EFFECTS__
function getDotPath(issue) {
  if (issue.path) {
    let key = "";
    for (const item of issue.path) if (typeof item.key === "string" || typeof item.key === "number") if (key) key += `.${item.key}`;
    else key += item.key;
    else return null;
    return key;
  }
  return null;
}
// @__NO_SIDE_EFFECTS__
function check(requirement, message$1) {
  return {
    kind: "validation",
    type: "check",
    reference: check,
    async: false,
    expects: null,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !this.requirement(dataset.value)) _addIssue(this, "input", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function gtValue(requirement, message$1) {
  return {
    kind: "validation",
    type: "gt_value",
    reference: gtValue,
    async: false,
    expects: `>${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !(dataset.value > this.requirement)) _addIssue(this, "value", dataset, config$1, { received: dataset.value instanceof Date ? dataset.value.toJSON() : /* @__PURE__ */ _stringify(dataset.value) });
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function integer(message$1) {
  return {
    kind: "validation",
    type: "integer",
    reference: integer,
    async: false,
    expects: null,
    requirement: Number.isInteger,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !this.requirement(dataset.value)) _addIssue(this, "integer", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function maxValue(requirement, message$1) {
  return {
    kind: "validation",
    type: "max_value",
    reference: maxValue,
    async: false,
    expects: `<=${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !(dataset.value <= this.requirement)) _addIssue(this, "value", dataset, config$1, { received: dataset.value instanceof Date ? dataset.value.toJSON() : /* @__PURE__ */ _stringify(dataset.value) });
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function minValue(requirement, message$1) {
  return {
    kind: "validation",
    type: "min_value",
    reference: minValue,
    async: false,
    expects: `>=${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !(dataset.value >= this.requirement)) _addIssue(this, "value", dataset, config$1, { received: dataset.value instanceof Date ? dataset.value.toJSON() : /* @__PURE__ */ _stringify(dataset.value) });
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function nonEmpty(message$1) {
  return {
    kind: "validation",
    type: "non_empty",
    reference: nonEmpty,
    async: false,
    expects: "!0",
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && dataset.value.length === 0) _addIssue(this, "length", dataset, config$1, { received: "0" });
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function regex(requirement, message$1) {
  return {
    kind: "validation",
    type: "regex",
    reference: regex,
    async: false,
    expects: `${requirement}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !this.requirement.test(dataset.value)) _addIssue(this, "format", dataset, config$1);
      return dataset;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function transform(operation) {
  return {
    kind: "transformation",
    type: "transform",
    reference: transform,
    async: false,
    operation,
    "~run"(dataset) {
      dataset.value = this.operation(dataset.value);
      return dataset;
    }
  };
}
var ABORT_EARLY_CONFIG = { abortEarly: true };
// @__NO_SIDE_EFFECTS__
function getFallback(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function getDefault(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function _merge(value1, value2) {
  if (typeof value1 === typeof value2) {
    if (/* @__PURE__ */ _isSameValueZero(value1, value2) || value1 instanceof Date && value2 instanceof Date && /* @__PURE__ */ _isSameValueZero(+value1, +value2)) return { value: value1 };
    if (value1 && value2 && value1.constructor === Object && value2.constructor === Object) {
      const nextValue = {
        ...value1,
        ...value2
      };
      for (const key in value2) if (Object.prototype.hasOwnProperty.call(value1, key) && Object.prototype.hasOwnProperty.call(value2, key)) {
        const dataset = /* @__PURE__ */ _merge(value1[key], value2[key]);
        if (dataset.issue) return dataset;
        nextValue[key] = dataset.value;
      }
      return { value: nextValue };
    }
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length === value2.length) {
        const nextValue = [...value1];
        for (let index = 0; index < value1.length; index++) {
          const dataset = /* @__PURE__ */ _merge(value1[index], value2[index]);
          if (dataset.issue) return dataset;
          nextValue[index] = dataset.value;
        }
        return { value: nextValue };
      }
    }
  }
  return { issue: true };
}
// @__NO_SIDE_EFFECTS__
function intersect(options, message$1) {
  return _standardSchema({
    kind: "schema",
    type: "intersect",
    reference: intersect,
    expects: /* @__PURE__ */ _joinExpects(options.map((option) => option.expects), "&"),
    async: false,
    options,
    message: message$1,
    "~run"(dataset, config$1) {
      if (this.options.length) {
        const input = dataset.value;
        let outputs;
        dataset.typed = true;
        for (const schema of this.options) {
          const optionDataset = schema["~run"]({ value: input }, config$1);
          if (optionDataset.issues) {
            if (dataset.issues) for (const issue of optionDataset.issues) dataset.issues.push(issue);
            else dataset.issues = optionDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!optionDataset.typed) dataset.typed = false;
          if (dataset.typed) if (outputs) outputs.push(optionDataset.value);
          else outputs = [optionDataset.value];
        }
        if (dataset.typed) {
          dataset.value = outputs[0];
          for (let index = 1; index < outputs.length; index++) {
            const mergeDataset = /* @__PURE__ */ _merge(dataset.value, outputs[index]);
            if (mergeDataset.issue) {
              _addIssue(this, "type", dataset, config$1, { received: "unknown" });
              break;
            }
            dataset.value = mergeDataset.value;
          }
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function literal(literal_, message$1) {
  return _standardSchema({
    kind: "schema",
    type: "literal",
    reference: literal,
    expects: /* @__PURE__ */ _stringify(literal_),
    async: false,
    literal: literal_,
    message: message$1,
    "~run"(dataset, config$1) {
      if (/* @__PURE__ */ _isSameValueZero(dataset.value, this.literal)) dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function number(message$1) {
  return _standardSchema({
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message: message$1,
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function object(entries$1, message$1) {
  return _standardSchema({
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function optional(wrapped, default_) {
  return _standardSchema({
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) {
        if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  });
}
// @__NO_SIDE_EFFECTS__
function string(message$1) {
  return _standardSchema({
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message$1,
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function tupleWithRest(items, rest, message$1) {
  return _standardSchema({
    kind: "schema",
    type: "tuple_with_rest",
    reference: tupleWithRest,
    expects: "Array",
    async: false,
    items,
    rest,
    message: message$1,
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < this.items.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.items[key]["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
        if (!dataset.issues || !config$1.abortEarly) for (let key = this.items.length; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.rest["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function undefined_(message$1) {
  return _standardSchema({
    kind: "schema",
    type: "undefined",
    reference: undefined_,
    expects: "undefined",
    async: false,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.value === void 0) dataset.typed = true;
      else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function unknown() {
  return _standardSchema({
    kind: "schema",
    type: "unknown",
    reference: unknown,
    expects: "unknown",
    async: false,
    "~run"(dataset) {
      dataset.typed = true;
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function variant(key, options, message$1) {
  return _standardSchema({
    kind: "schema",
    type: "variant",
    reference: variant,
    expects: "Object",
    async: false,
    key,
    options,
    message: message$1,
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        let outputDataset;
        let maxDiscriminatorPriority = 0;
        let invalidDiscriminatorKey = this.key;
        let expectedDiscriminators = [];
        const parseOptions = (variant$1, allKeys) => {
          for (const schema of variant$1.options) {
            if (schema.type === "variant") parseOptions(schema, new Set(allKeys).add(schema.key));
            else {
              let keysAreValid = true;
              let currentPriority = 0;
              for (const currentKey of allKeys) {
                const discriminatorSchema = schema.entries[currentKey];
                if (currentKey in input ? discriminatorSchema["~run"]({
                  typed: false,
                  value: input[currentKey]
                }, ABORT_EARLY_CONFIG).issues : discriminatorSchema.type !== "exact_optional" && discriminatorSchema.type !== "optional" && discriminatorSchema.type !== "nullish") {
                  keysAreValid = false;
                  if (invalidDiscriminatorKey !== currentKey && (maxDiscriminatorPriority < currentPriority || maxDiscriminatorPriority === currentPriority && currentKey in input && !(invalidDiscriminatorKey in input))) {
                    maxDiscriminatorPriority = currentPriority;
                    invalidDiscriminatorKey = currentKey;
                    expectedDiscriminators = [];
                  }
                  if (invalidDiscriminatorKey === currentKey) expectedDiscriminators.push(schema.entries[currentKey].expects);
                  break;
                }
                currentPriority++;
              }
              if (keysAreValid) {
                const optionDataset = schema["~run"]({ value: input }, config$1);
                if (!outputDataset || !outputDataset.typed && optionDataset.typed) outputDataset = optionDataset;
              }
            }
            if (outputDataset && !outputDataset.issues) break;
          }
        };
        parseOptions(this, /* @__PURE__ */ new Set([this.key]));
        if (outputDataset) return outputDataset;
        _addIssue(this, "type", dataset, config$1, {
          input: input[invalidDiscriminatorKey],
          expected: /* @__PURE__ */ _joinExpects(expectedDiscriminators, "|"),
          path: [{
            type: "object",
            origin: "value",
            input,
            key: invalidDiscriminatorKey,
            value: input[invalidDiscriminatorKey]
          }]
        });
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function pipe(...pipe$1) {
  return _standardSchema({
    ...pipe$1[0],
    pipe: pipe$1,
    "~run"(dataset, config$1) {
      for (const item of pipe$1) if (item.kind !== "metadata") {
        if (dataset.issues && (item.kind === "schema" || item.kind === "transformation")) {
          dataset.typed = false;
          break;
        }
        if (!dataset.issues || !config$1.abortEarly && !config$1.abortPipeEarly) dataset = item["~run"](dataset, config$1);
      }
      return dataset;
    }
  });
}
// @__NO_SIDE_EFFECTS__
function safeParse(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}
// @__NO_SIDE_EFFECTS__
function summarize(issues) {
  let summary = "";
  for (const issue of issues) {
    if (summary) summary += "\n";
    summary += `\xD7 ${issue.message}`;
    const dotPath = /* @__PURE__ */ getDotPath(issue);
    if (dotPath) summary += `
  \u2192 at ${dotPath}`;
  }
  return summary;
}

// html/handoff_parse.js
var HASH_MAX_LEN = 8192;
var HOST_RE = /^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:.]+\])$/;
var MACHINE_ID_RE = /^[a-zA-Z0-9._-]+$/;
function b64urlDecode(value) {
  const bytes = Uint8Array.fromBase64(value, { alphabet: "base64url" });
  return new TextDecoder().decode(bytes);
}
function parseHandoffFragment(rawHash, origin) {
  if (!rawHash.startsWith("#kyber=")) return null;
  if (rawHash.length > HASH_MAX_LEN) return { error: "invalid" };
  const value = rawHash.slice("#kyber=".length);
  return value.includes(".") ? parseRawTokenHandoff(value, origin) : parseEnvelopeHandoff(value);
}
function isLoopbackHost(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}
var KyhubUrl = pipe(
  string(),
  check((raw) => {
    if (!URL.canParse(raw)) return false;
    const { protocol, hostname } = new URL(raw);
    return protocol === "https:" || protocol === "http:" && isLoopbackHost(hostname);
  }, "must be an https URL, or http on a loopback host"),
  transform((raw) => {
    const url = new URL(raw);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  })
);
var Endpoint = object({
  host: pipe(string(), regex(HOST_RE)),
  port: optional(pipe(number(), integer(), minValue(1), maxValue(65535)), 443)
});
var Envelope = intersect([
  object({
    v: literal(1),
    token: pipe(string(), nonEmpty()),
    exp: optional(pipe(number(), gtValue(0))),
    endpoints: tupleWithRest([Endpoint], unknown())
  }),
  variant("refresh_token", [
    object({
      refresh_token: pipe(string(), nonEmpty()),
      kyhub_url: KyhubUrl,
      kyhub_machine_id: pipe(string(), regex(MACHINE_ID_RE))
    }),
    object({ refresh_token: optional(undefined_()) })
  ])
]);
function parseRawTokenHandoff(token, origin) {
  if (token.length === 0) return { error: "invalid" };
  const exp = jwtExp(token);
  if (typeof exp !== "number" || exp <= 0) return { error: "parse" };
  const host = origin.hostname;
  const port = origin.port ? Number(origin.port) : origin.protocol === "https:" ? 443 : 80;
  if (host.length === 0 || !HOST_RE.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: "invalid" };
  }
  return { token, exp, host, port, kyhubUrl: null, machineId: null, refreshToken: null };
}
function parseEnvelopeHandoff(value) {
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(value));
  } catch (err) {
    console.warn("Handoff envelope is not base64 JSON:", err);
    return { error: "parse" };
  }
  const result = safeParse(Envelope, payload);
  if (!result.success) {
    console.warn("Handoff envelope rejected:", summarize(result.issues));
    return { error: "invalid" };
  }
  const {
    token,
    exp = null,
    endpoints: [ep],
    kyhub_url = null,
    kyhub_machine_id = null,
    refresh_token = null
  } = result.output;
  return {
    token,
    exp,
    host: ep.host,
    port: ep.port,
    kyhubUrl: kyhub_url,
    machineId: kyhub_machine_id,
    refreshToken: refresh_token
  };
}
function jwtClaims(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return JSON.parse(b64urlDecode(parts[1]));
  } catch (err) {
    console.warn("JWT payload is not base64 JSON:", err);
    return null;
  }
}
function jwtExp(token) {
  const c = jwtClaims(token);
  return c && typeof c.exp === "number" ? c.exp : null;
}
function jwtIdentity(token) {
  const c = jwtClaims(token);
  return c ? c.preferred_username ?? c.sub ?? null : null;
}

// html/handoff.js
var REFRESH_LEAD_SEC = 30;
var KILL_WINDOW_SEC = 15;
var REFRESH_RETRY_DELAYS_SEC = [5, 10];
var REFRESH_TIMEOUT_MS = 8e3;
var REOPEN_PROMPT = "Reopen from the portal to connect";
function detectHandoff() {
  const rawHash = location.hash;
  if (!rawHash.startsWith("#kyber=")) return null;
  history.replaceState(null, "", location.pathname + location.search);
  return parseHandoffFragment(rawHash, {
    hostname: location.hostname,
    port: location.port,
    protocol: location.protocol
  });
}
async function refreshConnection(kyhubUrl, machineId, refreshToken) {
  const url = `${kyhubUrl}/machines/${encodeURIComponent(machineId)}:refresh-connection`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS)
  });
  if (!resp.ok) {
    const err = new Error(`refresh-connection returned ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const token = data.auth_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("refresh-connection response missing auth_token");
  }
  const rotated = typeof data.auth_refresh_token === "string" && data.auth_refresh_token.length > 0 ? data.auth_refresh_token : refreshToken;
  const exp = jwtExp(token) ?? isoToUnix(data.auth_token_expires_at);
  if (exp === null) throw new Error("refresh-connection response has no readable expiry");
  return { token, refreshToken: rotated, exp };
}
function isoToUnix(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1e3) : null;
}
async function startHandoff(handoff2, uiClientListener2, updateStatus2) {
  if (handoff2.error) {
    updateStatus2(REOPEN_PROMPT);
    return () => {
    };
  }
  const { host, port, kyhubUrl, machineId } = handoff2;
  let currentRefreshToken = handoff2.refreshToken;
  const refreshEnabled = Boolean(kyhubUrl && machineId && currentRefreshToken);
  let timers = [];
  let expiryNoticeShown = false;
  let stopped = false;
  let selfStops = 0;
  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }
  function stop() {
    if (selfStops > 0) {
      selfStops--;
      return;
    }
    stopped = true;
    clearTimers();
  }
  const exp = jwtExp(handoff2.token) ?? handoff2.exp;
  if (exp === null) {
    updateStatus2(REOPEN_PROMPT);
    return stop;
  }
  await connect(handoff2.token, exp);
  return stop;
  async function connect(token, exp2) {
    const identity = jwtIdentity(token);
    const handoffListener = async (name, event) => {
      await uiClientListener2(name, event);
      if (name === "reconnection_failed") {
        clearTimers();
        return;
      }
      if (name === "controlplane_connect_failed" && event === "unauthorized") {
        clearTimers();
        updateStatus2(REOPEN_PROMPT);
        return;
      }
      if (name === "controlplane_connected") {
        if (identity) {
          updateStatus2(`Connected as ${identity} to ${host}:${port}`);
        }
        scheduleRefresh(exp2);
      }
    };
    try {
      await doConnect(handoffListener, host, port, { type: "oidc", token });
    } catch (err) {
      console.error("Handoff connect failed:", err);
      updateStatus2(`Connection error: ${err.message}`);
    }
  }
  async function tryRefreshWithRetry2() {
    for (const [attempt, delay] of [...REFRESH_RETRY_DELAYS_SEC, null].entries()) {
      try {
        return await refreshConnection(kyhubUrl, machineId, currentRefreshToken);
      } catch (err) {
        const rejected = typeof err.status === "number" && err.status < 500;
        if (rejected || delay === null) {
          console.error("Token refresh failed:", err);
          return null;
        }
        console.warn(`Token refresh failed (attempt ${attempt + 1}), retrying in ${delay}s:`, err);
        await new Promise((resolve) => setTimeout(resolve, delay * 1e3));
      }
    }
  }
  async function doRefresh() {
    const refreshed = await tryRefreshWithRetry2();
    if (stopped) return;
    if (!refreshed) {
      updateStatus2(REOPEN_PROMPT);
      return;
    }
    currentRefreshToken = refreshed.refreshToken;
    const exp2 = refreshed.exp;
    let renewed = false;
    const wasmClient = getWasmClient();
    if (wasmClient) {
      try {
        const { ok, status } = await applyFreshToken({ host, port }, wasmClient, refreshed.token);
        renewed = ok;
        if (!ok) console.warn(`Session renew returned ${status}, reconnecting`);
      } catch (err) {
        console.warn("Session renew request failed, reconnecting:", err);
      }
    } else {
      console.warn("No wasm client, reconnecting with the fresh token");
    }
    if (stopped) return;
    if (renewed) {
      if (expiryNoticeShown) updateStatus2("Session renewed");
      scheduleRefresh(exp2);
      return;
    }
    if (isClientActive()) selfStops++;
    cancelAndDisconnect();
    await connect(refreshed.token, exp2);
  }
  function scheduleRefresh(exp2) {
    if (stopped) return;
    clearTimers();
    expiryNoticeShown = false;
    if (!refreshEnabled) {
      scheduleExpiryNotice(exp2);
      return;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    const refreshIn = Math.max(exp2 - nowSec - REFRESH_LEAD_SEC, 1);
    timers.push(setTimeout(() => {
      doRefresh().catch((err) => console.error("doRefresh failed:", err));
    }, refreshIn * 1e3));
    scheduleExpiryNotice(exp2);
  }
  function scheduleExpiryNotice(exp2) {
    const nowSec = Math.floor(Date.now() / 1e3);
    const notice = refreshEnabled ? "Session expiring, renewing" : "Session expiring";
    timers.push(setTimeout(() => {
      expiryNoticeShown = true;
      updateStatus2(notice);
    }, Math.max(exp2 - nowSec - KILL_WINDOW_SEC, 1) * 1e3));
    timers.push(setTimeout(() => {
      expiryNoticeShown = true;
      updateStatus2(REOPEN_PROMPT);
    }, Math.max(exp2 - nowSec, 1) * 1e3));
  }
}

// html/ui.js
var oidc = null;
var stopHandoff = null;
var handoff = detectHandoff();
async function ensureOidc() {
  if (!oidc) {
    const { OidcManager: OidcManager2 } = await Promise.resolve().then(() => (init_manager(), manager_exports));
    oidc = new OidcManager2({
      updateStatus,
      updateConfig,
      getConfigValue: (key) => key === "oidc_popup" ? getConfigValue(key) ?? oidcPopupDefault : getConfigValue(key)
    });
  }
  return oidc;
}
document.getElementById("sidebar").addEventListener("click", function(event) {
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
    hideSidebar();
  } else {
    showSidebar();
  }
}
function initHudMode() {
  const hudCheckbox = document.getElementById("hud-mode-toggle");
  const movableWrapper = document.getElementById("graph-overlay-wrapper");
  const pillsContainer = document.getElementById("metrics-toggles");
  if (!hudCheckbox || !movableWrapper || !pillsContainer) return;
  function updateHud(visible) {
    if (visible) {
      document.body.appendChild(movableWrapper);
      movableWrapper.classList.add("hud-active");
      hideSidebar();
      document.activeElement.blur();
    } else {
      movableWrapper.classList.remove("hud-active");
      pillsContainer.insertAdjacentElement("afterend", movableWrapper);
    }
  }
  hudCheckbox.addEventListener("change", (e) => {
    updateHud(e.target.checked);
  });
  updateHud(hudCheckbox.checked);
}
function humanizeKeyboardEvent(event) {
  let human = "";
  human += event.altKey ? "Alt+" : "";
  human += event.ctrlKey ? "Ctrl+" : "";
  human += event.metaKey ? "Meta+" : "";
  human += event.shiftKey ? "Shift+" : "";
  human += typeof event.key === "undefined" ? "" : event.key.toLowerCase();
  return human;
}
var overlayConfiguration = {
  toggleShortcut: "Alt+Ctrl+m"
};
var oidcPopupDefault = true;
var captureMode = false;
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
          oidcPopupDefault = value === "true";
          const cb = document.getElementById("oidc_popup");
          if (cb) cb.checked = oidcPopupDefault;
        }
        break;
    }
  }
}
function setToggleShortcut(shortcut, setInURL) {
  if (shortcut == "") {
    return;
  }
  console.log("Setting overlay toggle shortcut to: ", shortcut);
  overlayConfiguration.toggleShortcut = shortcut;
  document.getElementById("overlay_toggle_shortcut").value = shortcut;
  document.getElementById("capture_shortcut").disabled = false;
  captureMode = false;
  if (setInURL) {
    let queryParams = new URLSearchParams(window.location.search);
    queryParams.set("overlay_toggle_shortcut", shortcut);
    window.history.replaceState(null, null, "?" + queryParams.toString());
  }
}
setToggleShortcut(overlayConfiguration.toggleShortcut, false);
document.getElementById("capture_shortcut").addEventListener("click", function(event) {
  captureMode = true;
  event.target.disabled = true;
  document.getElementById("overlay_toggle_shortcut").value = "";
});
function isEventToggleShortcut(event) {
  return humanizeKeyboardEvent(event) == overlayConfiguration.toggleShortcut;
}
document.addEventListener("keyup", function(event) {
  if (captureMode) {
    setToggleShortcut(humanizeKeyboardEvent(event), true);
  } else if (isEventToggleShortcut(event)) {
    toggleSidebar();
  }
});
Array.from(document.getElementsByClassName("nav-section-header")).forEach(function(element) {
  element.addEventListener("click", function() {
    element.classList.toggle("unfold");
  });
});
function updateStatus(text) {
  document.getElementById("sidebar-client-status").textContent = text;
}
async function probeAudioAndMaybeShowOverlay() {
  while (isClientActive()) {
    const result = await tryResumeAudio();
    if (result === AudioResumeState.Running) return;
    if (result === AudioResumeState.Suspended) {
      showClickToStart(() => audioResume());
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
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
        protocol: "Protocol error"
      };
      const message = reasons[event] ?? "Connection failed";
      updateStatus(message);
      break;
    }
    case "controlplane_connected":
      updateStatus("Connected");
      break;
    case "reconnecting":
      updateStatus(`Reconnecting (${event.attempt}/${event.maxAttempts})`);
      break;
    case "reconnected":
      updateStatus("Reconnected");
      break;
    case "authentication_required":
      await oidc?.onAuthenticationRequired(event, uiClientListener);
      break;
    case "reconnection_failed":
      updateStatus("Reconnection failed");
      oidc?.onReconnectionFailed();
      break;
    case "streaming_started":
      updateStatus("Streaming");
      break;
    case "streaming_stopped":
      updateStatus("Streaming stopped");
      break;
    case "streaming_start_failed":
      updateStatus("Streaming failed");
      oidc?.onStreamingStartFailed();
      break;
    case "stopped":
      updateStatus(`Stopped (${event.reason()})`);
      stopHandoff?.();
      oidc?.onClientStopped(event.reason());
      break;
  }
}
function onClickId(elementId, fn) {
  document.getElementById(elementId).addEventListener("click", fn);
}
onClickId("hide_sidebar_btn", hideSidebar);
onClickId("connect", async function() {
  await updateConfig();
  const authType = getConfigValue("auth-method");
  const host = getConfigValue("host");
  const port = getConfigValue("port");
  stopHandoff?.();
  if (oidc) {
    oidc.cancelInFlight();
  } else if (isClientActive()) {
    cancelAndDisconnect();
  }
  if (authType === "oidc") {
    const o = await ensureOidc();
    if (!o.prepareOidcConnect()) return;
  }
  let credentials;
  if (authType === "oidc") {
    credentials = { type: "oidc", token: "" };
  } else if (authType === "jwt") {
    credentials = { type: "jwt", token: getConfigValue("auth-token") };
  } else {
    credentials = { type: "basic", username: getConfigValue("auth-user"), password: getConfigValue("auth-pass") };
  }
  try {
    await doConnect(uiClientListener, host, port, credentials);
  } catch (err) {
    oidc?.onConnectFailed();
    console.error("Connect failed:", err);
    updateStatus("Connection error: " + err.message);
  }
});
onClickId("disconnect", async function() {
  stopHandoff?.();
  oidc?.onDisconnect();
  await doDisconnect();
});
onClickId("restart_streaming", async function() {
  await updateConfig();
  await doRestartStreaming();
});
onClickId("fullscreen", toggleFullscreen);
onClickId("send_ctrl_alt_del", sendCtrlAltDel);
onClickId("download_logs", async function() {
  try {
    await flushLogs();
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
var defaultConfig = getConfigFromURLParams();
function genConfigInput(param, definition = null) {
  if (definition == null) {
    definition = StreamingConfigParameters[param];
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
          let opt = document.createElement("option");
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
  document.getElementById("auth-basic-fields").style.display = authType === "basic" ? "block" : "none";
  document.getElementById("auth-jwt-fields").style.display = authType === "jwt" ? "block" : "none";
  document.getElementById("auth-oidc-fields").style.display = authType === "oidc" ? "block" : "none";
}
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
  let config = {};
  for (const name in StreamingConfigParameters) {
    let valueFromSidebar = getConfigValue(name);
    let defaultValue = defaultConfig[name];
    if (valueFromSidebar !== null) {
      config[name] = getConfigValue(name);
    } else if (typeof defaultValue !== "undefined") {
      config[name] = defaultValue;
    }
  }
  console.log("Updating streaming config:", config);
  await updateStreamingConfig(config);
}
function initMetricToggles() {
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
function stopPropagation(event) {
  if (!isEventToggleShortcut(event)) {
    event.stopPropagation();
  }
}
function disableSidebarEventsPropagation() {
  for (const eventType of ["mousedown", "mouseup", "mousewheel", "keydown", "keyup"]) {
    document.getElementById("sidebar").addEventListener(eventType, stopPropagation);
  }
}
function enableSidebarEventsPropagation() {
  for (const eventType of ["mousedown", "mouseup", "mousewheel", "keydown", "keyup"]) {
    document.getElementById("sidebar").removeEventListener(eventType, stopPropagation);
  }
}
function buildSidebar(defaultHost, defaultPort) {
  genConfigInput("host", { name: "Host", type: String, description: "Server host you want to connect on.", default: defaultHost });
  genConfigInput("port", { name: "Port", type: Number, description: "Server port you want to connect on.", default: defaultPort });
  genConfigInput("auto_reconnect", { name: "Auto reconnect", type: Boolean, description: "Automatically reconnect on connection loss.", default: true });
  const hiddenParameters = ["intra_refresh", "gamepad_force_xbox360"];
  for (const param in StreamingConfigParameters) {
    if (hiddenParameters.includes(param)) continue;
    genConfigInput(param);
  }
  document.getElementById("auth-method").addEventListener("change", () => {
    if (getConfigValue("auth-method") === "oidc") ensureOidc().catch(() => {
    });
    updateAuthFieldsVisibility();
  });
  updateAuthFieldsVisibility();
  configureOverlayFromURLParams();
  initMetricToggles();
  initHudMode();
  showSidebar();
}
async function handleOidcPageLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOidcCallback = (urlParams.has("code") || urlParams.has("error")) && urlParams.has("state");
  if (!isOidcCallback) return false;
  const o = await ensureOidc();
  o.purgeStaleResults();
  updateStatus("Completing OIDC login...");
  const cb = await o.handleCallback();
  if (cb.kind === "popup") {
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
    defaultConfig = getConfigFromURLParams();
    buildSidebar(cb.result.host, cb.result.port);
    document.getElementById("auth-method").value = "oidc";
    updateAuthFieldsVisibility();
    await updateConfig();
    updateStatus("Logged in");
    await o.finalizeRedirectLogin(cb.result, uiClientListener);
    probeAudioAndMaybeShowOverlay();
    return true;
  }
  if (cb.kind === "redirect-error") {
    console.error("OIDC callback failed:", cb.err);
    updateStatus("OIDC error: " + cb.err.message);
  }
  return false;
}
window.addEventListener("load", async () => {
  if (handoff) {
    const handoffUiListener = async (name, event) => {
      if (name === "streaming_started") hideSidebar();
      await uiClientListener(name, event);
    };
    stopHandoff = await startHandoff(handoff, handoffUiListener, updateStatus);
    probeAudioAndMaybeShowOverlay();
    return;
  }
  if (await handleOidcPageLoad()) return;
  const [defaultHost, defaultPort] = getHostAndPortFromURLParams();
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
      let updateMetricsVisibility = function() {
        if (metricsCheckbox.checked) {
          metricsModeRow.style.display = "flex";
        } else {
          metricsModeRow.style.display = "none";
        }
      };
      const metricsModeRow = metricsModeSelect.closest(".input-row");
      metricsCheckbox.addEventListener("change", updateMetricsVisibility);
      updateMetricsVisibility();
    }
    metricsCheckbox.addEventListener("change", () => {
      localStorage.setItem("metricsEnabled", String(metricsCheckbox.checked));
    });
  }
});
export {
  initMetricToggles
};
