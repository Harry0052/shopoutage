import type { OrderRow } from "../contracts/orders.js";
import type { DrillReport, OrderDiscrepancy, StockDiscrepancy, StockEffect } from "../contracts/report.js";
import type { Scenario } from "../contracts/scenario.js";
import { expectedIntentLines, expectedOnHand } from "./expected.js";
import type { BusinessLedger } from "./ledger.js";
import type { Observation } from "./stability.js";

export const UNSTABLE_LIMITATION =
  "Recovery deadline elapsed before the ledger stayed unchanged for the stability window. Observations from the last poll were kept.";

function byText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortOrders(orders: readonly OrderRow[]): OrderRow[] {
  return [...orders].sort((left, right) => byText(left.sourceRowId, right.sourceRowId));
}

/**
 * Compare one application of each intent with the observed orders and stock.
 * Unstable runs stay inconclusive and do not turn the last sample into a pass or a fail.
 * A duplicate whose line amount matches the expected line is reported as `duplicate` only.
 * `amount` is used when a single committed order's minor-unit total differs.
 */
export function reconcile(scenario: Scenario, observation: Observation<BusinessLedger>): DrillReport {
  const ledger = observation.snapshot;
  const limitations: string[] = [];
  const orderDiscrepancies: OrderDiscrepancy[] = [];
  const stockDiscrepancies: StockDiscrepancy[] = [];
  const expectedLines = expectedIntentLines(scenario);

  if (!observation.stable) {
    limitations.push(UNSTABLE_LIMITATION);
  }

  if (observation.stable && !ledger.correlationAvailable) {
    limitations.push("The adapter could not correlate orders to intent ids. Order assertions are inconclusive.");
  }
  if (observation.stable && !ledger.inventoryReadable) {
    limitations.push("The adapter could not read inventory. Stock assertions are inconclusive.");
  }

  if (observation.stable && ledger.correlationAvailable) {
    for (const expected of expectedLines) {
      const committed = sortOrders(
        ledger.orders.filter((order) => order.intentId === expected.intentId && order.status === "committed")
      );
      if (committed.length === 0) {
        orderDiscrepancies.push({
          intentId: expected.intentId,
          sku: expected.sku,
          sourceRowIds: [],
          kind: "missing-order",
          expected: 1,
          observed: 0
        });
      } else if (committed.length !== 1) {
        orderDiscrepancies.push({
          intentId: expected.intentId,
          sku: expected.sku,
          sourceRowIds: committed.map((order) => order.sourceRowId),
          kind: "duplicate",
          expected: 1,
          observed: committed.length
        });
      } else {
        const observedAmount = committed.reduce((sum, order) => sum + order.amountCents, 0);
        if (observedAmount !== expected.amountCents) {
          orderDiscrepancies.push({
            intentId: expected.intentId,
            sku: expected.sku,
            sourceRowIds: committed.map((order) => order.sourceRowId),
            kind: "amount",
            expected: expected.amountCents,
            observed: observedAmount
          });
        }
      }
    }
  }

  const stock: StockEffect[] = [];
  for (const seeded of [...scenario.seededSkus].sort((left, right) => byText(left.sku, right.sku))) {
    const intentId = scenario.intents.find((intent) => intent.sku === seeded.sku)?.intentId ?? seeded.sku.toLowerCase();
    const observed = ledger.stock.find((row) => row.sku === seeded.sku);
    const expectedQty = expectedOnHand(scenario, seeded.sku);
    const observedQty = observed?.onHand ?? seeded.openingQty;
    const sourceRowId = observed?.sourceRowId ?? `stock-${seeded.sku}`;
    stock.push({
      sku: seeded.sku,
      intentId,
      openingQty: seeded.openingQty,
      expectedQty,
      observedQty: observed ? observedQty : seeded.openingQty,
      sourceRowId
    });
    if (!observation.stable || !ledger.inventoryReadable) {
      continue;
    }
    if (!observed) {
      limitations.push(`No stock observation for ${seeded.sku}. The stock assertion is inconclusive.`);
      continue;
    }
    if (observed.onHand < expectedQty) {
      stockDiscrepancies.push({
        intentId,
        sku: seeded.sku,
        sourceRowIds: [sourceRowId],
        kind: "excess-decrement",
        units: expectedQty - observed.onHand
      });
    } else if (observed.onHand > expectedQty) {
      stockDiscrepancies.push({
        intentId,
        sku: seeded.sku,
        sourceRowIds: [sourceRowId],
        kind: "missing-decrement",
        units: observed.onHand - expectedQty
      });
    }
  }

  const inconclusive =
    !observation.stable ||
    !ledger.correlationAvailable ||
    !ledger.inventoryReadable ||
    limitations.some((line) => line.includes("inconclusive"));
  const failed = orderDiscrepancies.length > 0 || stockDiscrepancies.length > 0;
  const state = !observation.stable ? "inconclusive" : failed ? "fail" : inconclusive ? "inconclusive" : "pass";

  orderDiscrepancies.sort((left, right) => byText(left.intentId, right.intentId) || byText(left.sku, right.sku) || byText(left.kind, right.kind));
  stockDiscrepancies.sort((left, right) => byText(left.intentId, right.intentId) || byText(left.sku, right.sku) || byText(left.kind, right.kind));

  return {
    schemaVersion: "1.0.0",
    scenarioId: scenario.scenarioId,
    state,
    adapter: {
      name: scenario.adapter.name,
      version: scenario.adapter.version,
      coverage: scenario.adapter.name
    },
    timeOrigin: scenario.timeOrigin,
    recoveryDeadlineMs: scenario.recoveryDeadlineMs,
    stabilityWindowMs: scenario.stabilityWindowMs,
    cutoff: {
      reached: true,
      stable: observation.stable,
      observationsPreserved: true
    },
    timeline: scenario.connectivity.map((event) => ({ offsetMs: event.offsetMs, event: event.event })),
    orders: sortOrders(ledger.orders),
    stock,
    discrepancies: {
      orders: orderDiscrepancies,
      stock: stockDiscrepancies
    },
    limitations,
    mutatedOutsideFixture: false
  };
}
