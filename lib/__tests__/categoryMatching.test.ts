import { describe, expect, it } from "vitest";

import { matchExpenseCategory, MERCHANT_CATEGORY_HINTS } from "../categoryMatching";
import { classifyTransaction } from "../statementClassify";
import type { Category } from "../types";
import type { LearnedRule } from "../types";
import type { NormalizedBankTransaction } from "../statementTypes";

const CATEGORIES: Category[] = [
  { id: "c-rent", name: "Rent", icon: "🏠", color: "#ef4444", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-transport", name: "Transport", icon: "🚌", color: "#eab308", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-utilities", name: "Utilities", icon: "💡", color: "#22c55e", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-entertainment", name: "Entertainment", icon: "🎬", color: "#8b5cf6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-health", name: "Health", icon: "🏥", color: "#14b8a6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-food", name: "Food", icon: "🍲", color: "#f97316", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
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

describe("matchExpenseCategory — known merchants (HIGH)", () => {
  it("matches Nigerian mobile-data providers regardless of packaging", () => {
    expect(matchExpenseCategory({ description: "MTN 3.2GB 2 Days Plan" }, CATEGORIES)).toEqual({
      categoryId: "c-utilities",
      confidence: "high",
      reason: "merchant:MTN",
    });
    expect(matchExpenseCategory({ description: "Airtel Recharge" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "9mobile Data Bundle" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "Glo NIGERIA" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
    });
  });

  it("uses the parser-extracted provider", () => {
    expect(matchExpenseCategory({ description: "Data Bundle Purchase", provider: "MTN" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
      reason: "merchant:MTN",
    });
  });

  it("matches subscriptions and ride-hailing merchants", () => {
    expect(matchExpenseCategory({ description: "Netflix Subscription" }, CATEGORIES)).toMatchObject({
      categoryId: "c-entertainment",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "Spotify Premium" }, CATEGORIES)).toMatchObject({
      categoryId: "c-entertainment",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "D.S.T.V SUBSCRIPTION" }, CATEGORIES)).toMatchObject({
      categoryId: "c-entertainment",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "Uber Trip - Lagos" }, CATEGORIES)).toMatchObject({
      categoryId: "c-transport",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "Bolt Ride" }, CATEGORIES)).toMatchObject({
      categoryId: "c-transport",
      confidence: "high",
    });
  });

  it("matches supermarkets, food delivery and fuel merchants", () => {
    expect(matchExpenseCategory({ description: "SHOPRITE PURCHASE" }, CATEGORIES)).toMatchObject({
      categoryId: "c-groceries",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "SPAR" }, CATEGORIES)).toMatchObject({
      categoryId: "c-groceries",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "CHOWDECK ORDER" }, CATEGORIES)).toMatchObject({
      categoryId: "c-food",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "TOTAL FILLING STATION" }, CATEGORIES)).toMatchObject({
      categoryId: "c-transport",
      confidence: "high",
    });
  });

  it("is case-, punctuation- and number-insensitive", () => {
    expect(matchExpenseCategory({ description: "mTn 3.2Gb 2 Days" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
    });
    expect(matchExpenseCategory({ description: "MTN 3.2GB, 2 Days Plan!" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "high",
    });
  });
});

