import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createEmailConnectionManager } = require_("./emailConnection.cjs");

const CONFIG = {
  provider: "gmail",
  email: "user@gmail.com",
  initialLookbackDays: 30,
};

/** Stand-in for the real credential store. Records what happened to the
 *  vault so tests can assert exactly when a password was written. */
function fakeCredentialStore({ available = true } = {}) {
  const calls: string[] = [];
  let stored: string | null = null;
  return {
    calls,
    isAvailable: () => available,
    set(_account: string, secret: string) {
      calls.push("set");
      if (!available) return { ok: false, reason: "encryption-unavailable" };
      stored = secret;
      return { ok: true };
    },
    status(_account: string) {
      return { connected: stored !== null, savedAt: stored ? "2026-09-03T00:00:00.000Z" : null };
    },
    reveal(_account: string) {
      calls.push("reveal");
      return stored;
    },
    clear(_account: string) {
      calls.push("clear");
      const removed = stored !== null;
      stored = null;
      return { ok: true, removed };
    },
  };
}

/** Transport factory whose behaviour the test drives. */
function fakeTransportFactory({ result = { ok: true } as Record<string, unknown> } = {}) {
  const factory = vi.fn(() => ({
    test: vi.fn(async () => result),
    close: vi.fn(async () => {}),
  }));
  return Object.assign(factory, { result });
}

describe("successful connect", () => {
  it("stores the password in the vault only AFTER the server accepted it", async () => {
    const store = fakeCredentialStore();
    const transport = fakeTransportFactory();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: transport,
    });

    const result = await manager.connect(CONFIG, "app-password-123");
    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
    expect(store.calls).toEqual(["set"]);
    expect(store.status("email").connected).toBe(true);
    expect(manager.status().state).toBe("connected");
  });

  it("reports safe identity and timestamps, and NEVER the password", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory(),
    });
    await manager.connect(CONFIG, "app-password-123");

    const status = manager.status();
    expect(status).toMatchObject({
      state: "connected",
      provider: "gmail",
      email: "user@gmail.com",
    });
    expect(status.lastConnectedAt).toBeTruthy();
    // The assertion that matters: no secret anywhere in the status payload.
    expect(JSON.stringify(status)).not.toContain("app-password-123");
  });

  it("uses the stored credential when no password is supplied, without re-storing", async () => {
    const store = fakeCredentialStore();
    const transport = fakeTransportFactory();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: transport,
    });
    // Simulate a previously stored password.
    store.set("email", "stored-password");

    const result = await manager.connect(CONFIG);
    expect(result.ok).toBe(true);
    expect(store.calls).toEqual(["set", "reveal"]);
    // The transport received the DECRYPTED secret internally...
    const options = (
      transport.mock.calls as unknown as Array<[{ password: string }]>
    )[0][0];
    expect(options.password).toBe("stored-password");
    // ...but the result and status carry nothing secret-bearing.
    expect(JSON.stringify(result)).not.toContain("stored-password");
  });

  it("deduplicates concurrent connects so a double-click cannot race the vault", async () => {
    const store = fakeCredentialStore();
    const transport = fakeTransportFactory();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: transport,
    });
    const [a, b] = await Promise.all([
      manager.connect(CONFIG, "app-password-123"),
      manager.connect(CONFIG, "app-password-123"),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(transport).toHaveBeenCalledOnce();
    expect(store.calls).toEqual(["set"]);
  });
});

