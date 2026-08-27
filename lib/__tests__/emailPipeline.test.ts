import { describe, expect, it } from "vitest";
import { buildEmailDrafts, blockedDrafts } from "../emailPipeline";
import { parseAlerts, type AlertEmail } from "../emailAlerts";
import { RULE_MIN_STRENGTH } from "../learnedRules";
import { planImport } from "../statementPipeline";
import type { Category, LearnedRule } from "../types";
import type { ExistingTransaction } from "../duplicateScore";

const GROCERIES: Category = {
  id: "c-groceries", name: "Groceries", icon: "🛒", color: "#f97316",
  kind: "expense", createdAt: "2026-01-01T00:00:00.000Z",
};
const SALARY: Category = {
  id: "c-salary", name: "Salary", icon: "💰", color: "#0ea5e9",
  kind: "income", createdAt: "2026-01-01T00:00:00.000Z",
};
const CATEGORIES = [GROCERIES, SALARY];

function learned(key: string, categoryId: string, strength = RULE_MIN_STRENGTH): LearnedRule {
  return {
    id: `r-${key}`, source: "statement-import", kind: "merchant", key,
    categoryId, strength, enabled: strength >= RULE_MIN_STRENGTH,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const gtbankAlert = (id: string, desc: string, amount: string, date = "12-Aug-2026"): AlertEmail => ({
  id,
  from: "GeNS@gtbank.com",
  // Generic subject, direction in the body — the confirmed real shape.
  subject: "Transaction Notification",
  body: `a DEBIT transaction occurred on your account.\nAmount : NGN${amount}\nDescription : ${desc}\nDate : ${date}`,
});

function build(emails: AlertEmail[], opts: {
  rules?: LearnedRule[];
  existing?: ExistingTransaction[];
  seen?: Set<string>;
} = {}) {
  return buildEmailDrafts({
    alerts: parseAlerts(emails),
    categories: CATEGORIES,
    learnedRules: opts.rules ?? [],
    existing: opts.existing ?? [],
    seenMessageIds: opts.seen,
  });
}

describe("categorization reuses the learned-rules engine", () => {
  it("pre-fills a category from a rule learned during statement import", () => {
    // The rule was learned by the IMPORTER; the email path must honour it.
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });

    expect(draft.suggestion).toMatchObject({
      categoryId: GROCERIES.id,
      match: "exact",
      confident: true,
    });
    expect(draft.row.categoryId).toBe(GROCERIES.id);
  });

  it("marks a single-correction candidate as not confident", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id, 1)];
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });
    expect(draft.suggestion?.confident).toBe(false);
    // Still pre-filled, still reviewable.
    expect(draft.row.categoryId).toBe(GROCERIES.id);
  });

  it("leaves the category null when nothing has been learned", () => {
    const [draft] = build([gtbankAlert("m1", "UNKNOWN PLACE", "5,000.00")]);
    expect(draft.suggestion).toBeUndefined();
    expect(draft.row.categoryId).toBeNull();
  });

  it("respects direction guards — an income rule never fires on a debit", () => {
    const rules = [learned("shoprite lekki", SALARY.id)];
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });
    expect(draft.row.categoryId).toBeNull();
  });
});

describe("duplicate detection reuses the shared scorer", () => {
  const manual: ExistingTransaction[] = [
    {
      id: "manual-1",
      date: "2026-08-12",
      amount: 500000,
      type: "expense",
      note: "Shoprite Lekki groceries",
    },
  ];

  it("flags an alert that mirrors a hand-entered transaction", () => {
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], {
      existing: manual,
    });
    expect(draft.duplicates.length).toBeGreaterThan(0);
    expect(draft.duplicates[0].existing.id).toBe("manual-1");
    // And it blocks the import until answered, like a statement row.
    expect(draft.row.duplicateResolution).toBe("unresolved");
    expect(draft.row.duplicateOfId).toBe("manual-1");
  });

  it("does not flag an unrelated transaction that merely shares an amount", () => {
    const unrelated: ExistingTransaction[] = [
      { id: "other", date: "2026-08-12", amount: 500000, type: "expense", note: "Fuel at Mobil station" },
    ];
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], {
      existing: unrelated,
    });
    expect(draft.duplicates).toHaveLength(0);
    expect(draft.row.duplicateResolution).toBeUndefined();
  });

  it("does not attempt scoring for an alert missing its amount", () => {
    const broken: AlertEmail = {
      id: "m1", from: "GeNS@gtbank.com", subject: "Transaction Alert",
      body: "a DEBIT transaction occurred.\nAmount : NGN ****\nDescription : SHOPRITE LEKKI\nDate : 12-Aug-2026",
    };
    const [draft] = build([broken], { existing: manual });
    expect(draft.duplicates).toHaveLength(0);
  });
});

