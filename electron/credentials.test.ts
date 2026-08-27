import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createCredentialStore, vaultPath } = require_("./credentials.cjs");

/** Stand-in for Electron's safeStorage. `available` flips to exercise the
 *  refusal path, which is the security-critical branch. */
function fakeSafeStorage(available = true) {
  return {
    available,
    isEncryptionAvailable() {
      return this.available;
    },
    encryptString(text: string) {
      // A reversible transform standing in for the OS key. The point of the
      // test is the STORE's behaviour, not the cipher.
      return Buffer.from(`enc:${text}`, "utf8");
    },
    decryptString(buffer: Buffer) {
      const raw = buffer.toString("utf8");
      if (!raw.startsWith("enc:")) throw new Error("not encrypted by us");
      return raw.slice(4);
    },
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bp-cred-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("storing and retrieving a credential", () => {
  it("round-trips a secret through safeStorage", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());

    expect(store.set("email", "app-specific-password")).toEqual({ ok: true });
    expect(store.status("email").connected).toBe(true);
    expect(store.reveal("email")).toBe("app-specific-password");
  });

  it("never writes the secret in plaintext to disk", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "super-secret-value");

    const onDisk = readFileSync(vaultPath(dir), "utf8");
    // The exact assertion that matters for this feature.
    expect(onDisk).not.toContain("super-secret-value");
    expect(onDisk).toContain("ciphertext");
  });

  it("records when it was saved, without exposing the secret", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "pw");
    const status = store.status("email");
    expect(status.connected).toBe(true);
    expect(typeof status.savedAt).toBe("string");
    expect(JSON.stringify(status)).not.toContain("pw");
  });

  it("reports not-connected before anything is stored", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    expect(store.status("email")).toEqual({ connected: false, savedAt: null });
    expect(store.reveal("email")).toBeNull();
  });

  it("replaces an existing secret rather than accumulating entries", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "first");
    store.set("email", "second");
    expect(store.reveal("email")).toBe("second");
    const onDisk = JSON.parse(readFileSync(vaultPath(dir), "utf8"));
    expect(Object.keys(onDisk)).toEqual(["email"]);
  });
});

describe("when the OS cannot encrypt", () => {
  it("REFUSES to store rather than falling back to plaintext", () => {
    const store = createCredentialStore(dir, fakeSafeStorage(false));

    const result = store.set("email", "app-specific-password");
    expect(result).toEqual({ ok: false, reason: "encryption-unavailable" });
    // Nothing was written at all — not even an obfuscated copy.
    expect(existsSync(vaultPath(dir))).toBe(false);
    expect(store.status("email").connected).toBe(false);
  });

  it("reports availability so the UI can warn before asking for a password", () => {
    expect(createCredentialStore(dir, fakeSafeStorage(false)).isAvailable()).toBe(false);
    expect(createCredentialStore(dir, fakeSafeStorage(true)).isAvailable()).toBe(true);
  });

  it("declines to reveal a stored secret if encryption becomes unavailable", () => {
    const safe = fakeSafeStorage(true);
    const store = createCredentialStore(dir, safe);
    store.set("email", "pw");

    safe.available = false;
    expect(store.reveal("email")).toBeNull();
  });
});

describe("disconnecting", () => {
  it("fully clears the stored credential", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "app-specific-password");
    expect(existsSync(vaultPath(dir))).toBe(true);

    expect(store.clear("email")).toEqual({ ok: true, removed: true });

    expect(store.status("email")).toEqual({ connected: false, savedAt: null });
    expect(store.reveal("email")).toBeNull();
    // The file itself is gone, not merely emptied.
    expect(existsSync(vaultPath(dir))).toBe(false);
  });

  it("leaves no trace of the secret on disk afterwards", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "traceable-secret");
    store.clear("email");
    // Nothing left to read at all.
    expect(existsSync(vaultPath(dir))).toBe(false);
  });

  it("is idempotent", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    expect(store.clear("email")).toEqual({ ok: true, removed: false });
    store.set("email", "pw");
    expect(store.clear("email")).toEqual({ ok: true, removed: true });
    expect(store.clear("email")).toEqual({ ok: true, removed: false });
  });

  it("clears only the named account", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "one");
    store.set("other", "two");
    store.clear("email");
    expect(store.status("email").connected).toBe(false);
    expect(store.reveal("other")).toBe("two");
  });
});

describe("input guards", () => {
  it("rejects an empty secret rather than storing a blank credential", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    expect(store.set("email", "")).toEqual({ ok: false, reason: "empty-secret" });
    expect(store.set("", "pw")).toEqual({ ok: false, reason: "invalid-account" });
  });

  it("treats a corrupt vault file as no credential rather than crashing", () => {
    const store = createCredentialStore(dir, fakeSafeStorage());
    store.set("email", "pw");
    require_("node:fs").writeFileSync(vaultPath(dir), "{ not json", "utf8");
    expect(store.status("email").connected).toBe(false);
    expect(store.reveal("email")).toBeNull();
  });
});
