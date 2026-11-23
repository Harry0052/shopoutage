/** Bounds for scenario files. Values outside these limits are rejected before use. */
export const LIMITS = {
  maxFileBytes: 65_536,
  maxSkus: 32,
  maxIntents: 64,
  maxEvents: 32,
  maxIdLength: 64,
  maxSkuLength: 32,
  maxTextLength: 128,
  maxQuantity: 1_000,
  maxOpeningQty: 100_000,
  maxUnitPriceCents: 100_000_000,
  minRecoveryDeadlineMs: 1,
  maxRecoveryDeadlineMs: 120_000,
  maxStabilityWindowMs: 60_000,
  maxOffsetMs: 120_000,
  minorUnitScale: 100
} as const;

export const SCHEMA_VERSION = "1.0.0";

export const CURRENCY = "XTS";

export const ALLOWED_ENDPOINTS = ["fixture://reference", "fixture://odoo"] as const;

export const ALLOWED_DATASTORES = [
  "fixture:memory",
  "fixture:sqlite",
  "fixture:odoo-volume"
] as const;

export const INJECTIONS = [
  "none",
  "duplicate-replay",
  "missing-stock",
  "never-converges"
] as const;

export const CONNECTIVITY_EVENTS = [
  "submit",
  "disconnect",
  "reconnect",
  "restart"
] as const;

export const ADAPTER_NAMES = ["reference", "odoo"] as const;

export const ORDER_STATUSES = ["committed", "pending", "rejected"] as const;

export const REPORT_STATES = [
  "pass",
  "fail",
  "inconclusive",
  "incomplete",
  "unavailable"
] as const;
