import { getDesktopBridge } from "./desktop";

/**
 * Renderer-side access to the email credential vault (FR-24).
 *
 * ## Why this is desktop-only, and hard-refuses elsewhere
 *
 * Requirement: credentials must be stored via the OS secure store
 * (`safeStorage`), never in plaintext in localStorage or any app-readable
 * file. `safeStorage` exists ONLY in Electron's main process.
 *
 * This app also ships as a static browser build. In a browser there is no
 * OS-backed secret store available to a page — `localStorage`, IndexedDB and
 * cookies are all plainly readable by any script on the origin. There is no
 * way to satisfy the requirement there.
 *
 * So the email feature is **unavailable in browser mode**, and this module
 * reports that rather than quietly degrading to a weaker store. That is a
 * deliberate refusal: a "best effort" localStorage fallback would look like
 * the feature working while leaving the user's email password readable.
 *
 * The same rule applies inside Electron when the OS keychain itself is
 * unavailable (a Linux box with no libsecret/kwallet, for instance):
 * `isAvailable()` returns false and the UI must not collect a password.
 */

/** The single account slot. One connected mailbox is the whole scope today. */
export const EMAIL_ACCOUNT = "email";

export type CredentialAvailability =
  | { available: true }
  | { available: false; reason: "not-desktop" | "no-os-keychain" };

/** Whether a credential can be stored safely on this machine, right now. */
export async function credentialAvailability(): Promise<CredentialAvailability> {
  const bridge = getDesktopBridge();
  if (!bridge?.credentials) return { available: false, reason: "not-desktop" };
  const ok = await bridge.credentials.isAvailable().catch(() => false);
  return ok ? { available: true } : { available: false, reason: "no-os-keychain" };
}

/** Human-readable explanation for a refusal, for the settings UI. */
export function availabilityMessage(reason: "not-desktop" | "no-os-keychain"): string {
  return reason === "not-desktop"
    ? "Connecting an email account needs the desktop app. A browser has no secure place to keep your password, so this feature is only available in the installed app."
    : "This computer has no working system keychain, so your password could not be stored securely. Connecting email is disabled rather than saving it somewhere readable.";
}

export interface EmailConnectionStatus {
  connected: boolean;
  savedAt: string | null;
}

export async function emailConnectionStatus(): Promise<EmailConnectionStatus> {
  const bridge = getDesktopBridge();
  if (!bridge?.credentials) return { connected: false, savedAt: null };
  return bridge.credentials
    .status(EMAIL_ACCOUNT)
    .catch(() => ({ connected: false, savedAt: null }));
}

export type ConnectResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Stores the app password. The value is handed straight to the main process
 * and is never written anywhere by renderer code — do not log it, put it in
 * component state longer than the form's lifetime, or persist it.
 */
export async function connectEmail(appPassword: string): Promise<ConnectResult> {
  const availability = await credentialAvailability();
  if (!availability.available) {
    return { ok: false, message: availabilityMessage(availability.reason) };
  }
  const bridge = getDesktopBridge();
  if (!bridge?.credentials) {
    return { ok: false, message: availabilityMessage("not-desktop") };
  }

  const result = await bridge.credentials
    .set(EMAIL_ACCOUNT, appPassword)
    .catch(() => ({ ok: false as const, reason: "write-failed" as const }));

  if (result.ok) return { ok: true };

  const message =
    result.reason === "empty-secret"
      ? "Enter the app password from your email provider."
      : result.reason === "encryption-unavailable"
        ? availabilityMessage("no-os-keychain")
        : "Your password could not be stored securely, so nothing was saved. Try again.";
  return { ok: false, message };
}

/**
 * Removes the stored credential entirely — the "Disconnect email" action.
 * Idempotent, and safe to call when nothing is connected.
 */
export async function disconnectEmail(): Promise<{ ok: boolean }> {
  const bridge = getDesktopBridge();
  if (!bridge?.credentials) return { ok: true };
  return bridge.credentials
    .clear(EMAIL_ACCOUNT)
    .then((result) => ({ ok: result.ok }))
    .catch(() => ({ ok: false }));
}
