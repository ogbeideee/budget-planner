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

// Custom title bar: keep the native overlay controls in sync with the app's
// theme (colors come from the renderer's design tokens, hex only).
const windowControls = {
  setTitleBarOverlay: (payload) =>
    ipcRenderer.send("desktop:window:setTitleBarOverlay", payload),
  show: (deepLink) => ipcRenderer.invoke("desktop:window:show", deepLink),
};

// Tray + background mode (FR-26). The renderer OWNS the setting (it lives in
// AppState); this channel only mirrors it into the main process, which is the
// only place that can act on a window `close` event.
const backgroundMode = {
  set: (enabled) => ipcRenderer.invoke("desktop:background-mode:set", enabled),
  get: () => ipcRenderer.invoke("desktop:background-mode:get"),
};

const quickAdd = {
  open: () => ipcRenderer.invoke("desktop:quick-add:open"),
  close: () => ipcRenderer.invoke("desktop:quick-add:close"),
  /** Announce a save so other windows rehydrate. Carries NO transaction data —
   *  the row is already persisted through the ordinary storage seam. */
  saved: () => ipcRenderer.invoke("desktop:quick-add:saved"),
};

// Cross-window state invalidation: main -> renderer, same subscribe shape as
// the menu bridge so callers get an unsubscribe back.
const appEvents = {
  onStateChanged(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("desktop:state:changed", listener);
    return () => ipcRenderer.removeListener("desktop:state:changed", listener);
  },
  onNavigate(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, route) => callback(route);
    ipcRenderer.on("desktop:navigate", listener);
    return () => ipcRenderer.removeListener("desktop:navigate", listener);
  },
  // FR-24 sync stage: main → renderer. The alerts payload is the parser-ready
  // plain-text conversion — never a password, never a raw HTML body. The
  // result summary is safe counts/identity only and carries NO message content.
  onEmailAlerts(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:email:alerts", listener);
    return () => ipcRenderer.removeListener("desktop:email:alerts", listener);
  },
  onEmailSyncResult(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("desktop:email:sync-result", listener);
    return () => ipcRenderer.removeListener("desktop:email:sync-result", listener);
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

// Credential vault (FR-24). Deliberately WRITE-AND-FORGET: there is no
// `reveal`/`get` here and there must never be one. The main process decrypts
// only when it opens a connection, so the renderer — the part of the app that
// runs web content — can never read the stored email password.
const credentials = {
  isAvailable: () => ipcRenderer.invoke("desktop:credentials:available"),
  set: (account, secret) =>
    ipcRenderer.invoke("desktop:credentials:set", { account, secret }),
  status: (account) => ipcRenderer.invoke("desktop:credentials:status", account),
  clear: (account) => ipcRenderer.invoke("desktop:credentials:clear", account),
};

// Email connection + sync operations (FR-24). The password in a connect/test
// payload travels once, into main, and nothing here can ever read it back —
// there is no such channel. Status and results are safe identity data only.
// IMAP networking itself happens entirely in main; `check` runs the SAME
// canonical sync the scheduler and the tray call, and the fetched messages
// arrive through `appEvents.onEmailAlerts`.
const email = {
  connect: (payload) => ipcRenderer.invoke("desktop:email:connect", payload),
  test: (payload) => ipcRenderer.invoke("desktop:email:test", payload),
  disconnect: () => ipcRenderer.invoke("desktop:email:disconnect"),
  status: () => ipcRenderer.invoke("desktop:email:status"),
  setAccount: (payload) => ipcRenderer.invoke("desktop:email:set-account", payload),
  check: () => ipcRenderer.invoke("desktop:email:check"),
  syncStatus: () => ipcRenderer.invoke("desktop:email:sync-status"),
  confirmProcessed: (payload) =>
    ipcRenderer.invoke("desktop:email:confirm-processed", payload),
};

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
  credentials,
  email,
  menu,
  window: windowControls,
  backgroundMode,
  quickAdd,
  appEvents,
});
