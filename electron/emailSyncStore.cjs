// Message-level sync metadata store (FR-24, Prompt 2) — runs in the ELECTRON
// MAIN PROCESS, persisted through the same kv store that holds AppState.
//
// This is MAILBOX-LEVEL deduplication, deliberately separate from
// transaction duplicate detection (which stays in lib/emailPipeline.ts and
// lib/duplicateScore.ts): it remembers which IMAP UIDs have already been
// fetched and delivered, so a message is not downloaded again on the next
// hourly tick. It is keyed by (account identity, mailbox, UIDVALIDITY) — a
// UID is only meaningful within one UIDVALIDITY generation, so a mailbox that
// was recreated (UIDVALIDITY changed) starts a fresh seen-set.
//
// Nothing here stores email CONTENT: only the account key, the UIDVALIDITY,
// the seen UID list, and sync timestamps/counts.
"use strict";

const SYNC_STORAGE_KEY = "budget-planner:email-sync";
const MAX_SEEN_UIDS = 10000;

function isUid(value) {
  return (
    (typeof value === "number" || typeof value === "string") &&
    Number.isInteger(Number(value)) &&
    Number(value) > 0
  );
}

function createEmailSyncStore({ db, now = () => new Date() }) {
  function load() {
    try {
      const raw = db.get(SYNC_STORAGE_KEY);
      if (typeof raw !== "string" || raw.length === 0) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function save(record) {
    try {
      db.set(SYNC_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // A failed metadata write must never crash a sync; the worst case is a
      // re-fetch next hour, which the parser-level dedupe already tolerates.
    }
  }

  /** The record for a given mailbox generation, or a fresh empty one. */
  function recordFor(accountKey, uidValidity) {
    const record = load();
    if (
      record &&
      record.account === accountKey &&
      Number(record.uidValidity) === Number(uidValidity)
    ) {
      return record;
    }
    return { account: accountKey, uidValidity, seen: [], lastSyncAt: null };
  }

  return {
    /**
     * Splits `uids` into already-seen and fresh, for a mailbox generation.
     * A UIDVALIDITY mismatch is treated as a new mailbox: nothing is "seen"
     * and the stored set is reset (the filter starts over).
     */
    diffUnseen(accountKey, uidValidity, uids) {
      const list = Array.isArray(uids)
        ? uids.map(Number).filter((uid) => Number.isInteger(uid) && uid > 0)
        : [];
      const record = recordFor(accountKey, uidValidity);
      const seenSet = new Set(record.seen.map(Number));
      const fresh = list.filter((uid) => !seenSet.has(uid));
      const alreadySeen = list.length - fresh.length;
      return { fresh, alreadySeen, uidValidity: Number(uidValidity) };
    },

    /** Persists delivered UIDs for a mailbox generation (called AFTER the
     *  renderer confirms it has processed them). Idempotent. */
    markSeen(accountKey, uidValidity, uids) {
      const list = Array.isArray(uids)
        ? uids
            .map((uid) => (isUid(uid) ? Number(uid) : null))
            .filter((uid) => uid !== null)
        : [];
      if (list.length === 0) return { ok: true, added: 0 };
      const record = recordFor(accountKey, uidValidity);
      const seenSet = new Set(record.seen.map(Number));
      let added = 0;
      for (const uid of list) {
        if (!seenSet.has(uid)) {
          seenSet.add(uid);
          added += 1;
        }
      }
      // Bound the set to the newest MAX_SEEN_UIDS UIDs (IMAP UIDs only grow).
      const seen = [...seenSet].sort((a, b) => a - b).slice(-MAX_SEEN_UIDS);
      save({ ...record, seen });
      return { ok: true, added };
    },

    /** Timestamp of the last successful sync (ISO string) or null. */
    lastSyncAt() {
      const record = load();
      return record && typeof record.lastSyncAt === "string"
        ? record.lastSyncAt
        : null;
    },

    /** Records a completed sync's metadata (timestamp + counts). */
    finish(accountKey, uidValidity, meta) {
      const record = recordFor(accountKey, uidValidity);
      const counts = meta && typeof meta === "object" ? meta : {};
      const at = now().toISOString();
      save({
        ...record,
        lastSyncAt: at,
        lastOutcome: {
          ok: counts.ok === true,
          fetched: Number(counts.fetched) || 0,
          newCount: Number(counts.newCount) || 0,
          sinceDays: Number(counts.sinceDays) || 0,
          at,
        },
      });
    },

    /** Safe status for the renderer: no content, only metadata. */
    status() {
      const record = load();
      if (!record) return { configured: false, seenCount: 0, lastSyncAt: null };
      return {
        configured: true,
        seenCount: Array.isArray(record.seen) ? record.seen.length : 0,
        lastSyncAt: record.lastSyncAt ?? null,
      };
    },
  };
}

module.exports = { createEmailSyncStore, SYNC_STORAGE_KEY, MAX_SEEN_UIDS };