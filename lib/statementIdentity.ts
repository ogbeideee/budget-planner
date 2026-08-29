// Statement-vs-ledger duplicate identity (Prompt 5B).
//
// Decides, deterministically, whether a review row is the SAME transaction as
// one already in the ledger:
//
//   - "already-imported"  — the row IS in the ledger (confirmed).
//   - "possible-duplicate" — strong but ambiguous overlap (amount + date, or
//     amount + description, with a detail missing or conflicting); the user
//     decides whether to keep or skip it.
//   - "new"               — no match.
//
// Identity fields (Prompt 5B §2): bank, transaction date, amount, debit/
// credit direction, reference, normalized description. Amount alone NEVER
// matches — two separate ₦1,000 transactions are not duplicates.
//
// Reference rules (authoritative, consistent with 3E/5A):
//   - A ledger transaction WITH a stored reference is matched ONLY by that
//     reference (same bank + same amount + same direction). The fallback
//     signals never run against referenced ledger rows, so they stay
//     unambiguous.
//   - A row whose reference differs from a ledger row's reference is a
//     DIFFERENT transaction — banks distinguish two same-day same-amount
//     payments by their references.
//   - Only reference-less ledger rows (manual entries, or imports without a
//     reference) fall back to amount + date + description signals.

import type { Transaction } from "./types";
import { daysBetween } from "./date";
import type { BankSource } from "./statementTypes";

export type DuplicateStatus = "new" | "already-imported" | "possible-duplicate";

export const DUPLICATE_SIGNALS = {
  /** Same bank + amount + direction + normalized reference. */
  SAME_REFERENCE: "same-reference",
  /** Same bank + amount + direction + date + normalized description. */
  SAME_DETAILS: "same-transaction-details",
  /** Same bank + amount + direction + date; description/reference absent or
   *  conflicting. */
  SAME_DATE_AND_AMOUNT: "same-date-and-amount",
  /** Same bank + amount + direction + description; date absent or
   *  conflicting. */
  SAME_DESCRIPTION_AND_AMOUNT: "same-description-and-amount",
} as const;

export type DuplicateSignal =
  (typeof DUPLICATE_SIGNALS)[keyof typeof DUPLICATE_SIGNALS];

export interface DuplicateMatch {
  status: DuplicateStatus;
  /** Why the match was made (undefined when status is "new"). */
  signal?: DuplicateSignal;
  /** The ledger transaction this row matched, when any. */
  matchedTransactionId?: string;
}

/** The slice of an import row the identity matcher needs. */
export interface IdentityRow {
  transactionDate: string | null;
  description: string;
  debitAmount?: number;
  creditAmount?: number;
  sourceBank: BankSource;
  reference?: string;
}

export type LedgerTransactionSlice = Pick<
  Transaction,
  "id" | "amount" | "type" | "date" | "note" | "importSource"
>;

function normalizeReference(value: string | undefined): string | undefined {
  const reference = value?.trim();
  if (!reference) return undefined;
  return reference.toUpperCase().replace(/\s+/g, " ");
}

function normalizeDescription(value: string | undefined): string | undefined {
  const description = String(value ?? "").trim();
  if (description === "") return undefined;
  return description.toLowerCase().replace(/\s+/g, " ");
}

/** The ledger's side of a debit/credit direction. */
function ledgerDirection(type: Transaction["type"]): "out" | "in" {
  return type === "expense" ? "out" : "in";
}

/** Both banks participate only when both are known; a manual (no import
 *  provenance) or unknown-bank row can't contradict the other side. */
function banksMatch(rowBank: BankSource, existingBank: string | undefined): boolean {
  if (rowBank === "unknown") return true;
  if (!existingBank || existingBank === "unknown") return true;
  return rowBank === existingBank;
}

/**
 * Matches one review row against the existing ledger. Deterministic — same
 * input, same verdict. Confirmed matches win over possible ones; the first
 * confirmed (then the first possible) match is reported.
 */
