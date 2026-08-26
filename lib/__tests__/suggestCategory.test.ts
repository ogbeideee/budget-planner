import { describe, expect, it } from "vitest";
import {
  FUZZY_MATCH_THRESHOLD,
  RULE_MIN_STRENGTH,
  keySimilarity,
  markRulesUsed,
  recordCorrection,
  suggestCategory,
  suggestCategoryForText,
} from "../learnedRules";
import type { Category, LearnedRule } from "../types";

const GROCERIES: Category = {
  id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316",
  kind: "expense", createdAt: "2026-01-01T00:00:00.000Z",
};
const TRANSPORT: Category = {
  id: "c-transport", name: "Transport", icon: "🚌", color: "#eab308",
  kind: "expense", createdAt: "2026-01-01T00:00:00.000Z",
};
const SALARY: Category = {
  id: "c-salary", name: "Salary", icon: "💰", color: "#0ea5e9",
  kind: "income", createdAt: "2026-01-01T00:00:00.000Z",
};
const CATEGORIES = [GROCERIES, TRANSPORT, SALARY];

function rule(
  id: string,
  kind: LearnedRule["kind"],
  key: string,
  categoryId: string,
  strength = RULE_MIN_STRENGTH,
): LearnedRule {
  return {
    id, source: "statement-import", kind, key, categoryId, strength,
    enabled: strength >= RULE_MIN_STRENGTH,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("exact matches", () => {
  it("suggests the learned category for a known merchant", () => {
    const rules = [rule("r1", "merchant", "shoprite lekki", GROCERIES.id)];
    const hit = suggestCategory(
      { description: "POS purchase", merchant: "SHOPRITE LEKKI", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(hit).toMatchObject({ match: "exact", similarity: 1, confident: true });
    expect(hit?.category.id).toBe(GROCERIES.id);
  });

  it("fires for EVERY learned merchant, not just the first one", () => {
    // Regression: the previous matcher took only the first rule of each kind,
    // so a user's second learned merchant could never match and the feature
    // silently stopped learning after one.
    const rules = [
      rule("r1", "merchant", "shoprite lekki", GROCERIES.id),
      rule("r2", "merchant", "uber", TRANSPORT.id),
      rule("r3", "merchant", "bolt", TRANSPORT.id),
    ];
    for (const [merchant, expected] of [
      ["SHOPRITE LEKKI", GROCERIES.id],
      ["UBER", TRANSPORT.id],
      ["BOLT", TRANSPORT.id],
    ] as const) {
      const hit = suggestCategory({ description: "x", merchant, direction: "out" }, rules, CATEGORIES);
      expect(hit?.category.id, `${merchant} should match`).toBe(expected);
    }
  });

  it("prefers a more specific signal", () => {
    const rules = [
      rule("r-desc", "description", "mtn airtime purchase", GROCERIES.id),
      rule("r-prov", "provider", "mtn", TRANSPORT.id),
    ];
    const hit = suggestCategory(
      { description: "MTN airtime purchase", provider: "MTN", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(hit?.rule.id).toBe("r-prov");
  });

  it("never fires a rule whose direction contradicts the row", () => {
    const rules = [rule("r1", "merchant", "acme", SALARY.id)];
    // An income rule must not fire on a debit.
    expect(
      suggestCategory({ description: "x", merchant: "ACME", direction: "out" }, rules, CATEGORIES),
    ).toBeNull();
    expect(
      suggestCategory({ description: "x", merchant: "ACME", direction: "in" }, rules, CATEGORIES),
    ).not.toBeNull();
  });

  it("ignores a rule whose category has been deleted", () => {
    const rules = [rule("r1", "merchant", "acme", "c-gone")];
    expect(
      suggestCategory({ description: "x", merchant: "ACME" }, rules, CATEGORIES),
    ).toBeNull();
  });
});

describe("fuzzy matches", () => {
  it("scores token overlap, not character overlap", () => {
    expect(keySimilarity("shoprite lekki", "shoprite lekki")).toBe(1);
    expect(keySimilarity("shoprite lekki", "shoprite lekki store")).toBeCloseTo(0.8, 5);
    expect(keySimilarity("shoprite lekki", "uber trip")).toBe(0);
  });

  it("applies a suggestion above the threshold", () => {
    const rules = [rule("r1", "merchant", "shoprite lekki phase one", GROCERIES.id)];
    const hit = suggestCategory(
      // Three of four tokens shared -> 6/7 ≈ 0.857, above the bar.
      { description: "x", merchant: "SHOPRITE LEKKI PHASE", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(hit?.match).toBe("fuzzy");
    expect(hit?.similarity).toBeGreaterThanOrEqual(FUZZY_MATCH_THRESHOLD);
    expect(hit?.category.id).toBe(GROCERIES.id);
  });

  it("withholds a suggestion below the threshold", () => {
    const rules = [rule("r1", "merchant", "shoprite lekki", GROCERIES.id)];
    const hit = suggestCategory(
      // One of three tokens shared -> 2/5 = 0.4, well under the bar.
      { description: "x", merchant: "SHOPRITE IKEJA CITY MALL", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(hit).toBeNull();
  });

  it("prefers an exact match on a weaker signal over a fuzzy stronger one", () => {
    const rules = [
      rule("r-prov", "provider", "mtn nigeria plc", TRANSPORT.id),
      rule("r-desc", "description", "mtn data bundle", GROCERIES.id),
    ];
    const hit = suggestCategory(
      { description: "MTN data bundle", provider: "MTN NIGERIA", direction: "out" },
      rules,
      CATEGORIES,
    );
    // The description key was corrected verbatim; the provider is only close.
    expect(hit?.match).toBe("exact");
    expect(hit?.rule.id).toBe("r-desc");
  });
});

describe("confidence", () => {
  it("marks a single-correction candidate as not yet confident", () => {
    const rules = [rule("r1", "merchant", "acme", GROCERIES.id, 1)];
    const hit = suggestCategory({ description: "x", merchant: "ACME" }, rules, CATEGORIES);
    // Still pre-fills the category...
    expect(hit?.category.id).toBe(GROCERIES.id);
    // ...but flags that the row should be looked at rather than auto-applied.
    expect(hit?.confident).toBe(false);
  });

  it("becomes confident once corrected enough times", () => {
    const rules = [rule("r1", "merchant", "acme", GROCERIES.id, RULE_MIN_STRENGTH)];
    const hit = suggestCategory({ description: "x", merchant: "ACME" }, rules, CATEGORIES);
    expect(hit?.confident).toBe(true);
  });
});

describe("overriding a learned mapping", () => {
  it("rewrites the existing entry rather than leaving two in conflict", () => {
    let rules = recordCorrection([], {
      merchant: "SHOPRITE LEKKI", description: "POS", categoryId: GROCERIES.id,
    });
    rules = recordCorrection(rules, {
      merchant: "SHOPRITE LEKKI", description: "POS", categoryId: GROCERIES.id,
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].enabled).toBe(true);

    // The user now files the same merchant somewhere else.
    rules = recordCorrection(rules, {
      merchant: "SHOPRITE LEKKI", description: "POS", categoryId: TRANSPORT.id,
    });

    // One entry, pointing at the newest choice — never two competing rules.
    expect(rules).toHaveLength(1);
    expect(rules[0].categoryId).toBe(TRANSPORT.id);

    const hit = suggestCategory(
      { description: "POS", merchant: "SHOPRITE LEKKI", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(hit?.category.id).toBe(TRANSPORT.id);
  });

  it("deactivates a re-baselined mapping until the new direction repeats", () => {
    let rules = recordCorrection([], { merchant: "ACME", description: "d", categoryId: GROCERIES.id });
    rules = recordCorrection(rules, { merchant: "ACME", description: "d", categoryId: GROCERIES.id });
    rules = recordCorrection(rules, { merchant: "ACME", description: "d", categoryId: TRANSPORT.id });
    // Flip-flopping must not leave a confidently-wrong rule behind.
    expect(rules[0].enabled).toBe(false);
    expect(rules[0].strength).toBe(1);
  });
});

describe("deleting a mapping", () => {
  it("stops it suggesting anything afterwards", () => {
    const rules = [
      rule("r1", "merchant", "shoprite lekki", GROCERIES.id),
      rule("r2", "merchant", "uber", TRANSPORT.id),
    ];
    const before = suggestCategory(
      { description: "x", merchant: "SHOPRITE LEKKI", direction: "out" },
      rules,
      CATEGORIES,
    );
    expect(before?.category.id).toBe(GROCERIES.id);

    // What the Settings panel's delete does to the list.
    const after = rules.filter((entry) => entry.id !== "r1");
    expect(
      suggestCategory(
        { description: "x", merchant: "SHOPRITE LEKKI", direction: "out" },
        after,
        CATEGORIES,
      ),
    ).toBeNull();
    // The other mapping is untouched.
    expect(
      suggestCategory({ description: "x", merchant: "UBER", direction: "out" }, after, CATEGORIES)
        ?.category.id,
    ).toBe(TRANSPORT.id);
  });

  it("clearing everything leaves no suggestions at all", () => {
    expect(
      suggestCategory({ description: "x", merchant: "SHOPRITE LEKKI" }, [], CATEGORIES),
    ).toBeNull();
  });
});

describe("the shared entry point", () => {
  it("works from a bare description, with no statement context", () => {
    // What the planned email-alert parser will have: one raw line.
    const rules = [rule("r1", "description", "shoprite lekki purchase", GROCERIES.id)];
    const hit = suggestCategoryForText("Shoprite Lekki purchase", rules, CATEGORIES);
    expect(hit?.category.id).toBe(GROCERIES.id);
  });

  it("skips direction guards when direction is unknown", () => {
    const rules = [rule("r1", "merchant", "acme", SALARY.id)];
    // No direction supplied — an income rule is allowed to match.
    expect(suggestCategoryForText("ACME", rules, CATEGORIES)).toBeNull();
    expect(
      suggestCategory({ description: "x", merchant: "ACME" }, rules, CATEGORIES)?.category.id,
    ).toBe(SALARY.id);
  });
});

describe("usage tracking", () => {
  it("stamps only the rules that were used", () => {
    const rules = [
      rule("r1", "merchant", "a", GROCERIES.id),
      rule("r2", "merchant", "b", TRANSPORT.id),
    ];
    const stamped = markRulesUsed(rules, ["r1"], "2026-06-01T00:00:00.000Z");
    expect(stamped[0].lastUsedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(stamped[1].lastUsedAt).toBeUndefined();
  });

  it("is a no-op for an empty id list", () => {
    const rules = [rule("r1", "merchant", "a", GROCERIES.id)];
    expect(markRulesUsed(rules, [])).toEqual(rules);
  });
});
