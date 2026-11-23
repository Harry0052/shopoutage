import {
  ADAPTER_NAMES,
  ALLOWED_DATASTORES,
  ALLOWED_ENDPOINTS,
  CONNECTIVITY_EVENTS,
  CURRENCY,
  INJECTIONS,
  LIMITS,
  SCHEMA_VERSION
} from "./limits.js";
import { FixtureError } from "./errors.js";
import { decimalToMinorUnits } from "./money.js";

export interface SeededSku {
  sku: string;
  openingQty: number;
  unitPrice: string;
  unitPriceMinor: number;
}

export interface SaleIntent {
  intentId: string;
  sku: string;
  quantity: number;
}

export interface ConnectivityEvent {
  offsetMs: number;
  event: (typeof CONNECTIVITY_EVENTS)[number];
}

export interface AdapterConfig {
  name: (typeof ADAPTER_NAMES)[number];
  version: string;
  endpoint: (typeof ALLOWED_ENDPOINTS)[number];
  datastore: (typeof ALLOWED_DATASTORES)[number];
}

export interface Scenario {
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioId: string;
  timeOrigin: string;
  recoveryDeadlineMs: number;
  stabilityWindowMs: number;
  currency: typeof CURRENCY;
  minorUnitScale: typeof LIMITS.minorUnitScale;
  seededSkus: SeededSku[];
  intents: SaleIntent[];
  connectivity: ConnectivityEvent[];
  injection: (typeof INJECTIONS)[number];
  adapter: AdapterConfig;
}

const SCENARIO_KEYS = [
  "schemaVersion",
  "scenarioId",
  "timeOrigin",
  "recoveryDeadlineMs",
  "stabilityWindowMs",
  "currency",
  "minorUnitScale",
  "seededSkus",
  "intents",
  "connectivity",
  "injection",
  "adapter"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[], field: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new FixtureError(
        "schema",
        `${field}.${key}`,
        `Unknown property "${key}" on ${field}. Allowed properties: ${allowed.join(", ")}.`
      );
    }
  }
}

function requireString(record: Record<string, unknown>, key: string, field: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new FixtureError("schema", field, `${field} must be a non-empty string.`);
  }
  return value;
}

function requireInt(record: Record<string, unknown>, key: string, field: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new FixtureError("schema", field, `${field} must be an integer.`);
  }
  return value;
}

function assertId(value: string, field: string): void {
  if (value.length > LIMITS.maxIdLength || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new FixtureError(
      "bounds",
      field,
      `${field} must match [a-z0-9][a-z0-9-]* and be at most ${LIMITS.maxIdLength} characters.`
    );
  }
}

function assertSku(value: string, field: string): void {
  if (value.length > LIMITS.maxSkuLength || !/^[A-Z0-9][A-Z0-9-]*$/.test(value)) {
    throw new FixtureError(
      "bounds",
      field,
      `${field} must match [A-Z0-9][A-Z0-9-]* and be at most ${LIMITS.maxSkuLength} characters.`
    );
  }
}

/**
 * Reject endpoints and datastores that are not inside the synthetic drill.
 * Call this before any adapter mutation. Allowed values are fixture-local names only.
 */
