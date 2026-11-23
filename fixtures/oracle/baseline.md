# Oracle: baseline-s001

Label: valid. Injection: none. Adapter: reference 0.1.0.

Hand calculation. SKU `S-001` opens at 10 units. Intent `intent-001` sells 2 units at 5.00 XTS. The minor-unit scale is 100, so the unit price is 500 minor units and the line total is `2 * 500 = 1000` minor units. Each intent is applied once, so the expected stock on hand is `10 - 2 = 8`.

| Check | Expected |
| --- | --- |
| Committed orders | 1 (`order-1`) |
| Amount | 1000 minor units |
| Stock on hand | 8 |
| Discrepancies | 0 |
| Report state | pass |

A second run from a fresh state keeps the same discrepancy count and the same ledger once clock fields are removed. The time origin is `2026-01-01T00:00:00.000Z` and is not a wall clock.
