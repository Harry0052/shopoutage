import type { OrderRow } from "../contracts/orders.js";

export interface BusinessLedger {
  orders: OrderRow[];
  stock: { sku: string; onHand: number; sourceRowId: string }[];
  correlationAvailable: boolean;
  inventoryReadable: boolean;
  probe: number;
}

export function ledgerKey(ledger: BusinessLedger): string {
  return JSON.stringify({
    orders: ledger.orders,
    stock: ledger.stock,
    probe: ledger.probe,
    correlationAvailable: ledger.correlationAvailable,
    inventoryReadable: ledger.inventoryReadable
  });
}
