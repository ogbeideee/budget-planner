import { getDesktopBridge } from "./desktop";
import type {
  EmailConnectionStatusReport,
  EmailOperationResult,
} from "./desktop";

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

/* ------------------------------------------------------------------------ */
/* Email connection operations (FR-24, transport phase)                      */
/* ------------------------------------------------------------------------ */

/**
 * Thin wrappers over the desktop:email:* IPC channels. They live here —
 * beside the vault helpers — so the UI never builds a second bridge, and the
 * password's one-way trip is visible in exactly one file.
 *
 * SECURITY NOTE: `password` crosses IPC once, into main, and nothing in
 * these functions keeps it, logs it, or reads it back. The stored credential
 * is used internally by main when `password` is omitted (test/reconnect).
 */

/** Human message for a failed connect/test, from the safe category. */
export function emailErrorMessage(
  category: string | undefined,
  fallback: string | undefined,
): string {
  switch (category) {
    case "auth":
      return "The mail server rejected the address or app password. Check both, and make sure you are using an app password — not your normal account password.";
    case "tls":
      return "The mail server's security certificate could not be verified, so the connection was refused. Check the server hostname and port.";
    case "timeout":
      return "The mail server took too long to respond. Check your connection and the server details.";
    case "network":
      return "Could not reach the mail server. Check the hostname, port and your internet connection.";
    case "empty-secret":
      return "Enter the app password from your email provider.";
    case "credential":
      return fallback ?? "The password could not be stored securely.";
    case "invalid-config":
      return fallback ?? "Check the email account settings.";
    default:
      return fallback ?? "The connection failed. Try again.";
  }
}

/**
 * Connects (and stays connected) to the email account. On success the app
 * password has been stored in the OS-backed vault by main — only after the
 * server actually accepted it.
 */
export async function connectEmailAccount(
  config: unknown,
  appPassword: string,
): Promise<EmailOperationResult> {
  const bridge = getDesktopBridge();
  if (!bridge?.email) {
    return { ok: false, category: "invalid-config", message: "Email connections need the desktop app." };
  }
  try {
    const result = await bridge.email.connect({ config, password: appPassword });
    return result.ok ? result : { ...result, message: emailErrorMessage(result.category, result.message) };
  } catch {
    return { ok: false, category: "unknown", message: emailErrorMessage("unknown", undefined) };
  }
}

/**
 * Tests a configuration without changing the connected state or the vault.
 * `appPassword` may be omitted when a credential is already stored.
 */
export async function testEmailConnection(
  config: unknown,
  appPassword?: string,
): Promise<EmailOperationResult> {
  const bridge = getDesktopBridge();
  if (!bridge?.email) {
    return { ok: false, category: "invalid-config", message: "Email connections need the desktop app." };
  }
  try {
    const result = await bridge.email.test({ config, password: appPassword ?? "" });
    return result.ok ? result : { ...result, message: emailErrorMessage(result.category, result.message) };
  } catch {
    return { ok: false, category: "unknown", message: emailErrorMessage("unknown", undefined) };
  }
}

/**
 * The full disconnect: drops main's runtime connection state AND clears the
 * stored credential (main does both), so the next connect needs the app
 * password again. The renderer clears its persisted config alongside.
 */
export async function disconnectEmailAccount(): Promise<{ ok: boolean }> {
  const bridge = getDesktopBridge();
  if (!bridge?.email) return { ok: true };
  return bridge.email.disconnect().catch(() => ({ ok: false }));
}

/**
 * The safe status report from main. Safe to render directly: state, identity,
 * timestamps and an error CATEGORY — never a password or vault contents.
 */
export async function emailConnectionStatusReport(): Promise<EmailConnectionStatusReport | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.email) return null;
  return bridge.email.status().catch(() => null);
}

