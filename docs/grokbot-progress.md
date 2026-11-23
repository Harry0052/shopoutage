# Grokbot progress

Current: **P06 PASS**. Next phase is P07.

## P01 — Research overlap and confirm the MVP

**Phase and status:** P01 PASS

**Files changed:**

- `docs/overlap.md`
- `docs/project-contract.md`
- `docs/grokbot-progress.md`

**Commands and results:**

- `git status`, `git log`, `git remote -v` on 2026-11-23. Repository `Harry0052/shopoutage` at `6eb45dd`, files `README.md` and `LICENSE` (MIT). Clean `main`.
- `node --version` → `v22.23.4`. `npm --version` → `10.9.9`. `docker --version` → `docker missing`.
- GitHub repository search `POS offline replay inventory reconciliation outage` → `total_count: 0`.
- GitHub repository search `toxiproxy POS checkout resilience` → `total_count: 0`.
- Web search and GitHub contents/API reads for Odoo POS 18, Toxiproxy 2.13.0, ShelfSync, Commerce Reliability Kit 0.1.0, and `@devx-retailos/inventory` 0.1.2. Citations and evidence class are in `docs/overlap.md`.
- Shared-fixture hand calculation (observed):

```json
{
  "healthyA": { "committedOrders": 1, "monetaryTotalCents": 1000, "stockOnHand": 8, "discrepancies": 0 },
  "stableDiscrepancies": true,
  "identicalNonclockLedger": true,
  "duplicate": { "committedOrders": 2, "stockOnHand": 6, "excessDecrementUnits": 2 },
  "missingStock": { "committedOrders": 1, "stockOnHand": 10, "missingDecrementUnits": 2 }
}
```

**Artifact paths:**

- `docs/overlap.md`
- `docs/project-contract.md`

**Open issues:**

- Docker is not installed on this host. Live Odoo disconnect and Toxiproxy up/down were not executed. Documentary evidence is enough for the proceed decision. The Odoo smoke remains opt-in until a later phase has Docker.
- Playwright selectors for Odoo 18.0.20261112 are not yet verified.

**Next phase:** P02 — Create the repository and data contracts.

**Gate:** The overlap evidence supports a concrete MVP hypothesis (order-plus-stock report versus a connectivity check). Fixture data is generated in-repo. Toxiproxy and Odoo Community have a pinned, license-compatible provenance path and are not vendored. No existing workflow covers the acceptance case, so the decision is proceed rather than hold.

## P02 — Create the repository and data contracts

**Phase and status:** P02 PASS

**Files changed:**

- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- `src/cli.ts`, `src/index.ts`, `src/contracts/*`, `src/core/expected.ts`, `src/adapters/types.ts`, `src/store/sqlite.ts`
- `fixtures/scenarios/*`, `fixtures/expected/*`, `fixtures/oracle/*`, `fixtures/manifest.json`
- `docs/data-contract.md`, `README.md`, `docs/grokbot-progress.md`
- `tests/validate.test.ts`, `tests/cli.test.ts`

**Commands and results:**

- `npm install` — added the lockfile. Direct devDependencies: `typescript@5.9.3`, `vitest@3.2.4`, `@types/node@22.19.0`. Runtime dependencies: none.
- `npm test` (`tsc -p tsconfig.json && vitest run`) — 2 files, 10 tests passed. Node.js v22.23.4. `node:sqlite` prints an ExperimentalWarning once.
- `node dist/cli.js validate fixtures/scenarios/baseline.json` — exit 0. `valid scenario baseline-s001 (schema 1.0.0, adapter reference 0.1.0). No data was mutated.`
- `node dist/cli.js validate fixtures/scenarios/invalid-outside-network.json` — exit 2. `boundary: adapter.endpoint is "https://erp.example.com", which is outside the synthetic drill environment. Allowed values: fixture://reference, fixture://odoo. No data was mutated.`
- `npm audit --omit=dev` — 0 vulnerabilities. `npm audit` reports 3 issues in the Vitest dev tree (`@vitest/mocker`, `tinypool`). Left for P05; they are not on the runtime path.

