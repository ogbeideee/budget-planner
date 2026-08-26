// Deterministic transaction-type layer tests (Prompt 8F).
//
// `classifyTransactionType` is a pure, narration-only classifier — the same
// input always yields the same type, direction is never consulted (an
// incoming transfer is still "transfer", never income), and fee kinds are
// never treated as ordinary expenses.

import { describe, expect, it } from "vitest";

import { classifyTransactionType, TRANSACTION_TYPE_RULES } from "../transactionTypes";

function typeFor(description: string) {
  return classifyTransactionType(description);
}

describe("classifyTransactionType — every type has a deterministic trigger", () => {
  it("maps a representative narration to each type", () => {
    expect(typeFor("Refund of purchase")).toBe("refund");
    expect(typeFor("EaseMoni loan repayment")).toBe("loan-payment");
    expect(typeFor("Stamp Duty")).toBe("stamp-duty");
    expect(typeFor("VAT CHARGES")).toBe("vat");
    expect(typeFor("Commission on NIP Transfer CHARGES")).toBe("transfer-fee");
    expect(typeFor("SMS ALERT CHARGE")).toBe("sms-charge");
    expect(typeFor("OWealth Interest Earned")).toBe("interest");
    expect(typeFor("Auto-save to OWealth Balance")).toBe("savings");
    expect(typeFor("OWealth Withdrawal (Transaction Payment)")).toBe("internal-transfer");
    expect(typeFor("Airtime Purchase Airtel")).toBe("airtime");
    expect(typeFor("Mobile Data | MTN | 3.2GB 2 Days Plan")).toBe("mobile-data");
    expect(typeFor("POS Withdrawal")).toBe("card-payment");
    expect(typeFor("ATM Withdrawal")).toBe("withdrawal");
    expect(typeFor("Cash Deposit")).toBe("deposit");
    expect(typeFor("SALARY")).toBe("salary");
    expect(typeFor("USSD Charge")).toBe("bank-charge");
    expect(typeFor("Transfer to JOHN DOE | PalmPay")).toBe("transfer");
    expect(typeFor("BUSINESS SERVICES")).toBe("unknown");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(typeFor("  commission   on NIP transfer   charges ")).toBe("transfer-fee");
    expect(typeFor("stamp duty")).toBe("stamp-duty");
    expect(typeFor("Spend + Save")).toBe("savings");
  });

  it("is deterministic — the same narration always maps to the same type", () => {
    const narration = "OWealth Deposit (Transaction Refund)";
    const results = new Set(Array.from({ length: 20 }, () => typeFor(narration)));
    expect(results.size).toBe(1);
    expect([...results][0]).toBe("refund");
  });
});

describe("classifyTransactionType — specificity and ordering", () => {
  it("keeps VAT on Transfer Fee a VAT charge, not a transfer fee", () => {
    expect(typeFor("VAT on Transfer Fee")).toBe("vat");
  });

  it("treats a commission on a transfer as a transfer fee, not a plain bank charge", () => {
    expect(typeFor("Commission on NIP Transfer CHARGES")).toBe("transfer-fee");
  });

  it("never calls a card maintenance fee a card payment", () => {
    expect(typeFor("Card maintenance fee")).toBe("bank-charge");
  });

  it("never calls a POS withdrawal a withdrawal — it is a card payment", () => {
    expect(typeFor("POS Withdrawal")).toBe("card-payment");
  });

  it("calls an ATM withdrawal a withdrawal, not a card payment", () => {
    expect(typeFor("ATM Withdrawal")).toBe("withdrawal");
  });

  it("calls an OWealth movement an internal transfer before it reaches transfer", () => {
    expect(typeFor("Transfer to OWealth")).toBe("internal-transfer");
    expect(typeFor("OWealth Withdrawal (Transaction Payment)")).toBe("internal-transfer");
  });

  it("calls an OWealth deposit refund a refund before internal transfer", () => {
    expect(typeFor("OWealth Deposit (Transaction Refund)")).toBe("refund");
  });

  it("calls a Spend + Save movement savings before anything else", () => {
    expect(typeFor("Spend + Save (1 Pocket)")).toBe("savings");
  });

  it("calls a third-party merchant order a card payment (it is a payment)", () => {
    expect(typeFor("Third-Party Merchant Order | Kora Payments Network Limited")).toBe(
      "card-payment",
    );
  });
});

describe("classifyTransactionType — direction is never encoded", () => {
  it("returns the same type for money in and money out", () => {
    expect(typeFor("Transfer from JOHN DOE | OPay")).toBe("transfer");
    expect(typeFor("Transfer to JOHN DOE | OPay")).toBe("transfer");
    expect(typeFor("SALARY")).toBe("salary");
    expect(typeFor("INTEREST CAPITALISED")).toBe("interest");
  });
});

describe("classifyTransactionType — word boundaries", () => {
  it("never matches substrings inside longer tokens", () => {
    expect(typeFor("QWE786JSALARYXQWERTY")).toBe("unknown");
    expect(typeFor("FOODSTUFF GLOBAL")).toBe("unknown");
    expect(typeFor("BUSINESS")).toBe("unknown");
  });

  it("matches phrases as whole words only", () => {
    expect(typeFor("RENT PAYMENT")).toBe("unknown");
    expect(typeFor("NETFLIX SUBSCRIPTION")).toBe("unknown");
  });
});

describe("TRANSACTION_TYPE_RULES — the table is data", () => {
  it("is non-empty and has no duplicate types", () => {
    expect(TRANSACTION_TYPE_RULES.length).toBeGreaterThan(0);
    const types = TRANSACTION_TYPE_RULES.map((rule) => rule.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("covers the full taxonomy (no type is orphaned)", () => {
    const covered = new Set(TRANSACTION_TYPE_RULES.map((rule) => rule.type));
    for (const type of [
      "transfer",
      "card-payment",
      "bank-charge",
      "transfer-fee",
      "vat",
      "stamp-duty",
      "sms-charge",
      "airtime",
      "mobile-data",
      "interest",
      "refund",
      "savings",
      "withdrawal",
      "deposit",
      "internal-transfer",
      "loan-payment",
      "salary",
    ] as const) {
      expect(covered.has(type), `${type} should have a rule`).toBe(true);
    }
  });
});
