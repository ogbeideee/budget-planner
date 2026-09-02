"use strict";

/**
 * Background mode (FR-26) — the close-button decision, kept pure.
 *
 * This module deliberately requires NOTHING from `electron`. The question it
 * answers ("does closing the window hide it or quit the app?") is pure logic
 * with three inputs, and keeping it separate is what lets it be unit-tested
 * without an Electron main process (see backgroundMode.test.ts). main.cjs owns
 * the window handles and the actual `event.preventDefault()`.
 *
 * The default is OFF, and every ambiguous input resolves to OFF. Closing the
 * window has quit the app for the whole life of this product; a user who never
 * opened Settings must keep getting that, so "unknown" can never mean "keep a
 * process running invisibly".
 */

/**
 * Decides what a main-window `close` event should do.
 *
 * @returns "hide" to minimise to the tray (the caller must preventDefault),
 *          or "quit" to let the close proceed and the app exit.
 */
function resolveCloseBehavior({ backgroundMode, quitting, trayAvailable }) {
  // An explicit quit — the tray's Quit item, the app menu, an OS shutdown —
  // always wins. Without this the tray would be a roach motel: every exit
  // route would just re-hide the window and the app could never be closed.
  if (quitting === true) return "quit";

  // No tray means no way back to a hidden window. Registering the tray icon
  // can genuinely fail (a Linux session with no StatusNotifier host, a locked
  // -down Windows shell), and hiding into a tray that isn't there would strand
  // the user with a running process and no UI. Quit instead.
  if (trayAvailable !== true) return "quit";

  return backgroundMode === true ? "hide" : "quit";
}

/**
 * Whether the app process should survive its last window closing.
 *
 * Mirrors `resolveCloseBehavior` for the `window-all-closed` handler, which
 * fires for reasons the close handler never sees (a window destroyed
 * programmatically, the quick-add window closing while no main window exists).
 */
function shouldKeepRunning({ backgroundMode, quitting, trayAvailable, platform }) {
  if (quitting === true) return false;
  // macOS convention: the app already outlives its windows, tray or not.
  if (platform === "darwin") return true;
  if (trayAvailable !== true) return false;
  return backgroundMode === true;
}

/**
 * Normalises whatever the renderer sent over IPC into a boolean.
 *
 * The renderer is the authority on this setting (it lives in AppState), but it
 * is also the untrusted-ish side of the bridge, so only a literal `true` turns
 * the behaviour on.
 */
function normalizeSetting(value) {
  return value === true;
}

/** Tooltip text for the tray icon — the always-visible "am I still running?"
 *  answer required by FR-26 req 13. */
function trayTooltip({ appName, backgroundMode }) {
  const name = typeof appName === "string" && appName.length > 0 ? appName : "Budget Planner";
  return backgroundMode === true
    ? `${name} — running in the background`
    : `${name} — window open`;
}

module.exports = {
  resolveCloseBehavior,
  shouldKeepRunning,
  normalizeSetting,
  trayTooltip,
};