export function assertSyntheticBoundary(adapter: AdapterConfig): void {
  const endpoint = adapter.endpoint as string;
  const datastore = adapter.datastore as string;
  if (!ALLOWED_ENDPOINTS.includes(adapter.endpoint)) {
    throw new FixtureError(
      "boundary",
      "adapter.endpoint",
      `adapter.endpoint is "${endpoint}", which is outside the synthetic drill environment. Allowed values: ${ALLOWED_ENDPOINTS.join(", ")}.`
    );
  }
  if (!ALLOWED_DATASTORES.includes(adapter.datastore)) {
    throw new FixtureError(
      "boundary",
      "adapter.datastore",
      `adapter.datastore is "${datastore}", which is outside the synthetic drill environment. Allowed values: ${ALLOWED_DATASTORES.join(", ")}.`
    );
  }
  if (adapter.name === "reference" && adapter.endpoint !== "fixture://reference") {
    throw new FixtureError(
      "unsupported_value",
      "adapter.endpoint",
      `The reference adapter only accepts endpoint fixture://reference.`
    );
  }
  if (adapter.name === "odoo" && adapter.endpoint !== "fixture://odoo") {
    throw new FixtureError(
      "unsupported_value",
      "adapter.endpoint",
      `The odoo adapter only accepts endpoint fixture://odoo.`
    );
  }
  if (adapter.name === "reference" && adapter.datastore === "fixture:odoo-volume") {
    throw new FixtureError(
      "unsupported_value",
      "adapter.datastore",
      `The reference adapter cannot use fixture:odoo-volume.`
    );
  }
  if (adapter.name === "odoo" && adapter.datastore !== "fixture:odoo-volume") {
    throw new FixtureError(
      "unsupported_value",
      "adapter.datastore",
      `The odoo adapter only accepts datastore fixture:odoo-volume.`
    );
  }
}