describe("needs-review alerts", () => {
  const broken: AlertEmail = {
    id: "m-broken", from: "GeNS@gtbank.com", subject: "Transaction Alert",
    body: "a DEBIT transaction occurred.\nAmount : NGN ****\nDescription : SHOPRITE LEKKI\nDate : 12-Aug-2026",
  };

  it("still produce a draft rather than disappearing", () => {
    const drafts = build([broken]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].needsReview).toMatchObject({ missing: ["amount"] });
    expect(drafts[0].needsReview?.snippet).toContain("SHOPRITE");
  });

  it("keep whatever was understood so the user completes one field", () => {
    const [draft] = build([broken]);
    expect(draft.row.description).toBe("SHOPRITE LEKKI");
    expect(draft.row.transactionDate).toBe("2026-08-12");
    expect(draft.row.direction).toBe("out");
    // The one thing that could not be read stays absent.
    expect(draft.row.debitAmount).toBeUndefined();
  });

  it("are reported as blocked", () => {
    const drafts = build([broken]);
    expect(blockedDrafts(drafts)).toHaveLength(1);
  });

  it("cannot reach the ledger through planImport", () => {
    const drafts = build([broken]);
    const plan = planImport(drafts.map((d) => d.row), []);
    // No amount and no category — nothing is written.
    expect(plan.inputs).toHaveLength(0);
  });
});

describe("feeding the shared import planner", () => {
  it("a clean alert with a learned category imports as a normal transaction", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const drafts = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });

    const plan = planImport(drafts.map((d) => d.row), []);
    expect(plan.inputs).toHaveLength(1);
    expect(plan.inputs[0]).toMatchObject({
      categoryId: GROCERIES.id,
      amount: 500000,
      type: "expense",
      date: "2026-08-12",
    });
    expect(plan.unresolvedDuplicates).toBe(0);
  });

  it("a flagged duplicate blocks the batch until answered", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const existing: ExistingTransaction[] = [
      { id: "manual-1", date: "2026-08-12", amount: 500000, type: "expense", note: "Shoprite Lekki groceries" },
    ];
    const drafts = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules, existing });

    const plan = planImport(drafts.map((d) => d.row), []);
    expect(plan.unresolvedDuplicates).toBe(1);
    expect(plan.inputs).toHaveLength(0);
  });

  it("carries provenance so the row's origin is identifiable", () => {
    const [draft] = build([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")]);
    expect(draft.row.sourceBank).toBe("gtco");
    expect(draft.row.id).toBe("email:m1");
  });
});

describe("re-syncing", () => {
  it("skips messages already turned into drafts", () => {
    const emails = [gtbankAlert("m1", "A", "1,000.00"), gtbankAlert("m2", "B", "2,000.00")];
    const drafts = build(emails, { seen: new Set(["m1"]) });
    expect(drafts.map((d) => d.messageId)).toEqual(["m2"]);
  });

  it("produces stable row ids, so a repeat build is idempotent", () => {
    const emails = [gtbankAlert("m1", "A", "1,000.00")];
    expect(build(emails)[0].row.id).toBe(build(emails)[0].row.id);
  });
});

describe("mixed batches", () => {
  it("handles parsed, needs-review and ignored together", () => {
    const drafts = build([
      gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00"),
      { id: "m2", from: "GeNS@gtbank.com", subject: "Alert", body: "a DEBIT transaction occurred.\nAmount : NGN ****\nDescription : X\nDate : 12-Aug-2026" },
      { id: "m3", from: "spam@elsewhere.example", subject: "Hi", body: "Amount : NGN9.99" },
    ]);
    // The non-allowlisted message never becomes a draft at all.
    expect(drafts.map((d) => d.messageId)).toEqual(["m1", "m2"]);
    expect(drafts[0].needsReview).toBeUndefined();
    expect(drafts[1].needsReview).toBeDefined();
  });
});
