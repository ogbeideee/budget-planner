// Email account configuration (FR-24) — renderer side.
//
// Mirrors electron/imapConfig.cjs (the main-process line of defence against a
// config the UI should never have produced); a parity test asserts the two
// implementations agree, so the rules live in ONE place conceptually and
// cannot drift silently.
//
// Persistence deliberately follows lib/onboarding.ts: a small, non-ledger
// record stored through the SINGLE persistence seam (SQLite on desktop,
// localStorage in the browser) under its own key — NOT part of AppState. It
// references no category ids and no user budgeting data, so it never needs a
// schema migration and survives an import/restore of the ledger untouched.
//
// THE APP PASSWORD IS NEVER WRITTEN HERE — not in the record, not in any
// state, not in storage. It crosses IPC once at connect time and lives only
// in the OS-backed credential vault (electron/credentials.cjs).
import { getStorageBackend } from "./storageAdapter";
import type { EmailConnectionState } from "./desktop";

export const EMAIL_ACCOUNT_STORAGE_KEY = "email-account";

export type EmailProvider = "gmail" | "generic";
export type EmailSecurity = "tls" | "starttls" | "none";

export interface EmailAccountConfig {
  provider: EmailProvider;
  /** The login address AND the IMAP username. */
  email: string;
  /** Gmail: forced to Google's endpoint by normalization. */
  host: string;
  port: number;
  security: EmailSecurity;
  /** Lookback for the FIRST sync only (Prompt 2's initial-sync operation). */
  initialLookbackDays: 7 | 30 | 90;
  /** Sync metadata — nothing writes these until the sync operation exists. */
  initialSyncDone: boolean;
  lastSyncAt: string | null;
}

/** Gmail's well-known IMAP endpoint — prefilled in the UI, forced in main. */
export const GMAIL_DEFAULTS = Object.freeze({
  host: "imap.gmail.com",
  port: 993,
  security: "tls" as const,
});

export const DEFAULT_LOOKBACK_DAYS = 30;
export const LOOKBACK_DAYS_CHOICES = [7, 30, 90] as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePort(value: unknown, fallback: number): number {
  const port = typeof value === "number" ? value : Number(asTrimmedString(value));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fallback;
  return port;
}

/**
 * Validates and normalizes a raw email account configuration. Returns
 * { ok, config } or { ok: false, errors } (field → human message).
 *
 * For Gmail the host/port/security are FORCED to Google's endpoint; anything
 * else in those fields is ignored, so a tampered persisted record can never
 * point a Gmail connection at an impostor server.
 */
export function normalizeEmailAccountConfig(
  raw: unknown,
): { ok: true; config: EmailAccountConfig } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const input = isPlainObject(raw) ? raw : {};

  const provider = asTrimmedString(input.provider).toLowerCase();
  if (provider !== "gmail" && provider !== "generic") {
    errors.provider = "Choose Gmail or Generic IMAP.";
  }

  const email = asTrimmedString(input.email).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  let host = asTrimmedString(input.host).toLowerCase();
  let port = normalizePort(input.port, 0);
  let security = asTrimmedString(input.security).toLowerCase();

  if (provider === "gmail") {
    host = GMAIL_DEFAULTS.host;
    port = GMAIL_DEFAULTS.port;
    security = GMAIL_DEFAULTS.security;
  } else if (provider === "generic") {
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) {
      errors.host = "Enter your provider's IMAP server hostname.";
    }
    if (port === 0) {
      port = security === "none" ? 143 : 993;
    }
    if (security !== "tls" && security !== "starttls" && security !== "none") {
      security = "tls";
    }
  }

  const initialLookbackDays = normalizePort(input.initialLookbackDays, DEFAULT_LOOKBACK_DAYS);
  if (!(LOOKBACK_DAYS_CHOICES as readonly number[]).includes(initialLookbackDays)) {
    errors.initialLookbackDays = "Choose 7, 30 or 90 days.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    config: {
      provider: provider as EmailProvider,
      email,
      host,
      port,
      security: security as EmailSecurity,
      initialLookbackDays: initialLookbackDays as 7 | 30 | 90,
      initialSyncDone: input.initialSyncDone === true,
      lastSyncAt: typeof input.lastSyncAt === "string" ? input.lastSyncAt : null,
    },
  };
}

/** The safe identity of a config — what status cards and diagnostics show. */
export function emailIdentity(config: EmailAccountConfig) {
  return {
    provider: config.provider,
    email: config.email,
    host: config.host,
    port: config.port,
    security: config.security,
  };
}

/**
 * Loads the persisted configuration. Returns null when absent or corrupt —
 * never a half-valid record, and never anything secret-bearing.
 */
export function loadEmailAccountConfig(): EmailAccountConfig | null {
  try {
    const raw = getStorageBackend().getItem(EMAIL_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const result = normalizeEmailAccountConfig(JSON.parse(raw));
    return result.ok ? result.config : null;
  } catch {
    return null;
  }
}

/** Persists the non-secret configuration through the storage seam. */
export function saveEmailAccountConfig(config: EmailAccountConfig): void {
  try {
    getStorageBackend().setItem(
      EMAIL_ACCOUNT_STORAGE_KEY,
      JSON.stringify(config),
    );
  } catch {
    // Persistence failing must not break the connect flow itself; main has
    // already received the config, and the next successful connect re-saves.
  }
}

/** Removes the persisted configuration (the Disconnect cleanup). */
export function clearEmailAccountConfig(): void {
  try {
    getStorageBackend().removeItem(EMAIL_ACCOUNT_STORAGE_KEY);
  } catch {
    // Same reasoning as saveEmailAccountConfig.
  }
}


export type { EmailConnectionState };
