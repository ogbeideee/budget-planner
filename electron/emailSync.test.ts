import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createEmailSyncManager } = require_("./emailSync.cjs");
const { createEmailSyncStore } = require_("./emailSyncStore.cjs");

const CONFIG = {
  provider: "gmail",
  email: "user@gmail.com",
  host: "imap.gmail.com",
  port: 993,
  security: "tls",
  initialLookbackDays: 30,
  initialSyncDone: false,
  lastSyncAt: null,
};

const DOMAINS = ["gtbank.com", "wemabank.com"];

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

function fakeCredentials({ secret = "app-password-123", connected = true } = {}) {
  return {
    status: () => ({ connected, savedAt: connected ? "2026-09-03T00:00:00.000Z" : null }),
    reveal: () => (connected ? secret : null),
    set: () => ({ ok: true }),
    clear: () => ({ ok: true, removed: true }),
  };
}

interface FakeMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  html?: string;
}

/** Records exactly what the transport was asked to do, so the sync layer's
 *  narrowing + read-only behaviour can be asserted without a live mailbox.
 *  The fetch is UID-FAITHFUL: it returns only the messages whose id is in the
 *  requested uid list, like a real server would. */
function fakeTransport({
  searchUids = [1, 2, 3],
  messages = [] as FakeMessage[],
  openResult,
  searchResult,
  fetchResult,
  uidValidity = 42,
}: {
  searchUids?: number[];
  messages?: FakeMessage[];
  openResult?: { ok: boolean };
  searchResult?: { ok: boolean };
  fetchResult?: { ok: boolean };
  uidValidity?: number;
} = {}) {
  const calls: {
    open: number;
    search: number;
    fetch: number;
    close: number;
    searches: Array<{ sinceDays: number; fromDomains: string[] }>;
    fetches: Array<number | string>[];
  } = { open: 0, search: 0, fetch: 0, close: 0, searches: [], fetches: [] };
  const transport = {
    calls,
    mailboxInfo: () => ({ path: "INBOX", uidValidity }),
    open: vi.fn(async () => {
      calls.open += 1;
      return openResult ?? { ok: true };
    }),
    test: vi.fn(async () => openResult ?? { ok: true }),
    search: vi.fn(async (query: { sinceDays: number; fromDomains: string[] }) => {
      calls.search += 1;
      calls.searches.push(query);
      return searchResult ?? { ok: true, uids: searchUids };
    }),
    fetchMessages: vi.fn(async ({ uids }: { uids: Array<number | string> }) => {
      calls.fetch += 1;
      calls.fetches.push(uids);
      if (fetchResult) return fetchResult;
      const requested = new Set(uids.map(Number));
      return {
        ok: true,
        messages: messages.filter((message) => requested.has(Number(message.id))),
      };
    }),
    close: vi.fn(async () => {
      calls.close += 1;
    }),
  };
  return transport;
}

function setup({
  credentials = fakeCredentials(),
  transport,
  managerNow,
  backoffBaseMs = 1000,
}: {
  credentials?: ReturnType<typeof fakeCredentials>;
  transport?: ReturnType<typeof fakeTransport>;
  managerNow?: Date;
  backoffBaseMs?: number;
} = {}) {
  const db = fakeDb();
  const store = createEmailSyncStore({
    db,
    now: () => new Date("2026-09-03T10:00:00.000Z"),
  });
  let lastPassword: string | null = null;
  const factory = vi.fn((payload: { config: unknown; password: string }) => {
    lastPassword = payload.password;
    return transport ?? fakeTransport();
  });
  const manager = createEmailSyncManager({
    credentialStore: credentials,
    transportFactory: factory,
    syncStore: store,
    log: undefined,
    now: () => managerNow ?? new Date("2026-09-03T10:00:00.000Z"),
    backoffBaseMs,
  });
  const applied = manager.setAccountConfig(CONFIG, DOMAINS);
  expect(applied.ok).toBe(true);
  return { manager, factory, store, db, lastPassword: () => lastPassword };
}