**Artifact paths:**

- Valid fixture: `fixtures/scenarios/baseline.json`
- Invalid fixture: `fixtures/scenarios/invalid-outside-network.json`
- Oracles: `fixtures/oracle/baseline.md`, `fixtures/oracle/duplicate-sale.md`, `fixtures/oracle/missing-stock.md`
- Contract: `docs/data-contract.md`
- Checksums: `fixtures/manifest.json` (seed `shopoutage-fixture-seed-v1`)

**Open issues:**

- Vitest 3.2.4 dev-tree advisories (GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8, GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr). Runtime install is clean.
- `node:sqlite` is experimental on Node 22.
- Docker is still absent, so the Odoo adapter is specified and not executed.

**Next phase:** P03 — Build the working core.

**Gate:** The documented toolchain installs, `tsc` emits `dist/`, and the public CLI accepts the valid fixture and rejects the outside-network fixture with category `boundary` before any mutation.

## P03 — Build the working core

**Phase and status:** P03 PASS

**Files changed:** `src/core/*`, `src/adapters/reference.ts`, `src/adapters/odoo.ts`, `src/run/execute.ts`, `src/cli.ts`, `fixtures/scenarios/restart-after-ack.json`, `fixtures/scenarios/never-converges.json`, `fixtures/scenarios/odoo-baseline.json`, `fixtures/oracle/restart-after-ack.md`, `fixtures/oracle/never-converges.md`, `tests/reconcile.test.ts`, `deploy/fixture/*`, `scripts/odoo-smoke.mjs`, `docs/evidence/odoo-baseline-s001.json`.

**Commands and results:**

- `npm test` — typecheck and Vitest, 22 tests passed after the workflow tests in P04 were included. The core assertions were already green at 20 tests before the printable report.
- `node dist/cli.js run fixtures/scenarios/baseline.json --out fixtures/out/baseline-s001` — exit 0, `state pass`, `discrepancies 0`. Report: one order, stock observed 8.
- `node dist/cli.js run fixtures/scenarios/duplicate-sale.json --out fixtures/out/duplicate-s001` — exit 3, `state fail`, `discrepancies 2`. Excess decrement of 2 units on `S-001` / `intent-001`.
- `node dist/cli.js run fixtures/scenarios/missing-stock.json --out fixtures/out/missing-stock-s001` — exit 3, missing decrement of 2, one committed order.
- `node dist/cli.js run fixtures/scenarios/restart-after-ack.json --out fixtures/out/restart-after-ack` — exit 0, one order, stock 8.
- `node dist/cli.js run fixtures/scenarios/never-converges.json --out fixtures/out/never-converges-s001` — exit 4, `state inconclusive`, observations kept.
- Two fresh runs of the healthy fixture were byte-identical and finished in 46 ms and 45 ms.
- Odoo smoke `node scripts/odoo-smoke.mjs fixtures/out/odoo-baseline-s001` against image `odoo:18.0-20261112`. Export `{"orders":[],"onHand":10,"sku":"S-001","orderCount":0}`. State inconclusive. No duplicate was invented. See `docs/evidence/odoo-baseline-s001.json`.

**Artifact paths:**

- `fixtures/out/baseline-s001/report.json` (gitignored run output)
- `docs/evidence/odoo-baseline-s001.json`

**Open issues:**

- The Odoo browser payment did not create a committed `pos.order` in the observed run. Stock stayed 10. That limitation is recorded, not treated as a pass.
- Bridge networking between containers timed out, so the smoke uses the host network and loopback.

**Next phase:** P04

**Gate:** The public `run` command processes the real fixtures, matches the hand oracles, and distinguishes the duplicate and missing-stock cases by intent and SKU.

