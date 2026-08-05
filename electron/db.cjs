// SQLite persistence for the desktop shell. This module is the ONLY place
// better-sqlite3 is used and the ONLY code that touches the database file:
// the renderer never sees SQLite, it talks to the main process over IPC.
//
// Layout: a single key/value table mirroring the web app's localStorage keys
// (`budget-planner:state`, backups, categorization, disclosure, icon lists…).
// Schema is versioned via PRAGMA user_version so a later phase can normalize
// records into dedicated tables while migrating kv rows.
"use strict";

const path = require("path");
const Database = require("better-sqlite3");

const KV_TABLE = "kv";
const MIGRATION_MARKER = "migration:browser:done";
const MIGRATION_BACKUP_PREFIX = "budget-planner:backup:migration-browser:";

function timestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function openDatabase(userDataDir) {
  const file = path.join(userDataDir, "budget-planner.sqlite3");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS kv (" +
      "key TEXT PRIMARY KEY NOT NULL," +
      "value TEXT NOT NULL" +
      ") WITHOUT ROWID;",
  );
  db.pragma("user_version = 1");

  const getStmt = db.prepare("SELECT value FROM kv WHERE key = ?");
  const setStmt = db.prepare(
    "INSERT INTO kv (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const removeStmt = db.prepare("DELETE FROM kv WHERE key = ?");
  const keysStmt = db.prepare("SELECT key FROM kv WHERE key LIKE ? ORDER BY key");
  const countStmt = db.prepare("SELECT COUNT(*) AS n FROM kv");
  const insertStmt = db.prepare("INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)");

  const api = {
    file,
    get(key) {
      const row = getStmt.get(key);
      return row === undefined ? null : row.value;
    },
    set(key, value) {
      setStmt.run(key, value);
      return true;
    },
    remove(key) {
      removeStmt.run(key);
      return true;
    },
    keys(prefix = "") {
      return keysStmt.all(`${prefix}%`).map((row) => row.key);
    },
    count() {
      return countStmt.get().n;
    },
    // The browser-localStorage payload arrives through the preload on first
    // launch. Everything is committed in one transaction and a full backup of
    // the browser data is written BEFORE the migrated rows, so a migration
    // failure can never destroy the source of truth.
    migrateBrowserData(kv) {
      if (api.get(MIGRATION_MARKER) !== null || api.count() > 0) {
        return { migrated: false, backupKey: null };
      }
      const entries = Object.entries(kv).filter(
        ([key, value]) =>
          typeof key === "string" &&
          key.length > 0 &&
          typeof value === "string",
      );
      if (entries.length === 0) {
        return { migrated: false, backupKey: null };
      }
      const backupKey = `${MIGRATION_BACKUP_PREFIX}${timestampToken()}`;
      const backupValue = JSON.stringify({
        app: "budget-planner",
        backup: true,
        kind: "migration-browser",
        createdAt: new Date().toISOString(),
        sourceVersion: "browser",
        raw: JSON.stringify(Object.fromEntries(entries)),
      });
      const run = db.transaction(() => {
        insertStmt.run(backupKey, backupValue);
        for (const [key, value] of entries) {
          insertStmt.run(key, value);
        }
        insertStmt.run(MIGRATION_MARKER, new Date().toISOString());
      });
      run();
      return { migrated: true, backupKey };
    },
    info() {
      return {
        file,
        count: api.count(),
        migrated: api.get(MIGRATION_MARKER) !== null,
      };
    },
    close() {
      db.close();
    },
  };
  return api;
}

module.exports = { openDatabase, MIGRATION_MARKER };
