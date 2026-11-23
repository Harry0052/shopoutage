import type { Scenario } from "../contracts/scenario.js";
import type { OrderRow } from "../contracts/orders.js";
import { assertSyntheticBoundary } from "../contracts/scenario.js";

export interface LedgerSnapshot {
  orders: OrderRow[];
  stock: { sku: string; onHand: number; sourceRowId: string }[];
  correlationAvailable: boolean;
  inventoryReadable: boolean;
}

/**
 * Adapter contract. Implementations must call `guardAdapter` before reset,
 * submit, or any other mutation.
 */
export interface PosAdapter {
  readonly name: Scenario["adapter"]["name"];
  readonly version: string;
  reset(scenario: Scenario): void;
  submit(scenario: Scenario, intentId: string): void;
  poll(scenario: Scenario): LedgerSnapshot;
  exportLedgers(scenario: Scenario): LedgerSnapshot;
}

export function guardAdapter(scenario: Scenario): void {
  assertSyntheticBoundary(scenario.adapter);
}
