import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function run(args: string[]) {
  return spawnSync(process.execPath, ["dist/cli.js", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
}

describe("shopoutage validate", () => {
  it("accepts the valid fixture", () => {
    const result = run(["validate", "fixtures/scenarios/baseline.json"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("valid scenario baseline-s001");
    expect(result.stdout).toContain("No data was mutated.");
    expect(result.stderr).toBe("");
  });

  it("rejects the outside-network fixture with an actionable error", () => {
    const result = run(["validate", "fixtures/scenarios/invalid-outside-network.json"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("boundary:");
    expect(result.stderr).toContain("https://erp.example.com");
    expect(result.stderr).toContain("No data was mutated.");
    expect(result.stdout).toBe("");
  });

  it("prints help and rejects a missing path", () => {
    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("shopoutage validate <fixture.json>");
    const missing = run(["validate"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("requires a fixture path");
  });
});
