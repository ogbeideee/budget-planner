import { describe, expect, it } from "vitest";
import {
  ALERT_SENDERS,
  ALERT_TEMPLATES,
  cleanNarration,
  parseAlert,
  parseAlertAmount,
  parseMoneyToken,
  senderFor,
  type AlertEmail,
} from "../emailAlerts";

/**
 * Fixtures for the three institutions with REAL sample data.
 *
 * IMPORTANT — provenance of these fixtures:
 * The six verbatim sample emails did not reach this session (the prompt's
 * paste placeholder came through literally). Every value asserted below is
 * taken from the ground truth STATED in the requirements — the exact amount
 * strings, the direction wording, the negative balance, the truncated
 * description, the underscore composite narration and the sending domain.
 * The surrounding body scaffolding is reconstructed around those facts.
 *
 * So: the FIELD FORMATS are real and these tests pin them. The exact line
 * layout is not, and must be re-checked when the raw samples are available.
 * See docs/15_EMAIL_PARSING.md § Template confidence.
 */

const GTBANK_DEBIT: AlertEmail = {
  id: "gt-debit",
  from: "GeNS@gtbank.com",
  // Generic for BOTH directions — requirement 4.
  subject: "Transaction Notification",
  body: [
    "Dear Customer,",
    "",
    "This is to inform you that a DEBIT transaction occurred on your account.",
    "",
    "Amount : NGN 3.51",
    "Description : TRF FROM DAVID OSA",
    "Available Balance : NGN -28.48",
    "Date : 12-Aug-2026",
  ].join("\n"),
};

const GTBANK_CREDIT: AlertEmail = {
  id: "gt-credit",
  from: "GeNS@gtbank.com",
  subject: "Transaction Notification",
  body: [
    "Dear Customer,",
    "",
    "This is to inform you that a CREDIT transaction occurred on your account.",
    "",
    // Same institution, no decimals — requirement 2.
    "Amount : NGN 26388",
    "Description : SALARY PAYMENT AUGUST",
    "Available Balance : NGN 26359.52",
    "Date : 12-Aug-2026",
  ].join("\n"),
};

const WEMA_DEBIT: AlertEmail = {
  id: "wema-debit",
  from: "alerts@wemabank.com",
  subject: "Transaction Alert",
  body: [
    "Dear Customer,",
    "Your account has been debited.",
    // Currency code SUFFIX — requirement 2.
    "Amount: 3,000.00 NGN",
    "Narration: POS PURCHASE SHOPRITE LEKKI",
    "Date: 12-Aug-2026",
    "Balance: 45,000.00 NGN",
  ].join("\n"),
};

const WEMA_CREDIT: AlertEmail = {
  id: "wema-credit",
  from: "alerts@wemabank.com",
  subject: "Transaction Alert",
  body: [
    "Dear Customer,",
    "Your account has been credited.",
    "Amount: 150,000.00 NGN",
    "Narration: TRANSFER FROM ACME LIMITED",
    "Date: 01-Sep-2026",
    "Balance: 195,000.00 NGN",
  ].join("\n"),
};

const QUICK_DEBIT: AlertEmail = {
  id: "quick-debit",
  // The brand is "Quick Microfinance Bank"; the domain is quickmart.com.
  from: "no-reply@quickmart.com",
  subject: "Transaction Alert",
  body: [
    "Dear Customer,",
    "Your account has been debited.",
    // Symbol prefix with comma groups — requirement 2.
    "Amount: ₦250,000.23",
    // Underscore composite narration — requirement 5.
    "Narration: FT_Out Fee:ADEBAYO OLUWASEUN_08031234567_BESTAF TECHNOLOGIES_TRANSFER",
    "Date: 12-Aug-2026",
  ].join("\n"),
};

const QUICK_CREDIT: AlertEmail = {
  id: "quick-credit",
  from: "no-reply@quickmart.com",
  subject: "Transaction Alert",
  body: [
    "Dear Customer,",
    "Your account has been credited.",
    "Amount: ₦450,000.00",
    // Clean prose from the SAME sender — requirement 5.
    "Narration: July 2026 Bestaf Tech Staff Salary",
    "Date: 31-Jul-2026",
  ].join("\n"),
};

