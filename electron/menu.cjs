// Native application menu for the desktop shell.
//
// Rules:
// - Menu items that only need main-process state (open/reveal folders,
//   About) act here directly.
// - Menu items that need renderer data (import/export/backup/restore) send
//   "desktop:menu:action" to the focused window; the renderer owns the app
//   flow (it holds the state and the toast system).
// - Standard Edit roles (undo/copy/...) are required on Windows for
//   clipboard shortcuts to work in text inputs.
"use strict";

const { app, dialog, Menu, shell } = require("electron");
const { checkForUpdatesNow, feedDescription } = require("./updater.cjs");

const MENU_ACTIONS = {
  export: "export",
  import: "import",
  backupNow: "backup-now",
  restoreLatest: "restore-latest",
};

function sendMenuAction(win, action) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("desktop:menu:action", action);
  }
}

function sendToFocused(action, getFocusedWindow) {
  const win = getFocusedWindow();
  sendMenuAction(win, action);
  return win;
}

function buildApplicationMenu({ getFocusedWindow, getBackupsDir, getDataDir }) {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Import data…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendToFocused(MENU_ACTIONS.import, getFocusedWindow),
        },
        {
          label: "Export data…",
          accelerator: "CmdOrCtrl+S",
          click: () => sendToFocused(MENU_ACTIONS.export, getFocusedWindow),
        },
        { type: "separator" },
        {
          label: "Back up now",
          accelerator: "CmdOrCtrl+B",
          click: () => sendToFocused(MENU_ACTIONS.backupNow, getFocusedWindow),
        },
        {
          label: "Restore latest backup",
          accelerator: "CmdOrCtrl+Shift+B",
          click: () =>
            sendToFocused(MENU_ACTIONS.restoreLatest, getFocusedWindow),
        },
        { type: "separator" },
        {
          label: "Open backup folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => shell.openPath(getBackupsDir()),
        },
        {
          label: "Reveal data folder",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => shell.openPath(getDataDir()),
        },
        { type: "separator" },
        { role: "quit", label: "Quit", accelerator: "CmdOrCtrl+Q" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload", accelerator: "CmdOrCtrl+R" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize", label: "Minimize" }, { role: "close", label: "Close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for updates…",
          click: () => checkForUpdatesNow(),
        },
        { type: "separator" },
        {
          label: "About Budget Planner",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "About Budget Planner",
              message: `Budget Planner ${app.getVersion()}`,
              detail: [
                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
                `Platform: ${process.platform}`,
                `Update feed: ${feedDescription()}`,
                `Data folder: ${getDataDir()}`,
                `Backups folder: ${getBackupsDir()}`,
              ].join("\n"),
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { MENU_ACTIONS, buildApplicationMenu };
