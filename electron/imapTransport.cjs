// IMAP transport (FR-24) — the only place the app touches an IMAP library.
//
// Everything here runs in the ELECTRON MAIN PROCESS. The renderer never opens
// a socket, never sees the app password (it is consumed by the transport and
// never stored on it), and never sees a full email body.
//
// imapflow is deliberately kept BEHIND this module. The rest of the
// application depends on `createTransport`, not on ImapFlow, so swapping or
// stubbing the client (tests use a fake) touches exactly one file.
//
// Security posture (docs/15_EMAIL_PARSING.md):
//  - READ ONLY. The session is opened with `readOnly: true`, so the server
//    itself refuses any flag change, delete, move or expunge. No method here
//    issues a mutating command even if a caller asks.
//  - The password is never logged. All imapflow logging is disabled and every
//    error message is scrubbed through redactSecrets() before it leaves here.
//  - Error messages are categorized and capped; they are safe status, not
//    server transcripts.
"use strict";

const { ImapFlow } = require("imapflow");
const { extractBodies } = require("./mimeBodies.cjs");

const CONNECT_TIMEOUT_MS = 15 * 1000;
const GREETING_TIMEOUT_MS = 15 * 1000;
const SOCKET_TIMEOUT_MS = 30 * 1000;

const ERROR_CATEGORIES = Object.freeze([
  "auth",
  "tls",
  "timeout",
  "network",
  "unknown",
]);

const REDACTED = "[redacted]";
const MAX_MESSAGE_CHARS = 300;

/** The mailbox every sync reads. Searches are server-side against this. */
const INBOX = "INBOX";

/** Cap for a single fetched body part. Bank alert mail is tiny; anything this
 *  large is not an alert and would only cost memory. */
const BODY_PART_MAX_BYTES = 768 * 1024;
// FETCH UIDs are batched: a 30-day lookback over busy bank senders can match
// hundreds of messages, and Gmail answers a single FETCH with a very long UID
// list `BAD — Could not parse command` (found live, 2026-09-11).
const FETCH_BATCH_SIZE = 100;

/** Replaces any occurrence of a secret in a message with [redacted]. */
function redactSecrets(message, secrets) {
  let out = String(message ?? "");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      out = out.split(secret).join(REDACTED);
    }
  }
  return out.length > MAX_MESSAGE_CHARS
    ? `${out.slice(0, MAX_MESSAGE_CHARS)}…`
    : out;
}

/**
 * Maps a raw transport error onto the safe categories the UI knows. Order
 * matters: an authentication failure can surface behind a TLS wrapper, so
 * auth is checked first; ETIMEDOUT is a socket-level network error while a
 * "timeout" in the message is an application-level one.
 */
function categorizeImapError(error) {
  const code = String((error && error.code) || "");
  const text = String(
    (error && (error.message || error.text || error.response)) || error || "",
  );
  const combined = `${text} ${code}`;

  if (error && (error.authenticationFailed === true || /AUTHENTICATIONFAILED/i.test(combined))) {
    return "auth";
  }
  if (/invalid credentials|authentication (failed|required)|login failed|bad credentials/i.test(combined)) {
    return "auth";
  }
  if (
    error &&
    (code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      code === "CERT_HAS_EXPIRED" ||
      code === "ERR_SSL_WRONG_VERSION_NUMBER")
  ) {
    return "tls";
  }
  if (/\btls\b|\bssl\b|certificate|handshake|wrong version number/i.test(combined)) {
    return "tls";
  }
  if (error && error.timeout === true) return "timeout";
  if (/timeout|timed?\s?out/i.test(combined)) return "timeout";
  if (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    /getaddrinfo|connection refused|socket hang up|network/i.test(combined)
  ) {
    return "network";
  }
  return "unknown";
}

