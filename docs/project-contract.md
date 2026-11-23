# ShopOutage project contract

Status: accepted for implementation after P01 overlap review on 2026-11-23. Decision in `docs/overlap.md`: proceed.

## User and task

A small-business software maintainer, or a developer who integrates a point of sale, rehearses a checkout outage on a disposable demo before they trust a recovery procedure.

The task they can finish with the working release:

1. Load a local scenario that names dummy SKUs, sale intents, and connectivity events.
2. Run it through the deterministic reference adapter (no Docker, no account).
3. Read a report that compares the checkout intent log with committed orders and stock effects.
4. Reopen that report after the store process is gone.
5. Optionally, run the same scenario shape against one pinned Odoo 18 Community POS demo and keep whatever that adapter actually observed.

## MVP hypothesis

A reusable order-plus-stock reconciliation report makes a synthetic POS recovery failure easier to verify than a connectivity check alone. Toxiproxy can show that a TCP connection dropped. It cannot show whether intent `intent-001` became one order and a stock change from 10 to 8, two orders and stock 6, an order with no stock move, or a ledger that never stabilized.

## Minimum dependencies

Reference demo, required:

- Node.js 22 (verified host: v22.23.4). The drill, reconciliation engine, and tests run here.
- npm lockfile for TypeScript, Vitest, and any small parsing libraries chosen in P02.
- SQLite for drill state, via the Node.js built-in `node:sqlite` when the toolchain exposes it, so the reference path does not need a native add-on or a database server.
- Fixtures committed in the repo. The reference run must not fetch data.

Opt-in Odoo smoke, not required for the acceptance metric:

- Docker Compose on the maintainer’s machine.
- `ghcr.io/shopify/toxiproxy:2.13.0` (MIT) inside the compose network only.
- Official image `odoo:18.0-20261112` (Odoo Community, LGPL-3) and the Postgres image that image documents. Image release SHA `cd29eedcd78f286cd0e44958760f1fdaf8927dd3`.
- Playwright for the seeded POS workflow, cash tender only.

No paid services, no payment credentials, and no production credentials.

## One measurable acceptance case

Fixture `shared-s001-healthy` (also the healthy proof case):

- Reset SKU `S-001` to 10 units.
- Submit one sale intent `intent-001` for 2 units at 500 minor currency units each.
- Disconnect and reconnect.
- The report contains one committed order, a committed total of 1000 minor units, stock on hand 8, and **zero discrepancies**.
- Run the same fixture a second time from a fresh state. Discrepancy results stay zero. Ledger content is identical once clock fields are removed.

This case passes only on the reference adapter. The Odoo adapter publishes a separate observed trace and is not required to show zero discrepancies.

Hand calculation, recorded in P01: `onHand = 10 - 2 = 8`, `total = 2 * 500 = 1000`, order count `1`, discrepancy count `0`.

## Acceptance suite the later phases must keep

These travel with the build. P01’s pass uses the single case above; the rest are in scope for P03–P05.

- Seed a duplicate committed order and a missing stock effect in separate runs. The report names them by intent id and SKU (`S-001`, excess decrement of 2 units versus a missing decrement of 2 units).
- A reconnect that never converges inside the recovery deadline yields an inconclusive result. Polled observations remain in the report.
- Restart a supported demo after the intent is acknowledged. Retries are not double-counted in the expected ledger.
- A configuration that names a network or datastore outside the synthetic drill is rejected before any mutation.
- Currency enters as a decimal string or number and is stored as integer minor units. Ordering is stable.
- If an adapter cannot correlate an order to an intent, or cannot read inventory, that assertion is inconclusive rather than a silent pass.

## Boundaries

- Disposable demo databases, dummy SKUs, simulated cash tender.
- No arbitrary endpoint URLs, payment credentials, production credentials, or live charges.
- No replacement POS and no payment integration.
- Unsupported restart behavior is an explicit drill limitation, not a guessed success.
- Fault injection stays inside the declared fixture network. Teardown removes only containers the fixture created.
- Adapter credentials never appear in reports.
- An outage test must not pass while reconciliation is still inside its stability window. A deadline stores the observed layers and finishes as incomplete or inconclusive.

## Out of scope

Contributing these checks to Odoo, Toxiproxy, ShelfSync, or Commerce Reliability Kit. Those projects remain the comparison points in `docs/overlap.md`.
