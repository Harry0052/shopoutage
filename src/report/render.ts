import type { DrillReport } from "../contracts/report.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderText(report: DrillReport, fixturePath: string): string {
  const lines = [
    `ShopOutage report`,
    `scenario: ${report.scenarioId}`,
    `fixture: ${fixturePath}`,
    `state: ${report.state}`,
    `adapter: ${report.adapter.name} ${report.adapter.version} (${report.adapter.coverage})`,
    `time origin: ${report.timeOrigin}`,
    `recovery deadline: ${report.recoveryDeadlineMs} ms`,
    `stability window: ${report.stabilityWindowMs} ms`,
    `cutoff: reached=${report.cutoff.reached} stable=${report.cutoff.stable} observations=${report.cutoff.observationsPreserved}`,
    `currency: simulated XTS minor units (100 per major unit)`,
    ``,
    `Timeline`,
    ...(report.timeline.length === 0
      ? ["  (none)"]
      : report.timeline.map((entry) => `  ${entry.offsetMs} ms  ${entry.event}`)),
    ``,
    `Orders`,
    ...(report.orders.length === 0
      ? ["  (none)"]
      : report.orders.map(
          (order) =>
            `  ${order.sourceRowId}  intent ${order.intentId}  ${order.sku}  qty ${order.quantity}  ${order.amountCents} minor  ${order.status}`
        )),
    ``,
    `Stock`,
    ...(report.stock.length === 0
      ? ["  (none)"]
      : report.stock.map(
          (row) =>
            `  ${row.sourceRowId}  intent ${row.intentId}  ${row.sku}  opening ${row.openingQty}  expected ${row.expectedQty}  observed ${row.observedQty}`
        )),
    ``,
    `Order discrepancies`,
    ...(report.discrepancies.orders.length === 0
      ? ["  (none)"]
      : report.discrepancies.orders.map(
          (row) =>
            `  ${row.kind}  intent ${row.intentId}  ${row.sku}  rows ${row.sourceRowIds.join(", ") || "(none)"}  expected ${row.expected}  observed ${row.observed}`
        )),
    ``,
    `Stock discrepancies`,
    ...(report.discrepancies.stock.length === 0
      ? ["  (none)"]
      : report.discrepancies.stock.map(
          (row) =>
            `  ${row.kind}  intent ${row.intentId}  ${row.sku}  rows ${row.sourceRowIds.join(", ")}  ${row.units} units`
        )),
    ``,
    `Limitations`,
    ...(report.limitations.length === 0 ? ["  (none)"] : report.limitations.map((line) => `  ${line}`)),
    ``
  ];
  return `${lines.join("\n")}\n`;
}

export function renderHtml(report: DrillReport, fixturePath: string): string {
  const text = renderText(report, fixturePath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ShopOutage ${escapeHtml(report.scenarioId)}</title>
  <style>
    body { font-family: ui-sans-serif, sans-serif; margin: 2rem; color: #172026; }
    pre { white-space: pre-wrap; font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <h1>ShopOutage ${escapeHtml(report.scenarioId)}</h1>
  <p>State <strong>${escapeHtml(report.state)}</strong>. Adapter ${escapeHtml(report.adapter.coverage)}. Amounts are simulated XTS minor units.</p>
  <pre>${escapeHtml(text)}</pre>
</body>
</html>
`;
}