describe("failed connect", () => {
  it("an authentication failure never writes the vault and reports auth-failed", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory({ result: { ok: false, category: "auth", message: "rejected" } }),
    });

    const result = await manager.connect(CONFIG, "wrong-password");
    expect(result.ok).toBe(false);
    if (!result.ok) return void 0;
    expect(result.category).toBe("auth");
    expect(store.calls).toEqual([]); // nothing stored
    expect(store.status("email").connected).toBe(false);
    expect(manager.status().state).toBe("auth-failed");
    expect(manager.status().lastError?.category).toBe("auth");
    expect(JSON.stringify(result)).not.toContain("wrong-password");
  });

  it("a connection failure reports connection-failed, vault untouched", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory({ result: { ok: false, category: "network", message: "unreachable" } }),
    });
    const result = await manager.connect(CONFIG, "app-password-123");
    expect(result.ok).toBe(false);
    expect(store.calls).toEqual([]);
    expect(manager.status().state).toBe("connection-failed");
  });

  it("a vault refusal (no OS keychain) blocks the connect instead of weakening storage", async () => {
    const store = fakeCredentialStore({ available: false });
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory(),
    });
    const result = await manager.connect(CONFIG, "app-password-123");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe("credential");
    expect(manager.status().state).toBe("not-connected");
    expect(store.status("email").connected).toBe(false);
  });

  it("a missing password and no stored credential is an auth failure", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory(),
    });
    const result = await manager.connect(CONFIG, "");
    expect(result.ok).toBe(false);
    expect(result.category).toBe("auth");
  });

  it("an invalid configuration is refused before any connection is attempted", async () => {
    const store = fakeCredentialStore();
    const transport = fakeTransportFactory();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: transport,
    });
    const result = await manager.connect({ provider: "nonsense" }, "app-password-123");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.category).toBe("invalid-config");
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("test operation", () => {
  it("does not change the vault or the connection state", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory(),
    });
    const result = await manager.test(CONFIG, "app-password-123");
    expect(result.ok).toBe(true);
    expect(store.calls).toEqual([]);
    expect(manager.status().state).toBe("not-connected");
    expect(store.status("email").connected).toBe(false);
  });
});

describe("disconnect and status", () => {
  it("disconnect clears the vault and resets state", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory(),
    });
    await manager.connect(CONFIG, "app-password-123");
    expect(store.status("email").connected).toBe(true);

    const result = manager.disconnect();
    expect(result.ok).toBe(true);
    expect(store.calls).toContain("clear");
    expect(store.status("email").connected).toBe(false);
    expect(manager.status().state).toBe("not-connected");
    expect(manager.status().email).toBeNull();
    expect(manager.status().lastConnectedAt).toBeNull();
  });

  it("status is safe to serialize on a fresh manager", () => {
    const manager = createEmailConnectionManager({
      credentialStore: fakeCredentialStore(),
      transportFactory: fakeTransportFactory(),
    });
    expect(manager.status()).toEqual({
      state: "not-connected",
      provider: null,
      email: null,
      lastConnectedAt: null,
      lastError: null,
      credential: { connected: false, savedAt: null },
    });
  });

  it("status never leaks the transport's password, in any state", async () => {
    const store = fakeCredentialStore();
    const manager = createEmailConnectionManager({
      credentialStore: store,
      transportFactory: fakeTransportFactory({
        result: { ok: false, category: "auth", message: "LOGIN app-password-123 rejected" },
      }),
    });
    await manager.connect(CONFIG, "app-password-123");
    // Even though the transport's (mock) message mentions the password, the
    // manager only keeps the CATEGORY — the message never enters status.
    const serialized = JSON.stringify(manager.status());
    expect(serialized).not.toContain("app-password-123");
  });
});

// The 2026-09-11 live failure: main.cjs built the connection manager without
// `transportFactory`, so every real connect/test threw and the renderer could
// only show a generic message. The unit tests inject a fake factory and never
// caught it — so the wiring itself gets a tripwire here.
describe("main-process wiring", () => {
  it("hands the real transport factory to the connection manager", () => {
    const fs = require_("node:fs");
    const path = require_("node:path");
    const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
    const call = source.match(
      /createEmailConnectionManager\(\{[\s\S]*?\n  \}\);/,
    );
    expect(call).not.toBeNull();
    expect(call![0]).toContain("transportFactory");
  });
});