describe("matchExpenseCategory — keywords (MEDIUM/HIGH/LOW)", () => {
  it("matches the category's own name with HIGH confidence", () => {
    expect(matchExpenseCategory({ description: "RENT PAYMENT" }, CATEGORIES)).toEqual({
      categoryId: "c-rent",
      confidence: "high",
      reason: "keyword:rent",
    });
  });

  it("matches a strong alias with MEDIUM confidence", () => {
    expect(matchExpenseCategory({ description: "ELECTRICITY BILL" }, CATEGORIES)).toMatchObject({
      categoryId: "c-utilities",
      confidence: "medium",
      reason: "keyword:electricity",
    });
    expect(matchExpenseCategory({ description: "SUPERMARKET RUN" }, CATEGORIES)).toMatchObject({
      categoryId: "c-groceries",
      confidence: "medium",
    });
  });

  it("labels short, weak aliases as LOW confidence", () => {
    expect(matchExpenseCategory({ description: "BUS FARE" }, CATEGORIES)).toMatchObject({
      categoryId: "c-transport",
      confidence: "low",
    });
    expect(matchExpenseCategory({ description: "FUEL" }, CATEGORIES)).toMatchObject({
      categoryId: "c-transport",
      confidence: "low",
    });
  });

  it("matches only whole words — never substrings of longer words", () => {
    expect(matchExpenseCategory({ description: "FOODSTUFF GLOBAL" }, CATEGORIES)).toMatchObject({
      categoryId: "c-groceries",
      confidence: "medium",
    });
    expect(matchExpenseCategory({ description: "QWE786JSALARYXQWERTY" }, CATEGORIES)).toBeNull();
  });
});

describe("matchExpenseCategory — expense eligibility (8F integration)", () => {
  it("never treats transfers to people, banks or wallets as merchants", () => {
    expect(matchExpenseCategory({ description: "Transfer to FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "NIP TRANSFER TO PALMPAY" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Transfer to JOHN DOE" }, CATEGORIES)).toBeNull();
  });

  it("never categorizes fees, taxes, refunds, interest, savings or internal transfers", () => {
    expect(matchExpenseCategory({ description: "Commission on NIP Transfer" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Stamp Duty" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Refund of previous charge" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Interest Earned" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Spend and Save" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "Owealth transfer" }, CATEGORIES)).toBeNull();
  });

  it("returns null for unknown merchants and no-category words", () => {
    expect(matchExpenseCategory({ description: "Payment to XYZ UNKNOWN MERCHANT" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "SHOPPING MALL VOUCHER" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "CASH DEPOSIT" }, CATEGORIES)).toBeNull();
    expect(matchExpenseCategory({ description: "" }, CATEGORIES)).toBeNull();
  });
});

