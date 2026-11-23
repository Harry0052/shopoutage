# Oracle: missing-stock-s001

Label: valid scenario, seeded failure. Injection: missing-stock.

The order is committed once. The stock effect is not.

Hand calculation:

- Committed orders: 1 (`order-1`), intent `intent-001`, SKU `S-001`, 2 units, 1000 minor units.
- Expected stock on hand: `10 - 2 = 8`.
- Observed stock on hand: 10. Observed decrement: 0.
- Missing decrement: `2 - 0 = 2` units of `S-001`.

| Finding | Key |
| --- | --- |
| Order discrepancies | none |
| Stock discrepancy `missing-decrement` | SKU `S-001`, intent `intent-001`, source row `stock-S-001`, 2 units |

Report state: fail. The order row is present, so this is not a missing order. The duplicate-sale fixture is the one that has two committed orders and stock 6.
