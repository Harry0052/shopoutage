# Oracle: duplicate-s001

Label: valid scenario, seeded failure. Injection: duplicate-replay.

The expected ledger still applies intent `intent-001` once: 1 order, 1000 minor units, stock on hand 8. The injection records the same intent a second time.

Observed hand calculation:

- Committed orders: 2 (`order-1`, `order-2`), both intent `intent-001`, SKU `S-001`, 2 units, 1000 minor units each.
- Observed monetary total: `2 * 1000 = 2000` minor units.
- Observed stock decrement: `2 + 2 = 4`. Stock on hand: `10 - 4 = 6`.
- Expected decrement: 2. Excess decrement: `4 - 2 = 2` units of `S-001`.

| Finding | Key |
| --- | --- |
| Order discrepancy `duplicate` | intent `intent-001`, source rows `order-1` and `order-2`, expected 1, observed 2 |
| Stock discrepancy `excess-decrement` | SKU `S-001`, intent `intent-001`, source row `stock-S-001`, 2 units |

Report state: fail. This case is distinct from the missing-stock fixture, which keeps a single order.
