import { METRIC_KEYS } from './metrics_structure.js';

const DOM_UPDATE_INTERVAL = 200; // ms
const MAX_POINTS = 90;

/**
 * Fixed size buffer.
 * When full, new values overwrite the oldest ones.
 * Used to have a rolling window of the metrics for the live chart.
 */
class RingBuffer {
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
}

class Metric {
  constructor() {
    this.data = new RingBuffer(MAX_POINTS);
    this.color = "#888";
  }
}

/**
 * Manages the live metrics Chart.js chart and the sidebar latency display.
 * Maintains one RingBuffer per metric key and a shared PTS labels buffer.
 * DOM updates are throttled to DOM_UPDATE_INTERVAL ms.
 */
class MetricsManager {
  constructor() {
    // Chart state
    this.metricsChart = null;
    this.lastChartUpdate = 0;
    this.metrics = new Map(
        METRIC_KEYS.map(k => [k, new Metric()])
      );
    this.labelsBuffer = new RingBuffer(MAX_POINTS);
    this.activeSeries = new Set(METRIC_KEYS);
    this.updateScheduled = false;
    this.yAvg = 30;

    // DOM update throttling
    this.lastDomUpdate = 0;

    // Statistics
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
    const ds = this.metricsChart.data.datasets.find(d => d.label === key);
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
      console.warn('Live metrics : Invalid frame (no pts)', obj);
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
      `Live metrics : Session stats - Processed: ${this.totalFramesProcessed}, ` +
      `Dropped: ${this.totalFramesDropped} ` +
      `(${this.totalFramesProcessed > 0 ? (this.totalFramesDropped / this.totalFramesProcessed * 100).toFixed(1) : '0'}%)`
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
        this.metricsChart.data.datasets.forEach(ds => {
          const metric = this.metrics.get(ds.label);
          if (metric) {
            ds.data = Array.from(metric.data.getView());
          }
        });
        this.metricsChart.update('none');
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
    let ds = this.metricsChart.data.datasets.find(d => d.label === key);
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
        console.warn('Live metrics : No valid timestamps found in frame');
        return;
      }

      this.labelsBuffer.push(frame.pts);

      for (const [key, metric] of this.metrics) {
        const val = frame[key];

        let finalVal = NaN;
        if (val !== null && isFinite(val) && val > 0) {
          finalVal = (val - minTs) / 1000.0;
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
      console.error('Chart Error:', error);
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

    if (acquiredTs == null || sentTs == null || receivedTs == null ||
        !isFinite(acquiredTs) || !isFinite(sentTs) || !isFinite(receivedTs)) {
      return null;
    }

    const serverLat = (sentTs - acquiredTs) / 1000.0;
    const networkLat = (receivedTs - sentTs) / 1000.0;
    const endTs = displayedTs ?? preparedTs;

    if (endTs == null || !isFinite(endTs)) return null;

    const clientLat = (endTs - receivedTs) / 1000.0;
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
      ['latency-value', 'latency-server', 'latency-network', 'latency-client'].forEach(id => {
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
}


export const metricsManager = new MetricsManager();
