# Validation

Recorded 2026-11-23 on Linux x86_64, Node.js v22.23.4, npm 10.9.9. The acceptance checks use the committed synthetic fixtures. They are exact integer comparisons. There is no measured tolerance and no external dataset.

## Acceptance metric

Healthy reference fixture `fixtures/scenarios/baseline.json` (752 bytes): one committed order for intent `intent-001`, SKU `S-001`, 1000 minor units, stock on hand 8, zero discrepancies.

Two fresh output directories, wall clock 46 ms and 45 ms. The reports were identical, including every non-clock field. The reference adapter does not read the wall clock. `timeOrigin` stays `2026-01-01T00:00:00.000Z`.

Budget for this demo on a developer machine: under 2 seconds. A regression test fails the in-process run if it takes 2 seconds or longer.

## Other acceptance cases

| Case | Command result | Evidence |
| --- | --- | --- |
| Healthy twice | state `pass`, identical reports | `tests/reconcile.test.ts` |
| Duplicate sale | state `fail`, intent `intent-001`, SKU `S-001`, excess decrement 2, source rows `order-1`, `order-2`, `stock-S-001` | same, and `fixtures/oracle/duplicate-sale.md` |
| Missing stock | state `fail`, one order, missing decrement 2 on `S-001` | `fixtures/oracle/missing-stock.md` |
| Restart after ack | state `pass`, one order, stock 8 | `fixtures/oracle/restart-after-ack.md` |
| Never converges | state `inconclusive`, last order and stock kept, discrepancy arrays empty | `fixtures/oracle/never-converges.md` |
| Outside endpoint | exit 2, category `boundary`, output directory not created | `fixtures/scenarios/invalid-outside-network.json` |

`npm test` on this host: `tsc -p tsconfig.json && vitest run`, 21 tests passed. There is no separate formatter. The typecheck is the compiler gate.

## Domain safeguard

A non-zero stability window cannot pass on the first poll. `observeUntilStable` returns only after the snapshot has stayed unchanged for the whole window, or the deadline has elapsed. A deadline without a stable snapshot is `inconclusive`. The last orders and stock are still written. Adapter credentials are not part of the report. The reference path starts no containers. The Odoo smoke tears down only the compose project `shopoutage-fixture`. Its Toxiproxy upstream is hardcoded to `127.0.0.1:8069`.

## Odoo observation

Opt-in command `node scripts/odoo-smoke.mjs fixtures/out/odoo-baseline-s001` against `odoo:18.0-20261112`. Playwright opened the register and clicked a cash sale of Drill Widget while the proxy was down, then re-enabled it. The export was `{"orders":[],"onHand":10,"sku":"S-001","orderCount":0}`. State `inconclusive`. No duplicate was added. Details are in `docs/evidence/odoo-baseline-s001.json`. This is not part of the default test command. Bridge networking between containers timed out here, so that smoke uses the host network and loopback listeners.

## Trust boundaries

- Scenario files are parsed as data. Unknown properties, oversize files (above 65536 bytes), and non-fixture endpoints are rejected before any adapter write.
- Reference runs do not spawn a process and do not open a network connection.
- Writes go under the `--out` directory. The filesystem root is refused. A rerun replaces `drill.sqlite` in that directory.
- HTML reports escape text.
- `npm audit --omit=dev` reported 0 vulnerabilities. `npm audit` reports advisories in the Vitest 3.2.4 dev tree (`@vitest/mocker`, `tinypool`). They are not imported by `dist/`. The published package has no runtime dependencies.
- Runtime license is MIT. Optional images: Odoo Community LGPL-3, Toxiproxy MIT, Postgres under its own image license. They are not vendored.
- `node:sqlite` prints an ExperimentalWarning on Node 22. The drill code suppresses that one warning when it opens a database. The reference demo does not need a database server.

## Residual limits

- The Odoo browser payment did not produce a committed `pos.order` in the observed run. Stock stayed at 10. That is an inconclusive drill, not a passing recovery.
- Restart coverage is the reference adapter. The Odoo UI was not restarted mid-sale.
- Vitest dev advisories remain. They do not affect `node dist/cli.js`.
