"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Secure bridge between the renderer and the main process. The renderer only
// ever talks to SQLite through these whitelisted, synchronous channels — it
// never touches the database file or better-sqlite3 directly. Sync IPC is
// deliberate: the storage seam is synchronous (localStorage-shaped), and the
// main-process handlers are trivial SQLite statements.
//
// First-launch migration: before exposing the bridge, if the database is empty
// the preload ships the page origin's localStorage (the browser-era data)
// to the main process, which writes a full backup and then the rows in one
// transaction. Afterwards the app rehydrates from SQLite exactly as it used to
// from localStorage.
const storage = {
  getItem(key) {
    return ipcRenderer.sendSync("desktop:storage:get", key);
  },
  setItem(key, value) {
    return ipcRenderer.sendSync("desktop:storage:set", key, value);
  },
  removeItem(key) {
    return ipcRenderer.sendSync("desktop:storage:remove", key);
  },
  keys(prefix) {
    return ipcRenderer.sendSync("desktop:storage:keys", prefix ?? "");
  },
};

function migrateBrowserData() {
  try {
    const needsMigration = ipcRenderer.sendSync("desktop:storage:needs-migration");
    if (!needsMigration) return;
    const kv = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key !== null) kv[key] = window.localStorage.getItem(key);
    }
    if (Object.keys(kv).length === 0) return;
    const result = ipcRenderer.sendSync("desktop:storage:migrate", kv);
    if (result && result.migrated) {
      console.log(
        `[desktop] migrated ${Object.keys(kv).length} browser keys to SQLite (backup: ${result.backupKey})`,
      );
    }
  } catch (error) {
    console.warn(`[desktop] browser-data migration skipped: ${error.message}`);
  }
}

migrateBrowserData();

contextBridge.exposeInMainWorld("budgetPlannerDesktop", {
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke("desktop:app-info"),
  storage,
});
