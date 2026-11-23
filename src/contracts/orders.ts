import { LIMITS, ORDER_STATUSES } from "./limits.js";
import { FixtureError } from "./errors.js";

export interface OrderRow {
  intentId: string;
  sourceRowId: string;
  sku: string;
  quantity: number;
  amountCents: number;
  status: (typeof ORDER_STATUSES)[number];
}

const ORDER_KEYS = ["intentId", "sourceRowId", "sku", "quantity", "amountCents", "status"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOrderRow(value: unknown, field: string): OrderRow {
  if (!isRecord(value)) {
    throw new FixtureError("schema", field, `${field} must be a JSON object.`);
  }
  for (const key of Object.keys(value)) {
    if (!ORDER_KEYS.includes(key as (typeof ORDER_KEYS)[number])) {
      throw new FixtureError("schema", `${field}.${key}`, `Unknown property "${key}" on an order row.`);
    }
  }
  const intentId = value.intentId;
  const sourceRowId = value.sourceRowId;
  const sku = value.sku;
  const quantity = value.quantity;
  const amountCents = value.amountCents;
  const status = value.status;
  if (typeof intentId !== "string" || typeof sourceRowId !== "string" || typeof sku !== "string") {
    throw new FixtureError("schema", field, `${field} intentId, sourceRowId, and sku must be strings.`);
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.maxQuantity) {
    throw new FixtureError("bounds", `${field}.quantity`, `${field}.quantity must be an integer from 1 to ${LIMITS.maxQuantity}.`);
  }
  if (
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents < 0 ||
    amountCents > LIMITS.maxUnitPriceCents
  ) {
    throw new FixtureError(
      "bounds",
      `${field}.amountCents`,
      `${field}.amountCents must be an integer minor-unit total from 0 to ${LIMITS.maxUnitPriceCents}.`
    );
  }
  if (typeof status !== "string" || !ORDER_STATUSES.includes(status as OrderRow["status"])) {
    throw new FixtureError(
      "unsupported_value",
      `${field}.status`,
      `${field}.status must be one of ${ORDER_STATUSES.join(", ")}.`
    );
  }
  return { intentId, sourceRowId, sku, quantity, amountCents, status: status as OrderRow["status"] };
}

export function formatOrderJsonl(rows: readonly OrderRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
}

export function parseOrderJsonl(text: string): OrderRow[] {
  if (Buffer.byteLength(text, "utf8") > LIMITS.maxFileBytes) {
    throw new FixtureError("bounds", "orders", `Order export exceeds ${LIMITS.maxFileBytes} bytes.`);
  }
  const lines = text.split("\n").filter((line) => line.length > 0);
  return lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new FixtureError("malformed", `orders[${index}]`, `Order line ${index + 1} is not valid JSON.`);
    }
    return parseOrderRow(parsed, `orders[${index}]`);
  });
}
