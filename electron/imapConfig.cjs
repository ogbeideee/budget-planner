// Email account configuration (FR-24) — normalization and validation.
//
// PURE: no Electron, no fs, no network. The renderer keeps the same rules in
// lib/emailAccount.ts; a parity test asserts both implementations agree, so
// this module is the main-process line of defence against a config the UI
// should never have produced.
//
// The app password is NOT part of a config record — it travels once, through
// IPC, at connect time, and lives only in the credential vault afterwards.
"use strict";

const PROVIDER_GMAIL = "gmail";
const PROVIDER_GENERIC = "generic";
const SECURITY_MODES = ["tls", "starttls", "none"];

// Gmail's well-known IMAP endpoint. A Gmail account NEVER carries its own
// host/port/security — they are forced here so a UI bug or a stale persisted
// record cannot point a Gmail connection at an impostor server.
const GMAIL_IMAP = Object.freeze({ host: "imap.gmail.com", port: 993, security: "tls" });

const DEFAULT_LOOKBACK_DAYS = 30;
const LOOKBACK_DAYS_CHOICES = Object.freeze([7, 30, 90]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePort(value, fallback) {
  const port = typeof value === "number" ? value : Number(asTrimmedString(value));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fallback;
  return port;
}

/**
 * Validates and normalizes a raw email account configuration (an untrusted
 * IPC payload or a persisted record). Returns { ok, config } or
 * { ok: false, errors } where errors maps field -> human message.
 *
 * For Gmail the host/port/security are FORCED to Google's endpoint; the
 * caller may omit them or send anything — they are never honoured.
 */
function normalizeEmailAccountConfig(raw) {
  const errors = {};
  const input = isPlainObject(raw) ? raw : {};

  const provider = asTrimmedString(input.provider).toLowerCase();
  if (provider !== PROVIDER_GMAIL && provider !== PROVIDER_GENERIC) {
    errors.provider = "Choose Gmail or Generic IMAP.";
  }

  const email = asTrimmedString(input.email).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  let host = asTrimmedString(input.host).toLowerCase();
  let port = normalizePort(input.port, 0);
  let security = asTrimmedString(input.security).toLowerCase();

  if (provider === PROVIDER_GMAIL) {
    host = GMAIL_IMAP.host;
    port = GMAIL_IMAP.port;
    security = GMAIL_IMAP.security;
  } else if (provider === PROVIDER_GENERIC) {
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) {
      errors.host = "Enter your provider's IMAP server hostname.";
    }
    if (port === 0) {
      port = security === "none" ? 143 : 993;
    }
    if (!SECURITY_MODES.includes(security)) {
      security = "tls";
    }
  }

  const initialLookbackDays = normalizePort(input.initialLookbackDays, DEFAULT_LOOKBACK_DAYS);
  if (!LOOKBACK_DAYS_CHOICES.includes(initialLookbackDays)) {
    errors.initialLookbackDays = "Choose 7, 30 or 90 days.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    config: {
      provider,
      email,
      host,
      port,
      security,
      initialLookbackDays,
      // Sync metadata (Phase 7). Nothing sets these until the sync operation
      // exists; they are persisted so the field is there when it does.
      initialSyncDone: input.initialSyncDone === true,
      lastSyncAt: typeof input.lastSyncAt === "string" ? input.lastSyncAt : null,
    },
  };
}

/** The safe identity of an account — never includes anything secret. */
function emailIdentity(config) {
  return {
    provider: config.provider,
    email: config.email,
    host: config.host,
    port: config.port,
    security: config.security,
  };
}

module.exports = {
  PROVIDER_GMAIL,
  PROVIDER_GENERIC,
  GMAIL_IMAP,
  SECURITY_MODES,
  DEFAULT_LOOKBACK_DAYS,
  LOOKBACK_DAYS_CHOICES,
  normalizeEmailAccountConfig,
  emailIdentity,
};
