# Overlap investigation

Access date for every source below: 2026-11-23.

Decision: **proceed**. No existing tool accepts the shared fixture and reports order multiplicity together with per-SKU stock deltas after a scripted checkout disconnect. The closest projects cover one slice (a POS product, a TCP fault proxy, or an offline evidence evaluator) and leave the maintainer drill unbuilt.

## Shared fixture and acceptance metric

Held constant across every contender. This is the playbook proof case, reduced to one SKU so a hand calculation can check it.

| Field | Value |
| --- | --- |
| Scenario | `shared-s001-healthy` |
| SKU | `S-001` |
| Intent | `intent-001` |
| Opening stock | 10 units |
| Sale | 2 units at 500 minor units each |
| Expected healthy ledger | 1 committed order, 1000 minor units, stock on hand 8, delta −2, 0 discrepancies |
| Duplicate replay | 2 committed orders, stock on hand 6, excess decrement of 2 units on `S-001` / `intent-001` |
| Missing stock effect | 1 committed order, stock on hand 10, missing decrement of 2 units on `S-001` |
| Acceptance metric | Healthy reference has zero discrepancies. Duplicate and missing-effect cases are named at that intent or SKU. A second healthy pass has the same discrepancy count and the same ledger once clock fields are removed. |

Observed local calculation (Node.js v22.23.4, formula only, no contender code):

```text
node -e '<hand formula: orders * qty * price; onHand = opening - qty * orders>'
```

Result: `stableDiscrepancies: true`, `identicalNonclockLedger: true`, healthy discrepancies `0`, duplicate `excessDecrementUnits: 2` on `S-001`, missing-stock `missingDecrementUnits: 2` with one committed order. Evidence class: **observed run** of the metric, not of any contender. Full JSON is in the P01 command log in `docs/grokbot-progress.md`.

No contender could be pointed at this fixture in this session. Docker is not installed (`docker` is absent from `PATH`), so Odoo and Toxiproxy were not started. That is an unresolved live check, recorded per tool below. It does not erase the documentary feature evidence.

## Capability matrix

Columns are the acceptance behaviors a maintainer needs. A cell is `yes` only when a primary source shows that behavior.

| Capability | Odoo POS 18 Community | Toxiproxy 2.13.0 | ShelfSync | Commerce Reliability Kit 0.1.0 | retailOS inventory 0.1.2 | ShopOutage (proposed) |
| --- | --- | --- | --- | --- | --- | --- |
| Browser POS that keeps selling through a disconnect | yes | no | yes (its own till) | no | no | drives a pinned demo; does not replace a POS |
| TCP connect/disconnect injection | no | yes | no (app-level network flag) | no | no | yes, only inside the fixture network |
| Deterministic reference adapter, no store required | no | no | no | partial (synthetic scenarios, different domain) | no | yes |
| Order multiplicity compared with stock delta by intent and SKU | partial (internal idempotency test) | no | partial (recount flag, not an intent report) | partial (order and inventory checks, no POS intent) | partial (1:1 movement match, no outage) | yes |
| Inconclusive result with observations kept | no | no | no | yes | no | yes |
| Report reopens with the store stopped | session UI only while Odoo runs | no | demo UI | yes (JSON/HTML) | no | yes |
| Rejects endpoints outside the synthetic drill before mutation | no | no (API can target arbitrary upstreams) | no | no live endpoints | no | yes |

## Probes

### Odoo Point of Sale

| | |
| --- | --- |
| Primary URL | https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale.html |
| Source | https://github.com/odoo/odoo (Community), image `odoo:18.0-20261112` |
| Version | Community 18.0, image release `20261112`, deb checksum pin `ODOO_SHA=cd29eedcd78f286cd0e44958760f1fdaf8927dd3` (Docker Hub layer metadata for `library/odoo:18`, fetched 2026-11-23). Manifest digest `sha256:f5e18dea144c6054b2084874801283cf4e31868186415c19f21e3c0904545bec`. |
| License | LGPL-3.0 for Odoo 18 Community. https://raw.githubusercontent.com/odoo/documentation/18.0/content/legal/licenses.rst and https://github.com/odoo/odoo/blob/HEAD/LICENSE. Enterprise and Odoo Apps proprietary licenses are out of scope. |
| Dataset terms | No external dataset. A drill must use a disposable database, dummy SKUs, and simulated cash. Do not vendor the Odoo tree; pull the official image and cite it. |
| Evidence class | **Documentation**, plus an upstream test excerpt found by search. **Unresolved check:** this machine has no Docker, so a seeded disconnect was not reproduced here. |

