# shopoutage

Rehearse checkout outages in a demo store and reconcile lost or duplicated sales and stock.

The reference demo runs on your machine with Node.js. It does not call a paid service, and it does not need Docker. An Odoo Community POS smoke path is specified for a later phase and is not required to validate fixtures.

## Prerequisites

- Node.js 22.13 or newer (developed on Node.js 22.23.4) and npm 10.
- No database server. Drill state uses the built-in `node:sqlite` module, which prints an ExperimentalWarning on Node 22.
- Optional, not used by the commands below: Docker, for a future Odoo 18 Community smoke (`odoo:18.0-20261112`, LGPL-3) and Toxiproxy 2.13.0 (MIT).

Fixture quantities are hand-authored dummy data. See `fixtures/manifest.json` for checksums, the generation seed, and third-party image terms.

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

Exit codes: `0` valid, `1` usage error, `2` fixture rejected.

## Layout

- `fixtures/scenarios/` — baseline, duplicate sale, missing stock, and one invalid network config.
- `fixtures/oracle/` — hand calculation for each valid scenario.
- `fixtures/expected/` — order JSONL and report JSON the core must match.
- `docs/data-contract.md` — versioned shapes, units, bounds, and error categories.
- `docs/project-contract.md` — user task and acceptance case.
- `docs/overlap.md` — why this repository is separate from Odoo, Toxiproxy, and nearby tools.

## License

MIT. See `LICENSE`.