export function parseScenario(value: unknown): Scenario {
  if (!isRecord(value)) {
    throw new FixtureError("schema", "scenario", "Scenario must be a JSON object.");
  }
  rejectUnknown(value, SCENARIO_KEYS, "scenario");

  const schemaVersion = requireString(value, "schemaVersion", "schemaVersion");
  if (schemaVersion !== SCHEMA_VERSION) {
    throw new FixtureError(
      "unsupported_value",
      "schemaVersion",
      `schemaVersion "${schemaVersion}" is not supported. Expected ${SCHEMA_VERSION}.`
    );
  }

  const scenarioId = requireString(value, "scenarioId", "scenarioId");
  assertId(scenarioId, "scenarioId");

  const timeOrigin = requireString(value, "timeOrigin", "timeOrigin");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timeOrigin) || Number.isNaN(Date.parse(timeOrigin))) {
    throw new FixtureError(
      "unsupported_value",
      "timeOrigin",
      `timeOrigin must be an absolute UTC timestamp with millisecond precision, such as 2026-01-01T00:00:00.000Z.`
    );
  }

  const recoveryDeadlineMs = requireInt(value, "recoveryDeadlineMs", "recoveryDeadlineMs");
  if (recoveryDeadlineMs < LIMITS.minRecoveryDeadlineMs || recoveryDeadlineMs > LIMITS.maxRecoveryDeadlineMs) {
    throw new FixtureError(
      "bounds",
      "recoveryDeadlineMs",
      `recoveryDeadlineMs must be an integer from ${LIMITS.minRecoveryDeadlineMs} to ${LIMITS.maxRecoveryDeadlineMs}.`
    );
  }

  const stabilityWindowMs = requireInt(value, "stabilityWindowMs", "stabilityWindowMs");
  if (stabilityWindowMs < 0 || stabilityWindowMs > LIMITS.maxStabilityWindowMs || stabilityWindowMs > recoveryDeadlineMs) {
    throw new FixtureError(
      "bounds",
      "stabilityWindowMs",
      `stabilityWindowMs must be an integer from 0 to ${LIMITS.maxStabilityWindowMs} and must not exceed recoveryDeadlineMs.`
    );
  }

  const currency = requireString(value, "currency", "currency");
  if (currency !== CURRENCY) {
    throw new FixtureError(
      "unsupported_value",
      "currency",
      `currency must be ${CURRENCY} (ISO 4217 test code). Amounts are simulated and are not a real tender.`
    );
  }

  const minorUnitScale = requireInt(value, "minorUnitScale", "minorUnitScale");
  if (minorUnitScale !== LIMITS.minorUnitScale) {
    throw new FixtureError(
      "unsupported_value",
      "minorUnitScale",
      `minorUnitScale must be ${LIMITS.minorUnitScale} (minor units per major unit).`
    );
  }

  if (!Array.isArray(value.seededSkus)) {
    throw new FixtureError("schema", "seededSkus", "seededSkus must be an array.");
  }
  if (value.seededSkus.length < 1 || value.seededSkus.length > LIMITS.maxSkus) {
    throw new FixtureError(
      "bounds",
      "seededSkus",
      `seededSkus must contain 1 to ${LIMITS.maxSkus} entries.`
    );
  }

  const seededSkus: SeededSku[] = [];
  const seenSkus = new Set<string>();
  for (let index = 0; index < value.seededSkus.length; index += 1) {
    const raw = value.seededSkus[index];
    const field = `seededSkus[${index}]`;
    if (!isRecord(raw)) {
      throw new FixtureError("schema", field, `${field} must be an object.`);
    }
    rejectUnknown(raw, ["sku", "openingQty", "unitPrice"], field);
    const sku = requireString(raw, "sku", `${field}.sku`);
    assertSku(sku, `${field}.sku`);
    if (seenSkus.has(sku)) {
      throw new FixtureError("schema", `${field}.sku`, `Duplicate SKU ${sku}.`);
    }
    seenSkus.add(sku);
    const openingQty = requireInt(raw, "openingQty", `${field}.openingQty`);
    if (openingQty < 0 || openingQty > LIMITS.maxOpeningQty) {
      throw new FixtureError(
        "bounds",
        `${field}.openingQty`,
        `${field}.openingQty must be an integer from 0 to ${LIMITS.maxOpeningQty}.`
      );
    }
    const unitPrice = requireString(raw, "unitPrice", `${field}.unitPrice`);
    const unitPriceMinor = decimalToMinorUnits(unitPrice, `${field}.unitPrice`);
    seededSkus.push({ sku, openingQty, unitPrice, unitPriceMinor });
  }

  if (!Array.isArray(value.intents)) {
    throw new FixtureError("schema", "intents", "intents must be an array.");
  }
  if (value.intents.length < 1 || value.intents.length > LIMITS.maxIntents) {
    throw new FixtureError(
      "bounds",
      "intents",
      `intents must contain 1 to ${LIMITS.maxIntents} entries in submit order.`
    );
  }

  const intents: SaleIntent[] = [];
  const seenIntents = new Set<string>();
  for (let index = 0; index < value.intents.length; index += 1) {
    const raw = value.intents[index];
    const field = `intents[${index}]`;
    if (!isRecord(raw)) {
      throw new FixtureError("schema", field, `${field} must be an object.`);
    }
    rejectUnknown(raw, ["intentId", "sku", "quantity"], field);
    const intentId = requireString(raw, "intentId", `${field}.intentId`);
    assertId(intentId, `${field}.intentId`);
    if (seenIntents.has(intentId)) {
      throw new FixtureError("schema", `${field}.intentId`, `Duplicate intent id ${intentId}.`);
    }
    seenIntents.add(intentId);
    const sku = requireString(raw, "sku", `${field}.sku`);
    assertSku(sku, `${field}.sku`);
    if (!seenSkus.has(sku)) {
      throw new FixtureError("schema", `${field}.sku`, `${field}.sku ${sku} is not in seededSkus.`);
    }
    const quantity = requireInt(raw, "quantity", `${field}.quantity`);
    if (quantity < 1 || quantity > LIMITS.maxQuantity) {
      throw new FixtureError(
        "bounds",
        `${field}.quantity`,
        `${field}.quantity must be an integer from 1 to ${LIMITS.maxQuantity}.`
      );
    }
    intents.push({ intentId, sku, quantity });
  }

  if (!Array.isArray(value.connectivity)) {
    throw new FixtureError("schema", "connectivity", "connectivity must be an array.");
  }
  if (value.connectivity.length < 1 || value.connectivity.length > LIMITS.maxEvents) {
    throw new FixtureError(
      "bounds",
      "connectivity",
      `connectivity must contain 1 to ${LIMITS.maxEvents} events.`
    );
  }

  const connectivity: ConnectivityEvent[] = [];
  let previousOffset = -1;
  for (let index = 0; index < value.connectivity.length; index += 1) {
    const raw = value.connectivity[index];
    const field = `connectivity[${index}]`;
    if (!isRecord(raw)) {
      throw new FixtureError("schema", field, `${field} must be an object.`);
    }
    rejectUnknown(raw, ["offsetMs", "event"], field);
    const offsetMs = requireInt(raw, "offsetMs", `${field}.offsetMs`);
    if (offsetMs < 0 || offsetMs > LIMITS.maxOffsetMs) {
      throw new FixtureError(
        "bounds",
        `${field}.offsetMs`,
        `${field}.offsetMs must be an integer from 0 to ${LIMITS.maxOffsetMs}.`
      );
    }
    if (offsetMs <= previousOffset) {
      throw new FixtureError(
        "schema",
        `${field}.offsetMs`,
        `connectivity offsets must be strictly increasing.`
      );
    }
    previousOffset = offsetMs;
    const event = requireString(raw, "event", `${field}.event`);
    if (!CONNECTIVITY_EVENTS.includes(event as ConnectivityEvent["event"])) {
      throw new FixtureError(
        "unsupported_value",
        `${field}.event`,
        `${field}.event must be one of ${CONNECTIVITY_EVENTS.join(", ")}.`
      );
    }
    connectivity.push({ offsetMs, event: event as ConnectivityEvent["event"] });
  }

  const injection = requireString(value, "injection", "injection");
  if (!INJECTIONS.includes(injection as Scenario["injection"])) {
    throw new FixtureError(
      "unsupported_value",
      "injection",
      `injection must be one of ${INJECTIONS.join(", ")}.`
    );
  }

  if (!isRecord(value.adapter)) {
    throw new FixtureError("schema", "adapter", "adapter must be an object.");
  }
  rejectUnknown(value.adapter, ["name", "version", "endpoint", "datastore"], "adapter");
  const name = requireString(value.adapter, "name", "adapter.name");
  if (!ADAPTER_NAMES.includes(name as AdapterConfig["name"])) {
    throw new FixtureError(
      "unsupported_value",
      "adapter.name",
      `adapter.name must be one of ${ADAPTER_NAMES.join(", ")}.`
    );
  }
  const version = requireString(value.adapter, "version", "adapter.version");
  if (version.length > LIMITS.maxTextLength) {
    throw new FixtureError(
      "bounds",
      "adapter.version",
      `adapter.version must be at most ${LIMITS.maxTextLength} characters.`
    );
  }
  const endpoint = requireString(value.adapter, "endpoint", "adapter.endpoint");
  const datastore = requireString(value.adapter, "datastore", "adapter.datastore");
  const adapter: AdapterConfig = {
    name: name as AdapterConfig["name"],
    version,
    endpoint: endpoint as AdapterConfig["endpoint"],
    datastore: datastore as AdapterConfig["datastore"]
  };
  assertSyntheticBoundary(adapter);

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId,
    timeOrigin,
    recoveryDeadlineMs,
    stabilityWindowMs,
    currency: CURRENCY,
    minorUnitScale: LIMITS.minorUnitScale,
    seededSkus,
    intents,
    connectivity,
    injection: injection as Scenario["injection"],
    adapter
  };
}

export function parseScenarioBytes(bytes: Buffer, label = "fixture"): Scenario {
  if (bytes.length > LIMITS.maxFileBytes) {
    throw new FixtureError(
      "bounds",
      "file",
      `${label} is ${bytes.length} bytes, which exceeds the ${LIMITS.maxFileBytes} byte limit.`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new FixtureError(
      "malformed",
      "file",
      `${label} is not valid JSON.`
    );
  }
  return parseScenario(parsed);
}