function imapOptionsFor(config, password, timeouts) {
  return {
    host: config.host,
    port: config.port,
    // "tls" is implicit TLS on connect; "starttls" upgrades a plaintext
    // connection; "none" is a plaintext socket, offered for exotic servers.
    secure: config.security === "tls",
    disableSTARTTLS: config.security === "none",
    auth: { user: config.email, pass: password },
    tls: {
      // Never silently accept a bad certificate: a MITM here sees the app
      // password. The hostname must match the certificate.
      rejectUnauthorized: true,
      servername: config.host,
    },
    // Never let the library write connection logs: they can carry command
    // transcripts, and a transcript of LOGIN carries the password.
    logger: false,
    emitLogs: false,
    greetingTimeout: timeouts.greetingTimeoutMs ?? GREETING_TIMEOUT_MS,
    socketTimeout: timeouts.socketTimeoutMs ?? SOCKET_TIMEOUT_MS,
    // Read-only session: the server refuses any store/copy/expunge on it.
    readOnly: true,
    clientInfo: "Budget Planner",
  };
}

/**
 * Creates a transport bound to one config and one password.
 *
 * `clientFactory` is injectable — tests pass a fake. The default constructs
 * an ImapFlow client with hardened options.
 *
 * The transport supports: open/authenticate, search (server-side narrowed),
 * fetch (read-only), and a clean close. The scheduler and sync pipeline are
 * NOT part of this module.
 */
