import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_RULES,
  classifyTransaction,
  classifyTransactions,
  detectProvider,
  PROVIDER_RULES,
} from "../statementClassify";
import type { Category } from "../types";
import type { NormalizedBankTransaction } from "../statementTypes";

const CATEGORIES: Category[] = [
  { id: "c-rent", name: "Rent", icon: "🏠", color: "#ef4444", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-transport", name: "Transport", icon: "🚌", color: "#eab308", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-utilities", name: "Utilities", icon: "💡", color: "#22c55e", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-entertainment", name: "Entertainment", icon: "🎬", color: "#8b5cf6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-health", name: "Health", icon: "🏥", color: "#14b8a6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-salary", name: "Salary", icon: "💰", color: "#0ea5e9", kind: "income", createdAt: "2026-01-01T00:00:00.000Z" },
];

function tx(overrides: Partial<NormalizedBankTransaction> = {}): NormalizedBankTransaction {
  return {
    id: "t1",
    transactionDate: "2026-08-12",
    description: "",
    currency: "NGN",
    sourceBank: "gtco",
    type: "unknown",
    direction: "out",
    confidence: "none",
    status: "draft",
    categoryId: null,
    row: 2,
    ...overrides,
  };
}

function classify(description: string, overrides: Partial<NormalizedBankTransaction> = {}) {
  return classifyTransaction(tx({ description, ...overrides }), CATEGORIES);
}

describe("classifyTransaction — fees, taxes and charges", () => {
  it("classifies Stamp Duty as a tax with high confidence", () => {
    const result = classify("Stamp Duty");
    expect(result.type).toBe("tax");
    expect(result.confidence).toBe("high");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.status).toBe("classified");
  });

  it("classifies VAT on Transfer Fee as a tax", () => {
    const result = classify("VAT on Transfer Fee");
    expect(result.type).toBe("tax");
    expect(result.confidence).toBe("high");
    expect(result.classificationReason).toBe("tax");
  });

  it("classifies VAT CHARGES as a tax", () => {
    expect(classify("VAT CHARGES").type).toBe("tax");
  });

  it("classifies a commission on NIP transfer as a bank fee", () => {
    const result = classify("Commission on NIP Transfer CHARGES");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
    expect(result.classificationReason).toBe("bank-fee");
  });

  it("classifies USSD Charge as a bank fee", () => {
    expect(classify("USSD Charge").type).toBe("bank-fee");
  });

  it("classifies SMS ALERT CHARGE as a bank fee", () => {
    const result = classify("SMS ALERT CHARGE");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
  });

  it("classifies FT_Out Fee narrations as a bank fee — a real recurring charge shape", () => {
    const result = classify("FT_Out Fee:DAVID OSAHON OGBEIDE_OPAY NIGERIA_Amount Transfer");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
    expect(result.classificationReason).toBe("bank-fee");
  });

  it("classifies Service Charge narrations as a bank fee", () => {
    expect(classify("SERVICE CHARGE").type).toBe("bank-fee");
  });
});

describe("classifyTransaction — interest, savings, loans, refunds", () => {
  it("classifies OWealth Interest Earned as interest", () => {
    const result = classify("OWealth Interest Earned", { direction: "in" });
    expect(result.type).toBe("interest");
    expect(result.confidence).toBe("high");
    expect(result.needsReview).toBe(true);
  });

  it("classifies INTEREST CAPITALISED as interest", () => {
    expect(classify("INTEREST CAPITALISED", { direction: "in" }).type).toBe("interest");
  });

  it("classifies Auto-save to OWealth Balance as savings", () => {
    const result = classify("Auto-save to OWealth Balance");
    expect(result.type).toBe("savings");
    expect(result.confidence).toBe("high");
  });

  it("classifies an OWealth withdrawal as an internal transfer", () => {
    const result = classify("OWealth Withdrawal (Transaction Payment)");
    expect(result.type).toBe("internal-transfer");
    expect(result.confidence).toBe("medium");
  });

  it("classifies OWealth Deposit (Transaction Refund) as a refund, not an internal transfer", () => {
    const result = classify("OWealth Deposit (Transaction Refund)", { direction: "in" });
    expect(result.type).toBe("refund");
    expect(result.confidence).toBe("high");
  });

  it("classifies EaseMoni loan repayment as a loan payment", () => {
    const result = classify("EaseMoni loan repayment");
    expect(result.type).toBe("loan-payment");
    expect(result.confidence).toBe("high");
  });

  it("classifies a bare loan repayment as a loan payment", () => {
    expect(classify("loan repayment").type).toBe("loan-payment");
  });
});

