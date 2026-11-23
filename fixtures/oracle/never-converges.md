# Oracle: never-converges-s001

Label: valid scenario, seeded non-convergence. Injection: never-converges.

The sale is submitted once: 1 committed order, 1000 minor units, stock on hand 8 if the business ledger were trusted. Each poll changes a probe counter, so the snapshot never remains the same for the 1000 ms stability window. The recovery deadline is 5000 ms.

The result is inconclusive. It is not a pass, even though the last business sample shows one order and stock 8. The last polled orders and stock are kept. Discrepancy arrays stay empty because the run did not reach a stable verdict.

No random draws are used. The probe is a counter.
