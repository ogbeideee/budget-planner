// Verifies the better-sqlite3 native module loads under the Electron runtime
// and that a basic SQLite roundtrip works. Run via `npm run db:check`.
// Must live inside the project: it requires better-sqlite3 from the project's
// own node_modules, so the binary was built for the matching Electron ABI.
"use strict";

const { app } = require("electron");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..");

app.whenReady().then(() => {
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
    app.exit(0);
  } catch (error) {
    console.error(`SQLITE_FAIL: ${error.stack || error.message}`);
    app.exit(1);
  }
});