Feature evidence. The 18.0 POS guide says the app works in a browser while temporarily offline and that product moves are registered in stock. It documents opening a session, selling, cash payment, and listing orders from the session report (order ref, date, receipt, total, status). It does not document an export that pairs a checkout intent id with a stock delta after a scripted disconnect. A later 19.0 page (https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html) states offline orders stay in the browser cache and sync on reconnect, and that real-time stock sync is unavailable offline. Treat the 19.0 page as supporting context, not as the pinned version.

Upstream idempotency exists inside Odoo, not as a maintainer drill. `test_double_syncing_same_order` in `addons/point_of_sale/tests/test_pos_basic_config.py` (blob `f399f99d` on GitHub, retrieved 2026-11-23) syncs one UI order twice and asserts the same `pos.order` id, one picking, one payment, and one invoice. That is order-row idempotency for an in-process test. It does not seed a missing stock effect, emit a discrepancy report, or inject a network partition.

Matching features: browser POS, offline queue, stock moves, cash tender, order list. Not matched: fault injection, reference adapter, reopenable order-plus-stock report, inconclusive cutoff, boundary rejection.

### Shopify Toxiproxy

| | |
| --- | --- |
| Primary URL | https://github.com/Shopify/toxiproxy |
| Version | 2.13.0, release commit `ff428b0` (GitHub release v2.13.0, 2026-10-14). Image `ghcr.io/shopify/toxiproxy:2.13.0`, digest `sha256:5d3dae09bc185dcc5ff6cf43abf6062a4a720aff0c4306a471e773acdcd107aa`. |
| License | MIT. https://github.com/Shopify/toxiproxy/blob/v2.13.0/LICENSE |
| Dataset terms | None. The server is a test dependency, not data. |
| Evidence class | **Documentation** (README at tag `v2.13.0`, retrieved via GitHub contents API). **Unresolved check:** Docker is not installed here, so connect/disconnect was not executed. |

Feature evidence. README states Toxiproxy simulates network conditions for tests. The `down` operation disables a named TCP proxy. Latency, timeout, reset, and packet loss are connection toxics. The HTTP API listens on port 8474 and can create a proxy to an arbitrary upstream. Nothing in the README reads an order, a payment, or a stock quantity. A green Toxiproxy check therefore proves the pipe went down and came back. Checkout invariants (one committed order, stock 8, no double count after restart) need a separate application ledger.

Matching features: deterministic disconnect and reconnect on one TCP hop. Not matched: every acceptance assertion about orders and stock. The README also warns the API is unauthenticated and can point at arbitrary upstreams, which is why ShopOutage must refuse non-fixture endpoints before any mutation and must not publish the Toxiproxy port on the host.

### ShelfSync (closest POS-shaped discovery result)

| | |
| --- | --- |
| Primary URL | https://github.com/Tariqali13/ShelfSync |
| Version | No release. Default branch `main`. Repository created 2026-08-11. 0 stars at access time. |
| License | MIT (GitHub repository metadata). |
| Dataset terms | Demo store only. Not a redistributable retail dataset. Uses Postgres plus a hosted demo; not a local disposable Odoo database. |
| Evidence class | **Documentation** (README retrieved by web search on 2026-11-23). Not executed. |

Feature evidence. ShelfSync is itself an offline-first POS. Tills queue operations in IndexedDB and replay them idempotently by client operation id. A chaos test description says three tills sell while requests are dropped or duplicated, then stock equals opening stock plus movements and each operation lands once. A discrepancy is a negative stock recount, not a report that names an intent id and a two-unit excess decrement against a saved order export. It does not drive Odoo, does not use Toxiproxy, and does not reject foreign datastores as a drill boundary.

Matching features: idempotent offline replay and a stock invariant inside one product. Not matched: the acceptance case against a reference adapter and a pinned Odoo demo, or a report that opens without that product running. Integrating ShopOutage into ShelfSync would test ShelfSync, not a maintainer’s Odoo checkout.

### Commerce Reliability Kit (closest report-shaped discovery result)

| | |
| --- | --- |
| Primary URL | https://github.com/SafetyMP/commerce-reliability-kit |
| Version | `0.1.0` in `package.json` (GitHub contents API, 2026-11-23). `"private": true`. README: no versioned package is published. Node `>=22.23.0`. |
| License | Apache-2.0 (package.json and README). |
| Dataset terms | 24 synthetic scenarios shipped with the repo. No merchant data. Callers may supply their own captures; those captures are not part of this probe. |
| Evidence class | **Documentation** plus **observed file read** of `package.json`. The CLI was not installed or run. npm has no release to execute. |

Feature evidence. The kit reproduces order, fulfillment, and inventory integration failures from files. It can mark a result inconclusive when evidence is missing, and it writes JSON and HTML. Checks named in the README are order presence, fulfillment quantities and deadlines, inventory comparison, and freshness. Scenarios are not a checkout disconnect, a restart during a sale, or a duplicate POS replay. There is no adapter for Odoo and no connectivity injector. The demo command in package.json is `demo partial-shipment`, a fulfillment case.

