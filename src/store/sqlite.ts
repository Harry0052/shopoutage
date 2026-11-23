import { DatabaseSync } from "node:sqlite";

/**
 * Drill-state tables. `node:sqlite` is still marked experimental on Node 22,
 * so callers should expect one ExperimentalWarning. The reference demo does
 * not need a database server.
 */
export function openMemoryDrillState(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE run_manifest (
      scenario_id TEXT NOT NULL,
      adapter_name TEXT NOT NULL,
      adapter_version TEXT NOT NULL,
      time_origin TEXT NOT NULL,
      fixture_sha256 TEXT NOT NULL
    );
  `);
  return db;
}
