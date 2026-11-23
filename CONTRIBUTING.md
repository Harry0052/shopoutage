# Contributing

Issues and pull requests are welcome.

1. Install Node.js 22.13 or newer.
2. Run `npm ci`, then `npm test`.
3. Keep fixtures synthetic. Do not add customer data, live credentials, or a production URL.
4. The reference demo must stay runnable without Docker and without a paid service.
5. If you change a scenario, update `fixtures/manifest.json` checksums and the matching oracle in `fixtures/oracle/`.

The optional Odoo smoke is `node dist/cli.js run fixtures/scenarios/odoo-baseline.json --out fixtures/out/odoo-baseline-s001 --smoke`. It needs Docker and `npx playwright install chromium`. It is not part of `npm test`.
