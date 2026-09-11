import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createEmailSyncStore, MAX_SEEN_UIDS } = require_("./emailSyncStore.cjs");

/** In-memory kv stand-in for main's SQLite db. */
function fakeDb() {
  const map = new Map<string, string>();
  return {
    get: (key: string) => (map.has(key) ? map.get(key) : null),
    set: (key: string, value: string) => {
      map.set(key, value);
      return true;
    },
    remove: (key: string) => map.delete(key),
  };
}

const KEY = "me@gmail.com|imap.gmail.com|INBOX";

describe("emailSyncStore", () => {
  it("diffUnseen returns every UID fresh when nothing has been seen", () => {
    const store = createEmailSyncStore({ db: fakeDb() });
    const result = store.diffUnseen(KEY, 42, [1, 2, 3]);
    expect(result.fresh).toEqual([1, 2, 3]);
    expect(result.alreadySeen).toBe(0);
  });

  it("markSeen then diffUnseen excludes the seen UIDs", () => {
    const db = fakeDb();
    const store = createEmailSyncStore({ db });
    store.markSeen(KEY, 42, [1, 2]);
    const result = store.diffUnseen(KEY, 42, [1, 2, 3]);
    expect(result.fresh).toEqual([3]);
    expect(result.alreadySeen).toBe(2);
  });

  it("a changed UIDVALIDITY resets the seen set (new mailbox generation)", () => {
    const db = fakeDb();
    const store = createEmailSyncStore({ db });
    store.markSeen(KEY, 42, [1, 2, 3]);
    const result = store.diffUnseen(KEY, 99, [1, 2, 3, 4]);
    expect(result.fresh).toEqual([1, 2, 3, 4]);
    expect(result.alreadySeen).toBe(0);
  });

  it("different account keys never share a seen set", () => {
    const store = createEmailSyncStore({ db: fakeDb() });
    store.markSeen("a@x|host|INBOX", 1, [5]);
    const result = store.diffUnseen(KEY, 1, [5]);
    expect(result.fresh).toEqual([5]);
  });

  it("records the last success timestamp and safe outcome metadata", () => {
    const at = new Date("2026-09-03T10:00:00.000Z");
    const store = createEmailSyncStore({
      db: fakeDb(),
      now: () => at,
    });
    store.finish(KEY, 42, { ok: true, fetched: 3, newCount: 3, sinceDays: 30 });
    expect(store.lastSyncAt()).toBe("2026-09-03T10:00:00.000Z");
    const status = store.status();
    expect(status.configured).toBe(true);
    expect(status.lastSyncAt).toBe("2026-09-03T10:00:00.000Z");
  });

  it("lastSyncAt feeds the NEXT since-window", () => {
    const db = fakeDb();
    let current = new Date("2026-09-03T10:00:00.000Z");
    const store = createEmailSyncStore({ db, now: () => current });
    store.finish(KEY, 42, { ok: true, fetched: 0, newCount: 0, sinceDays: 30 });
    // Later, 26 hours after the last sync…
    current = new Date("2026-09-04T12:00:00.000Z");
    expect(store.lastSyncAt()).toBe("2026-09-03T10:00:00.000Z");
  });

  it("caps the seen set to MAX_SEEN_UIDS", () => {
    const store = createEmailSyncStore({ db: fakeDb() });
    const uids = Array.from({ length: MAX_SEEN_UIDS + 50 }, (_, i) => i + 1);
    store.markSeen(KEY, 42, uids);
    const status = store.status();
    expect(status.seenCount).toBe(MAX_SEEN_UIDS);
  });

  it("ignores garbage and survives corrupt persisted records", () => {
    const db = fakeDb();
    db.set("budget-planner:email-sync", "{not json");
    const store = createEmailSyncStore({ db });
    expect(store.lastSyncAt()).toBeNull();
    expect(store.status().configured).toBe(false);
    // diffUnseen still works with a clean slate.
    const result = store.diffUnseen(KEY, 7, [9]);
    expect(result.fresh).toEqual([9]);
  });

  it("markSeen is idempotent", () => {
    const store = createEmailSyncStore({ db: fakeDb() });
    store.markSeen(KEY, 42, [1, 2]);
    const second = store.markSeen(KEY, 42, [2, 3]);
    expect(second.added).toBe(1);
    const result = store.diffUnseen(KEY, 42, [1, 2, 3]);
    expect(result.fresh).toEqual([]);
  });
});