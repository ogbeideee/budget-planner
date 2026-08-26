import { describe, expect, it } from "vitest";

import {
  activeRuleFor,
  normalizeRuleKey,
  recordCorrection,
  RULE_MIN_STRENGTH,
  signalForCorrection,
} from "../learnedRules";
import { classifyTransaction, classifyTransactions } from "../statementClassify";
import { createInitialState } from "../seed";
import { validateAppState } from "../validate";
import type { Category, LearnedRule } from "../types";
import type { NormalizedBankTransaction } from "../statementTypes";

const CATEGORIES: Category[] = [
  { id: "c-food", name: "Food", icon: "🍔", color: "#ef4444", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-utilities", name: "Utilities", icon: "💡", color: "#22c55e", kind: "expense", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c-salary", name: "Salary", icon: "💰", color: "#0ea5e9", kind: "income", createdAt: "2026-01-01T00:00:00.000Z" },
];

function tx(overrides: Partial<NormalizedBankTransaction> = {}): NormalizedBankTransaction {
  return {
    id: "t1",
    transactionDate: "2026-08-12",
    description: "",
    currency: "NGN",
    sourceBank: "opay",
    type: "unknown",
    direction: "out",
    confidence: "none",
    status: "draft",
    categoryId: null,
    row: 2,
    ...overrides,
  };
}

function active(rules: LearnedRule[]): LearnedRule[] {
  return rules.filter((rule) => rule.enabled);
}

describe("recordCorrection — repeated corrections", () => {
  it("one correction only creates an inactive candidate (never a rule)", () => {
    const rules = recordCorrection([], {
      provider: "MTN",
      description: "Mobile Data 3.2GB",
      categoryId: "c-food",
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].strength).toBe(1);
    expect(rules[0].enabled).toBe(false);
    expect(rules[0].kind).toBe("provider");
    expect(rules[0].key).toBe("mtn");
  });

  it("a second matching correction activates the rule", () => {
    const once = recordCorrection([], {
      provider: "MTN",
      description: "Airtime Recharge",
      categoryId: "c-food",
    });
    const twice = recordCorrection(once, {
      provider: "MTN",
      description: "Data Bundle Renewal",
      categoryId: "c-food",
    });
    expect(active(twice)).toHaveLength(1);
    expect(twice[0].strength).toBe(2);
    expect(twice[0].enabled).toBe(true);
    expect(RULE_MIN_STRENGTH).toBe(2);
  });

  it("the rule key is the normalized provider, not the description", () => {
    const rules = recordCorrection([], {
      provider: "  MTN ",
      description: "Mobile Data",
      categoryId: "c-food",
    });
    expect(rules[0].key).toBe("mtn");
    expect(rules[0].kind).toBe("provider");
  });

  it("falls back to the merchant signal when there is no provider", () => {
    const rules = recordCorrection([], {
      merchant: "  David ",
      description: "Transfer to David | PalmPay",
      categoryId: "c-food",
    });
    expect(rules[0].kind).toBe("merchant");
    expect(rules[0].key).toBe("david");
  });

  it("falls back to the full normalized description when neither is present", () => {
    const rules = recordCorrection([], {
      description: "  POS   Withdrawal  ",
      categoryId: "c-food",
    });
    expect(rules[0].kind).toBe("description");
    expect(rules[0].key).toBe("pos withdrawal");
  });

  it("ignores a correction with no usable signal at all", () => {
    const rules = recordCorrection([], { description: "   ", categoryId: "c-food" });
    expect(rules).toHaveLength(0);
  });
});

describe("classification with learned rules", () => {
  it("classifies a future MTN row to the learned category with high confidence (provider rule)", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    const result = classifyTransaction(
      tx({ provider: "MTN", description: "Mobile Data 3.2GB 2 Days Plan" }),
      CATEGORIES,
      rules,
    );
    expect(result.type).toBe("expense");
    expect(result.categoryId).toBe("c-food");
    expect(result.confidence).toBe("high");
    expect(result.needsReview).toBe(false);
    expect(result.classificationReason).toBe("learned:provider:mtn");
  });

  it("classifies by merchant when the row has a merchant (merchant rule)", () => {
    let rules = recordCorrection([], { merchant: "DAVID", description: "X", categoryId: "c-food" });
    rules = recordCorrection(rules, { merchant: "David", description: "Y", categoryId: "c-food" });
    const result = classifyTransaction(
      tx({ merchant: "david", description: "Transfer to DAVID | PalmPay" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).toBe("c-food");
    expect(result.classificationReason).toBe("learned:merchant:david");
  });

  it("matches by the full normalized description when the row has no provider or merchant", () => {
    let rules = recordCorrection([], { description: "POS Withdrawal", categoryId: "c-food" });
    rules = recordCorrection(rules, { description: "pos  withdrawal", categoryId: "c-food" });
    const result = classifyTransaction(
      tx({ description: "POS Withdrawal" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).toBe("c-food");
    const different = classifyTransaction(
      tx({ description: "POS Withdrawal STAMP" }),
      CATEGORIES,
      rules,
    );
    expect(different.categoryId).not.toBe("c-food");
  });

  it("a single correction never changes classification (safety)", () => {
    const rules = recordCorrection([], {
      provider: "MTN",
      description: "Mobile Data",
      categoryId: "c-food",
    });
    const result = classifyTransaction(
      tx({ provider: "MTN", description: "Mobile Data 3.2GB" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).not.toBe("c-food");
  });

  it("provider rules beat merchant rules on the same row", () => {
    let rules = recordCorrection([], { merchant: "DAVID", description: "X", categoryId: "c-food" });
    rules = recordCorrection(rules, { merchant: "DAVID", description: "Y", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "PalmPay", description: "Z", categoryId: "c-utilities" });
    rules = recordCorrection(rules, { provider: "PalmPay", description: "W", categoryId: "c-utilities" });
    const result = classifyTransaction(
      tx({ provider: "palmpay", merchant: "david", description: "Transfer to DAVID | PalmPay" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).toBe("c-utilities");
    expect(result.classificationReason).toBe("learned:provider:palmpay");
  });

  it("applies to batch classification", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    const results = classifyTransactions(
      [
        tx({ id: "a", provider: "MTN", description: "Airtime" }),
        tx({ id: "b", provider: "Airtel", description: "Data" }),
      ],
      CATEGORIES,
      rules,
    );
    expect(results[0].categoryId).toBe("c-food");
    expect(results[1].categoryId).not.toBe("c-food");
  });
});

describe("rule priority — user rules override built-ins", () => {
  it("a learned rule overrides the built-in transfer classification", () => {
    const control = classifyTransaction(
      tx({ description: "TRANSFER TO JOHN | PALMPAY" }),
      CATEGORIES,
    );
    expect(control.type).toBe("transfer");

    let rules = recordCorrection([], { provider: "PalmPay", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "PalmPay", description: "B", categoryId: "c-food" });
    const learned = classifyTransaction(
      tx({ description: "TRANSFER TO JOHN | PALMPAY" }),
      CATEGORIES,
      rules,
    );
    expect(learned.type).toBe("expense");
    expect(learned.categoryId).toBe("c-food");
    expect(learned.confidence).toBe("high");
  });
});

describe("conflicting corrections", () => {
  it("a conflicting correction re-baselines the rule and deactivates it", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    expect(active(rules)).toHaveLength(1);

    rules = recordCorrection(rules, { provider: "MTN", description: "C", categoryId: "c-utilities" });
    expect(active(rules)).toHaveLength(0);
    expect(rules[0].categoryId).toBe("c-utilities");
    expect(rules[0].strength).toBe(1);
    expect(rules[0].enabled).toBe(false);
  });

  it("the new direction needs two more corrections to activate", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "C", categoryId: "c-utilities" });
    rules = recordCorrection(rules, { provider: "MTN", description: "D", categoryId: "c-utilities" });
    expect(active(rules)).toHaveLength(1);
    expect(rules[0].categoryId).toBe("c-utilities");
    expect(rules[0].strength).toBe(2);
  });

  it("flip-flopping can never activate anything", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-utilities" });
    rules = recordCorrection(rules, { provider: "MTN", description: "C", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "D", categoryId: "c-utilities" });
    expect(active(rules)).toHaveLength(0);
  });
});

describe("disabled and deleted rules", () => {
  it("a disabled rule never applies — classification falls back to built-ins", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    rules = rules.map((rule) => ({ ...rule, enabled: false }));
    const result = classifyTransaction(
      tx({ provider: "MTN", description: "Mobile Data 3.2GB" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).not.toBe("c-food");
  });

  it("a deleted rule no longer applies", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    const deleted = rules.filter((rule) => rule.key !== "mtn");
    const result = classifyTransaction(
      tx({ provider: "MTN", description: "Mobile Data 3.2GB" }),
      CATEGORIES,
      deleted,
    );
    expect(result.categoryId).not.toBe("c-food");
  });

  it("a rule whose category was deleted never applies", () => {
    const orphan: LearnedRule = {
      id: "orphan",
      source: "statement-import",
      kind: "provider",
      key: "mtn",
      categoryId: "c-gone",
      strength: 5,
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(activeRuleFor(tx({ provider: "MTN" }), [orphan], CATEGORIES)).toBeNull();
    const result = classifyTransaction(tx({ provider: "MTN", description: "Data" }), CATEGORIES, [orphan]);
    expect(result.categoryId).not.toBe("c-gone");
  });
});

describe("safety guards", () => {
  it("an expense rule never fires on credits (in)", () => {
    let rules = recordCorrection([], { provider: "MTN", description: "A", categoryId: "c-food" });
    rules = recordCorrection(rules, { provider: "MTN", description: "B", categoryId: "c-food" });
    const result = classifyTransaction(
      tx({ provider: "MTN", description: "MTN Reversal", direction: "in" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).not.toBe("c-food");
  });

  it("an income rule never fires on debits (out)", () => {
    let rules = recordCorrection([], { provider: "ACME", description: "A", categoryId: "c-salary" });
    rules = recordCorrection(rules, { provider: "ACME", description: "B", categoryId: "c-salary" });
    const result = classifyTransaction(
      tx({ provider: "ACME", description: "ACME Payment", direction: "out" }),
      CATEGORIES,
      rules,
    );
    expect(result.categoryId).not.toBe("c-salary");
  });

  it("signalForCorrection prefers provider over merchant over description", () => {
    expect(signalForCorrection({ provider: "MTN", merchant: "DAVID", description: "X" })).toEqual({
      kind: "provider",
      key: "mtn",
    });
    expect(signalForCorrection({ merchant: "DAVID", description: "X" })).toEqual({
      kind: "merchant",
      key: "david",
    });
    expect(signalForCorrection({ description: "X" })).toEqual({
      kind: "description",
      key: "x",
    });
    expect(signalForCorrection({ description: "" })).toBeNull();
  });

  it("normalizeRuleKey collapses whitespace and lowercases", () => {
    expect(normalizeRuleKey("  Mobile   Data  ")).toBe("mobile data");
  });
});

describe("validation and migration", () => {
  it("round-trips learned rules through validateAppState", () => {
    const state = createInitialState();
    state.learnedRules = recordCorrection([], {
      provider: "MTN",
      description: "Mobile Data",
      categoryId: state.categories[3].id,
    });
    const result = validateAppState(JSON.parse(JSON.stringify(state)));
    expect(result.learnedRules).toHaveLength(1);
    expect(result.learnedRules[0]).toMatchObject({
      kind: "provider",
      key: "mtn",
      strength: 1,
      enabled: false,
    });
  });

  it("rejects a learned rule with an unknown category", () => {
    const state = createInitialState();
    state.learnedRules = [
      {
        id: "r1",
        source: "statement-import",
        kind: "provider",
        key: "mtn",
        categoryId: "missing",
        strength: 1,
        enabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    expect(() => validateAppState(state)).toThrow();
  });

  it("rejects a learned rule with a bad kind or strength", () => {
    const state = createInitialState();
    const base = {
      id: "r1",
      source: "statement-import",
      key: "mtn",
      categoryId: state.categories[3].id,
      enabled: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as const;
    state.learnedRules = [{ ...base, kind: "bank", strength: 1 }] as never;
    expect(() => validateAppState(state)).toThrow();
    state.learnedRules = [{ ...base, kind: "provider", strength: 0 }] as never;
    expect(() => validateAppState(state)).toThrow();
  });
});