describe("matchExpenseCategory — adaptive to existing category names", () => {
  it("resolves merchant hints against different category names (never hard-coded ids)", () => {
    const custom: Category[] = [
      { id: "c-bills", name: "Bills & Utilities", icon: "💡", color: "#22c55e", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "c-data", name: "Mobile Data", icon: "📶", color: "#0ea5e9", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(matchExpenseCategory({ description: "MTN Data" }, custom)).toMatchObject({
      categoryId: "c-bills",
      confidence: "high",
    });

    const dataOnly: Category[] = [
      { id: "c-data", name: "Mobile Data", icon: "📶", color: "#0ea5e9", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(matchExpenseCategory({ description: "MTN Data" }, dataOnly)).toMatchObject({
      categoryId: "c-data",
      confidence: "high",
    });
  });

  it("returns null when no hint resolves (no matching expense category exists)", () => {
    const onlyShopping: Category[] = [
      { id: "c-shopping", name: "Shopping", icon: "🛍️", color: "#8b5cf6", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(matchExpenseCategory({ description: "MTN Data" }, onlyShopping)).toBeNull();
  });

  it("falls back to Groceries when no Food category exists", () => {
    const noFood: Category[] = [
      { id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(matchExpenseCategory({ description: "CHOWDECK ORDER" }, noFood)).toMatchObject({
      categoryId: "c-groceries",
      confidence: "high",
    });
  });

  it("hints are merchant-keyed and cover the curated merchant set", () => {
    const canonicalNames = MERCHANT_CATEGORY_HINTS.map((entry) => entry.merchant);
    for (const expected of ["MTN", "Airtel", "DSTV", "Netflix", "Uber", "Bolt", "Shoprite", "Chowdeck", "Total", "MedPlus"]) {
      expect(canonicalNames).toContain(expected);
    }
  });
});

describe("classifyTransaction — Prompt 8G integration", () => {
  it("upgrades an unknown debit to expense when a known merchant matches (HIGH)", () => {
    const result = classifyTransaction(tx({ description: "SHOPRITE PURCHASE" }), CATEGORIES);
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-groceries");
    expect(result.categoryConfidence).toBe("high");
    expect(result.categoryReason).toBe("merchant:Shoprite");
    expect(result.confidence).toBe("high");
    expect(result.needsReview).toBe(false);
    expect(result.merchant).toBe("Shoprite");
  });

  it("records category evidence for rule-matched expense rows", () => {
    const result = classifyTransaction(tx({ description: "Mobile Data | MTN | 3.2GB 2 Days Plan" }), CATEGORIES);
    expect(result.categoryId).toBe("c-utilities");
    expect(result.categoryConfidence).toBe("high");
    expect(result.categoryReason).toBe("merchant:MTN");

    const electricity = classifyTransaction(tx({ description: "ELECTRICITY BILL" }), CATEGORIES);
    expect(electricity.categoryId).toBe("c-utilities");
    expect(electricity.categoryConfidence).toBe("medium");
    expect(electricity.categoryReason).toBe("keyword:electricity");
  });

  it("does not reclassify fees, refunds, transfers or savings as expenses", () => {
    const fee = classifyTransaction(tx({ description: "Commission on NIP Transfer" }), CATEGORIES);
    expect(fee.type).toBe("bank-fee");
    expect(fee.categoryConfidence).toBeUndefined();

    const refund = classifyTransaction(tx({ description: "Refund from Shoprite" }), CATEGORIES);
    expect(refund.type).toBe("refund");
    expect(refund.categoryConfidence).toBeUndefined();

    const transfer = classifyTransaction(tx({ description: "Transfer to FRIDAY PATIENCE NISMA | Sterling Bank" }), CATEGORIES);
    expect(transfer.type).toBe("transfer");
    expect(transfer.categoryConfidence).toBeUndefined();

    const saving = classifyTransaction(tx({ description: "Spend and Save" }), CATEGORIES);
    expect(saving.type).toBe("savings");
  });

  it("keeps unknown debits in review when merchant evidence is absent", () => {
    const result = classifyTransaction(tx({ description: "PAYMENT TO UNKNOWN SHOP" }), CATEGORIES);
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
    expect(result.categoryId).toBeNull();
  });

  it("keeps low-confidence keyword rows out of the auto-upgrade path", () => {
    const result = classifyTransaction(tx({ description: "FOODSTUFF GLOBAL" }), CATEGORIES);
    expect(result.type).toBe("unknown");
    expect(result.needsReview).toBe(true);
  });

  it("keeps a short-rule expense row unflagged despite a LOW keyword match", () => {
    const result = classifyTransaction(tx({ description: "FUEL" }), CATEGORIES);
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-transport");
    expect(result.needsReview).toBe(false);
  });

  it("extracts the merchant for transfer rows through the shared layer", () => {
    const result = classifyTransaction(tx({ description: "Transfer to JOHN DOE" }), CATEGORIES);
    expect(result.merchant).toBe("JOHN DOE");
  });
});

describe("user overrides become reusable rules (Prompt 8G future-friendly)", () => {
  const learned: LearnedRule[] = [
    {
      id: "lr-1",
      source: "statement-import",
      kind: "provider",
      key: "mtn",
      categoryId: "c-food",
      strength: 2,
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("a corrected category (provider key) wins over the merchant matcher on later imports", () => {
    const corrected = classifyTransaction(tx({ description: "MTN Data Bundle" }), CATEGORIES, learned);
    expect(corrected.type).toBe("expense");
    expect(corrected.categoryId).toBe("c-food");
    expect(corrected.categoryConfidence).toBe("high");
    expect(corrected.categoryReason).toBe("learned:provider:mtn");
    expect(corrected.needsReview).toBe(false);
  });

  it("without the learned rule the same row resolves through the merchant matcher", () => {
    const matcher = classifyTransaction(tx({ description: "MTN Data Bundle" }), CATEGORIES);
    expect(matcher.categoryId).toBe("c-utilities");
    expect(matcher.categoryReason).toBe("merchant:MTN");
  });
});
