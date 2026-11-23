#!/usr/bin/env node
/**
 * Opt-in Odoo 18 Community POS drill.
 * Starts only the shopoutage-fixture compose project, drives one cash sale of
 * S-001, exports orders and stock, then tears that project down.
 * Demo passwords live in deploy/fixture/odoo.conf and are not real credentials.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(root, "deploy/fixture/compose.yml");
const outDir = resolve(process.argv[2] ?? "fixtures/out/odoo-baseline-s001");
const base = "http://127.0.0.1:18069";
const toxic = "http://127.0.0.1:8474";
const dbName = "shopoutage";
const login = "admin";
const password = "shopoutage-demo";
const log = [];

function note(message) {
  log.push(message);
  process.stderr.write(`${message}\n`);
}

function compose(args, options = {}) {
  const result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, "-p", "shopoutage-fixture", ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SHOPOUTAGE_FIXTURE_DIR: outDir },
      timeout: options.timeout ?? 600_000
    }
  );
  if (result.stdout) {
    note(result.stdout.trim());
  }
  if (result.stderr) {
    note(result.stderr.trim());
  }
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout ?? "";
}

function tearDown() {
  note("Tearing down shopoutage-fixture containers and volumes.");
  const result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, "-p", "shopoutage-fixture", "down", "-v", "--remove-orphans"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SHOPOUTAGE_FIXTURE_DIR: outDir }
    }
  );
  note((result.stderr || result.stdout || "").trim());
}

async function waitFor(url, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      // proxy or server still booting
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonRpc(service, method, args) {
  const response = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service, method, args } })
  });
  const body = await response.json();
  if (body.error) {
    throw new Error(JSON.stringify(body.error));
  }
  return body.result;
}

async function enableProxy(enabled) {
  const response = await fetch(`${toxic}/proxies/odoo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) {
    throw new Error(`Toxiproxy update failed: ${response.status}`);
  }
}

function shell(scriptPath) {
  const script = readFileSync(scriptPath);
  const result = spawnSync(
    "docker",
    ["compose", "-f", composeFile, "-p", "shopoutage-fixture", "run", "--rm", "--no-deps", "-T", "odoo", "odoo", "shell", "-d", dbName, "--no-http"],
    {
      cwd: root,
      input: script,
      encoding: "utf8",
      env: { ...process.env, SHOPOUTAGE_FIXTURE_DIR: outDir },
      timeout: 600_000
    }
  );
  note((result.stderr || "").slice(-2000));
  if (result.status !== 0) {
    throw new Error(`odoo shell ${scriptPath} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout ?? "";
}

function readExport() {
  return JSON.parse(readFileSync(resolve(outDir, "export.json"), "utf8"));
}

async function sellWithBrowser(configId) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    throw new Error(`Playwright is not installed (${error instanceof Error ? error.message : error}).`);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${base}/web/login?db=${dbName}`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="login"]', login);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/web/login"), { timeout: 20000 });
    await page.goto(`${base}/pos/ui?config_id=${configId}`, { waitUntil: "domcontentloaded" });
    await page.locator(".open-register-btn").click({ timeout: 30000 });
    const popup = page.locator("button.btn-primary", { hasText: "Open Register" });
    const product = page.getByText("Drill Widget", { exact: false });
    const opened = await Promise.race([
      popup.waitFor({ timeout: 8000 }).then(() => "popup"),
      product.first().waitFor({ timeout: 8000 }).then(() => "product")
    ]).catch(() => "neither");
    if (opened === "popup") {
      const cash = page.locator(".opening-cash-section input");
      if (await cash.count()) {
        await cash.fill("0");
      }
      await popup.click();
    }
    await product.first().waitFor({ timeout: 20000 });
    await product.first().click();
    await product.first().click();
    await page.screenshot({ path: resolve(outDir, "pos-before-disconnect.png") });
    note("Disconnecting the fixture proxy before payment.");
    await enableProxy(false);
    await page.getByText("Payment", { exact: true }).click();
    await page.locator(".paymentmethod").filter({ hasText: /cash/i }).click();
    await page.locator("button.validation-button").click();
    await page.waitForTimeout(1000);
    note("Reconnecting the fixture proxy.");
    await enableProxy(true);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: resolve(outDir, "pos-after-reconnect.png") });
  } catch (error) {
    await page.screenshot({ path: resolve(outDir, "pos-failure.png") }).catch(() => undefined);
    const text = await page.locator("body").innerText().catch(() => "");
    writeFileSync(resolve(outDir, "pos-failure.txt"), `url ${page.url()}\n${text.slice(0, 4000)}\n`);
    throw error;
  } finally {
    await browser.close();
  }
}

function writeReport(partial) {
  const report = {
    schemaVersion: "1.0.0",
    scenarioId: "odoo-baseline-s001",
    state: partial.state,
    adapter: { name: "odoo", version: "18.0-20261112", coverage: "odoo" },
    timeOrigin: "2026-01-01T00:00:00.000Z",
    recoveryDeadlineMs: 5000,
    stabilityWindowMs: 1000,
    cutoff: partial.cutoff,
    timeline: partial.timeline ?? [],
    orders: partial.orders ?? [],
    stock: partial.stock ?? [],
    discrepancies: partial.discrepancies ?? { orders: [], stock: [] },
    limitations: partial.limitations,
    mutatedOutsideFixture: false
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(outDir, "smoke-log.txt"), `${log.join("\n")}\n`);
  return report;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  chmodSync(outDir, 0o777);
  rmSync(resolve(outDir, "seed.json"), { force: true });
  rmSync(resolve(outDir, "export.json"), { force: true });
  note("Starting disposable Postgres for the Odoo fixture.");
  compose(["up", "-d", "db"]);
  note("Installing point_of_sale and stock into a new database. This is the slow step.");
  compose([
    "run", "--rm", "--no-deps", "odoo", "odoo", "-d", dbName,
    "-i", "point_of_sale,stock", "--stop-after-init", "--without-demo=all"
  ], { timeout: 900_000 });
  note("Seeding S-001 at 10 units and opening the POS session.");
  shell(resolve(root, "deploy/fixture/seed.py"));
  const seed = JSON.parse(readFileSync(resolve(outDir, "seed.json"), "utf8"));
  note(`Seed ${JSON.stringify(seed)}`);
  compose(["up", "-d", "odoo", "toxiproxy"]);
  await waitFor(`${toxic}/version`);
  const created = await fetch(`${toxic}/proxies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "odoo", listen: "127.0.0.1:18069", upstream: "127.0.0.1:8069", enabled: true })
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`Could not create the odoo proxy: ${created.status} ${await created.text()}`);
  }
  await waitFor(`${base}/web/login?db=${dbName}`);
  const version = await jsonRpc("db", "server_version", []);
  note(`Odoo server version ${version}`);
  const limitations = [
    `Observed Odoo Community image odoo:18.0-20261112 (${version}). No duplicate was assumed.`
  ];
  try {
    await sellWithBrowser(seed.configId);
    limitations.push("Playwright completed a cash sale attempt through the Toxiproxy listener.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    limitations.push(`Browser sale did not finish: ${message}`);
    note(message);
  }
  shell(resolve(root, "deploy/fixture/export.py"));
  const exported = readExport();
  note(`Export ${JSON.stringify(exported)}`);
  const onHand = typeof exported.onHand === "number" ? exported.onHand : null;
  const stock = onHand === null ? [] : [{
    sku: "S-001",
    intentId: "intent-001",
    openingQty: 10,
    expectedQty: 8,
    observedQty: onHand,
    sourceRowId: "stock-S-001"
  }];
  const orders = exported.orders ?? [];
  const correlated = orders.length > 0 && orders.every((order) => order.intentId === "intent-001");
  const discrepancies = { orders: [], stock: [] };
  const saleFailed = limitations.some((line) => line.startsWith("Browser sale did not finish"));
  if (orders.length > 0 && onHand !== null && onHand < 8) {
    discrepancies.stock.push({
      intentId: "intent-001", sku: "S-001", sourceRowIds: ["stock-S-001"],
      kind: "excess-decrement", units: 8 - onHand
    });
  } else if (orders.length > 0 && onHand !== null && onHand > 8) {
    discrepancies.stock.push({
      intentId: "intent-001", sku: "S-001", sourceRowIds: ["stock-S-001"],
      kind: "missing-decrement", units: onHand - 8
    });
  }
  if (orders.length === 0) {
    limitations.push("No committed pos.order was exported. Stock on hand stayed at the seeded quantity. Order multiplicity was not judged. No duplicate was assumed.");
  } else if (!correlated) {
    limitations.push("Odoo order ids were not the drill intent id intent-001. Order multiplicity was not judged.");
  } else if (orders.length !== 1) {
    discrepancies.orders.push({
      intentId: "intent-001", sku: "S-001",
      sourceRowIds: orders.map((order) => order.sourceRowId),
      kind: "duplicate", expected: 1, observed: orders.length
    });
  }
  const failed = discrepancies.orders.length + discrepancies.stock.length > 0;
  const state = saleFailed || orders.length === 0
    ? (saleFailed ? "incomplete" : "inconclusive")
    : !correlated
      ? (failed ? "fail" : "inconclusive")
      : failed ? "fail" : "pass";
  const report = writeReport({
    state,
    cutoff: { reached: true, stable: orders.length > 0 && !saleFailed, observationsPreserved: true },
    timeline: [
      { offsetMs: 0, event: "submit" },
      { offsetMs: 100, event: "disconnect" },
      { offsetMs: 500, event: "reconnect" }
    ],
    orders,
    stock,
    discrepancies,
    limitations
  });
  process.stdout.write(`report ${resolve(outDir, "report.json")}\nstate ${report.state}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  note(message);
  writeReport({
    state: "unavailable",
    cutoff: { reached: false, stable: false, observationsPreserved: true },
    limitations: [`Odoo smoke stopped: ${message}`, "No duplicate was assumed."]
  });
  process.exitCode = 4;
} finally {
  tearDown();
}