## P04 — Ship the user workflow and reports

**Phase and status:** P04 PASS

**Files changed:** `src/report/render.ts`, `src/run/execute.ts`, `src/cli.ts`, `README.md`, `tests/reconcile.test.ts`.

**Commands and results:**

- `node dist/cli.js --help` — documents `validate`, `run`, `--out`, `--smoke`, and exit codes 0, 1, 2, 3, and 4.
- Healthy run writes `report.json`, `report.txt`, `report.html`, `orders.jsonl`, `manifest.json`, and `drill.sqlite`. Stdout is three stable lines (`report`, `state`, `discrepancies`). The human report is the text file.
- `report.txt` for the duplicate run names `excess-decrement`, intent `intent-001`, SKU `S-001`, and source rows `order-1, order-2`. The fixture path in the text is `fixtures/scenarios/duplicate-sale.json`, which a reviewer can open next to `fixtures/oracle/duplicate-sale.md`.
- `node dist/cli.js validate fixtures/scenarios/invalid-outside-network.json` — exit 2. Stderr: `boundary: adapter.endpoint is "https://erp.example.com", which is outside the synthetic drill environment. Allowed values: fixture://reference, fixture://odoo. No data was mutated.`
- `node dist/cli.js run` of that same invalid file exits 2 and does not create the output directory.

**Artifact paths:** `fixtures/out/baseline-s001/report.txt`, `fixtures/out/baseline-s001/report.html`, `fixtures/out/duplicate-s001/report.txt`.

**Open issues:** none in the reference workflow. The Odoo smoke remains opt-in and inconclusive, as recorded in P03.

**Next phase:** P05

**Gate:** A documented command finishes the healthy demo and writes an inspectable report. The rejected input explains the boundary category and does not mutate anything.

## P05 — Verify correctness, security, and performance

**Phase and status:** P05 PASS

**Files changed:** `docs/validation.md`, `tests/reconcile.test.ts`.

**Commands and results:**

- `npm test` — 22 tests passed, including the two-second budget, the repeat run, the boundary rejection, and the domain cases in the playbook.
- Fresh baseline pair: 46 ms and 45 ms, identical JSON, zero discrepancies, stock 8. Budget is 2 seconds. Evidence and host details are in `docs/validation.md`.
- `npm audit --omit=dev` — 0 vulnerabilities. Dev-tree Vitest advisories are recorded and are not on the runtime path.
- Outside-network run creates no directory. Stability window test does not accept the first sample.

**Artifact paths:** `docs/validation.md`.

**Open issues:** Vitest dev advisories; Odoo sale did not commit an order in the observed smoke.

**Next phase:** P06

**Gate:** Every required acceptance assertion has an observed result. The performance budget passes. The boundary check and the inconclusive timeout behave as specified.

## P06 — Prepare a reproducible open-source release

**Phase and status:** P06 PASS

**Files changed:** `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`, `package-lock.json`.

**Commands and results:**

- README install is `npm ci` then `npm run build`. The demo command is `node dist/cli.js run fixtures/scenarios/baseline.json --out fixtures/out/baseline-s001`. Expected result is state pass, stock 8, report under that directory.
- CI workflow uses `contents: read` by default, pins actions by commit SHA, runs `npm ci`, `npm test`, and the demo, and uploads the report. It does not use secrets.
- Clean copy in `/tmp/shopoutage-clean` (no `node_modules`, no `dist`): `npm ci`, `npm test` (22 tests passed), then `node dist/cli.js run fixtures/scenarios/baseline.json --out /tmp/shopoutage-clean-out`. Result: state `pass`, stock on hand 8, zero discrepancies.

**Artifact paths:** `.github/workflows/ci.yml`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.

**Open issues:** Hosted CI is verified in P07.

**Next phase:** P07

**Gate:** The repository documents the install, the demo, the license, fixture terms, and the CI checks. Hosted CI is the P07 gate.
