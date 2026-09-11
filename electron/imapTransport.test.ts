import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  categorizeImapError,
  createTransport,
  redactSecrets,
} = require_("./imapTransport.cjs");

const GMAIL_CONFIG = {
  provider: "gmail",
  email: "user@gmail.com",
  host: "imap.gmail.com",
  port: 993,
  security: "tls",
  initialLookbackDays: 30,
  initialSyncDone: false,
  lastSyncAt: null,
};

/** A fake IMAP client standing in for ImapFlow. Behaviours are driven by the
 *  `error` it throws on connect; its transcript records what the transport
 *  actually did, so the read-only promise can be asserted. */
function fakeClient({
  connectError = null,
  searchUids = [],
}: { connectError?: unknown; searchUids?: number[] } = {}) {
  const client = {
    connect: vi.fn(async () => {
      if (connectError) throw connectError;
    }),
    logout: vi.fn(async () => {}),
    close: vi.fn(() => {}),
    search: vi.fn(async () => searchUids),
    fetch: vi.fn(async function* () {
      // empty
    }),
  };
  return client;
}

describe("error categorization", () => {
  it("categorizes an authentication failure (imapflow's own flag)", () => {
    const error = Object.assign(new Error("Invalid credentials"), {
      authenticationFailed: true,
      responseText: "AUTHENTICATIONFAILED",
    });
    expect(categorizeImapError(error)).toBe("auth");
  });

  it("categorizes a TLS certificate failure", () => {
    const error = Object.assign(new Error("self signed certificate"), {
      code: "DEPTH_ZERO_SELF_SIGNED_CERT",
    });
    expect(categorizeImapError(error)).toBe("tls");
  });

  it("categorizes a DNS/connection failure as network", () => {
    expect(
      categorizeImapError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND imap.example.com" }),
    ).toBe("network");
    expect(categorizeImapError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" })).toBe(
      "network",
    );
  });

  it("categorizes a timeout as timeout", () => {
    expect(categorizeImapError(new Error("Greeting timeout"))).toBe("timeout");
  });

  it("falls back to unknown", () => {
    expect(categorizeImapError(new Error("something odd"))).toBe("unknown");
  });
});

describe("redaction", () => {
  it("removes the password and email from any message before it leaves the module", () => {
    const out = redactSecrets(
      "LOGIN user@gmail.com 'app-password-123' failed: bad password app-password-123",
      ["app-password-123", "user@gmail.com"],
    );
    expect(out).not.toContain("app-password-123");
    expect(out).not.toContain("user@gmail.com");
    expect(out).toContain("[redacted]");
  });

  it("caps message length", () => {
    const out = redactSecrets("x".repeat(1000), []);
    expect(out.length).toBeLessThanOrEqual(301);
  });
});

describe("successful IMAP authentication", () => {
  it("connects, and test() closes the connection cleanly", async () => {
    const client = fakeClient();
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => client,
    });

    const result = await transport.test();
    expect(result).toEqual({ ok: true });
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.logout).toHaveBeenCalledOnce();
  });

  it("nothing a transport call returns contains the password", async () => {
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => fakeClient(),
    });
    const result = await transport.test();
    expect(JSON.stringify(result)).not.toContain("app-password-123");
  });
});

describe("authentication failure", () => {
  it("returns ok:false with the auth category and a redacted message", async () => {
    const error = Object.assign(
      new Error("LOGIN failed for user@gmail.com with password hunter2"),
      { authenticationFailed: true },
    );
    const client = fakeClient({ connectError: error });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "hunter2",
      clientFactory: () => client,
    });

    const result = await transport.test();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe("auth");
    expect(result.message).not.toContain("hunter2");
    expect(result.message).not.toContain("user@gmail.com");
    // The failed connection must still have been torn down.
    expect(client.logout).toHaveBeenCalled();
  });
});

describe("TLS and connection failures", () => {
  it("reports a TLS failure as tls", async () => {
    const error = Object.assign(new Error("certificate has expired"), {
      code: "CERT_HAS_EXPIRED",
    });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => fakeClient({ connectError: error }),
    });
    const result = await transport.test();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe("tls");
  });

  it("reports an unreachable server as network", async () => {
    const error = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => fakeClient({ connectError: error }),
    });
    const result = await transport.test();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe("network");
  });
});

describe("search and fetch (transport primitives)", () => {
  it("narrows server-side with SEARCH FROM per domain and SINCE", async () => {
    const client = fakeClient({ searchUids: [3, 7] });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => client,
    });
    await transport.open();
    const result = await transport.search({
      sinceDays: 30,
      fromDomains: ["gtbank.com", "wemabank.com"],
      now: Date.UTC(2026, 8, 3),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uids).toEqual([3, 7]);
    const [query, options] = (
      client.search.mock.calls as unknown as Array<
        [
          { since: Date; or?: Array<{ from: string }> },
          Record<string, unknown>,
        ]
      >
    )[0];
    expect(options).toEqual({ uid: true });
    expect(query.since.toISOString()).toBe("2026-08-04T00:00:00.000Z");
    // OR-of-FROMs: the allowlist narrows the download, never a bare fetch.
    expect(query.or).toEqual([
      { from: "gtbank.com" },
      { from: "wemabank.com" },
    ]);
    await transport.close();
  });

  it("returns no messages for an empty uid list without touching the server", async () => {
    const client = fakeClient();
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => client,
    });
    await transport.open();
    const result = await transport.fetchMessages({ uids: [] });
    expect(result).toEqual({ ok: true, messages: [] });
    expect(client.fetch).not.toHaveBeenCalled();
    await transport.close();
  });

  it("exposes no write operations at all (read-only by construction)", () => {
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => fakeClient(),
    }) as unknown as Record<string, unknown>;
    for (const forbidden of [
      "messageDelete",
      "messageMove",
      "messageCopy",
      "messageFlagsAdd",
      "messageFlagsRemove",
      "messageFlagsSet",
      "append",
    ]) {
      expect(transport[forbidden]).toBeUndefined();
    }
  });
});

describe("close behaviour", () => {
  it("close is idempotent and a failed connect still tears down once", async () => {
    const client = fakeClient({
      connectError: Object.assign(new Error("nope"), { code: "ECONNREFUSED" }),
    });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => client,
    });
    await transport.test();
    await transport.close();
    await transport.close();
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it("falls back to a force close when logout rejects", async () => {
    const client = fakeClient();
    client.logout = vi.fn(async () => {
      throw new Error("socket gone");
    });
    const transport = createTransport({
      config: GMAIL_CONFIG,
      password: "app-password-123",
      clientFactory: () => client,
    });
    await transport.open();
    await transport.close();
    expect(client.close).toHaveBeenCalled();
  });
});
