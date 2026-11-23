# Oracle: restart-after-ack

Label: valid. Injection: none. The intent is acknowledged while the adapter is online, then the client restarts and retries on reconnect.

Hand calculation. Opening stock 10. Intent `intent-001` sells 2 units at 500 minor units, total `2 * 500 = 1000`. The server already holds that commit, so the retry matches the intent id and adds nothing.

| Check | Expected |
| --- | --- |
| Committed orders | 1 (`order-1`) |
| Amount | 1000 minor units |
| Stock on hand | 8 (`10 - 2`) |
| Discrepancies | 0 |
| Report state | pass |

A second order or stock on hand 6 would mean the retry was counted twice.
