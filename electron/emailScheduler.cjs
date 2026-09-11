// Background email polling (FR-24) — the 30-minute tick that keeps the
// account checked while the app runs.
//
// Design constraints (docs/15_EMAIL_PARSING.md + Prompt 2 product decisions):
//  - ONE timer handle, cleared on teardown AND before every restart, so a
//    reconnect/reopen cycle can never stack timers.
//  - The interval is a NAMED constant, never an inline literal.
//  - "Check now" MUST NOT go through the timer — it invokes the same canonical
//    operation directly, so a user who knows an alert just arrived waits for
//    nothing. The tray's menu item and the renderer's button both call
//    `runNow()`.
//  - The tick runs ONLY when an account is configured (`hasAccount`), invokes
//    the SAME canonical `checkNow` (there is no second sync implementation
//    anywhere), and refuses to stack: a tick that finds a sync already running
//    is dropped, never queued.
//  - A failed tick neither crashes Electron nor stops the schedule: the next
//    tick simply tries again (the sync manager owns backoff).
"use strict";

/** Polling interval: 30 MINUTES exactly (decided 2026-08-29, reconfirmed by
 *  the user 2026-09-11; supersedes the build session's one-hour choice). */
const EMAIL_SYNC_INTERVAL_MS = 30 * 60 * 1000;

function createEmailScheduler({
  checkNow,
  hasAccount,
  onResult,
  intervalMs = EMAIL_SYNC_INTERVAL_MS,
  now = Date.now,
  log = console,
}) {
  let timer = null;
  let running = false;

  const invoke = (trigger) => {
    if (typeof checkNow !== "function") {
      return { ok: false, started: false, reason: "no-sync" };
    }
    if (running) {
      log?.info?.("[email-scheduler] tick skipped — a sync is already running");
      return { ok: true, started: false, reason: "busy" };
    }
    if (typeof hasAccount === "function" && !hasAccount()) {
      return { ok: true, started: false, reason: "no-account" };
    }
    running = true;
    const result = checkNow(trigger);
    if (result && typeof result.then === "function") {
      result.then(
        (res) => {
          if (typeof onResult === "function") onResult(res);
        },
        (error) => {
          log?.error?.(
            `[email-scheduler] sync threw: ${error instanceof Error ? error.message : String(error)}`,
          );
          if (typeof onResult === "function") {
            onResult({
              ok: false,
              trigger,
              at: new Date(now()).toISOString(),
              category: "unknown",
              message: "The email check failed unexpectedly.",
            });
          }
        },
      ).finally(() => {
        running = false;
      });
    } else {
      // A synchronous checkNow (already-busy etc.) still reports through the
      // same channel so the renderer's status stays correct.
      if (typeof onResult === "function") onResult(result);
      running = false;
    }
    return { ok: true, started: true };
  };

  return {
    /**
     * Starts the 30-minute timer if it is not already running. Always safe to
     * call once at app ready; the tick itself is what decides whether an
     * account exists. Does NOT backfill a missed tick.
     */
    start() {
      if (timer !== null) return;
      timer = setInterval(() => {
        void invoke("scheduled");
      }, intervalMs);
      // The timer must never keep the process alive by itself — the app's own
      // lifetime rules (background mode / tray) decide whether we run.
      if (typeof timer.unref === "function") timer.unref();
      log?.info?.(`[email-scheduler] polling every ${Math.round(intervalMs / 60000)} minutes`);
    },

    /** Stops the timer and clears the single handle. Idempotent. */
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    /**
     * Manual check — the tray item and the renderer's "Check now" button.
     * Deliberately bypasses the timer: same canonical operation, immediate.
     * `trigger` selects the canonical trigger ("manual" or "tray"); both go
     * through THIS invoke, so overlap protection is enforced in one place and
     * the sync result always arrives through `onResult`. A running sync is
     * never stacked on.
     */
    runNow(trigger = "manual") {
      return invoke(trigger === "tray" ? "tray" : "manual");
    },

    /** True while a check is in flight (test seam + status). */
    get running() {
      return running;
    },
  };
}

module.exports = { createEmailScheduler, EMAIL_SYNC_INTERVAL_MS };