# Security

ShopOutage drills a disposable demo. It does not take payment credentials or production endpoints.

## Reporting

Report a vulnerability through GitHub private vulnerability reporting on this repository. Please include the version or commit, the fixture or command you ran, and the impact you observed. Do not include real customer data, live credentials, or a production URL.

## What the drill is allowed to touch

The reference command reads a local scenario file and writes only under the directory you pass to `--out`. A scenario that names any endpoint or datastore other than the `fixture:` names in `docs/data-contract.md` is rejected before a run starts.

The optional Odoo smoke starts the compose project `shopoutage-fixture` and removes that project when it finishes. It does not accept an arbitrary store URL. The demo database password in `deploy/fixture/odoo.conf` is a fixture value for that local database.

## Supported use

Use dummy SKUs and simulated cash. Do not point the tool at a store that handles real orders.
