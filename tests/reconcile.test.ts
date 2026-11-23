import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FixtureError,
  UNSTABLE_LIMITATION,
  observeUntilStable,
  openDrillFile,
  runFixtureFile
} from "../src/index.ts";

const root = new URL("..", import.meta.url);

function outDir(): string {
  return mkdtempSync(join(tmpdir(), "shopoutage-"));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

describe("reference drill", () => {
  it("matches the healthy oracle and repeats the same ledger", () => {
    const first = runFixtureFile("fixtures/scenarios/baseline.json", outDir());
    const second = runFixtureFile("fixtures/scenarios/baseline.json", outDir());
    expect(first.report).toEqual(readJson("fixtures/expected/baseline.report.json"));
    expect(second.report).toEqual(first.report);
    expect(first.report.state).toBe("pass");
    expect(first.report.discrepancies.orders).toEqual([]);
    expect(first.report.discrepancies.stock).toEqual([]);
    expect(first.report.orders).toHaveLength(1);
    expect(first.report.stock[0]?.observedQty).toBe(8);
    expect(first.virtualElapsedMs).toBe(1000);
    const orders = readFileSync(first.ordersPath, "utf8");
    expect(orders).toBe(readFileSync(new URL("fixtures/expected/baseline.orders.jsonl", root), "utf8"));
  });

  it("names the duplicate intent and the two-unit excess decrement", () => {
    const result = runFixtureFile("fixtures/scenarios/duplicate-sale.json", outDir());
    expect(result.report).toEqual(readJson("fixtures/expected/duplicate-sale.report.json"));
    expect(result.report.discrepancies.orders[0]).toMatchObject({
      intentId: "intent-001",
      sku: "S-001",
      kind: "duplicate",
      expected: 1,
      observed: 2
    });
    expect(result.report.discrepancies.stock[0]).toMatchObject({
      intentId: "intent-001",
      sku: "S-001",
      kind: "excess-decrement",
      units: 2
    });
    expect(result.report.stock[0]?.observedQty).toBe(6);
    const text = readFileSync(join(result.reportPath, "..", "report.txt"), "utf8");
    expect(text).toContain("intent intent-001");
    expect(text).toContain("S-001");
    expect(text).toContain("excess-decrement");
    expect(text).toContain("order-1, order-2");
    expect(text).toContain("fixtures/scenarios/duplicate-sale.json");
  });

  it("distinguishes a committed order with a missing stock effect", () => {
    const result = runFixtureFile("fixtures/scenarios/missing-stock.json", outDir());
    expect(result.report).toEqual(readJson("fixtures/expected/missing-stock.report.json"));
    expect(result.report.discrepancies.orders).toEqual([]);
    expect(result.report.discrepancies.stock[0]).toMatchObject({
      sku: "S-001",
      intentId: "intent-001",
      kind: "missing-decrement",
      units: 2
    });
    expect(result.report.stock[0]?.observedQty).toBe(10);
  });

  it("does not double-count a retry after the intent was acknowledged", () => {
    const result = runFixtureFile("fixtures/scenarios/restart-after-ack.json", outDir());
    expect(result.report.state).toBe("pass");
    expect(result.report.orders).toHaveLength(1);
    expect(result.report.orders[0]?.amountCents).toBe(1000);
    expect(result.report.stock[0]?.observedQty).toBe(8);
    expect(result.report.discrepancies.orders).toEqual([]);
    expect(result.report.discrepancies.stock).toEqual([]);
  });

  it("keeps observations when the reconnect never converges", () => {
    const result = runFixtureFile("fixtures/scenarios/never-converges.json", outDir());
    expect(result.report.state).toBe("inconclusive");
    expect(result.report.cutoff.stable).toBe(false);
    expect(result.report.cutoff.observationsPreserved).toBe(true);
    expect(result.report.limitations).toEqual([UNSTABLE_LIMITATION]);
    expect(result.report.orders).toHaveLength(1);
    expect(result.report.stock[0]?.observedQty).toBe(8);
    expect(result.report.discrepancies.orders).toEqual([]);
    expect(result.report.discrepancies.stock).toEqual([]);
    expect(result.virtualElapsedMs).toBe(5000);
  });

  it("rejects an outside endpoint before creating the output directory", () => {
    const parent = outDir();
    const target = join(parent, "not-created");
    expect(() => runFixtureFile("fixtures/scenarios/invalid-outside-network.json", target)).toThrow(FixtureError);
    expect(existsSync(target)).toBe(false);
  });

  it("finishes the healthy drill inside the two-second budget", () => {
    const dir = outDir();
    const started = performance.now();
    const result = runFixtureFile("fixtures/scenarios/baseline.json", dir);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.report.state).toBe("pass");
  });

  it("can be run twice into the same output directory", () => {
    const dir = outDir();
    runFixtureFile("fixtures/scenarios/baseline.json", dir);
    const second = runFixtureFile("fixtures/scenarios/baseline.json", dir);
    expect(second.report.state).toBe("pass");
  });

  it("reopens the saved report from SQLite without the adapter running", () => {
    const result = runFixtureFile("fixtures/scenarios/baseline.json", outDir());
    const db = openDrillFile(result.databasePath);
    const row = db.prepare("SELECT body, scenario_id FROM report").get() as { body: string; scenario_id: string };
    expect(row.scenario_id).toBe("baseline-s001");
    expect(JSON.parse(row.body)).toEqual(result.report);
    db.close();
  });
});

describe("stability window", () => {
  it("does not accept the first sample when the window is non-zero", () => {
    let polls = 0;
    const result = observeUntilStable({
      deadlineMs: 5000,
      stabilityWindowMs: 1000,
      stepMs: 100,
      advance: () => undefined,
      same: (left: { probe: number }, right: { probe: number }) => left.probe === right.probe,
      poll: () => {
        polls += 1;
        return { probe: polls < 3 ? polls : 3 };
      }
    });
    expect(result.stable).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(1000);
    expect(result.polls).toBeGreaterThan(1);
    expect(polls).toBe(result.polls);
  });
});

describe("odoo observation", () => {
  it("records an unavailable trace and does not invent a duplicate", () => {
    const result = runFixtureFile("fixtures/scenarios/odoo-baseline.json", outDir());
    expect(result.report.state).toBe("unavailable");
    expect(result.report.adapter.coverage).toBe("odoo");
    expect(result.report.orders).toEqual([]);
    expect(result.report.stock).toEqual([]);
    expect(result.report.discrepancies.orders).toEqual([]);
    expect(result.report.discrepancies.stock).toEqual([]);
    expect(result.report.mutatedOutsideFixture).toBe(false);
    expect(result.report.limitations.join("\n")).toContain("No duplicate was assumed");
    expect(result.report.limitations.join("\n")).toContain("odoo:18.0-20261112");
  });
});

describe("public run command", () => {
  it("writes the baseline report and a failing duplicate report", () => {
    const healthy = outDir();
    const duplicate = outDir();
    const pass = spawnSync(process.execPath, ["dist/cli.js", "run", "fixtures/scenarios/baseline.json", "--out", healthy], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    expect(pass.status).toBe(0);
    expect(pass.stdout).toContain("state pass");
    expect(pass.stdout).toContain("discrepancies 0");
    const fail = spawnSync(
      process.execPath,
      ["dist/cli.js", "run", "fixtures/scenarios/duplicate-sale.json", "--out", duplicate],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" }
    );
    expect(fail.status).toBe(3);
    expect(fail.stdout).toContain("state fail");
    const report = JSON.parse(readFileSync(join(healthy, "report.json"), "utf8"));
    expect(report.stock[0].observedQty).toBe(8);
  });
});