function createTransport({ config, password, clientFactory, timeouts = {} }) {
  const secrets = [password, config.email];

  let client = null;
  // The selected mailbox's UIDVALIDITY — the stable handle that marks one
  // mailbox "generation". Set on open, reset when the connection changes.
  let mailbox = null;

  function makeClient() {
    if (clientFactory) return clientFactory({ config, password, timeouts });
    return new ImapFlow(imapOptionsFor(config, password, timeouts));
  }

  function failure(error) {
    const category = categorizeImapError(error);
    const message = redactSecrets(
      error instanceof Error ? error.message : String(error),
      secrets,
    );
    // Main-process-only diagnostic (never crosses IPC beyond the category +
    // redacted message already carried by the result; never the secret —
    // every field passes through redactSecrets, which scrubs the password
    // and the account address). imapflow's error.message is often just
    // "Command failed"; the server's actual NO/BAD text lives on
    // .responseText and the sent command on .executedCommand, and those are
    // what make a live failure diagnosable.
    const detail = [
      error?.responseStatus || error?.status,
      redactSecrets(String(error?.responseText || error?.text || ""), secrets),
      redactSecrets(String(error?.executedCommand || ""), secrets),
    ]
      .filter(Boolean)
      .join(" | ");
    console.error(
      `[imap] ${category}: ${message}${detail ? ` — ${detail}` : ""}`,
    );
    return { ok: false, category, message };
  }

  return {
    /**
     * Opens the connection, authenticates and selects INBOX (read-only). All
     * searches/fetches in this app target INBOX, and imapflow's search/fetch
     * require a selected mailbox — selecting once here keeps the sync pipeline
     * free of mailbox-bookkeeping. Resolves { ok: true } or a categorized
     * { ok: false, category, message } — never throws, never has the password.
     */
    async open() {
      try {
        client = makeClient();
        await client.connect();
        if (typeof client.mailboxOpen === "function") {
          const opened = await client.mailboxOpen(INBOX);
          const validity = opened ? opened.uidValidity : undefined;
          mailbox = {
            path: INBOX,
            // imapflow reports UIDVALIDITY as bigint; the sync store JSON-serializes it.
            uidValidity:
              typeof validity === "bigint"
                ? Number(validity)
                : typeof validity === "number"
                  ? validity
                  : null,
          };
        }
        return { ok: true };
      } catch (error) {
        await this.close();
        return failure(error);
      }
    },

    /** Opens, authenticates, and closes — the "test connection" operation. */
    async test() {
      const opened = await this.open();
      if (!opened.ok) return opened;
      await this.close();
      return { ok: true };
    },

    /** Safe identity of the selected mailbox (path + UIDVALIDITY). */
    mailboxInfo() {
      return mailbox ? { ...mailbox } : { path: INBOX, uidValidity: null };
    },

    /**
     * Searches the mailbox server-side. `fromDomains` narrows with IMAP
     * SEARCH FROM per allowlisted domain, so non-matching mail is never
     * downloaded (second line of defence behind the parser's allowlist).
     * `sinceDays` looks back from `now` (ms epoch, defaults to Date.now()).
     */
    async search({ sinceDays, fromDomains, now }) {
      if (!client) return { ok: false, category: "unknown", message: "Not connected." };
      const since = new Date((now ?? Date.now()) - sinceDays * 24 * 60 * 60 * 1000);
      const query = { since };
      const domains = Array.isArray(fromDomains) ? fromDomains.filter(Boolean) : [];
      if (domains.length > 0) {
        // imapflow's `or` is a list of sub-queries, any of which may match.
        query.or = domains.map((domain) => ({ from: domain }));
      }
      try {
        const uids = await client.search(query, { uid: true });
        // Metadata only (a count + the window) — no subjects, no senders.
        console.error(
          `[imap] search since=${since.toISOString()} domains=${domains.length} -> ${(uids ?? []).length} uids`,
        );
        return { ok: true, uids: (uids ?? []).map((uid) => Number(uid)) };
      } catch (error) {
        return failure(error);
      }
    },

    /**
     * Fetches whole messages by uid. Returns AlertEmail-shaped records
     * ({ id, from, subject, body, receivedAt }) plus the raw HTML part when
     * present. Read-only: the session is opened readOnly so nothing on the
     * server can change.
     *
     * Both body parts are requested so HTML-only alerts are NOT lost: the
     * text part is preferred for `body`, and the sync pipeline converts the
     * HTML part to alert text when the message had no usable text part.
     */
    async fetchMessages({ uids }) {
      if (!client) return { ok: false, category: "unknown", message: "Not connected." };
      const list = (uids ?? []).map((uid) => Number(uid)).filter(Number.isInteger);
      if (list.length === 0) return { ok: true, messages: [] };
      try {
        const messages = [];
        for (let i = 0; i < list.length; i += FETCH_BATCH_SIZE) {
          const batch = list.slice(i, i + FETCH_BATCH_SIZE);
          // Raw source + local split, NOT BODY.PEEK[HTML]: IMAP has no
          // "give me the HTML part" selector (Gmail answers
          // `BODY.PEEK[HTML]` with BAD — Could not parse command), so the
          // message comes back capped and mimeBodies extracts text/html
          // locally. Read-only either way.
          for await (const msg of client.fetch(
            batch,
            {
              uid: true,
              envelope: true,
              source: { maxLength: BODY_PART_MAX_BYTES },
            },
            // The list contains UIDs (the search ran with uid:true) — without
            // this flag imapflow treats them as SEQUENCE numbers, matches
            // nothing, and silently returns zero messages (found live,
            // 2026-09-11).
            { uid: true },
          )) {
            const addresses = (msg.envelope?.from ?? [])
              .map((address) => address?.address)
              .filter(Boolean);
            const bodies = await extractBodies(msg.source);
            messages.push({
              id: String(msg.uid),
              from: addresses.join(", "),
              subject: msg.envelope?.subject ?? "",
              receivedAt: msg.envelope?.date
                ? new Date(msg.envelope.date).toISOString()
                : undefined,
              body: bodies.text,
              html: bodies.html,
            });
          }
        }
        return { ok: true, messages };
      } catch (error) {
        return failure(error);
      }
    },

    /** Closes cleanly and idempotently. Never throws. */
    async close() {
      const current = client;
      client = null;
      mailbox = null;
      if (!current) return;
      try {
        // logout() is the graceful goodbye (waits for the server's response);
        // close() is the force teardown. Either way the socket must end, and
        // neither may surface an error to the caller.
        if (typeof current.logout === "function") {
          await current.logout();
        } else {
          current.close();
        }
      } catch {
        try {
          current.close();
        } catch {
          // Already gone.
        }
      }
    },
  };
}


module.exports = {
  createTransport,
  categorizeImapError,
  redactSecrets,
  imapOptionsFor,
  ERROR_CATEGORIES,
  CONNECT_TIMEOUT_MS,
  GREETING_TIMEOUT_MS,
  SOCKET_TIMEOUT_MS,
};
