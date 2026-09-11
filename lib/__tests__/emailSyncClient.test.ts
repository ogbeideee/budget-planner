import { describe, expect, it } from "vitest";
import {
  existingFromLedger,
  isAutoImportable,
  processDeliveredEmails,
} from "../emailSyncClient";
import { RULE_MIN_STRENGTH } from "../learnedRules";
import type { AlertEmail } from "../emailAlerts";
import type { Category, LearnedRule, Transaction } from "../types";
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

/** The VERIFIED real GTBank alert shape (same fixture layout the parser's
 *  own Tier-1 tests use — never reconstructed). */
const gtbankAlert = (id: string, desc: string, amount: string, date = "2026-08-12"): AlertEmail => ({
  id,
  from: "GeNS@gtbank.com",
  subject: "Transaction Notification",
  body: `We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Amount | : | NGN${amount}\n| Description | : | ${desc}\n| Value Date | : | ${date}`,
});

function run(emails: AlertEmail[], opts: {
  rules?: LearnedRule[];
  existing?: ExistingTransaction[];
  seen?: Set<string>;
} = {}) {
  return processDeliveredEmails({
    emails,
    categories: CATEGORIES,
    learnedRules: opts.rules ?? [],
    existing: opts.existing ?? [],
    seenMessageIds: opts.seen,
  });
}

describe("emailSyncClient — parser integration", () => {
  it("parses a real GTBank alert through parseAlerts without re-implementing it", () => {
    const result = run([gtbankAlert("m1", "SHOPRITE LEKKI PV/1234", "5,000.00")]);
    // One draft with the parsed amount, direction, date and narration.
    const [draft] = [...result.auto, ...result.review];
    expect(draft.needsReview).toBeUndefined();
    expect(draft.row.debitAmount).toBe(500000);
    expect(draft.row.direction).toBe("out");
    expect(draft.row.transactionDate).toBe("2026-08-12");
    expect(draft.row.description).toContain("SHOPRITE LEKKI");
  });

  it("routes a needs-review parse (missing amount) to review, keeping what was read", () => {
    const broken: AlertEmail = {
      id: "m2", from: "GeNS@gtbank.com", subject: "Transaction Notification",
      body: `We wish to inform you that a DEBIT transaction occurred on your account with us.\n| Description | : | MYSTERY MERCHANT\n| Value Date | : | 2026-08-12`,
    };
    const result = run([broken]);
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    const [draft] = result.review;
    expect(draft.needsReview?.missing).toContain("amount");
    expect(draft.needsReview?.snippet.length).toBeGreaterThan(0);
    expect(draft.row.description).toContain("MYSTERY MERCHANT");
  });

  it("ignores non-allowlisted senders entirely — the parser stays the authority", () => {
    const attacker: AlertEmail = {
      id: "m3", from: "alerts@gtbank.com.attacker.example", subject: "DEBIT", body: "NGN 9,999.00",
    };
    const result = run([attacker]);
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(0);
    // Still confirmed: it will never be delivered again.
    expect(result.messageIds).toEqual(["m3"]);
  });

  it("survives a malformed body without throwing", () => {
    const garbage: AlertEmail = { id: "m4", from: "x@wemabank.com", subject: "", body: "" };
    const result = run([garbage]);
    expect([...result.auto, ...result.review]).toHaveLength(0);
    expect(result.messageIds).toEqual(["m4"]);
  });
});
describe("emailSyncClient — pipeline integration (auto vs review)", () => {
  it("auto-imports a fully parsed alert with a confident learned category and no duplicates", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const result = run([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });
    expect(result.auto).toHaveLength(1);
    expect(result.review).toHaveLength(0);
    expect(result.auto[0].suggestion?.confident).toBe(true);
    expect(result.auto[0].row.categoryId).toBe(GROCERIES.id);
  });

  it("routes to review when the category suggestion is not confident", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id, 1)];
    const result = run([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules });
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(1);
  });

  it("routes to review when nothing was learned (no category at all)", () => {
    const result = run([gtbankAlert("m1", "UNKNOWN PLACE", "5,000.00")]);
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0].row.categoryId).toBeNull();
  });

  it("routes to review when a duplicate is flagged — never auto-imports over it", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const existing: ExistingTransaction[] = [
      { id: "manual-1", date: "2026-08-12", amount: 500000, type: "expense", note: "Shoprite Lekki groceries" },
    ];
    const result = run([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules, existing });
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.review[0].duplicates.length).toBeGreaterThan(0);
    expect(result.review[0].row.duplicateResolution).toBe("unresolved");
  });

  it("drops message ids already seen this session (second-line dedupe)", () => {
    const emails = [gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")];
    const seen = new Set(["m1"]);
    const result = run(emails, { seen });
    expect(result.auto).toHaveLength(0);
    expect(result.review).toHaveLength(0);
    expect(result.messageIds).toEqual(["m1"]);
  });

  it("isAutoImportable refuses every ambiguous state explicitly", () => {
    const rules = [learned("shoprite lekki", GROCERIES.id)];
    const [good] = run([gtbankAlert("m1", "SHOPRITE LEKKI", "5,000.00")], { rules }).auto;
    expect(isAutoImportable(good)).toBe(true);
    const [uncategorized] = run([gtbankAlert("m2", "UNKNOWN PLACE", "5,000.00")]).review;
    expect(isAutoImportable(uncategorized)).toBe(false);
  });
});

describe("existingFromLedger — maps the ledger for the duplicate scorer", () => {
  it("carries note, category and import reference, income side as 'income'", () => {
    const transactions: Transaction[] = [
      {
        id: "t1", categoryId: "c-groceries", amount: 1234, type: "expense",
        date: "2026-08-12", note: "Shoprite", createdAt: "2026-08-12T00:00:00.000Z",
        importSource: { source: "statement-import", bank: "gtco", reference: "REF1" },
      },
      {
        id: "t2", categoryId: "c-salary", amount: 99, type: "income",
        date: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const existing = existingFromLedger(transactions);
    expect(existing).toEqual([
      { id: "t1", date: "2026-08-12", amount: 1234, type: "expense", note: "Shoprite", categoryId: "c-groceries", reference: "REF1" },
      { id: "t2", date: "2026-08-01", amount: 99, type: "income", categoryId: "c-salary" },
    ]);
  });
});