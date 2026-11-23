import { LIMITS, REPORT_STATES, SCHEMA_VERSION } from "./limits.js";
import { FixtureError } from "./errors.js";
import { parseOrderRow, type OrderRow } from "./orders.js";

export type ReportState = (typeof REPORT_STATES)[number];

export interface StockEffect {
  sku: string;
  intentId: string;
  openingQty: number;
  expectedQty: number;
  observedQty: number;
  sourceRowId: string;
}

export interface OrderDiscrepancy {
  intentId: string;
  sku: string;
  sourceRowIds: string[];
  kind: "duplicate" | "missing-order" | "amount";
  expected: number;
  observed: number;
}

export interface StockDiscrepancy {
  intentId: string;
  sku: string;
  sourceRowIds: string[];
  kind: "excess-decrement" | "missing-decrement";
  units: number;
}

export interface TimelineEntry {
  offsetMs: number;
  event: string;
}

export interface DrillReport {
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioId: string;
  state: ReportState;
  adapter: {
    name: "reference" | "odoo";
    version: string;
    coverage: "reference" | "odoo";
  };
  timeOrigin: string;
  recoveryDeadlineMs: number;
  stabilityWindowMs: number;
  cutoff: {
    reached: boolean;
    stable: boolean;
    observationsPreserved: boolean;
  };
  timeline: TimelineEntry[];
  orders: OrderRow[];
  stock: StockEffect[];
  discrepancies: {
    orders: OrderDiscrepancy[];
    stock: StockDiscrepancy[];
  };
  limitations: string[];
  mutatedOutsideFixture: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function requireBool(record: Record<string, unknown>, key: string, field: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new FixtureError("schema", field, `${field} must be a boolean.`);
  }
  return value;
}

const REPORT_KEYS = [
  "schemaVersion",
  "scenarioId",
  "state",
  "adapter",
  "timeOrigin",
  "recoveryDeadlineMs",
  "stabilityWindowMs",
  "cutoff",
  "timeline",
  "orders",
  "stock",
  "discrepancies",
  "limitations",
  "mutatedOutsideFixture"
] as const;

