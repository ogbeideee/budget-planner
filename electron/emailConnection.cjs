// Email connection manager (FR-24) — main-process runtime state for the one
// connected mailbox, plus the operations the renderer may request over IPC.
//
// SECURITY MODEL (docs/15_EMAIL_PARSING.md):
//  - The password is received ONCE, at connect/test time, and handed straight
//    to the transport. It is never stored here beyond the call, never logged,
//    and NEVER returned — not in a result, not in status(), not in an error.
//  - The credential vault (electron/credentials.cjs) is used through its
//    existing surface only: set() after a successful authentication, status()
//    for display, clear() on disconnect, reveal() internally when an
//    operation needs the password and none was supplied. reveal()'s return
//    value never crosses IPC.
//  - Status payloads are safe identity data: provider, email address, state,
//    timestamps, error CATEGORY. No passwords, no vault contents, no raw
//    server messages beyond the redacted category message.
//
// The renderer persists the non-secret configuration (lib/emailAccount.ts);
// main is TOLD the config at operation time — the same direction
// `settings.backgroundMode` uses. Main never parses the stored AppState.
//
// NOTE on connection lifetime: this phase performs a verify-and-release
// connect (open, authenticate, close). The long-lived idle connection the
// scheduler needs (one connection held open between ticks — see
// docs/15_EMAIL_PARSING.md, "Connection lifecycle") is Prompt 2's job; a
// live socket with nothing consuming it would only collect idle drops.
"use strict";

const { normalizeEmailAccountConfig, emailIdentity } = require("./imapConfig.cjs");

// Must match lib/emailCredentials.ts EMAIL_ACCOUNT — the vault's single slot.
const VAULT_ACCOUNT = "email";

const EMAIL_CONNECTION_STATES = Object.freeze([
  "not-connected",
  "connecting",
  "connected",
  "auth-failed",
  "connection-failed",
  "disconnected",
]);

function createEmailConnectionManager({
  credentialStore,
  transportFactory,
  now = () => new Date(),
}) {
  let state = "not-connected";
  // The identity of the last successfully connected account. Safe data only.
  let known = null;
  let lastConnectedAt = null;
  let lastError = null; // { category, at } — the CATEGORY, never a raw error.
  // Connect is deduplicated: a double-click must not race two vault writes.
  let inFlight = null;

  function categorizeState(category) {
    return category === "auth" ? "auth-failed" : "connection-failed";
  }

  return {
    /**
     * Verifies the configuration + password against the real server and, on
     * success, stores the password in the OS-backed vault and marks the
     * account connected. `password` is required on first connect; when
     * omitted, the vault's stored credential is used (reconnect path).
     */
    async connect(rawConfig, password) {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const norm = normalizeEmailAccountConfig(rawConfig);
        if (!norm.ok) {
          lastError = { category: "invalid-config", at: now().toISOString() };
          state = "not-connected";
          return { ok: false, category: "invalid-config", errors: norm.errors, state };
        }

        state = "connecting";
        const hasPassword = typeof password === "string" && password.length > 0;
        const secret = hasPassword ? password : credentialStore.reveal(VAULT_ACCOUNT);
        if (!secret) {
          state = "not-connected";
          lastError = { category: "auth", at: now().toISOString() };
          return {
            ok: false,
            category: "auth",
            message: hasPassword
              ? "The app password was empty."
              : "No stored app password. Enter it to connect.",
            state,
          };
        }

        const transport = transportFactory({ config: norm.config, password: secret });
        const result = await transport.test();
        await transport.close();

        if (!result.ok) {
          lastError = { category: result.category, at: now().toISOString() };
          state = categorizeState(result.category);
          return {
            ok: false,
            category: result.category,
            message: result.message,
            state,
          };
        }

        if (hasPassword) {
          // Store only AFTER authentication succeeded: a wrong password is
          // never persisted, and a machine that cannot encrypt reports the
          // refusal instead of pretending to connect.
          const stored = credentialStore.set(VAULT_ACCOUNT, password);
          if (!stored.ok) {
            lastError = { category: stored.reason, at: now().toISOString() };
            state = "not-connected";
            return {
              ok: false,
              category: "credential",
              message:
                "The connection worked, but the password could not be stored securely, so the account was not connected.",
              state,
            };
          }
        }

        known = emailIdentity(norm.config);
        lastConnectedAt = now().toISOString();
        lastError = null;
        state = "connected";
        return { ok: true, state };
      })();
      try {
        return await inFlight;
      } finally {
        inFlight = null;
      }
    },

    /**
     * Verifies a configuration WITHOUT changing the connected state or the
     * vault. Used by "Test connection" and for a pre-flight check.
     */
    async test(rawConfig, password) {
      const norm = normalizeEmailAccountConfig(rawConfig);
      if (!norm.ok) {
        return { ok: false, category: "invalid-config", errors: norm.errors };
      }
      const hasPassword = typeof password === "string" && password.length > 0;
      const secret = hasPassword ? password : credentialStore.reveal(VAULT_ACCOUNT);
      if (!secret) {
        return { ok: false, category: "auth", message: "No app password available to test with." };
      }
      const transport = transportFactory({ config: norm.config, password: secret });
      try {
        return await transport.test();
      } finally {
        await transport.close();
      }
    },

    /**
     * Disconnect: forgets the account AND removes the stored password. The
     * docs define Disconnect as wired to the vault clear, so a disconnect is
     * complete — the next connect needs the app password again.
     */
    disconnect() {
      const removed = credentialStore.clear(VAULT_ACCOUNT);
      known = null;
      lastConnectedAt = null;
      lastError = null;
      state = "not-connected";
      return { ok: removed.ok };
    },

    /** The safe status payload. No secrets, ever. */
    status() {
      return {
        state,
        provider: known ? known.provider : null,
        email: known ? known.email : null,
        lastConnectedAt,
        lastError,
        credential: credentialStore.status(VAULT_ACCOUNT),
      };
    },

    /** Test/inspection seam: the current state machine value. */
    get state() {
      return state;
    },
  };
}


module.exports = {
  createEmailConnectionManager,
  VAULT_ACCOUNT,
  EMAIL_CONNECTION_STATES,
};
