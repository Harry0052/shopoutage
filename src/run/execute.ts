import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parse, resolve } from "node:path";
import { observeOdoo } from "../adapters/odoo.js";
import { ReferencePos, applyConnectivity } from "../adapters/reference.js";
import { FixtureError } from "../contracts/errors.js";
import { formatOrderJsonl } from "../contracts/orders.js";
import type { DrillReport } from "../contracts/report.js";
import { parseScenarioBytes } from "../contracts/scenario.js";
import { ledgerKey } from "../core/ledger.js";
import { reconcile } from "../core/reconcile.js";
import { observeUntilStable } from "../core/stability.js";
import { renderHtml, renderText } from "../report/render.js";
import { openDrillFile } from "../store/sqlite.js";

export interface RunOutput {
  report: DrillReport;
  reportPath: string;
  ordersPath: string;
  manifestPath: string;
  databasePath: string;
  virtualElapsedMs: number;
}

function assertOutputDirectory(outDir: string): string {
  const resolved = resolve(outDir);
  if (resolved === parse(resolved).root) {
    throw new FixtureError("bounds", "out", "Refusing to write the report to the filesystem root.");
  }
  return resolved;
}

function writeArtifacts(
  outDir: string,
  scenarioId: string,
  fixturePath: string,
  fixtureSha256: string,
  timeOrigin: string,
  adapterName: string,
  adapterVersion: string,
  virtualElapsedMs: number,
  report: DrillReport
): RunOutput {
  const resolved = assertOutputDirectory(outDir);
  mkdirSync(resolved, { recursive: true });
  const reportPath = `${resolved}/report.json`;
  const ordersPath = `${resolved}/orders.jsonl`;
  const manifestPath = `${resolved}/manifest.json`;
  const textPath = `${resolved}/report.txt`;
  const htmlPath = `${resolved}/report.html`;
  const databasePath = `${resolved}/drill.sqlite`;
  const body = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(reportPath, body);
  writeFileSync(textPath, renderText(report, fixturePath));
  writeFileSync(htmlPath, renderHtml(report, fixturePath));
  writeFileSync(ordersPath, formatOrderJsonl(report.orders));
  const manifest = {
    schemaVersion: "1.0.0",
    scenarioId,
    adapter: { name: adapterName, version: adapterVersion },
    timeOrigin,
    fixtureSha256,
    fixturePath,
    virtualElapsedMs,
    virtualClock: true,
    randomSeed: null
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(databasePath, { force: true });
  const db = openDrillFile(databasePath);
  try {
    db.prepare(
      `INSERT INTO run_manifest (
        scenario_id, adapter_name, adapter_version, time_origin, fixture_sha256, virtual_elapsed_ms, report_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(scenarioId, adapterName, adapterVersion, timeOrigin, fixtureSha256, virtualElapsedMs, report.state);
    db.prepare("INSERT INTO report (scenario_id, body) VALUES (?, ?)").run(scenarioId, body);
  } finally {
    db.close();
  }
  return { report, reportPath, ordersPath, manifestPath, databasePath, virtualElapsedMs };
}

export function runFixtureBytes(bytes: Buffer, fixturePath: string, outDir: string): RunOutput {
  const scenario = parseScenarioBytes(bytes, fixturePath);
  const fixtureSha256 = createHash("sha256").update(bytes).digest("hex");
  if (scenario.adapter.name === "odoo") {
    const observed = observeOdoo(scenario);
    return writeArtifacts(
      outDir,
      scenario.scenarioId,
      fixturePath,
      fixtureSha256,
      scenario.timeOrigin,
      scenario.adapter.name,
      scenario.adapter.version,
      0,
      observed.report
    );
  }
  const pos = new ReferencePos();
  pos.reset(scenario);
  applyConnectivity(pos, scenario);
  const observed = observeUntilStable({
    poll: () => pos.poll(),
    same: (left, right) => ledgerKey(left) === ledgerKey(right),
    advance: () => undefined,
    deadlineMs: scenario.recoveryDeadlineMs,
    stabilityWindowMs: scenario.stabilityWindowMs,
    stepMs: 100
  });
  const report = reconcile(scenario, observed);
  return writeArtifacts(
    outDir,
    scenario.scenarioId,
    fixturePath,
    fixtureSha256,
    scenario.timeOrigin,
    scenario.adapter.name,
    scenario.adapter.version,
    observed.elapsedMs,
    report
  );
}

export function runFixtureFile(fixturePath: string, outDir: string): RunOutput {
  return runFixtureBytes(readFileSync(fixturePath), fixturePath, outDir);
}

export function exitCodeForState(state: DrillReport["state"]): number {
  if (state === "pass") {
    return 0;
  }
  if (state === "fail") {
    return 3;
  }
  return 4;
}
