"use strict";

const path = require("path");

/**
 * Quick-add window (FR-26 req 2).
 *
 * A small frameless window loading the SAME app bundle at the `/quick-add`
 * route. That is the whole trick: it is not a second app and not a native
 * form, so the page it renders imports the ordinary `useAppStore` and calls
 * the ordinary `addTransaction` — the exact function the main window's Add
 * Expense flow calls (req 3). A hand-rolled native dialog writing rows itself
 * would be a second write path and would drift.
 *
 * Only ever one instance: a second tray click focuses the existing window.
 */

const WIDTH = 400;
const HEIGHT = 560;

let quickAddWindow = null;

function quickAddUrl({ devMode, devUrl, scheme, host }) {
  return devMode ? `${devUrl}/quick-add` : `${scheme}://${host}/quick-add`;
}

function openQuickAdd({ electron, devMode, devUrl, scheme, host, backgroundColor }) {
  if (quickAddWindow !== null && !quickAddWindow.isDestroyed()) {
    // Already open — bring it forward rather than stacking windows.
    if (quickAddWindow.isMinimized()) quickAddWindow.restore();
    quickAddWindow.show();
    quickAddWindow.focus();
    return quickAddWindow;
  }

  const win = new electron.BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    // Quick-add is a transient capture surface reached from the tray; it
    // should sit above whatever the user was doing and not clutter the
    // taskbar with a second entry for the same app.
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  quickAddWindow = win;
  win.on("closed", () => {
    if (quickAddWindow === win) quickAddWindow = null;
  });
  // Dismiss on focus loss: a floating always-on-top window that outlives the
  // user's attention is a nuisance, and nothing here is worth preserving —
  // the draft is a few seconds of typing.
  win.on("blur", () => {
    if (!win.isDestroyed()) win.close();
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  win.loadURL(quickAddUrl({ devMode, devUrl, scheme, host }));
  return win;
}

function closeQuickAdd() {
  if (quickAddWindow !== null && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
}

function getQuickAddWindow() {
  return quickAddWindow !== null && !quickAddWindow.isDestroyed()
    ? quickAddWindow
    : null;
}

module.exports = { openQuickAdd, closeQuickAdd, getQuickAddWindow, quickAddUrl };
