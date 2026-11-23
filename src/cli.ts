#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FixtureError, formatFixtureError } from "./contracts/errors.js";
import { parseScenarioBytes } from "./contracts/scenario.js";

function printHelp(): void {
  process.stdout.write(
    [
      "shopoutage — validate a checkout-outage scenario fixture",
      "",
      "Usage:",
      "  shopoutage validate <fixture.json>",
      "  shopoutage --help",
      "",
      "Exit codes:",
      "  0  fixture is valid",
      "  1  usage error",
      "  2  fixture was rejected",
      ""
    ].join("\n")
  );
}

function main(argv: string[]): number {
  const [command, fixturePath] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return command === undefined ? 1 : 0;
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
    if (error instanceof FixtureError) {
      process.stderr.write(`${formatFixtureError(error)}\n`);
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`malformed: ${message} No data was mutated.\n`);
    return 2;
  }
}

const exitCode = main(process.argv.slice(2));
process.exitCode = exitCode;
