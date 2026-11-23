export { LIMITS, SCHEMA_VERSION, CURRENCY } from "./contracts/limits.js";
export { FixtureError, formatFixtureError } from "./contracts/errors.js";
export type { ErrorCategory } from "./contracts/errors.js";
export { decimalToMinorUnits } from "./contracts/money.js";
export {
  assertSyntheticBoundary,
  parseScenario,
  parseScenarioBytes
} from "./contracts/scenario.js";
export type {
  AdapterConfig,
  ConnectivityEvent,
  SaleIntent,
  Scenario,
  SeededSku
} from "./contracts/scenario.js";
export { formatOrderJsonl, parseOrderJsonl, parseOrderRow } from "./contracts/orders.js";
export type { OrderRow } from "./contracts/orders.js";
export { parseReport } from "./contracts/report.js";
export type { DrillReport, ReportState } from "./contracts/report.js";
export { expectedIntentLines, expectedOnHand } from "./core/expected.js";
export type { ExpectedIntentLine } from "./core/expected.js";
export { guardAdapter } from "./adapters/types.js";
export type { LedgerSnapshot, PosAdapter } from "./adapters/types.js";
export { openMemoryDrillState } from "./store/sqlite.js";
