#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureError, formatFixtureError } from "./contracts/errors.js";
import { parseScenarioBytes } from "./contracts/scenario.js";
import type { DrillReport } from "./contracts/report.js";
import { exitCodeForState, runFixtureFile } from "./run/execute.js";

function printHelp(): void {
  process.stdout.write(
    [
      "shopoutage — rehearse a checkout outage and reconcile orders with stock",
      "",
      "Usage:",
      "  shopoutage validate <fixture.json>",
      "  shopoutage run <fixture.json> --out <directory>",
      "  shopoutage run fixtures/scenarios/odoo-baseline.json --out <directory> --smoke",
      "  shopoutage --help",
      "",
      "Exit codes:",
      "  0  valid fixture, or a run whose report state is pass",
      "  1  usage error",
      "  2  fixture was rejected",
      "  3  report state is fail (discrepancies were found)",
      "  4  report state is inconclusive, incomplete, or unavailable",
      ""
    ].join("\n")
  );
}

function runCommand(argv: string[]): number {
  let fixturePath: string | undefined;
  let outDir: string | undefined;
  let smoke = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      outDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--smoke") {
      smoke = true;
      continue;
    }
    if (arg === undefined) {
      continue;
    }
    if (arg.startsWith("-")) {
      process.stderr.write(`Unknown option "${arg}". Run shopoutage --help.\n`);
      return 1;
    }
    if (fixturePath !== undefined) {
      process.stderr.write("run accepts one fixture path. Run shopoutage --help.\n");
      return 1;
    }
    fixturePath = arg;
  }
  if (fixturePath === undefined || outDir === undefined || outDir.length === 0) {
    process.stderr.write("run requires a fixture path and --out <directory>. Run shopoutage --help.\n");
    return 1;
  }
  try {
    if (smoke) {
      return runOdooSmoke(resolve(fixturePath), resolve(outDir));
    }
    const result = runFixtureFile(resolve(fixturePath), resolve(outDir));
    const findings = result.report.discrepancies.orders.length + result.report.discrepancies.stock.length;
    process.stdout.write(`report ${result.reportPath}\nstate ${result.report.state}\ndiscrepancies ${findings}\n`);
    return exitCodeForState(result.report.state);
  } catch (error) {
    return reportError(error);
  }
}

function main(argv: string[]): number {
  const [command, fixturePath] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return command === undefined ? 1 : 0;
  }
  if (command === "run") {
    return runCommand(argv.slice(1));
  }
  if (command !== "validate") {
    process.stderr.write(`Unknown command "${command}". Run shopoutage --help.\n`);
    return 1;
  }
  if (fixturePath === undefined) {
    process.stderr.write("validate requires a fixture path. Run shopoutage --help.\n");
    return 1;
  }
  try {
    const bytes = readFileSync(resolve(fixturePath));
    const scenario = parseScenarioBytes(bytes, fixturePath);
    process.stdout.write(
      `valid scenario ${scenario.scenarioId} (schema ${scenario.schemaVersion}, adapter ${scenario.adapter.name} ${scenario.adapter.version}). No data was mutated.\n`
    );
    return 0;
  } catch (error) {
    return reportError(error);
  }
}

function runOdooSmoke(fixturePath: string, outDir: string): number {
  const bytes = readFileSync(fixturePath);
  const scenario = parseScenarioBytes(bytes, fixturePath);
  if (scenario.adapter.name !== "odoo") {
    process.stderr.write("boundary: --smoke is only valid for the odoo adapter. No data was mutated.\n");
    return 2;
  }
  const script = fileURLToPath(new URL("../scripts/odoo-smoke.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [script, outDir], { stdio: "inherit" });
  if (child.error) {
    process.stderr.write(`unavailable: ${child.error.message} No duplicate was assumed.\n`);
    return 4;
  }
  try {
    const report = JSON.parse(readFileSync(resolve(outDir, "report.json"), "utf8")) as DrillReport;
    const findings = report.discrepancies.orders.length + report.discrepancies.stock.length;
    process.stdout.write(`report ${resolve(outDir, "report.json")}\nstate ${report.state}\ndiscrepancies ${findings}\n`);
    return child.status === 0 ? exitCodeForState(report.state) : (child.status ?? 4);
  } catch {
    return child.status ?? 4;
  }
}

function reportError(error: unknown): number {
  if (error instanceof FixtureError) {
    process.stderr.write(`${formatFixtureError(error)}\n`);
    return 2;
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`malformed: ${message} No data was mutated.\n`);
  return 2;
}

const exitCode = main(process.argv.slice(2));
process.exitCode = exitCode;
