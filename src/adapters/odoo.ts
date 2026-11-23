import { spawnSync } from "node:child_process";
import type { DrillReport } from "../contracts/report.js";
import type { Scenario } from "../contracts/scenario.js";
import { guardAdapter } from "./types.js";

export const ODOO_IMAGE = "odoo:18.0-20261112";

/**
 * The Odoo path never invents a duplicate. If the pinned image cannot be
 * started, the trace says so and leaves the order and stock layers empty.
 */
export function observeOdoo(scenario: Scenario): { report: DrillReport; detail: string } {
  guardAdapter(scenario);
  const docker = spawnSync("docker", ["version"], { encoding: "utf8" });
  const detail = docker.error
    ? docker.error.message
    : (docker.stderr || docker.stdout || "docker version failed").split("\n")[0]?.slice(0, 240) ?? "docker version failed";
  const started = docker.status === 0;
  const reason = started
    ? `Docker responded, but this run did not launch ${ODOO_IMAGE} because the browser smoke is opt-in and was not selected. No duplicate was assumed.`
    : `Docker is not available (${detail}), so ${ODOO_IMAGE} was not started. No sale was submitted. No duplicate was assumed.`;
  if (started) {
    // A reachable daemon without an explicit smoke still must not guess a ledger.
    // The opt-in smoke command owns container startup. This observation records that boundary.
  }
  const report: DrillReport = {
    schemaVersion: "1.0.0",
    scenarioId: scenario.scenarioId,
    state: "unavailable",
    adapter: {
      name: "odoo",
      version: scenario.adapter.version,
      coverage: "odoo"
    },
    timeOrigin: scenario.timeOrigin,
    recoveryDeadlineMs: scenario.recoveryDeadlineMs,
    stabilityWindowMs: scenario.stabilityWindowMs,
    cutoff: {
      reached: false,
      stable: false,
      observationsPreserved: true
    },
    timeline: [],
    orders: [],
    stock: [],
    discrepancies: { orders: [], stock: [] },
    limitations: [reason],
    mutatedOutsideFixture: false
  };
  return { report, detail: reason };
}
