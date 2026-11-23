# Changelog

## 0.1.0

- Reference drill for a seeded checkout: healthy sale, duplicate replay, missing stock, restart after acknowledge, and a reconnect that does not converge.
- Reports in JSON, plain text, and HTML. Orders are also exported as JSONL.
- Scenarios that point outside the synthetic fixture are rejected before any write.
- Optional Odoo 18 Community smoke. It records the exported orders and stock and does not invent a duplicate. It is not part of the default test run.
