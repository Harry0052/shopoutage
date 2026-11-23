# shopoutage

Rehearse checkout outages in a demo store and reconcile lost or duplicated sales and stock.

The reference demo runs on your machine with Node.js. It does not call a paid service, and it does not need Docker. An Odoo Community POS smoke path is specified for a later phase and is not required to validate fixtures.

## Prerequisites

- Node.js 22.13 or newer and npm 10. Developed on Linux x86_64 with Node.js 22.23.4. The same commands are what CI runs on `ubuntu-latest`.
- No database server. Drill state uses the built-in `node:sqlite` module. On Node 22 that module is still marked experimental; the drill suppresses that single warning.
- Optional smoke only: Docker, the images in `deploy/fixture/compose.yml`, and `npx playwright install chromium`.

Fixture quantities are hand-authored dummy SKUs. The generation seed is `shopoutage-fixture-seed-v1`. Checksums, image licenses, and the Odoo and Toxiproxy pins are in `fixtures/manifest.json`. You can redistribute the fixtures with this MIT repository. They are not a merchant dataset.

## Install

```bash
npm ci
npm run build
```

## Test

```bash
npm test
```

## Validate a fixture

Accept the labeled valid scenario:

```bash
node dist/cli.js validate fixtures/scenarios/baseline.json
```

Reject a configuration that points outside the synthetic drill. The process exits 2 and does not mutate anything:

```bash
node dist/cli.js validate fixtures/scenarios/invalid-outside-network.json
```

Help:

```bash
node dist/cli.js --help
```

Exit codes: `0` valid fixture or a passing run, `1` usage error, `2` fixture rejected, `3` discrepancies found, `4` inconclusive, incomplete, or unavailable.

## Run the reference drill

Healthy case. Expect one committed order, stock on hand 8, and zero discrepancies:

```bash
node dist/cli.js run fixtures/scenarios/baseline.json --out fixtures/out/baseline-s001
```

Duplicate replay. The report names intent `intent-001`, SKU `S-001`, and a two-unit excess decrement. Exit code 3:

```bash
node dist/cli.js run fixtures/scenarios/duplicate-sale.json --out fixtures/out/duplicate-s001
```

The report is `report.json` in the output directory. `orders.jsonl` is the order export. `drill.sqlite` stores the same report so it can be reopened after the process exits. The reference adapter uses a virtual clock, so the run does not wait on the wall clock.

Odoo Community is a separate adapter. Without `--smoke` the command does not start containers:

```bash
node dist/cli.js run fixtures/scenarios/odoo-baseline.json --out fixtures/out/odoo-baseline-s001
```

The opt-in smoke needs Docker, the images named in `deploy/fixture/compose.yml`, and a Chromium build (`npx playwright install chromium`). It records whatever Odoo actually exported and does not invent a duplicate:

```bash
node dist/cli.js run fixtures/scenarios/odoo-baseline.json --out fixtures/out/odoo-baseline-s001 --smoke
```

## Layout

- `fixtures/scenarios/` — baseline, duplicate sale, missing stock, and one invalid network config.
- `fixtures/oracle/` — hand calculation for each valid scenario.
- `fixtures/expected/` — order JSONL and report JSON the core must match.
- `docs/data-contract.md` — versioned shapes, units, bounds, and error categories.
- `docs/project-contract.md` — user task and acceptance case.
- `docs/overlap.md` — why this repository is separate from Odoo, Toxiproxy, and nearby tools.

The healthy report is written to `fixtures/out/baseline-s001/report.json`, with `report.txt` and `report.html` beside it. Expect `state pass`, one committed order, stock on hand 8, and zero discrepancies. A second fresh run produces the same report. `timeOrigin` stays `2026-01-01T00:00:00.000Z`.

There is no separate hardware or live-store demo. The Odoo command above is the only optional integration, and its last observed result was inconclusive. See `docs/evidence/odoo-baseline-s001.json`.

## Project files

- `CHANGELOG.md` — version notes.
- `CONTRIBUTING.md` — how to test a change.
- `SECURITY.md` — how to report a vulnerability.
- `docs/validation.md` — acceptance evidence and the two-second demo budget.
- `docs/data-contract.md` — shapes, units, and error categories.

## License

MIT. See `LICENSE`. Third-party images used only by the optional smoke are cited in `fixtures/manifest.json` and are not vendored in this repository.
