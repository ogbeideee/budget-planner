"use strict";

const path = require("path");
const fs = require("fs");
const { trayTooltip } = require("./backgroundMode.cjs");

/**
 * System tray (FR-26).
 *
 * Electron objects are INJECTED rather than required at module scope, the same
 * shape `createCredentialStore` uses for `safeStorage`. That keeps the menu
 * template — the part with actual branching in it — testable under vitest,
 * which has no Electron runtime.
 */

/** Resolved once: the tray reuses the installer/window icon so the taskbar,
 *  the window and the tray all show the same mark. */
function trayIconPath() {
  // .ico carries every size Windows asks the tray for; .png is the fallback
  // used by Linux and by a dev checkout that has not run `npm run icon`.
  const ico = path.join(__dirname, "..", "build", "icon.ico");
  const png = path.join(__dirname, "..", "build", "icon.png");
  if (process.platform === "win32" && fs.existsSync(ico)) return ico;
  return fs.existsSync(png) ? png : null;
}

/**
 * Builds the tray context menu.
 *
 * Pure: takes flags and callbacks, returns a Menu template. No Electron, no
 * window handles, no module state — so a test can assert which items exist in
 * which mode without launching anything.
 *
 * `canCheckAlerts` gates the "Check for new alerts now" item. It is driven by
 * `setAlertChecker()`: main passes the canonical sync invoker once an email
 * account is reported (FR-24 sync stage) and the item appears; passing null
 * removes it again. A menu entry is never shipped without something to call —
 * see docs/15_EMAIL_PARSING.md.
 */
function buildTrayMenuTemplate({
  appName,
  backgroundMode,
  canCheckAlerts,
  onQuickAdd,
  onOpen,
  onCheckAlerts,
  onQuit,
}) {
  const name = typeof appName === "string" && appName.length > 0 ? appName : "Budget Planner";
  const template = [
    { label: "Add expense…", click: onQuickAdd },
    { label: `Open ${name}`, click: onOpen },
  ];

  if (canCheckAlerts === true) {
    template.push({ type: "separator" });
    template.push({ label: "Check for new alerts now", click: onCheckAlerts });
  }

  template.push({ type: "separator" });
  // Req 13: the user must be able to tell, from the tray alone, whether the
  // app is deliberately running with no window or merely failed to quit.
  template.push({
    label:
      backgroundMode === true
        ? "Background mode: on"
        : "Background mode: off (closing quits)",
    enabled: false,
  });
  template.push({ type: "separator" });
  template.push({ label: `Quit ${name}`, click: onQuit });

  return template;
}

/**
 * Creates the tray icon and wires its menu.
 *
 * Returns `null` when no icon asset is present or the platform refuses a tray;
 * callers MUST treat that as "no tray", which forces close-to-quit
 * (`resolveCloseBehavior` checks `trayAvailable`) rather than stranding the
 * user with an invisible process.
 */
function createTray({ electron, appName, handlers }) {
  const iconPath = trayIconPath();
  if (iconPath === null) {
    console.warn("[tray] no icon asset found (run `npm run icon`); tray disabled");
    return null;
  }

  let tray;
  try {
    tray = new electron.Tray(iconPath);
  } catch (error) {
    // A tray is not guaranteed to exist (headless Linux, no StatusNotifier).
    console.warn(`[tray] unavailable: ${error instanceof Error ? error.message : error}`);
    return null;
  }

  let backgroundMode = false;
  let alertChecker = null;

  const render = () => {
    const template = buildTrayMenuTemplate({
      appName,
      backgroundMode,
      canCheckAlerts: alertChecker !== null,
      onQuickAdd: handlers.onQuickAdd,
      onOpen: handlers.onOpen,
      onCheckAlerts: () => {
        if (alertChecker !== null) alertChecker();
      },
      onQuit: handlers.onQuit,
    });
    tray.setContextMenu(electron.Menu.buildFromTemplate(template));
    tray.setToolTip(trayTooltip({ appName, backgroundMode }));
  };

  // Req 2: the tray icon itself opens quick-add. On Windows a left click fires
  // "click"; the context menu stays on right-click.
  tray.on("click", () => handlers.onQuickAdd());
  // macOS/Linux surface a double-click separately; treat it the same.
  tray.on("double-click", () => handlers.onQuickAdd());

  render();

  return {
    /** Repaints menu + tooltip when the setting changes (req 13). */
    setBackgroundMode(enabled) {
      backgroundMode = enabled === true;
      render();
    },
    /**
     * The email seam. The IMAP transport calls this once it can fetch mail;
     * passing a function makes "Check for new alerts now" appear, passing null
     * removes it again (e.g. the user disconnects the account).
     */
    setAlertChecker(fn) {
      alertChecker = typeof fn === "function" ? fn : null;
      render();
    },
    destroy() {
      tray.destroy();
    },
  };
}

module.exports = { buildTrayMenuTemplate, createTray, trayIconPath };
