// Renderer-side bridge calls for the email sync stage (FR-24).
//
// Thin typed wrappers over the desktop bridge; everything degrades to a safe
// no-op/false in a plain browser or during SSR/tests (mirrors
// lib/desktopFeatures.ts). The allowlist DOMAINS are derived from the parser's
// own registry — there is deliberately NO second sender registry anywhere.
import { getDesktopBridge, isDesktop } from "./desktop";
import type {
  EmailAlertsDelivered,
  EmailSyncCheckResult,
  EmailSyncResultSummary,
  EmailSyncStatusReport,
} from "./desktop";
import { ALERT_SENDERS } from "./emailAlerts";

/** The allowlisted sending domains — THE parser's list, narrowed server-side.
 *  `ALERT_SENDERS` stays the single source of truth. */
export function emailSyncDomains(): string[] {
  return ALERT_SENDERS.flatMap((sender) => sender.domains);
}

/** Reports the persistable account config to main so the scheduler can run and
 *  the tray item can appear. Pass `config: null` to clear (disconnect). */
export async function reportEmailAccountToMain(
  config: unknown,
): Promise<boolean> {
  const bridge = getDesktopBridge();
  if (!bridge?.email?.setAccount) return false;
  try {
    const result = await bridge.email.setAccount({
      config,
      domains: emailSyncDomains(),
    });
    return result.ok && result.configured;
  } catch {
    return false;
  }
}

/** Manual sync trigger — calls the canonical operation in main directly
 *  (never through the scheduler timer). Returns a safe ack; the fetched
 *  messages arrive through `onEmailAlertsDelivered`. */
export async function runEmailCheck(): Promise<EmailSyncCheckResult | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.email?.check) return null;
  try {
    return await bridge.email.check();
  } catch {
    return { ok: false, started: false, category: "unknown" };
  }
}

/** Current sync status (configured account, in-flight flag, last outcome). */
export async function readEmailSyncStatus(): Promise<EmailSyncStatusReport | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.email?.syncStatus) return null;
  try {
    return await bridge.email.syncStatus();
  } catch {
    return null;
  }
}

/** Mailbox-level dedupe confirmation — called AFTER the renderer has applied
 *  (auto-import) or queued (review) every delivered message. */
export async function confirmEmailProcessed(uids: string[]): Promise<void> {
  const bridge = getDesktopBridge();
  if (!bridge?.email?.confirmProcessed) return;
  try {
    await bridge.email.confirmProcessed({ uids });
  } catch {
    // Best effort: a failed confirmation only means a possible re-download on
    // the next poll, which the renderer's seen-message filter absorbs.
  }
}

/** Subscribes to delivered-alert events from the main window's sync. */
export function onEmailAlertsDelivered(
  callback: (payload: EmailAlertsDelivered) => void,
): () => void {
  const bridge = getDesktopBridge();
  if (!bridge?.appEvents?.onEmailAlerts || !isDesktop()) return () => {};
  return bridge.appEvents.onEmailAlerts(callback);
}

/** Subscribes to safe sync summaries (after every canonical run). */
export function onEmailSyncResult(
  callback: (result: EmailSyncResultSummary) => void,
): () => void {
  const bridge = getDesktopBridge();
  if (!bridge?.appEvents?.onEmailSyncResult || !isDesktop()) return () => {};
  return bridge.appEvents.onEmailSyncResult(callback);
}