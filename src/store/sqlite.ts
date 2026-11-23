import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);

function openDatabase(filename: string): DatabaseSync {
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning, ...args: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning instanceof Error ? warning.message : "";
    if (text.includes("SQLite is an experimental feature")) {
      return;
    }
    return original(warning, ...(args as []));
  }) as typeof process.emitWarning;
  try {
    const sqlite = require("node:sqlite") as typeof import("node:sqlite");
    const db = new sqlite.DatabaseSync(filename);
    db.exec(SCHEMA);
    return db;
  } finally {
    process.emitWarning = original;
  }
}

/**
 * Drill-state tables. `node:sqlite` is still marked experimental on Node 22,
 * so callers should expect one ExperimentalWarning. The reference demo does
 * not need a database server.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS run_manifest (
    scenario_id TEXT NOT NULL,
    adapter_name TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    time_origin TEXT NOT NULL,
    fixture_sha256 TEXT NOT NULL,
    virtual_elapsed_ms INTEGER NOT NULL,
    report_state TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS report (
    scenario_id TEXT PRIMARY KEY,
    body TEXT NOT NULL
  );
`;

export function openMemoryDrillState(): DatabaseSync {
  return openDatabase(":memory:");
}

export function openDrillFile(filename: string): DatabaseSync {
  return openDatabase(filename);
}
