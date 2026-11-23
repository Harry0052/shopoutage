import type { Scenario } from "../contracts/scenario.js";

export interface ExpectedIntentLine {
  intentId: string;
  sku: string;
  quantity: number;
  amountCents: number;
}

/**
 * Reference method: each sale intent is applied once.
 * Duplicate replay is an observed injection, not a second expected intent.
 */
export function expectedIntentLines(scenario: Scenario): ExpectedIntentLine[] {
  const prices = new Map(scenario.seededSkus.map((sku) => [sku.sku, sku.unitPriceMinor]));
  return scenario.intents.map((intent) => {
    const unit = prices.get(intent.sku);
    if (unit === undefined) {
      throw new Error(`SKU ${intent.sku} is missing from seeded prices.`);
    }
    return {
      intentId: intent.intentId,
      sku: intent.sku,
      quantity: intent.quantity,
      amountCents: unit * intent.quantity
    };
  });
}

export function expectedOnHand(scenario: Scenario, sku: string): number {
  const seeded = scenario.seededSkus.find((row) => row.sku === sku);
  if (!seeded) {
    throw new Error(`SKU ${sku} is not seeded.`);
  }
  const sold = expectedIntentLines(scenario)
    .filter((line) => line.sku === sku)
    .reduce((sum, line) => sum + line.quantity, 0);
  return seeded.openingQty - sold;
}
