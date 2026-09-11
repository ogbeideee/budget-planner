// Where a sync outcome goes when the main window may not be visible
// (FR-24 sync stage x FR-26 background mode).
//
// Pure decision — imports nothing from Electron — so the hidden-window branch
// is unit-testable without a main process (the backgroundMode.cjs pattern).
//
// The rule: a visible window receives the batch over IPC and the renderer's
// own toast is the surface. A hidden or absent window cannot receive
// anything, and silently dropping the batch would leave the user unaware
// that alerts arrived while the app sat in the tray — so the OS notification
// path raises instead (the SAME mechanism `desktop:notify` uses; never a
// second notification mechanism), and the batch is cached for re-delivery
// the moment the window is shown next.
//
// Cached messages stay UNCONFIRMED: the mailbox-level dedupe keys on the
// renderer's confirm, not on delivery. If the cache is lost (app quit before
// the window was shown), the next sync simply re-fetches the same messages —
// no alert can be lost, only delayed.
"use strict";

/** Where the notification click routes: Settings → Email alerts, which holds
 *  the review-queue button. A `?section=` deep link the settings view already
 *  understands — no new route was invented for this. */
const EMAIL_ALERTS_ROUTE = "/settings?section=email";

/**
 * Decides what happens to one sync outcome.
 *
 * @param {object} input
 * @param {boolean} input.windowVisible  main window shown, not minimized.
 * @param {boolean} input.ok             the sync completed successfully.
 * @param {number}  input.messageCount   unconfirmed alert messages found.
 * @returns {{deliver: boolean, cache: boolean, notify: {count: number, deepLink: string} | null}}
 *   deliver — send the batch to the renderer now.
 *   cache   — hold the batch until the window is shown again.
 *   notify  — raise an OS notification (with click-to-review deep link).
 */
function planEmailDelivery({ windowVisible = false, ok = false, messageCount = 0 } = {}) {
  if (!ok || messageCount <= 0) {
    return { deliver: false, cache: false, notify: null };
  }
  if (windowVisible) {
    return { deliver: true, cache: false, notify: null };
  }
  return {
    deliver: false,
    cache: true,
    notify: { count: messageCount, deepLink: EMAIL_ALERTS_ROUTE },
  };
}

/**
 * The notification content for a hidden-window find. Counts only — never a
 * sender, amount or body snippet (the same safe-by-construction rule as the
 * sync summary).
 */
function emailAlertNotification({ count }) {
  return {
    title: "New bank alerts",
    body: `${count} new bank alert${count === 1 ? "" : "s"} — click to review.`,
    deepLink: EMAIL_ALERTS_ROUTE,
  };
}

module.exports = { planEmailDelivery, emailAlertNotification, EMAIL_ALERTS_ROUTE };
