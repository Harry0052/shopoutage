# Grokbot progress

Current: **P02 PASS**. Next phase is P03.

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
