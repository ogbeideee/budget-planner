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

// Phase 3: native desktop features. Every call crosses IPC into the main
// process; the renderer never touches the file system or dialogs directly.
const dialog = {
  open: (options) => ipcRenderer.invoke("desktop:dialog:open", options),
  save: (options) => ipcRenderer.invoke("desktop:dialog:save", options),
};

const fs = {
  writeText: (payload) => ipcRenderer.invoke("desktop:fs:writeText", payload),
  readText: (payload) => ipcRenderer.invoke("desktop:fs:readText", payload),
};

const shell = {
  openPath: (target) => ipcRenderer.invoke("desktop:shell:openPath", target),
  showItemInFolder: (target) =>
    ipcRenderer.invoke("desktop:shell:showItemInFolder", target),
};

const backups = {
  create: (content) => ipcRenderer.sendSync("desktop:backup:create", content),
  list: () => ipcRenderer.invoke("desktop:backup:list"),
  read: (payload) => ipcRenderer.invoke("desktop:backup:read", payload),
  delete: (payload) => ipcRenderer.invoke("desktop:backup:delete", payload),
  restoreLatest: () => ipcRenderer.invoke("desktop:backup:restoreLatest"),
};

// Menu events flow main -> renderer; the renderer registers one callback
// (the bridge forwards the unsubscription so listeners can be cleaned up).
const menu = {
  on(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, action) => callback(action);
    ipcRenderer.on("desktop:menu:action", listener);
    return () => ipcRenderer.removeListener("desktop:menu:action", listener);
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
    } else if (result && result.error) {
      // The main process already notified the user; the browser data is
      // untouched and the migration retries on the next launch.
      console.error(
        `[desktop] browser-data migration failed: ${result.error} — browser data is intact, will retry on next launch`,
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
  dialog,
  fs,
  shell,
  notify: (payload) => ipcRenderer.invoke("desktop:notify", payload),
  paths: () => ipcRenderer.invoke("desktop:paths"),
  backups,
  menu,
});