export function parseReport(value: unknown): DrillReport {
  if (!isRecord(value)) {
    throw new FixtureError("schema", "report", "Report must be a JSON object.");
  }
  for (const key of Object.keys(value)) {
    if (!REPORT_KEYS.includes(key as (typeof REPORT_KEYS)[number])) {
      throw new FixtureError("schema", key, `Unknown report property "${key}".`);
    }
  }
  const schemaVersion = requireString(value, "schemaVersion", "schemaVersion");
  if (schemaVersion !== SCHEMA_VERSION) {
    throw new FixtureError("unsupported_value", "schemaVersion", `Report schemaVersion must be ${SCHEMA_VERSION}.`);
  }
  const state = requireString(value, "state", "state");
  if (!REPORT_STATES.includes(state as ReportState)) {
    throw new FixtureError("unsupported_value", "state", `state must be one of ${REPORT_STATES.join(", ")}.`);
  }
  if (!isRecord(value.adapter)) {
    throw new FixtureError("schema", "adapter", "adapter must be an object.");
  }
  const adapterName = requireString(value.adapter, "name", "adapter.name");
  if (adapterName !== "reference" && adapterName !== "odoo") {
    throw new FixtureError("unsupported_value", "adapter.name", `adapter.name must be reference or odoo.`);
  }
  const coverage = requireString(value.adapter, "coverage", "adapter.coverage");
  if (coverage !== "reference" && coverage !== "odoo") {
    throw new FixtureError("unsupported_value", "adapter.coverage", `adapter.coverage must be reference or odoo.`);
  }
  if (!isRecord(value.cutoff)) {
    throw new FixtureError("schema", "cutoff", "cutoff must be an object.");
  }
  if (value.mutatedOutsideFixture !== false) {
    throw new FixtureError(
      "boundary",
      "mutatedOutsideFixture",
      `A report cannot claim a mutation outside the fixture environment.`
    );
  }
  if (!Array.isArray(value.orders) || !Array.isArray(value.stock) || !Array.isArray(value.timeline)) {
    throw new FixtureError("schema", "report", "orders, stock, and timeline must be arrays.");
  }
  if (!isRecord(value.discrepancies)) {
    throw new FixtureError("schema", "discrepancies", "discrepancies must be an object.");
  }
  const orders = value.orders.map((row, index) => parseOrderRow(row, `orders[${index}]`));
  const stock: StockEffect[] = value.stock.map((row, index) => {
    if (!isRecord(row)) {
      throw new FixtureError("schema", `stock[${index}]`, `stock[${index}] must be an object.`);
    }
    return {
      sku: requireString(row, "sku", `stock[${index}].sku`),
      intentId: requireString(row, "intentId", `stock[${index}].intentId`),
      openingQty: requireInt(row, "openingQty", `stock[${index}].openingQty`),
      expectedQty: requireInt(row, "expectedQty", `stock[${index}].expectedQty`),
      observedQty: requireInt(row, "observedQty", `stock[${index}].observedQty`),
      sourceRowId: requireString(row, "sourceRowId", `stock[${index}].sourceRowId`)
    };
  });
  const orderDiscrepancies: DrillReport["discrepancies"]["orders"] = [];
  const stockDiscrepancies: DrillReport["discrepancies"]["stock"] = [];
  if (!Array.isArray(value.discrepancies.orders) || !Array.isArray(value.discrepancies.stock)) {
    throw new FixtureError("schema", "discrepancies", "discrepancies.orders and discrepancies.stock must be arrays.");
  }
  for (const [index, row] of value.discrepancies.orders.entries()) {
    if (!isRecord(row)) {
      throw new FixtureError("schema", `discrepancies.orders[${index}]`, "Order discrepancy must be an object.");
    }
    const kind = requireString(row, "kind", `discrepancies.orders[${index}].kind`);
    if (kind !== "duplicate" && kind !== "missing-order" && kind !== "amount") {
      throw new FixtureError("unsupported_value", `discrepancies.orders[${index}].kind`, "Unsupported order discrepancy kind.");
    }
    if (!Array.isArray(row.sourceRowIds) || row.sourceRowIds.some((item) => typeof item !== "string")) {
      throw new FixtureError("schema", `discrepancies.orders[${index}].sourceRowIds`, "sourceRowIds must be a string array.");
    }
    orderDiscrepancies.push({
      intentId: requireString(row, "intentId", `discrepancies.orders[${index}].intentId`),
      sku: requireString(row, "sku", `discrepancies.orders[${index}].sku`),
      sourceRowIds: row.sourceRowIds as string[],
      kind,
      expected: requireInt(row, "expected", `discrepancies.orders[${index}].expected`),
      observed: requireInt(row, "observed", `discrepancies.orders[${index}].observed`)
    });
  }
  for (const [index, row] of value.discrepancies.stock.entries()) {
    if (!isRecord(row)) {
      throw new FixtureError("schema", `discrepancies.stock[${index}]`, "Stock discrepancy must be an object.");
    }
    const kind = requireString(row, "kind", `discrepancies.stock[${index}].kind`);
    if (kind !== "excess-decrement" && kind !== "missing-decrement") {
      throw new FixtureError("unsupported_value", `discrepancies.stock[${index}].kind`, "Unsupported stock discrepancy kind.");
    }
    const units = requireInt(row, "units", `discrepancies.stock[${index}].units`);
    if (units < 1 || units > LIMITS.maxQuantity) {
      throw new FixtureError("bounds", `discrepancies.stock[${index}].units`, "units must be a positive integer within the quantity bound.");
    }
    if (!Array.isArray(row.sourceRowIds) || row.sourceRowIds.some((item) => typeof item !== "string")) {
      throw new FixtureError("schema", `discrepancies.stock[${index}].sourceRowIds`, "sourceRowIds must be a string array.");
    }
    stockDiscrepancies.push({
      intentId: requireString(row, "intentId", `discrepancies.stock[${index}].intentId`),
      sku: requireString(row, "sku", `discrepancies.stock[${index}].sku`),
      sourceRowIds: row.sourceRowIds as string[],
      kind,
      units
    });
  }
  if (!Array.isArray(value.limitations) || value.limitations.some((item) => typeof item !== "string")) {
    throw new FixtureError("schema", "limitations", "limitations must be an array of strings.");
  }
  const timeline = value.timeline.map((row, index) => {
    if (!isRecord(row)) {
      throw new FixtureError("schema", `timeline[${index}]`, "Timeline entry must be an object.");
    }
    return {
      offsetMs: requireInt(row, "offsetMs", `timeline[${index}].offsetMs`),
      event: requireString(row, "event", `timeline[${index}].event`)
    };
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId: requireString(value, "scenarioId", "scenarioId"),
    state: state as ReportState,
    adapter: {
      name: adapterName,
      version: requireString(value.adapter, "version", "adapter.version"),
      coverage
    },
    timeOrigin: requireString(value, "timeOrigin", "timeOrigin"),
    recoveryDeadlineMs: requireInt(value, "recoveryDeadlineMs", "recoveryDeadlineMs"),
    stabilityWindowMs: requireInt(value, "stabilityWindowMs", "stabilityWindowMs"),
    cutoff: {
      reached: requireBool(value.cutoff, "reached", "cutoff.reached"),
      stable: requireBool(value.cutoff, "stable", "cutoff.stable"),
      observationsPreserved: requireBool(value.cutoff, "observationsPreserved", "cutoff.observationsPreserved")
    },
    timeline,
    orders,
    stock,
    discrepancies: { orders: orderDiscrepancies, stock: stockDiscrepancies },
    limitations: value.limitations as string[],
    mutatedOutsideFixture: false
  };
}
