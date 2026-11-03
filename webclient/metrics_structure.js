/**
 * Ordered list of metric keys representing each stage of the frame pipeline.
 * Used to iterate over stages in a consistent order.
 *
 * @type {string[]}
 */
export const METRIC_KEYS = [
  "acquired", "encoding", "encoded", "sent", "received",
  "decoding", "decoded", "skipped", "prepared", "displayed"
];
