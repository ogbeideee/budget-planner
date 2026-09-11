import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  GMAIL_IMAP,
  DEFAULT_LOOKBACK_DAYS,
  LOOKBACK_DAYS_CHOICES,
  normalizeEmailAccountConfig,
  emailIdentity,
} = require_("./imapConfig.cjs");

describe("Gmail configuration defaults", () => {
  it("forces Google's IMAP endpoint regardless of what is supplied", () => {
    // The host/port/security fields are FORCED: a tampered payload cannot
    // point a Gmail connection at an impostor server.
    const result = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
      host: "evil.example",
      port: 1337,
      security: "none",
      initialLookbackDays: 30,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.host).toBe(GMAIL_IMAP.host);
    expect(result.config.port).toBe(GMAIL_IMAP.port);
    expect(result.config.security).toBe(GMAIL_IMAP.security);
  });

  it("accepts a Gmail config with no server fields at all", () => {
    const result = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      host: "imap.gmail.com",
      port: 993,
      security: "tls",
      initialLookbackDays: DEFAULT_LOOKBACK_DAYS,
    });
  });
});

describe("generic IMAP configuration", () => {
  it("keeps the caller's host, port and security", () => {
    const result = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
      host: "imap.example.com",
      port: 143,
      security: "starttls",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      host: "imap.example.com",
      port: 143,
      security: "starttls",
    });
  });

  it("defaults the port from the security mode and security to TLS", () => {
    const tls = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
      host: "imap.example.com",
    });
    if (!tls.ok) throw new Error("expected ok");
    expect(tls.config.port).toBe(993);
    expect(tls.config.security).toBe("tls");

    const plain = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
      host: "imap.example.com",
      security: "none",
    });
    if (!plain.ok) throw new Error("expected ok");
    expect(plain.config.port).toBe(143);
  });
});

describe("invalid configurations", () => {
  it("rejects a bad email, bad provider and bad lookback with field errors", () => {
    const result = normalizeEmailAccountConfig({
      provider: "exchange",
      email: "not-an-email",
      initialLookbackDays: 365,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["email", "initialLookbackDays", "provider"].sort(),
    );
  });

  it("rejects a generic config with a missing or malformed host", () => {
    const result = normalizeEmailAccountConfig({
      provider: "generic",
      email: "user@example.com",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.host).toBeTruthy();
  });

  it("rejects a lookback outside the supported choices", () => {
    expect(LOOKBACK_DAYS_CHOICES).toEqual([7, 30, 90]);
    const result = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
      initialLookbackDays: 14,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.initialLookbackDays).toBeTruthy();
  });

  it("treats a non-object payload as invalid, not a crash", () => {
    expect(normalizeEmailAccountConfig(null).ok).toBe(false);
    expect(normalizeEmailAccountConfig("config").ok).toBe(false);
    expect(normalizeEmailAccountConfig([1, 2]).ok).toBe(false);
  });
});

describe("identity", () => {
  it("carries safe identity data only", () => {
    const result = normalizeEmailAccountConfig({
      provider: "gmail",
      email: "user@gmail.com",
    });
    if (!result.ok) throw new Error("expected ok");
    expect(emailIdentity(result.config)).toEqual({
      provider: "gmail",
      email: "user@gmail.com",
      host: "imap.gmail.com",
      port: 993,
      security: "tls",
    });
  });
});
