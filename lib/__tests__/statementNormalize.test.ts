import { describe, expect, it } from "vitest";
import { candidatesToNormalized, toSignedMinor } from "../statementNormalize";
import { MAX_ORIGINAL_DESCRIPTION_LENGTH } from "../statementTypes";
import type { ImportCandidate } from "../statementImport";

function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    id: "r3",
    date: "2026-08-01",
    description: "RENT PAYMENT",
    amount: -50000000,
    type: "expense",
    categoryId: "cat-rent",
    row: 3,
    ...overrides,
  };
}

const CONTEXT = { currency: "NGN" as const };

describe("candidatesToNormalized", () => {
  it("maps a debit row to debitAmount and direction out", () => {
    const [t] = candidatesToNormalized([candidate()], CONTEXT);
    expect(t.debitAmount).toBe(50000000);
    expect(t.creditAmount).toBeUndefined();
    expect(t.direction).toBe("out");
  });

  it("maps a credit row to creditAmount and direction in", () => {
    const [t] = candidatesToNormalized(
      [candidate({ id: "r4", amount: 250000, row: 4 })],
      CONTEXT,
    );
    expect(t.creditAmount).toBe(250000);
    expect(t.debitAmount).toBeUndefined();
    expect(t.direction).toBe("in");
  });

  it("never infers a transaction type from the sign (no debit = expense)", () => {
    const [debit] = candidatesToNormalized([candidate()], CONTEXT);
    const [credit] = candidatesToNormalized(
      [candidate({ id: "r4", amount: 250000 })],
      CONTEXT,
    );
    expect(debit.type).toBe("unknown");
    expect(credit.type).toBe("unknown");
    expect(debit.confidence).toBe("none");
    expect(debit.categoryId).toBeNull();
    expect(debit.status).toBe("draft");
  });

  it("preserves identity, dates, description and source row", () => {
    const [t] = candidatesToNormalized(
      [
        candidate({
          id: "r7",
          date: null,
          description: "MYSTERY CHARGE X7",
          amount: -1234,
          row: 7,
        }),
      ],
      CONTEXT,
    );
    expect(t.id).toBe("r7");
    expect(t.transactionDate).toBeNull();
    expect(t.description).toBe("MYSTERY CHARGE X7");
    expect(t.originalDescription).toBe("MYSTERY CHARGE X7");
    expect(t.row).toBe(7);
  });

  it("carries the currency and source bank from context", () => {
    const [t] = candidatesToNormalized(
      [candidate()],
      { currency: "USD", sourceBank: "gtco" },
    );
    expect(t.currency).toBe("USD");
    expect(t.sourceBank).toBe("gtco");
  });

  it("defaults the source bank to unknown when not provided", () => {
    const [t] = candidatesToNormalized([candidate()], CONTEXT);
    expect(t.sourceBank).toBe("unknown");
  });

  it("caps the preserved original description", () => {
    const long = "X".repeat(MAX_ORIGINAL_DESCRIPTION_LENGTH + 50);
    const [t] = candidatesToNormalized([candidate({ description: long })], CONTEXT);
    expect(t.originalDescription).toHaveLength(MAX_ORIGINAL_DESCRIPTION_LENGTH);
    expect(t.description).toBe(long);
  });

  it("returns an empty list for no candidates", () => {
    expect(candidatesToNormalized([], CONTEXT)).toEqual([]);
  });
});

describe("toSignedMinor", () => {
  it("returns negative for debits, positive for credits", () => {
    const debit = candidatesToNormalized([candidate()], CONTEXT)[0];
    const credit = candidatesToNormalized(
      [candidate({ amount: 250000 })],
      CONTEXT,
    )[0];
    expect(toSignedMinor(debit)).toBe(-50000000);
    expect(toSignedMinor(credit)).toBe(250000);
  });

  it("computes the difference when both columns are present", () => {
    const t = {
      ...candidatesToNormalized([candidate()], CONTEXT)[0],
      debitAmount: 1000,
      creditAmount: 3000,
    };
    expect(toSignedMinor(t)).toBe(2000);
  });

  it("treats missing amounts as zero", () => {
    const t = candidatesToNormalized([candidate()], CONTEXT)[0];
    const zero = { ...t, debitAmount: undefined, creditAmount: undefined };
    expect(toSignedMinor(zero)).toBe(0);
  });
});