export const REAL_SAMPLES = [
  GTBANK_DEBIT, GTBANK_CREDIT, WEMA_DEBIT, WEMA_CREDIT, QUICK_DEBIT, QUICK_CREDIT,
];

/* ------------------------------------------------------------------------ */

describe("the shared money parser (requirement 2)", () => {
  it("handles a currency-code PREFIX with decimals (GTBank)", () => {
    expect(parseMoneyToken("NGN 3.51")).toEqual({ minor: 351, negative: false });
  });

  it("handles a currency-code prefix with NO decimals (GTBank, same sender)", () => {
    expect(parseMoneyToken("NGN 26388")).toEqual({ minor: 2638800, negative: false });
  });

  it("handles a currency-code SUFFIX with comma groups (WEMA)", () => {
    expect(parseMoneyToken("3,000.00 NGN")).toEqual({ minor: 300000, negative: false });
  });

  it("handles a currency-SYMBOL prefix with comma groups (Quick Microfinance)", () => {
    expect(parseMoneyToken("₦250,000.23")).toEqual({ minor: 25000023, negative: false });
  });

  it("reports a negative separately rather than folding it into the value", () => {
    expect(parseMoneyToken("NGN -28.48")).toEqual({ minor: 2848, negative: true });
  });

  it("absorbs a plausible fourth institution in a similar shape", () => {
    // No currency marker at all, and a symbol suffix — neither seen yet.
    expect(parseMoneyToken("1,234.50")).toEqual({ minor: 123450, negative: false });
    expect(parseMoneyToken("99.99 USD")).toEqual({ minor: 9999, negative: false });
    expect(parseMoneyToken("£12,000")).toEqual({ minor: 1200000, negative: false });
  });

  it("returns null rather than guessing", () => {
    expect(parseMoneyToken("NGN ****")).toBeNull();
    expect(parseMoneyToken("")).toBeNull();
    expect(parseMoneyToken("abc")).toBeNull();
  });
});

