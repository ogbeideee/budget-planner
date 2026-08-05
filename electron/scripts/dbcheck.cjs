// Verifies the better-sqlite3 native module loads under the Electron runtime
// and that a basic SQLite roundtrip works. Run via `npm run db:check`.
// Must live inside the project: it requires better-sqlite3 from the project's
// own node_modules, so the binary was built for the matching Electron ABI.
"use strict";

const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PROJECT_ROOT = path.join(__dirname, "..", "..");

app.whenReady().then(() => {
  const tempDirs = [];
  try {
    const Database = require(path.join(PROJECT_ROOT, "node_modules", "better-sqlite3"));
    const db = new Database(":memory:");
    db.exec("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO kv VALUES (?, ?)").run("a", "b");
    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get("a");
    console.log(
      `SQLITE_OK electron=${process.versions.electron} modules=${process.versions.modules} value=${row.value}`,
    );
    db.close();

    // Exercise the first-launch migration (success + forced failure) against
    // throwaway databases in a temp directory, then clean up.
    const { openDatabase } = require(path.join(PROJECT_ROOT, "electron", "db.cjs"));

    const okDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dbcheck-ok-"));
    tempDirs.push(okDir);
    const okDb = openDatabase(okDir);
    const ok = okDb.migrateBrowserData({
      "budget-planner:state": "{\"version\":3}",
      "settings:favourite-icons": "[]",
    });
    const okRows = okDb.count();
    const okMarker = okDb.get("migration:browser:done") !== null;
    const okBackup = okDb.keys("budget-planner:backup:migration-browser:").length === 1;
    const okState = okDb.get("budget-planner:state");
    okDb.close();
    if (!ok.migrated || okRows !== 4 || !okMarker || !okBackup || okState !== "{\"version\":3}") {
      throw new Error(
        `migration success path broken (migrated=${ok.migrated} rows=${okRows} marker=${okMarker} backup=${okBackup})`,
      );
    }
    console.log("MIGRATE_OK rows=4 backup=true marker=true");

    const failDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dbcheck-fail-"));
    tempDirs.push(failDir);
    const failDb = openDatabase(failDir);
    failDb.close();
    const fail = failDb.migrateBrowserData({ "budget-planner:state": "x" });
    if (!fail.error || fail.migrated !== false) {
      throw new Error(
        `migration failure path broken (migrated=${fail.migrated} error=${fail.error})`,
      );
    }
    // After a failure the db must still be empty: the transaction rolled back
    // and the original data is untouched.
    const countDb = new Database(path.join(failDir, "budget-planner.sqlite3"));
    const failRows = countDb
      .prepare("SELECT COUNT(*) AS n FROM kv")
      .get().n;
    countDb.close();
    if (failRows !== 0) {
      throw new Error(`failed migration left ${failRows} rows behind`);
    }
    console.log(
      `MIGRATE_FAIL_OK error="${fail.error}" rows_after_failure=0 retry_ready=true`,
    );

    const target = process.argv.find((arg) => arg.endsWith(".sqlite3"));
    if (target) {
      const real = new Database(target, { readonly: true });
      const info = real
        .prepare("SELECT key, length(value) AS bytes FROM kv ORDER BY key")
        .all();
      console.log(`DB_OK file=${target} rows=${info.length}`);
      for (const entry of info) {
        console.log(`  ${entry.key} (${entry.bytes} bytes)`);
      }
      real.close();
    }
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup; the OS will reclaim any stragglers
      }
    }
    app.exit(0);
  } catch (error) {
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup; the OS will reclaim any stragglers
      }
    }
    console.error(`SQLITE_FAIL: ${error.stack || error.message}`);
    app.exit(1);
  }
});
