// Canonical email synchronization (FR-24, Prompt 2) — the ONE operation the
// manual "Check now" button, the tray menu and the hourly scheduler all call.
//
// Everything here runs in the ELECTRON MAIN PROCESS. The renderer never opens
// a socket, never sees the app password, and never receives a raw HTML body —
// only the converted plain text the parser consumes.
//
// SECURITY (docs/15_EMAIL_PARSING.md):
//  - The password is revealed from the vault HERE, used to build the
//    transport, and never leaves main, never crosses IPC, never is logged.
//  - The mailbox is READ ONLY. The transport opens the session `readOnly`,
//    never issues a mutating command, and requests BODY parts (which do not
//    set \Seen — and a read-only session refuses flag changes anyway).
//  - Server-side narrowing: SEARCH SINCE + SEARCH FROM per allowlisted domain,
//    so non-alert mail is never downloaded. The parser's allowlist stays the
//    final authority (the renderer re-checks it on every message).
//  - Connection lifecycle follows the docs' decision: ONE connection is held
//    open between ticks, reconnected on failure with backoff — never one
//    connect/search/disconnect cycle per tick.
//  - Errors are categorized + redacted by the transport and stored/returned
//    as safe status, never server transcripts.
//
// The ledger data this operation does NOT have (categories, learned rules,
// existing transactions) is intentionally not pulled here: `buildEmailDrafts`
// runs in the renderer against the live store. Main delivers parsed-ready
// AlertEmail-shaped messages; the renderer applies the draft pipeline.
"use strict";

const { normalizeEmailAccountConfig, emailIdentity } = require("./imapConfig.cjs");
const { htmlToText } = require("./emailHtml.cjs");
const { VAULT_ACCOUNT } = require("./emailConnection.cjs");

const MAILBOX = "INBOX";
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;

/** Safe sync triggers — the middleware never sees a free-form string. */
const SYNC_TRIGGERS = Object.freeze(["manual", "scheduled", "tray"]);