describe("classifyTransaction — transfers stay transfers", () => {
  it("keeps Transfer to a person as a transfer, never an expense category", () => {
    const result = classify("Transfer to DAVID OSAHON OGBEIDE | PalmPay");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("medium");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it("keeps a bare transfer as a transfer with low confidence", () => {
    const result = classify("Transfer to JOHN DOE");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("low");
  });

  it("classifies a NIP transfer to a wallet as a transfer and detects the provider", () => {
    const result = classify("NIP TRANSFER TO PALMPAY");
    expect(result.type).toBe("transfer");
    expect(result.provider).toBe("PalmPay");
    expect(result.merchant).toBe("PALMPAY");
  });

  it("preserves the parser-provided merchant and provider", () => {
    const result = classify("Transfer to CHINEDU EZ... | OPay", {
      merchant: "CHINEDU EZ...",
      provider: "OPay",
    });
    expect(result.type).toBe("transfer");
    expect(result.merchant).toBe("CHINEDU EZ...");
    expect(result.provider).toBe("OPay");
  });

  it("never rewrites the statement direction", () => {
    const result = classify("Transfer from JOHN DOE | OPay", { direction: "in" });
    expect(result.type).toBe("transfer");
    expect(result.direction).toBe("in");
  });
});

describe("classifyTransaction — merchant payments", () => {
  it("classifies a third-party merchant order as an expense with the provider", () => {
    const result = classify("Third-Party Merchant Order | Kora Payments Network Limited");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("medium");
    expect(result.provider).toBe("Kora");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it("treats a transfer through a payment gateway as a merchant payment", () => {
    const result = classify("Transfer to PAYSTACK CHECKOUT | PAYSTACK-TITAN");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("medium");
    expect(result.provider).toBe("Paystack");
    expect(result.merchant).toBe("PAYSTACK CHECKOUT");
  });
});

describe("classifyTransaction — expense patterns and categories", () => {
  it("maps Mobile Data | MTN to Utilities with high confidence", () => {
    const result = classify("Mobile Data | MTN | 3.2GB 2 Days Plan");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("high");
    expect(result.categoryId).toBe("c-utilities");
    expect(result.provider).toBe("MTN");
    expect(result.needsReview).toBe(false);
  });

  it("maps Airtel airtime to Utilities and detects Airtel", () => {
    const result = classify("Airtime Purchase Airtel");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-utilities");
    expect(result.provider).toBe("Airtel");
  });

  it("maps a rent payment to the Rent category", () => {
    const result = classify("RENT PAYMENT");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("high");
    expect(result.categoryId).toBe("c-rent");
    expect(result.needsReview).toBe(false);
  });

  it("maps a netflix subscription to Entertainment", () => {
    const result = classify("NETFLIX SUBSCRIPTION");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-entertainment");
  });

  it("keeps the category null when no existing category matches the hint", () => {
    const result = classify("SHOPPING MALL VOUCHER");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("medium");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it("falls back to the existing keyword suggestion system for expenses", () => {
    const result = classify("GYM MEMBERSHIP");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("medium");
    expect(result.categoryId).toBe("c-health");
    expect(result.classificationReason).toBe("keyword-suggestion");
  });

  it("never guesses expense categories from keyword suggestions on credits", () => {
    const result = classify("GROCERIES DELIVERY", { direction: "in" });
    expect(result.type).toBe("unknown");
    expect(result.confidence).toBe("none");
    expect(result.needsReview).toBe(true);
    expect(result.status).toBe("draft");
  });
});

describe("classifyTransaction — income and unknowns", () => {
  it("maps Salary to the Salary income category", () => {
    const result = classify("SALARY", { direction: "in" });
    expect(result.type).toBe("income");
    expect(result.confidence).toBe("high");
    expect(result.categoryId).toBe("c-salary");
    expect(result.needsReview).toBe(false);
  });

  it("leaves an empty description unknown and flagged for review", () => {
    const result = classify("");
    expect(result.type).toBe("unknown");
    expect(result.confidence).toBe("none");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.status).toBe("draft");
  });

  it("leaves an unrecognized narration unknown", () => {
    const result = classify("QWE786JSALARYXQWERTY");
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
  });

  it("keeps original description, amounts and row untouched", () => {
    const original = tx({
      description: "SMS ALERT CHARGE",
      debitAmount: 400,
      creditAmount: undefined,
      balanceAfter: 749_933,
      row: 5,
    });
    const result = classifyTransaction(original, CATEGORIES);
    expect(result.description).toBe("SMS ALERT CHARGE");
    expect(result.originalDescription).toBeUndefined();
    expect(result.debitAmount).toBe(400);
    expect(result.balanceAfter).toBe(749_933);
    expect(result.row).toBe(5);
    expect(result.id).toBe("t1");
  });
});

describe("6B — real GTCO statement patterns", () => {
  it("keeps NIBSS Instant Payment Outward a low-confidence transfer", () => {
    const result = classify("NIBSS Instant Payment Outward");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("low");
    expect(result.categoryId).toBeNull();
  });

  it("keeps NIP TRANSFER a low-confidence transfer", () => {
    const result = classify("NIP TRANSFER");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("low");
  });

  it("classifies Commission on NIP Transfer CHARGES as a bank fee", () => {
    const result = classify("Commission on NIP Transfer CHARGES");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
  });

  it("classifies VAT CHARGES as a tax", () => {
    const result = classify("VAT CHARGES");
    expect(result.type).toBe("tax");
    expect(result.confidence).toBe("high");
  });

  it("classifies SMS ALERT CHARGE as a bank fee", () => {
    const result = classify("SMS ALERT CHARGE");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
  });

  it("classifies VATrecover Partial Charges as a tax, not a bank fee", () => {
    const result = classify("VATrecover Partial Charges");
    expect(result.type).toBe("tax");
    expect(result.confidence).toBe("high");
    expect(result.classificationReason).toBe("tax");
  });

  it("classifies INTEREST CAPITALISED as interest", () => {
    const result = classify("INTEREST CAPITALISED");
    expect(result.type).toBe("interest");
    expect(result.confidence).toBe("high");
  });
});

describe("6B — real OPay statement patterns", () => {
  it("classifies Mobile Data as a Utilities expense", () => {
    const result = classify("Mobile Data");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("high");
    expect(result.categoryId).toBe("c-utilities");
    expect(result.needsReview).toBe(false);
  });

  it("classifies MTN as Utilities and detects the provider", () => {
    const result = classify("MTN");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-utilities");
    expect(result.provider).toBe("MTN");
  });

  it("classifies Airtel as Utilities", () => {
    const result = classify("Airtel");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-utilities");
  });

  it("classifies OWealth Withdrawal as an internal transfer", () => {
    const result = classify("OWealth Withdrawal");
    expect(result.type).toBe("internal-transfer");
    expect(result.confidence).toBe("medium");
  });

  it("classifies OWN ACCOUNT TRANSFER as an internal transfer", () => {
    const result = classify("OWN ACCOUNT TRANSFER");
    expect(result.type).toBe("internal-transfer");
    expect(result.confidence).toBe("medium");
  });

  it("classifies TRANSFER TO MY OWN ACCOUNT as an internal transfer (own-account beats generic transfer)", () => {
    expect(classify("TRANSFER TO MY OWN ACCOUNT").type).toBe("internal-transfer");
  });

  it("classifies OWealth Interest Earned as interest, not a transfer", () => {
    const result = classify("OWealth Interest Earned");
    expect(result.type).toBe("interest");
    expect(result.confidence).toBe("high");
  });

  it("classifies Auto-save to OWealth Balance as savings", () => {
    const result = classify("Auto-save to OWealth Balance");
    expect(result.type).toBe("savings");
    expect(result.confidence).toBe("high");
  });

  it("classifies OWealth Deposit (Transaction Refund) as a refund", () => {
    const result = classify("OWealth Deposit (Transaction Refund)");
    expect(result.type).toBe("refund");
    expect(result.confidence).toBe("high");
  });

  it("classifies USSD Charge as a bank fee", () => {
    const result = classify("USSD Charge");
    expect(result.type).toBe("bank-fee");
    expect(result.confidence).toBe("high");
  });

  it("classifies loan repayment as a loan payment", () => {
    const result = classify("loan repayment");
    expect(result.type).toBe("loan-payment");
    expect(result.confidence).toBe("high");
  });

  it("keeps Paystack Checkout an expense that needs review (no category)", () => {
    const result = classify("Paystack Checkout");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("medium");
    expect(result.categoryId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it("keeps a structured merchant transfer medium confidence", () => {
    const result = classify("Transfer to DAVID OSAHON OGBEIDE | PalmPay");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("medium");
    expect(result.provider).toBe("PalmPay");
  });

  it("downgrades a generic Transfer to JOHN DOE to low confidence", () => {
    const result = classify("Transfer to JOHN DOE");
    expect(result.type).toBe("transfer");
    expect(result.confidence).toBe("low");
    expect(result.needsReview).toBe(true);
  });
});

describe("6B — type and category stay separate", () => {
  it("sets an expense type and a category for Utilities purchases", () => {
    const result = classify("Mobile Data | MTN | 3.2GB 2 Days Plan");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-utilities");
  });

  it("keeps transfers typed transfer with no category", () => {
    const result = classify("Transfer to JOHN DOE");
    expect(result.type).toBe("transfer");
    expect(result.categoryId).toBeNull();
  });

  it("keeps bank charges typed bank-fee with no category", () => {
    const result = classify("SMS ALERT CHARGE");
    expect(result.type).toBe("bank-fee");
    expect(result.categoryId).toBeNull();
  });
});

describe("6B — never overclassify with substring keywords", () => {
  it("keeps BUSINESS out of Transport", () => {
    const result = classify("BUSINESS");
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
  });

  it("keeps BUSINESS SERVICES unknown", () => {
    const result = classify("BUSINESS SERVICES");
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
  });

  it("keeps FOODSTUFF GLOBAL unknown instead of guessing Food", () => {
    const result = classify("FOODSTUFF GLOBAL");
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
  });

  it("still accepts word-boundary keyword suggestions (GYM MEMBERSHIP)", () => {
    const result = classify("GYM MEMBERSHIP");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-health");
  });

  it("still accepts mid-text word-boundary keywords (ONLINE DELIVERY)", () => {
    const result = classify("ONLINE DELIVERY");
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-groceries");
    expect(result.needsReview).toBe(false);
  });
});

describe("detectProvider", () => {
  it("detects providers from narrations", () => {
    expect(detectProvider("NIP TRANSFER TO PALMPAY")).toBe("PalmPay");
    expect(detectProvider("Transfer to CHINEDU EZ... | OPay")).toBe("OPay");
    expect(detectProvider("Mobile Data | MTN | 3.2GB")).toBe("MTN");
    expect(detectProvider("Transfer to PAYSTACK CHECKOUT | PAYSTACK-TITAN")).toBe("Paystack");
    expect(detectProvider("Third-Party Merchant Order | Kora Payments Network Limited")).toBe("Kora");
    expect(detectProvider("Transfer to ACCESS BANK ACCOUNT")).toBe("Access Bank");
    expect(detectProvider("Transfer to WEMA BANK")).toBe("Wema Bank");
  });

  it("returns undefined when no provider matches", () => {
    expect(detectProvider("RENT PAYMENT")).toBeUndefined();
    expect(detectProvider("")).toBeUndefined();
  });
});

describe("extensibility", () => {
  it("exposes the rule tables as data", () => {
    expect(CLASSIFICATION_RULES.length).toBeGreaterThan(0);
    expect(PROVIDER_RULES.length).toBeGreaterThan(0);
    expect(new Set(CLASSIFICATION_RULES.map((rule) => rule.id)).size).toBe(
      CLASSIFICATION_RULES.length,
    );
  });
});

describe("classifyTransactions", () => {
  it("classifies a batch without mutating the input", () => {
    const input = [
      tx({ id: "a", description: "SMS ALERT CHARGE" }),
      tx({ id: "b", description: "Transfer to JOHN DOE" }),
      tx({ id: "c", description: "" }),
    ];
    const result = classifyTransactions(input, CATEGORIES);
    expect(result.map((entry) => entry.type)).toEqual(["bank-fee", "transfer", "unknown"]);
    expect(input.map((entry) => entry.type)).toEqual(["unknown", "unknown", "unknown"]);
    expect(input.map((entry) => entry.status)).toEqual(["draft", "draft", "draft"]);
  });
});