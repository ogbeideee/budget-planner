import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  DEFAULT_LOOKBACK_DAYS,
  EMAIL_ACCOUNT_STORAGE_KEY,
  GMAIL_DEFAULTS,
  LOOKBACK_DAYS_CHOICES,
  clearEmailAccountConfig,
  loadEmailAccountConfig,
  normalizeEmailAccountConfig,
  saveEmailAccountConfig,
} from "@/lib/emailAccount";

const require_ = createRequire(import.meta.url);
const cjs = require_("../../electron/imapConfig.cjs");

describe("renderer-side normalization", () => {
  it("matches the CJS module's Gmail defaults", () => {
    expect(GMAIL_DEFAULTS).toEqual({ host: "imap.gmail.com", port: 993, security: "tls" });
    expect(DEFAULT_LOOKBACK_DAYS).toBe(30);
    expect(LOOKBACK_DAYS_CHOICES).toEqual([7, 30, 90]);
  });

  it("forces Gmail's endpoint and accepts a bare Gmail config", () => {
    const result = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
      host: "evil.example",
      port: 1337,
      security: "none",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.host).toBe("imap.gmail.com");
    expect(result.config.port).toBe(993);
    expect(result.config.security).toBe("tls");
    expect(result.config.initialLookbackDays).toBe(30);
  });

  it("requires a host for generic IMAP and defaults port/security sensibly", () => {
    const missing = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.host).toBeTruthy();

    const full = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
      host: "imap.example.com",
      security: "none",
    });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(full.config.port).toBe(143);
  });

  it("rejects invalid emails, providers and lookbacks", () => {
    const result = normalizeEmailAccountConfig({
      provider: "yahoo!",
      email: "nope",
      initialLookbackDays: 365,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["email", "initialLookbackDays", "provider"].sort(),
    );
  });
});

/** The two implementations of the SAME rules must agree on every input, or
 *  main would defend against a config the UI believes is valid (or
 *  vice versa). This parity test is what lets the rules live in two runtimes
 *  without silently drifting. */
describe("renderer/main parity", () => {
  const CORPUS: ReadonlyArray<unknown> = [
    null,
    "config",
    {},
    { provider: "gmail", email: "user@gmail.com" },
    { provider: "gmail", email: "user@gmail.com", host: "evil.example", port: 1337, security: "none" },
    { provider: "gmail", email: "USER@Gmail.COM", initialLookbackDays: 90 },
    { provider: "generic", email: "user@example.com" },
    { provider: "generic", email: "user@example.com", host: "imap.example.com", port: "143", security: "starttls" },
    { provider: "generic", email: "user@example.com", host: "bad host!", security: "nonsense" },
    { provider: "exchange", email: "not-an-email", initialLookbackDays: 14 },
    { provider: "gmail", email: "user@gmail.com", initialLookbackDays: 7, initialSyncDone: true, lastSyncAt: "2026-09-01T00:00:00.000Z" },
  ];

  it("agrees with electron/imapConfig.cjs on the whole corpus", () => {
    for (const input of CORPUS) {
      const ts = normalizeEmailAccountConfig(input);
      const main = cjs.normalizeEmailAccountConfig(input);
      expect(JSON.stringify(ts)).toBe(JSON.stringify(main));
    }
  });
});

describe("persistence through the storage seam", () => {
  it("round-trips a config under its own key, never in AppState", () => {
    const config = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
      initialLookbackDays: 7,
    });
    if (!config.ok) throw new Error("expected ok");

    saveEmailAccountConfig(config.config);
    expect(loadEmailAccountConfig()).toEqual(config.config);

    const raw = window.localStorage.getItem(EMAIL_ACCOUNT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}");
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "provider",
        "email",
        "host",
        "port",
        "security",
        "initialLookbackDays",
        "initialSyncDone",
        "lastSyncAt",
      ].sort(),
    );

    clearEmailAccountConfig();
    expect(loadEmailAccountConfig()).toBeNull();
  });

  it("returns null for a corrupt or invalid persisted record", () => {
    window.localStorage.setItem(EMAIL_ACCOUNT_STORAGE_KEY, "{not json");
    expect(loadEmailAccountConfig()).toBeNull();
    window.localStorage.setItem(
      EMAIL_ACCOUNT_STORAGE_KEY,
      JSON.stringify({ provider: "attacker", email: "x@y.z" }),
    );
    expect(loadEmailAccountConfig()).toBeNull();
    window.localStorage.removeItem(EMAIL_ACCOUNT_STORAGE_KEY);
  });

  it("the persisted record has NO password field, ever", () => {
    const config = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
    });
    if (!config.ok) throw new Error("expected ok");
    saveEmailAccountConfig(config.config);
    expect(
      JSON.stringify(window.localStorage.getItem(EMAIL_ACCOUNT_STORAGE_KEY)),
    ).not.toMatch(/password|secret/i);
  });
});
