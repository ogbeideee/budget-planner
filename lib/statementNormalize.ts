// Detection output → normalized bank transactions.
//
// The legacy generic-detect seam (Prompt 3C): `buildCandidates`
// (statementImport.ts) extracts *facts* from a statement — dates,
// descriptions, signed amounts — and this module lifts those facts into the
// normalized model WITHOUT interpreting them: the sign only sets `direction`
// (a fact), never `type` (a classification).
//
// Since Prompt 7A the bank parsers emit `NormalizedBankTransaction` rows
// directly (the pipeline calls `classifyTransactions` on parser output), so
// this seam is no longer on the import path — it stays exported with its
// tests as the generic fallback helper, exactly like `buildCandidates`
// (see ARCHITECTURE §4.1).

import type { ImportCandidate } from "./statementImport";
import { MAX_ORIGINAL_DESCRIPTION_LENGTH } from "./statementTypes";
import type {
  BankSource,
  NormalizationContext,
  NormalizedBankTransaction,
} from "./statementTypes";

/** Maps detection output onto the normalized model. Classification fields
 *  (`type`, `confidence`, `categoryId`, `status`) start neutral: "unknown",
 *  "none", null, "draft". */
export function candidatesToNormalized(
  candidates: ImportCandidate[],
  context: NormalizationContext,
): NormalizedBankTransaction[] {
  const sourceBank: BankSource = context.sourceBank ?? "unknown";
  return candidates.map((candidate) => {
    const debit = candidate.amount < 0 ? -candidate.amount : undefined;
    const credit = candidate.amount > 0 ? candidate.amount : undefined;
    return {
      id: candidate.id,
      transactionDate: candidate.date,
      description: candidate.description,
      originalDescription: capDescription(candidate.description),
      debitAmount: debit,
      creditAmount: credit,
      currency: context.currency,
      sourceBank,
      type: "unknown",
      direction: debit !== undefined ? "out" : credit !== undefined ? "in" : "unknown",
      confidence: "none",
      status: "draft",
      categoryId: null,
      row: candidate.row,
    };
  });
}

/** Signed minor units (credit − debit). Sign is a direction fact, never a
 *  type inference. */
export function toSignedMinor(transaction: NormalizedBankTransaction): number {
  return (transaction.creditAmount ?? 0) - (transaction.debitAmount ?? 0);
}

/** Amount-integrity gate for normalized transactions (structural sanity only
 *  — NO magnitude caps, so large but well-formed amounts like
 *  ₦2,607,010,201,000.00 pass). Catches the corruption a misaligned
 *  statement row can produce: references/balance values landing in money
 *  columns, or non-finite/negative amounts. `singleSided` banks (columnar
 *  debit/credit tables) must never carry both sides on one row. */
export type AmountSanityResult =
  | { ok: true }
  | {
      ok: false;
      /** Stable machine-readable reason: "invalid amount" or
       *  "conflicting debit and credit". */
      reason: string;
    };

export function checkAmountSanity(
  transaction: Pick<
    NormalizedBankTransaction,
    "debitAmount" | "creditAmount" | "balanceAfter"
  >,
  options?: { singleSided?: boolean },
): AmountSanityResult {
  const amounts = [
    transaction.debitAmount,
    transaction.creditAmount,
    transaction.balanceAfter,
  ];
  if (amounts.some((amount) => amount !== undefined && (!Number.isFinite(amount) || amount < 0))) {
    return { ok: false, reason: "invalid amount" };
  }
  if (
    options?.singleSided &&
    transaction.debitAmount !== undefined &&
    transaction.creditAmount !== undefined
  ) {
    return { ok: false, reason: "conflicting debit and credit" };
  }
  return { ok: true };
}

function capDescription(value: string): string {
  return value.length > MAX_ORIGINAL_DESCRIPTION_LENGTH
    ? value.slice(0, MAX_ORIGINAL_DESCRIPTION_LENGTH)
    : value;
}