function createEmailSyncManager({
  credentialStore,
  transportFactory,
  syncStore,
  log = console,
  now = () => new Date(),
  backoffBaseMs = BACKOFF_BASE_MS,
  backoffMaxMs = BACKOFF_MAX_MS,
}) {
  // Normalized account config — reported by the renderer (same direction as
  // `settings.backgroundMode`; main never parses AppState to find it).
  let config = null;
  // Allowlisted sender domains, derived by the renderer from ALERT_SENDERS —
  // NO second registry exists; this is the parser's own list, narrowed
  // server-side. The parser remains the final authority.
  let domains = [];

  // The ONE held transport. Null means "not connected right now".
  let transport = null;
  let inFlight = null;
  let backoffUntil = 0;
  let backoffCount = 0;
  let lastResult = null;
  // UIDVALIDITY of the last successful sync — needed so confirmProcessed
  // writes the seen-set into the SAME mailbox generation the UIDs came from.
  let lastUidValidity = null;

  function accountKey() {
    return config ? `${config.email}|${config.host}|${MAILBOX}` : null;
  }

  function sinceDaysFor(nowMs) {
    const lastSyncAt = syncStore.lastSyncAt();
    if (!lastSyncAt) return config.initialLookbackDays;
    const elapsed = nowMs - Date.parse(lastSyncAt);
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 1;
    return Math.max(1, Math.ceil(elapsed / DAY_MS));
  }

  function scheduleBackoff() {
    backoffCount += 1;
    const delay = Math.min(backoffMaxMs, backoffBaseMs * 2 ** (backoffCount - 1));
    backoffUntil = Date.now() + delay;
    log?.warn?.(`[email-sync] backing off for ${delay}ms after failure (${backoffCount})`);
  }

  function resetBackoff() {
    backoffCount = 0;
    backoffUntil = 0;
  }

  /** Returns { ok: true, transport, uidValidity } or a categorized failure. */
  async function ensureTransport() {
    if (transport) {
      const info = transport.mailboxInfo ? transport.mailboxInfo() : {};
      return { ok: true, transport, uidValidity: info.uidValidity ?? null };
    }
    if (Date.now() < backoffUntil) {
      return {
        ok: false,
        category: "network",
        message: "The mail server was recently unreachable — retrying later.",
        backingOff: true,
      };
    }
    const secret = credentialStore.reveal(VAULT_ACCOUNT);
    if (!secret) {
      return {
        ok: false,
        category: "auth",
        message: "No stored app password — reconnect the account.",
      };
    }
    if (typeof transportFactory !== "function") {
      return {
        ok: false,
        category: "unknown",
        message: "No IMAP transport available.",
      };
    }
    const created = transportFactory({ config, password: secret });
    const opened = await created.open();
    if (!opened.ok) {
      scheduleBackoff();
      // A transport that fails without a category still yields a SAFE,
      // categorized result — never an undefined field crossing IPC.
      return {
        ok: false,
        category: typeof opened.category === "string" ? opened.category : "network",
        message:
          typeof opened.message === "string" && opened.message.length > 0
            ? opened.message
            : "Could not connect to the mail server.",
      };
    }
    transport = created;
    const info = created.mailboxInfo ? created.mailboxInfo() : {};
    return { ok: true, transport, uidValidity: info.uidValidity ?? null };
  }

  async function teardownTransport() {
    const current = transport;
    transport = null;
    if (current && typeof current.close === "function") {
      try {
        await current.close();
      } catch {
        // Already gone.
      }
    }
  }

  function toAlertEmail(message) {
    const text = typeof message.body === "string" ? message.body.trim() : "";
    const html = typeof message.html === "string" ? message.html.trim() : "";
    const body = text.length > 0 ? text : htmlToText(html);
    const out = {
      id: message.id,
      from: message.from,
      subject: message.subject,
      body,
    };
    if (typeof message.receivedAt === "string" && message.receivedAt.length > 0) {
      out.receivedAt = message.receivedAt;
    }
    return out;
  }

  function failureResult(category, message, trigger) {
    const result = {
      ok: false,
      trigger,
      at: now().toISOString(),
      category,
      message,
    };
    lastResult = result;
    return result;
  }

  /** Status must never carry message content — only counts + identity. */
  function keepSummary(result) {
    if (!result || !result.ok) return result;
    const { messages, ...safe } = result;
    return safe;
  }

  /**
   * The canonical sync operation. Validates the account, connects through the
   * (held) transport, searches server-side, fetches only new candidate
   * messages with read-only body parts, converts them to the parser's
   * AlertEmail shape, records sync metadata, and returns a safe result.
   *
   * Safe result means: redacted categorized errors, identity + counts + the
   * converted plain-text messages, never a password, never a raw HTML body.
   */
  async function checkNow(trigger = "manual") {
    const safeTrigger = SYNC_TRIGGERS.includes(trigger) ? trigger : "manual";
    if (inFlight) {
      return {
        ok: true,
        trigger: safeTrigger,
        started: false,
        reason: "busy",
        at: now().toISOString(),
      };
    }
    inFlight = (async () => {
      // 1. Validate connected account.
      if (!config) {
        return failureResult(
          "invalid-config",
          "No connected email account.",
          safeTrigger,
        );
      }

      // 2. Retrieve credentials inside main.
      if (!credentialStore.status(VAULT_ACCOUNT).connected) {
        return failureResult(
          "auth",
          "No stored app password — reconnect the account.",
          safeTrigger,
        );
      }

      // 3. Connect through the IMAP transport (held + reconnected with backoff).
      const connected = await ensureTransport();
      if (!connected.ok) {
        return failureResult(
          connected.category,
          connected.message,
          safeTrigger,
        );
      }
      const { transport: t, uidValidity } = connected;
      const nowMs = now().getTime();

      // 4. Search the mailbox server-side (SINCE + OR-of-FROM allowlist).
      const sinceDays = sinceDaysFor(nowMs);
      const searched = await t.search({
        sinceDays,
        fromDomains: domains,
        now: nowMs,
      });
      if (!searched.ok) {
        await teardownTransport();
        scheduleBackoff();
        return failureResult(searched.category, searched.message, safeTrigger);
      }

      // 5. Drop messages already delivered (mailbox-level dedupe by UID,
      //    within the current UIDVALIDITY generation). Fetch the rest.
      const key = accountKey();
      const { fresh } = syncStore.diffUnseen(key, uidValidity, searched.uids ?? []);
      if (fresh.length === 0) {
        lastUidValidity = uidValidity ?? null;
        syncStore.finish(key, uidValidity, {
          ok: true,
          fetched: 0,
          newCount: 0,
          sinceDays,
        });
        resetBackoff();
        const result = {
          ok: true,
          trigger: safeTrigger,
          started: true,
          at: now().toISOString(),
          account: emailIdentity(config),
          mailbox: MAILBOX,
          uidValidity: uidValidity ?? null,
          sinceDays,
          fetched: 0,
          messages: [],
        };
        lastResult = keepSummary(result);
        return result;
      }
      const fetched = await t.fetchMessages({ uids: fresh });
      if (!fetched.ok) {
        await teardownTransport();
        scheduleBackoff();
        return failureResult(fetched.category, fetched.message, safeTrigger);
      }

      // 6-7. Read-only fetch already happened; convert to AlertEmail shape
      //       (HTML-only alerts become parser-readable plain text).
      const messages = (fetched.messages ?? []).map(toAlertEmail);

      // 11. Record sync metadata.
      lastUidValidity = uidValidity ?? null;
      syncStore.finish(key, uidValidity, {
        ok: true,
        fetched: messages.length,
        newCount: messages.length,
        sinceDays,
      });
      resetBackoff();

      const result = {
        ok: true,
        trigger: safeTrigger,
        started: true,
        at: now().toISOString(),
        account: emailIdentity(config),
        mailbox: MAILBOX,
        uidValidity: uidValidity ?? null,
        sinceDays,
        fetched: messages.length,
        messages,
      };
      lastResult = keepSummary(result);
      return result;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  return {
    /**
     * The renderer reports the connected account (and its persistable
     * lookback) here at mount and whenever it changes — main is TOLD, never
     * discovers it from stored state. Passing null/undefined clears it (the
     * disconnect path). Returns whether main now has an account to sync.
     */
    setAccountConfig(rawConfig, rawDomains) {
      if (rawConfig === null || rawConfig === undefined) {
        const wasConfigured = config !== null;
        config = null;
        domains = [];
        if (wasConfigured) {
          // A different (or removed) account: the held connection belongs to
          // the old mailbox — drop it so the next sync starts clean.
          void teardownTransport();
        }
        return { ok: true, configured: false };
      }
      const norm = normalizeEmailAccountConfig(rawConfig);
      if (!norm.ok) return { ok: false, errors: norm.errors, configured: false };
      const changed =
        config === null ||
        config.email !== norm.config.email ||
        config.host !== norm.config.host;
      config = norm.config;
      domains = Array.isArray(rawDomains)
        ? rawDomains.filter(
            (domain) => typeof domain === "string" && domain.length > 0,
          )
        : [];
      if (changed) {
        void teardownTransport();
        backoffUntil = 0;
        backoffCount = 0;
      }
      return { ok: true, configured: true };
    },

    /** True when an account is configured — gates the tray's "Check now" and
     *  the scheduler's tick. */
    hasAccount() {
      return (
        config !== null && credentialStore.status(VAULT_ACCOUNT).connected
      );
    },

    /** The safe identity of the current account (or null). */
    accountConfig() {
      return config ? emailIdentity(config) : null;
    },

    checkNow,

    /**
     * Message-level dedupe confirmation. Called by the renderer AFTER it has
     * applied/queued every delivered message, so the hourly tick does not
     * re-download them. This is mailbox UID bookkeeping — unrelated to the
     * transaction duplicate detection in lib/emailPipeline.ts.
     */
    confirmProcessed(uids) {
      if (!config) return { ok: false, reason: "no-account" };
      const key = accountKey();
      if (lastUidValidity === null) {
        // No successful sync yet — nothing to mark against.
        return { ok: true, added: 0 };
      }
      return syncStore.markSeen(key, lastUidValidity, uids);
    },

    /** Safe status: account identity, in-flight flag, last outcome, backoff. */
    status() {
      const storeStatus = syncStore.status();
      return {
        configured: config !== null,
        account: config ? emailIdentity(config) : null,
        inFlight: inFlight !== null,
        lastResult,
        backoff:
          backoffUntil > Date.now()
            ? {
                active: true,
                retryAt: new Date(backoffUntil).toISOString(),
              }
            : { active: false },
        lastSyncAt:
          typeof storeStatus.lastSyncAt === "string"
            ? storeStatus.lastSyncAt
            : null,
      };
    },

    /** Connection-teardown on quit. Idempotent. */
    async dispose() {
      await teardownTransport();
    },
  };
}

module.exports = {
  createEmailSyncManager,
  MAILBOX,
  SYNC_TRIGGERS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
};