describe("negative balances are never transaction amounts (requirement 3)", () => {
  it("rejects a negative token as an amount outright", () => {
    expect(parseAlertAmount("NGN -28.48")).toBeNull();
  });

  it("does not read the balance line as the amount", () => {
    const result = parseAlert(GTBANK_DEBIT);
    if (result.status !== "parsed") throw new Error(`expected parsed, got ${result.status}`);
    // 3.51 is the transaction; -28.48 is the balance sitting right beside it.
    expect(result.amount).toBe(351);
  });

  it("ignores a POSITIVE balance line too — it is still not the amount", () => {
    const result = parseAlert(GTBANK_CREDIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    expect(result.amount).toBe(2638800);
  });
});

describe("GTBank (requirements 1, 4, 6)", () => {
  it("recognises a real alert at all", () => {
    // The pre-correction template matched none of its markers and discarded
    // every GTBank message as "not-a-transaction-alert".
    expect(parseAlert(GTBANK_DEBIT).status).toBe("parsed");
  });

  it("takes direction from the BODY, not the generic subject", () => {
    expect(GTBANK_DEBIT.subject).toBe(GTBANK_CREDIT.subject);
    const debit = parseAlert(GTBANK_DEBIT);
    const credit = parseAlert(GTBANK_CREDIT);
    if (debit.status !== "parsed" || credit.status !== "parsed") throw new Error("expected parsed");
    expect(debit.direction).toBe("out");
    expect(credit.direction).toBe("in");
  });

  it("accepts a mid-word truncated description without crashing or garbling", () => {
    const result = parseAlert(GTBANK_DEBIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    // Kept verbatim: imperfect, but valid and usable downstream.
    expect(result.description).toBe("TRF FROM DAVID OSA");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("parses both amount shapes the same sender uses", () => {
    const debit = parseAlert(GTBANK_DEBIT);
    const credit = parseAlert(GTBANK_CREDIT);
    if (debit.status !== "parsed" || credit.status !== "parsed") throw new Error("expected parsed");
    expect(debit.amount).toBe(351);
    expect(credit.amount).toBe(2638800);
  });
});

describe("WEMA (requirements 1, 2)", () => {
  it("parses the currency-code suffix format in both directions", () => {
    const debit = parseAlert(WEMA_DEBIT);
    const credit = parseAlert(WEMA_CREDIT);
    if (debit.status !== "parsed" || credit.status !== "parsed") throw new Error("expected parsed");

    expect(debit).toMatchObject({
      institution: "wema", amount: 300000, direction: "out",
      description: "POS PURCHASE SHOPRITE LEKKI", date: "2026-08-12",
    });
    expect(credit).toMatchObject({
      institution: "wema", amount: 15000000, direction: "in",
      description: "TRANSFER FROM ACME LIMITED", date: "2026-09-01",
    });
  });

  it("does not take the suffixed BALANCE line as the amount", () => {
    const result = parseAlert(WEMA_DEBIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    expect(result.amount).not.toBe(4500000);
  });
});

describe("Quick Microfinance (requirements 1, 5, 7)", () => {
  it("is allowlisted by its VERIFIED domain, which its brand name does not contain", () => {
    const sender = senderFor("no-reply@quickmart.com");
    expect(sender?.institution).toBe("quickmfb");
    expect(sender?.label).toBe("Quick Microfinance Bank");
  });

  it("does NOT fall back to a brand-name match — that would be an allowlist bypass", () => {
    // A domain containing the brand is not thereby trusted.
    expect(senderFor("alerts@quickmicrofinance.example")).toBeNull();
    expect(senderFor("alerts@quick-mfb.example")).toBeNull();
    // And the real domain is still exact-host-or-subdomain only.
    expect(senderFor("no-reply@quickmart.com.attacker.example")).toBeNull();
    expect(senderFor("no-reply@notquickmart.com")).toBeNull();
    expect(senderFor("no-reply@mail.quickmart.com")?.institution).toBe("quickmfb");
  });

  it("parses the ₦ symbol-prefix amount", () => {
    const result = parseAlert(QUICK_DEBIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    expect(result.amount).toBe(25000023);
    expect(result.direction).toBe("out");
  });

  it("extracts the merchant segment from an underscore composite narration", () => {
    const result = parseAlert(QUICK_DEBIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    // NOT the whole "FT_Out Fee:NAME_PHONE_MERCHANT_TYPE" string.
    expect(result.description).not.toContain("_");
    expect(result.description).not.toContain("08031234567");
    expect(result.description).toBe("BESTAF TECHNOLOGIES");
  });

  it("leaves the clean credit narration from the SAME sender untouched", () => {
    const result = parseAlert(QUICK_CREDIT);
    if (result.status !== "parsed") throw new Error("expected parsed");
    expect(result.description).toBe("July 2026 Bestaf Tech Staff Salary");
    expect(result.direction).toBe("in");
  });
});

describe("cleanNarration in isolation", () => {
  it("returns human-readable prose unchanged", () => {
    expect(cleanNarration("July 2026 Bestaf Tech Staff Salary")).toBe(
      "July 2026 Bestaf Tech Staff Salary",
    );
    // Including a truncated one.
    expect(cleanNarration("TRF FROM DAVID OSA")).toBe("TRF FROM DAVID OSA");
  });

  it("drops phone numbers and transfer-type noise from a composite", () => {
    expect(
      cleanNarration("FT_Out Fee:ADEBAYO OLUWASEUN_08031234567_BESTAF TECHNOLOGIES_TRANSFER"),
    ).toBe("BESTAF TECHNOLOGIES");
  });

  it("never returns an empty string when given content", () => {
    expect(cleanNarration("FT_Out_123").length).toBeGreaterThan(0);
    expect(cleanNarration("_")).toBe("_");
  });

  it("is safe on empty input", () => {
    expect(cleanNarration("")).toBe("");
  });
});

describe("registry integrity after the correction", () => {
  it("covers all three institutions with real samples", () => {
    for (const institution of ["gtbank", "wema", "quickmfb"] as const) {
      expect(ALERT_SENDERS.some((s) => s.institution === institution)).toBe(true);
      expect(ALERT_TEMPLATES.some((t) => t.institution === institution)).toBe(true);
    }
  });

  it("parses every one of the six samples without falling to needs-review", () => {
    for (const sample of REAL_SAMPLES) {
      const result = parseAlert(sample);
      expect(result.status, `${sample.id} did not parse`).toBe("parsed");
    }
  });

  it("still refuses a lookalike of the corrected domains", () => {
    expect(senderFor("alerts@wemabank.com.evil.example")).toBeNull();
    expect(senderFor("GeNS@gtbank.com.evil.example")).toBeNull();
  });
});