Matching features: saved reports, integer-friendly evidence, inconclusive verdicts. Not matched: POS outage rehearsal and the shared fixture’s exact stock arithmetic. Contributing a POS drill here would change that project’s scope from offline evidence evaluation to a browser automation harness. The report ideas are worth copying in spirit (inconclusive is distinct from pass and fail). The repository should stay separate.

### @devx-retailos/inventory (closest registry result)

| | |
| --- | --- |
| Primary URL | https://www.npmjs.com/package/@devx-retailos/inventory |
| Version | 0.1.2, published metadata updated 2026-08-03. |
| License | MIT (npm page). |
| Dataset terms | None. A Medusa v2 plugin. |
| Evidence class | **Documentation** (npm registry page). Not installed. |

Feature evidence. Append-only stock movements and a `reconcile` helper that matches one POS row to one external row. It does not compute on-hand balances, does not model a checkout outage, and does not talk to Odoo. It fails the acceptance metric because a summed stock delta and an order multiplicity are outside its 1:1 matcher.

### Other discovery notes

- `dc-tech-inc/dotnet-pos-integration` documents sale-once booking and `Opening - OnHand = SUM(Applied)`. It is an integration reference with its own POS contract, not a fault-injection drill and not a TypeScript fixture runner. Not executed.
- `promantia-ltd/POSpire` pull 38 describes an offline outbox inside that POS. It is the product under test, not a reusable harness.
- `posnic.com` publishes a blank drill spreadsheet (task list only, no expected quantities). Not a runner.
- ECOSIRE “POS Offline Mode Pro” is a paid Odoo app. Out of scope: no paid services, and it extends POS rather than auditing it.
- GitHub repository search for `POS offline replay inventory reconciliation outage` and `toxiproxy POS checkout resilience` returned `total_count: 0` on 2026-11-23. Web search was required to find the projects above.
- npm has no package whose name or description is a checkout-outage reconciliation drill.

## What already matches, and what does not

Already available, and therefore not worth rewriting:

- Odoo 18 Community already is the browser POS with offline cache, cash payment, orders, and stock moves.
- Toxiproxy 2.13.0 already cuts and restores a TCP connection.
- Commerce Reliability Kit already shows that a file-based report can say inconclusive and still keep the observations.

Not available as one workflow:

- A local command that resets dummy stock to 10, submits intent `intent-001` for two units of `S-001`, disconnects, reconnects, and prints zero discrepancies with stock 8.
- The same command with a seeded duplicate that names `S-001` and a two-unit excess decrement, and a seeded missing stock effect distinguished from that duplicate.
- A non-converging reconnect that stays inconclusive with the polled observations saved.
- A restart after the intent is acknowledged that does not double-count.
- Rejection of a config that points at a network or datastore outside the synthetic environment, before any write.

## Remaining uncertainties

- Live Odoo 18.0 behavior under a Toxiproxy `down` was not observed here. Official docs support offline sale and later sync; they do not promise a stable stock export at an arbitrary recovery deadline. The Odoo adapter must record the observed trace and may mark stock or correlation inconclusive. That limitation is in scope, not a reason to hold.
- Odoo’s browser selectors for Playwright will have to be learned against image `18.0-20261112`. If the UI cannot complete a cash sale without Enterprise modules, the adapter must say so and the reference adapter still has to pass the acceptance metric.
- Docker is absent on this research host. Later phases need Docker only for the opt-in Odoo smoke, not for the reference demo.
- ShelfSync and Commerce Reliability Kit were not executed. Their READMEs are specific enough to show they do not consume the shared fixture. A later run is unnecessary for the proceed decision.

## Decision

**Proceed** with a separate ShopOutage repository.

Do not integrate into Odoo: the idempotency test is an upstream unit test, and a drill runner does not belong in the POS addon. Do not integrate into Toxiproxy: it has no order or stock model. Do not fold into ShelfSync or Commerce Reliability Kit: each would have to grow a pinned Odoo browser drill and a fixture network boundary that those projects do not have. Copy the useful ideas (Toxiproxy for the fault, an inconclusive verdict, a report that outlives the store) into a small TypeScript runner whose default path is the deterministic reference adapter.

Provenance path is viable without paid services and without redistributing third-party source:

- Drill runner and fixtures: written in this repo, MIT, generated dummy SKUs, seed recorded in the fixture manifest.
- Fault proxy: pull `ghcr.io/shopify/toxiproxy:2.13.0` (MIT). Do not vendor the binary.
- POS under test: pull `odoo:18.0-20261112` (LGPL-3 Community) plus its documented Postgres dependency. Do not copy Odoo source into this repo. Pin the image tag and the deb SHA above. Screenshots, if any later phase needs them, are of the local dummy store and may be committed only with that attribution.
