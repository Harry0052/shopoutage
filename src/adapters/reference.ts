import type { OrderRow } from "../contracts/orders.js";
import type { Scenario } from "../contracts/scenario.js";
import type { BusinessLedger } from "../core/ledger.js";
import { guardAdapter } from "./types.js";

export type { BusinessLedger } from "../core/ledger.js";

/**
 * In-process checkout. Stock and orders change only through `commit`.
 * `never-converges` increments `probe` on every poll so the ledger key never settles.
 * No random source is used.
 */
export class ReferencePos {
  private scenario: Scenario | undefined;
  private orders: OrderRow[] = [];
  private onHand = new Map<string, number>();
  private committed = new Set<string>();
  private prices = new Map<string, number>();
  private probe = 0;

  reset(scenario: Scenario): void {
    guardAdapter(scenario);
    this.scenario = scenario;
    this.orders = [];
    this.onHand = new Map(scenario.seededSkus.map((sku) => [sku.sku, sku.openingQty]));
    this.committed = new Set();
    this.prices = new Map(scenario.seededSkus.map((sku) => [sku.sku, sku.unitPriceMinor]));
    this.probe = 0;
  }

  /**
   * Commit one intent. A second call with the same id is a no-op unless
   * `duplicate` is set, which is the seeded replay fault.
   */
  commit(intentId: string, options: { duplicate: boolean }): void {
    const scenario = this.required();
    const intent = scenario.intents.find((row) => row.intentId === intentId);
    if (!intent) {
      throw new Error(`Unknown intent ${intentId}.`);
    }
    if (this.committed.has(intentId) && !options.duplicate) {
      return;
    }
    const unit = this.prices.get(intent.sku);
    if (unit === undefined) {
      throw new Error(`SKU ${intent.sku} has no price.`);
    }
    this.orders.push({
      intentId: intent.intentId,
      sourceRowId: `order-${this.orders.length + 1}`,
      sku: intent.sku,
      quantity: intent.quantity,
      amountCents: unit * intent.quantity,
      status: "committed"
    });
    if (scenario.injection !== "missing-stock") {
      const current = this.onHand.get(intent.sku);
      if (current === undefined) {
        throw new Error(`SKU ${intent.sku} has no stock.`);
      }
      this.onHand.set(intent.sku, current - intent.quantity);
    }
    this.committed.add(intentId);
  }

  poll(): BusinessLedger {
    const scenario = this.required();
    if (scenario.injection === "never-converges") {
      this.probe += 1;
    }
    const stock = [...this.onHand.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([sku, onHand]) => ({
        sku,
        onHand,
        sourceRowId: `stock-${sku}`
      }));
    return {
      orders: this.orders.map((order) => ({ ...order })),
      stock,
      correlationAvailable: true,
      inventoryReadable: true,
      probe: this.probe
    };
  }

  private required(): Scenario {
    if (!this.scenario) {
      throw new Error("Reference adapter was polled before reset.");
    }
    return this.scenario;
  }
}

/**
 * Walk the scenario clock. Restart drops the client's ack memory and retries.
 * The server keeps the first commit, so a retry does not add another order.
 * Duplicate replay, when injected, applies one extra commit on reconnect.
 */
export function applyConnectivity(pos: ReferencePos, scenario: Scenario): void {
  let online = true;
  let retryAfterRestart = false;
  const queued: string[] = [];

  const commitEach = (duplicate: boolean): void => {
    for (const intent of scenario.intents) {
      pos.commit(intent.intentId, { duplicate });
    }
  };

  for (const event of scenario.connectivity) {
    if (event.event === "submit") {
      if (online) {
        commitEach(false);
      } else {
        for (const intent of scenario.intents) {
          if (!queued.includes(intent.intentId)) {
            queued.push(intent.intentId);
          }
        }
      }
    } else if (event.event === "disconnect") {
      online = false;
    } else if (event.event === "restart") {
      retryAfterRestart = true;
      if (online) {
        commitEach(false);
        retryAfterRestart = false;
      }
    } else if (event.event === "reconnect") {
      online = true;
      for (const intentId of queued) {
        pos.commit(intentId, { duplicate: false });
      }
      queued.length = 0;
      if (retryAfterRestart) {
        commitEach(false);
        retryAfterRestart = false;
      }
      if (scenario.injection === "duplicate-replay") {
        commitEach(true);
      }
    }
  }
}
