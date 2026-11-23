import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FixtureError,
  decimalToMinorUnits,
  expectedIntentLines,
  expectedOnHand,
  guardAdapter,
  openMemoryDrillState,
  parseOrderJsonl,
  parseReport,
  parseScenarioBytes
} from "../src/index.ts";

const root = new URL("..", import.meta.url);

function read(path: string): Buffer {
  return readFileSync(new URL(path, root));
}

describe("scenario validation", () => {
  it("accepts the baseline, duplicate, and missing-stock fixtures", () => {
    for (const path of [
      "fixtures/scenarios/baseline.json",
      "fixtures/scenarios/duplicate-sale.json",
      "fixtures/scenarios/missing-stock.json"
    ]) {
      const scenario = parseScenarioBytes(read(path), path);
      expect(scenario.schemaVersion).toBe("1.0.0");
      expect(scenario.intents.map((intent) => intent.intentId)).toEqual(["intent-001"]);
      expect(expectedIntentLines(scenario)).toEqual([
        { intentId: "intent-001", sku: "S-001", quantity: 2, amountCents: 1000 }
      ]);
      expect(expectedOnHand(scenario, "S-001")).toBe(8);
    }
  });

  it("rejects an endpoint outside the synthetic drill before any mutation", () => {
    expect(() => parseScenarioBytes(read("fixtures/scenarios/invalid-outside-network.json"))).toThrow(
      FixtureError
    );
    try {
      parseScenarioBytes(read("fixtures/scenarios/invalid-outside-network.json"));
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureError);
      const fixtureError = error as FixtureError;
      expect(fixtureError.category).toBe("boundary");
      expect(fixtureError.field).toBe("adapter.endpoint");
      expect(fixtureError.mutated).toBe(false);
      expect(fixtureError.message).toContain("https://erp.example.com");
      expect(fixtureError.message).toContain("fixture://reference");
    }
  });

  it("rejects malformed JSON and oversized files", () => {
    expect(() => parseScenarioBytes(Buffer.from("{"))).toThrowError(/not valid JSON/);
    const huge = Buffer.alloc(65_537, 0x20);
    expect(() => parseScenarioBytes(huge)).toThrowError(/65536/);
  });

  it("converts decimal prices to integer minor units", () => {
    expect(decimalToMinorUnits("5.00", "unitPrice")).toBe(500);
    expect(decimalToMinorUnits("5", "unitPrice")).toBe(500);
    expect(decimalToMinorUnits("5.5", "unitPrice")).toBe(550);
    expect(() => decimalToMinorUnits("5.555", "unitPrice")).toThrow(FixtureError);
    expect(() => decimalToMinorUnits("-1.00", "unitPrice")).toThrow(FixtureError);
  });
});

describe("oracles", () => {
  it("matches the hand calculation written for each labeled fixture", () => {
    const baseline = readFileSync(new URL("fixtures/oracle/baseline.md", root), "utf8");
    expect(baseline).toContain("2 * 500 = 1000");
    expect(baseline).toContain("stock on hand");
    expect(baseline).toContain("8");
    expect(baseline).toContain("Discrepancies");

    const duplicate = readFileSync(new URL("fixtures/oracle/duplicate-sale.md", root), "utf8");
    expect(duplicate).toContain("Excess decrement");
    expect(duplicate).toContain("2");
    expect(duplicate).toContain("intent-001");
    expect(duplicate).toContain("S-001");

    const missing = readFileSync(new URL("fixtures/oracle/missing-stock.md", root), "utf8");
    expect(missing).toContain("Missing decrement");
    expect(missing).toContain("Observed stock on hand: 10");

    const orders = parseOrderJsonl(readFileSync(new URL("fixtures/expected/baseline.orders.jsonl", root), "utf8"));
    expect(orders).toEqual([
      {
        intentId: "intent-001",
        sourceRowId: "order-1",
        sku: "S-001",
        quantity: 2,
        amountCents: 1000,
        status: "committed"
      }
    ]);

    const duplicateReport = parseReport(
      JSON.parse(readFileSync(new URL("fixtures/expected/duplicate-sale.report.json", root), "utf8"))
    );
    expect(duplicateReport.state).toBe("fail");
    expect(duplicateReport.discrepancies.stock[0]).toMatchObject({
      sku: "S-001",
      intentId: "intent-001",
      kind: "excess-decrement",
      units: 2
    });

    const missingReport = parseReport(
      JSON.parse(readFileSync(new URL("fixtures/expected/missing-stock.report.json", root), "utf8"))
    );
    expect(missingReport.discrepancies.orders).toEqual([]);
    expect(missingReport.discrepancies.stock[0]?.kind).toBe("missing-decrement");
    expect(missingReport.stock[0]?.observedQty).toBe(10);

    const baselineReport = parseReport(
      JSON.parse(readFileSync(new URL("fixtures/expected/baseline.report.json", root), "utf8"))
    );
    expect(baselineReport.state).toBe("pass");
    expect(baselineReport.discrepancies.orders).toEqual([]);
    expect(baselineReport.discrepancies.stock).toEqual([]);
    expect(baselineReport.mutatedOutsideFixture).toBe(false);
  });

  it("records fixture hashes that match the files on disk", () => {
    const manifest = JSON.parse(readFileSync(new URL("fixtures/manifest.json", root), "utf8")) as {
      generationSeed: string;
      files: { path: string; sha256: string }[];
    };
    expect(manifest.generationSeed).toBe("shopoutage-fixture-seed-v1");
    expect(manifest.files.length).toBeGreaterThan(0);
    for (const file of manifest.files) {
      const digest = createHash("sha256").update(read(file.path)).digest("hex");
      expect(digest, file.path).toBe(file.sha256);
    }
  });
});

describe("drill state", () => {
  it("stores a manifest row in memory without a database server", () => {
    const db = openMemoryDrillState();
    const scenario = parseScenarioBytes(read("fixtures/scenarios/baseline.json"));
    db.prepare(
      `INSERT INTO run_manifest (
        scenario_id, adapter_name, adapter_version, time_origin, fixture_sha256, virtual_elapsed_ms, report_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(scenario.scenarioId, scenario.adapter.name, scenario.adapter.version, scenario.timeOrigin, "abc", 0, "pass");
    const row = db.prepare("SELECT scenario_id, adapter_version FROM run_manifest").get() as {
      scenario_id: string;
      adapter_version: string;
    };
    expect(row.scenario_id).toBe("baseline-s001");
    expect(row.adapter_version).toBe("0.1.0");
    db.close();
    expect(() => guardAdapter(scenario)).not.toThrow();
  });
});