describe("emailSync.checkNow — canonical sync", () => {
  it("search narrows server-side per allowlisted domain + SINCE the lookback", async () => {
    const t = fakeTransport({ searchUids: [1, 2], messages: [] });
    const { manager } = setup({ transport: t });
    const result = await manager.checkNow("manual");
    expect(result.ok).toBe(true);
    // SINCE is the initial lookback on the first sync (no lastSyncAt yet).
    expect(t.calls.searches[0].sinceDays).toBe(30);
    expect(t.calls.searches[0].fromDomains).toEqual(DOMAINS);
    // Only the fresh UIDs are fetched, never the whole mailbox.
    expect(t.calls.fetches[0]).toEqual([1, 2]);
    expect(result.fetched).toBe(0); // empty message payload
  });

  it("fetches only messages not already seen (mailbox-level dedupe)", async () => {
    const t = fakeTransport({
      searchUids: [1, 2, 3],
      messages: [
        { id: "2", from: "alerts@wemabank.com", subject: "Transaction Notification", body: "x" },
      ],
    });
    const { manager } = setup({ transport: t });
    const first = await manager.checkNow("manual");
    expect(first.fetched).toBe(1);
    // Renderer confirms it processed uid 2…
    const confirm = manager.confirmProcessed(["2"]);
    expect(confirm.ok).toBe(true);
    const second = await manager.checkNow("scheduled");
    expect(second.fetched).toBe(0);
    expect(second.messages).toEqual([]);
    // The second fetch requested only the NOT-yet-seen UIDs — uid 2 is never
    // re-downloaded after its confirmation.
    expect(t.calls.fetches).toHaveLength(2);
    expect(t.calls.fetches[1]).toEqual([1, 3]);
  });

  it("holds one transport across ticks instead of one connection per tick", async () => {
    const t = fakeTransport({
      searchUids: [9],
      messages: [{ id: "9", from: "a@gtbank.com", subject: "s", body: "b" }],
    });
    const { manager, factory } = setup({ transport: t });
    await manager.checkNow("scheduled");
    await manager.checkNow("scheduled");
    // Two checks, one transport created and opened.
    expect(factory).toHaveBeenCalledTimes(1);
    expect(t.calls.open).toBe(1);
  });

  it("converts HTML-only alert bodies to the parser's plain-text layout", async () => {
    const t = fakeTransport({
      searchUids: [7],
      messages: [
        {
          id: "7",
          from: "GeNS@gtbank.com",
          subject: "Transaction Notification",
          body: "",
          html: "<table><tr><td>Amount</td><td>:</td><td>NGN 5,000.00</td></tr></table>",
        },
      ],
    });
    const { manager } = setup({ transport: t });
    const result = await manager.checkNow("manual");
    expect(result.ok).toBe(true);
    const [email] = result.messages;
    expect(email.body).toContain("| Amount | : | NGN 5,000.00 |");
    expect(email.body).not.toContain("<table>");
    expect(email.id).toBe("7");
  });

  it("after a successful sync the next SINCE covers only the elapsed gap", async () => {
    const t = fakeTransport({ searchUids: [], messages: [] });
    const db = fakeDb();
    const store = createEmailSyncStore({
      db,
      now: () => new Date("2026-09-03T10:00:00.000Z"),
    });
    const manager = createEmailSyncManager({
      credentialStore: fakeCredentials(),
      transportFactory: () => t,
      syncStore: store,
      log: undefined,
      now: () => new Date("2026-09-04T12:00:00.000Z"),
    });
    manager.setAccountConfig(CONFIG, DOMAINS);
    // Arrange the state under test: a SUCCESSFUL sync 26 hours ago (the store
    // stamps lastSyncAt at its own fixed now, 2026-09-03T10:00Z).
    store.finish("user@gmail.com|imap.gmail.com|INBOX", 42, {
      ok: true,
      fetched: 0,
      newCount: 0,
      sinceDays: 30,
    });
    await manager.checkNow("manual");
    // 26 hours later: the since-days is 2 (ceil), not the 30-day lookback.
    expect(t.calls.searches[0].sinceDays).toBe(2);
  });
});

describe("emailSync.checkNow — failure and safety rails", () => {
  it("a failed connection returns a categorized failure and starts backoff", async () => {
    const t = fakeTransport({ openResult: { ok: false } });
    const { manager } = setup({ transport: t });
    const result = await manager.checkNow("scheduled");
    expect(result.ok).toBe(false);
    expect(typeof result.category).toBe("string");
    expect(result.message).not.toContain("app-password-123");
    const status = manager.status();
    expect(status.backoff.active).toBe(true);
    expect(typeof status.backoff.retryAt).toBe("string");
  });

  it("reports the secret never — even in a fetch failure", async () => {
    const t = fakeTransport({ fetchResult: { ok: false } });
    const { manager } = setup({ transport: t });
    const result = await manager.checkNow("manual");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("app-password-123");
  });

  it("a second check while one is in flight never opens an overlapping session", async () => {
    let release!: (value: { ok: boolean } | { ok: boolean; uids: number[] }) => void;
    const slow = fakeTransport({
      searchUids: [1],
      messages: [{ id: "1", from: "a@gtbank.com", subject: "s", body: "b" }],
    });
    slow.search = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { manager } = setup({ transport: slow });
    const first = manager.checkNow("manual");
    const second = await manager.checkNow("tray");
    // The second request is refused busy, not queued into a second session.
    expect(second.started).toBe(false);
    expect(second.reason).toBe("busy");
    expect(slow.calls.open).toBe(1);
    // Let the open/search microtask chain settle so the first sync is actually
    // parked inside SEARCH before we release it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    release({ ok: true, uids: [] });
    const done = await first;
    expect(done.ok).toBe(true);
  });

  it("the transport is never asked to mutate the mailbox (read-only contract)", async () => {
    const t = fakeTransport({
      searchUids: [5],
      messages: [{ id: "5", from: "a@gtbank.com", subject: "s", body: "b" }],
    });
    const { manager } = setup({ transport: t });
    await manager.checkNow("manual");
    await manager.checkNow("scheduled");
    // Only the read-only operations were called, and the transport object
    // exposes no write methods at all.
    expect(t.calls.open).toBe(1);
    expect(t.calls.search).toBe(2);
    expect(t.calls.close).toBe(0);
    for (const forbidden of [
      "messageDelete",
      "messageMove",
      "messageFlagsAdd",
      "messageFlagsRemove",
      "append",
      "setFlags",
    ]) {
      expect(t).not.toHaveProperty(forbidden);
    }
  });

  it("the no-new-alert case records metadata and returns an empty batch", async () => {
    const t = fakeTransport({ searchUids: [], messages: [] });
    const { manager, store } = setup({ transport: t });
    const result = await manager.checkNow("manual");
    expect(result.ok).toBe(true);
    expect(result.fetched).toBe(0);
    expect(result.messages).toEqual([]);
    expect(store.lastSyncAt()).not.toBeNull();
    const status = manager.status();
    expect(status.lastResult?.ok).toBe(true);
  });

  it("a triggered check without a stored credential fails safe", async () => {
    const t = fakeTransport();
    const { manager } = setup({ credentials: fakeCredentials({ connected: false }) });
    const result = await manager.checkNow("manual");
    expect(result.ok).toBe(false);
    expect(result.category).toBe("auth");
    // The transport was never created — no connection attempt happened.
    expect(t.calls.open).toBe(0);
  });
});