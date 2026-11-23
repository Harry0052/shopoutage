# Data contract 1.0.0

Normative checks live in `src/contracts/`. Fixtures under `fixtures/` are the labeled examples. The engine must not fetch these files, or anything else, at run time.

## Units

| Field | Unit |
| --- | --- |
| `unitPrice` | Simulated major units as a decimal string, at most 2 fractional digits. Currency code `XTS` (ISO 4217 test code). Not a real tender. |
| `amountCents` and `unitPriceMinor` | Integer minor units. Scale is 100 minor units per major unit. `5.00` becomes `500`. |
| `openingQty`, `quantity`, stock quantities | Integer units of the dummy SKU. |
| `offsetMs`, `recoveryDeadlineMs`, `stabilityWindowMs` | Integer milliseconds from `timeOrigin`. |
| `timeOrigin` | Absolute UTC timestamp with millisecond precision (`YYYY-MM-DDTHH:mm:ss.sssZ`). Runs must not replace it with the wall clock. |

## Scenario (input)

Schema version `1.0.0`. JSON object. Unknown properties are rejected.

| Field | Rule |
| --- | --- |
| `scenarioId`, `intentId` | `[a-z0-9][a-z0-9-]*`, length 1–64. Intent ids are unique. Array order is submit order. |
| `sku` | `[A-Z0-9][A-Z0-9-]*`, length 1–32. Unique within `seededSkus`. Every intent SKU is seeded. |
| `seededSkus` | 1–32 rows. `openingQty` integer 0–100000. |
| `intents` | 1–64 rows. `quantity` integer 1–1000. |
| `connectivity` | 1–32 events. `offsetMs` integer 0–120000, strictly increasing. Event is `submit`, `disconnect`, `reconnect`, or `restart`. |
| `injection` | `none`, `duplicate-replay`, `missing-stock`, or `never-converges`. |
| `recoveryDeadlineMs` | Integer 1–120000. |
| `stabilityWindowMs` | Integer 0–60000 and not greater than the deadline. |
| `adapter.name` | `reference` or `odoo`. |
| `adapter.endpoint` | `fixture://reference` or `fixture://odoo` only. |
| `adapter.datastore` | `fixture:memory`, `fixture:sqlite`, or `fixture:odoo-volume` only. |
| File size | 65536 bytes maximum. |

Pairing: `reference` uses `fixture://reference` and not `fixture:odoo-volume`. `odoo` uses `fixture://odoo` and `fixture:odoo-volume`.

## Error categories

| Category | Meaning |
| --- | --- |
| `malformed` | Bytes are not JSON, or an order line is not JSON. |
| `schema` | Wrong shape, missing field, unknown property, duplicate id, unknown SKU. |
| `bounds` | Number or size outside the table above. |
| `unsupported_value` | A known field has a value this version does not implement, including a bad currency or event name. |
| `boundary` | Endpoint or datastore is outside the synthetic drill. Also used when a report claims an outside mutation. |

Every rejection includes the category, the field, and the sentence `No data was mutated.` The CLI exits 2. Validation does not create a database, container, or output file.

## Orders (output JSONL)

One JSON object per line:

`intentId`, `sourceRowId`, `sku`, `quantity`, `amountCents`, `status`.

`status` is `committed`, `pending`, or `rejected`. `amountCents` is the line total in minor units.

## Report (output JSON)

`state` is one of `pass`, `fail`, `inconclusive`, `incomplete`, `unavailable`.

- `pass` and `fail` are conclusions after the stability window.
- `inconclusive` means an assertion could not be decided (no correlation id, inventory unreadable, or the ledger never stabilized) and the observations are still present.
- `incomplete` means the run stopped before the deadline logic finished.
- `unavailable` means an input the adapter needs was not available.

Order discrepancies and stock discrepancies are separate arrays. Each one names `intentId`, `sku`, and `sourceRowIds`. `mutatedOutsideFixture` must be `false`.

## Run manifest

A later run record stores `adapter.name`, `adapter.version`, `timeOrigin`, and the SHA-256 of the scenario file. The fixture manifest at `fixtures/manifest.json` already stores those hashes for the committed files.

## Expected versus observed

`expectedIntentLines` applies every intent once. That is the reference ledger. `duplicate-replay` and `missing-stock` change the observed orders or stock, not the expected ledger. The arithmetic is written out in `fixtures/oracle/`.