export function matchExistingTransaction(
  row: IdentityRow,
  existing: readonly LedgerTransactionSlice[],
): DuplicateMatch {
  const amount = row.debitAmount ?? row.creditAmount;
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return { status: "new" };
  }
  const rowDirection = row.debitAmount !== undefined ? "out" : "in";

  const rowReference = normalizeReference(row.reference);
  const rowDescription = normalizeDescription(row.description);

  let possible: DuplicateMatch | null = null;

  for (const transaction of existing) {
    if (transaction.amount !== amount) continue;
    if (ledgerDirection(transaction.type) !== rowDirection) continue;
    if (!banksMatch(row.sourceBank, transaction.importSource?.bank)) continue;

    const existingReference = normalizeReference(transaction.importSource?.reference);

    if (existingReference !== undefined) {
      // Referenced ledger rows are matched ONLY by their reference.
      if (
        rowReference !== undefined &&
        rowReference === existingReference
      ) {
        return {
          status: "already-imported",
          signal: DUPLICATE_SIGNALS.SAME_REFERENCE,
          matchedTransactionId: transaction.id,
        };
      }
      continue;
    }

    // Reference-less ledger rows fall back to the detail signals.
    const sameDate =
      row.transactionDate !== null && row.transactionDate === transaction.date;
    const sameDescription =
      rowDescription !== undefined &&
      rowDescription === normalizeDescription(transaction.note);

    if (sameDate && sameDescription) {
      return {
        status: "already-imported",
        signal: DUPLICATE_SIGNALS.SAME_DETAILS,
        matchedTransactionId: transaction.id,
      };
    }
    if (
      possible === null &&
      sameDate &&
      !sameDescription
    ) {
      possible = {
        status: "possible-duplicate",
        signal: DUPLICATE_SIGNALS.SAME_DATE_AND_AMOUNT,
        matchedTransactionId: transaction.id,
      };
      continue;
    }
    if (possible === null && sameDescription) {
      possible = {
        status: "possible-duplicate",
        signal: DUPLICATE_SIGNALS.SAME_DESCRIPTION_AND_AMOUNT,
        matchedTransactionId: transaction.id,
      };
    }
  }

  return possible ?? { status: "new" };
}

/* ---------------------------------------------------------------------------
 * Own-account (internal) transfer detection across statements.
 *
 * `matchExistingTransaction` answers "is this row the SAME ledger
 * transaction?" — it only ever compares the SAME side (debit↔expense,
 * credit↔income). An internal transfer between the user's own accounts is
 * the opposite shape: an amount LEAVING the statement being imported shows
 * up in the ledger as an INCOME (it arrived in the other account), or an
 * amount ARRIVING pairs with a ledger EXPENSE. Same amount, opposite side,
 * a couple of days apart — that is a debit/credit pair across two of the
 * user's own statements, not spending and not earning.
 *
 * Deliberately conservative so a genuine external transaction is never
 * flagged: the amount must match EXACTLY (no tolerance), the dates must sit
 * within TRANSFER_COUNTERPART_WINDOW_DAYS, and the caller only applies the
 * result where classification had no narration signal (an "unknown" row) —
 * a confident "SALARY" narration always beats a coincidental same-amount
 * ledger entry. Like everything here it is a SUGGESTION: the review row
 * keeps its editable type dropdown.
 * ------------------------------------------------------------------------- */

/** Days either side of the row's date a counterpart may sit. Own-account
 *  transfers settle same-day or next-day in practice; a wide window would
 *  flag coincidental same-amount external transactions. */
export const TRANSFER_COUNTERPART_WINDOW_DAYS = 2;

export interface CounterpartMatch {
  /** Ledger transaction that pairs with the statement row. */
  ledgerId: string;
  /** The ledger row's side — "income" for an outflow row, "expense" for
   *  an inflow row. */
  ledgerType: "income" | "expense";
  /** Ledger row's ISO date (for the review-screen hint). */
  date: string;
  /** Ledger amount in minor units (equals the row's amount). */
  amount: number;
  /** |row date − ledger date| in days, 0 = same day. */
  daysApart: number;
}

/**
 * Finds the ledger transaction that most plausibly pairs with this row as
 * the other side of a transfer between the user's own accounts. Pure and
 * deterministic: strongest match wins (fewest days apart, then lowest ledger
 * id); null when nothing pairs.
 */
export function findCounterpartTransfer(
  row: IdentityRow,
  existing: readonly LedgerTransactionSlice[],
  windowDays: number = TRANSFER_COUNTERPART_WINDOW_DAYS,
): CounterpartMatch | null {
  const amount = row.debitAmount ?? row.creditAmount;
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (row.transactionDate === null) return null;
  // An outflow pairs with a ledger INCOME (it arrived somewhere); an inflow
  // pairs with a ledger EXPENSE (it left somewhere).
  const counterpartType = row.debitAmount !== undefined ? "income" : "expense";

  let best: CounterpartMatch | null = null;
  for (const transaction of existing) {
    if (transaction.type !== counterpartType) continue;
    if (transaction.amount !== amount) continue;
    const apart = Math.abs(daysBetween(row.transactionDate, transaction.date));
    if (apart > windowDays) continue;
    if (
      best === null ||
      apart < best.daysApart ||
      (apart === best.daysApart && transaction.id < best.ledgerId)
    ) {
      best = {
        ledgerId: transaction.id,
        ledgerType: counterpartType,
        date: transaction.date,
        amount,
        daysApart: apart,
      };
    }
  }
  return best;
}
