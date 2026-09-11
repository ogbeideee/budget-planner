// Renderer-side email sync client (FR-24, sync stage) — the ONLY place that
// turns delivered mailbox messages into ledger drafts and import decisions.
//
// Everything here is PURE: it takes AlertEmail-shaped messages plus the live
// store data it needs, and returns what to auto-import and what to review. The
// IMAP networking, credential decryption and message fetching all stay in the
// Electron main process (electron/emailSync.cjs); this module never opens a
// socket and never sees a password.
//
// It reuses the existing engines verbatim:
//   parseAlerts()       -> sender allowlist + institution templates (VERIFIED
//                          for GTBank / Wema / Quick MFB — untouched)
//   buildEmailDrafts()  -> categorization (suggestCategory) + duplicate
//                          scoring (findDuplicateCandidates) + ImportRow
//                          generation — NOT reimplemented here
//   planImport()        -> the same confirm/write planner statement import uses
//
// The auto-vs-review split uses the EXISTING semantics, never a new threshold:
//   AUTO  = fully parsed (no needsReview) AND a confident learned-rule
//           suggestion (strength >= RULE_MIN_STRENGTH — the existing
//           auto-apply cut) AND a category AND no unanswered duplicate.
//   REVIEW = everything else: a parse gap, an uncertain/absent suggestion, no
//           category, or a flagged duplicate that must be explicitly resolved.
import { parseAlerts, type AlertEmail } from "./emailAlerts";
import { buildEmailDrafts, type EmailDraft } from "./emailPipeline";
import { planImport, type ImportRow, type ImportPlan } from "./statementPipeline";
import type { Category, LearnedRule, Transaction } from "./types";
import type { ExistingTransaction } from "./duplicateScore";
import type { LedgerTransactionSlice } from "./statementIdentity";

export type { ImportPlan };

export interface ProcessDeliveredEmailsInput {
  emails: readonly AlertEmail[];
  categories: readonly Category[];
  learnedRules: readonly LearnedRule[];
  existing: readonly ExistingTransaction[];
  /** Message ids already turned into drafts this session — a second-line guard
   *  on top of main's mailbox-level dedupe. */
  seenMessageIds?: ReadonlySet<string>;
}

export interface ProcessDeliveredEmailsOutput {
  /** Drafts that qualify for automatic import (fully parsed + confident). */
  auto: EmailDraft[];
  /** Drafts that must go through the review UI before anything is written. */
  review: EmailDraft[];
  /** Every delivered message id — handed back to main via confirmProcessed
   *  once the renderer has applied or queued them, so the next poll does not
   *  re-download them (mailbox-level dedupe). */
  messageIds: string[];
}

/**
 * The auto-import qualification. Deliberately strict and written in terms of
 * the pipeline's own signals:
 *  - `needsReview` undefined → the parser extracted every field.
 *  - no category → the ledger requires one; never guess.
 *  - `duplicateResolution === "unresolved"` → FR-23: an unanswered duplicate
 *    must never be silently imported OR silently discarded.
 *  - `suggestion.confident` → the existing auto-apply cut (strength >=
 *    RULE_MIN_STRENGTH = 2, meaning the user has confirmed the mapping at
 *    least twice across imports).
 */
export function isAutoImportable(draft: EmailDraft): boolean {
  if (draft.needsReview !== undefined) return false;
  if (draft.row.categoryId === null) return false;
  if (draft.row.duplicateResolution === "unresolved") return false;
  return draft.suggestion?.confident === true;
}

/** Maps the ledger onto the duplicate scorer's plain shapes (same fields the
 *  email pipeline's `existing` input expects — manual and imported rows alike). */
export function existingFromLedger(
  transactions: readonly Transaction[],
): ExistingTransaction[] {
  return transactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    amount: tx.amount,
    type: tx.type === "income" ? "income" : "expense",
    ...(tx.note !== undefined ? { note: tx.note } : {}),
    ...(tx.categoryId !== undefined ? { categoryId: tx.categoryId } : {}),
    ...(tx.importSource?.reference
      ? { reference: tx.importSource.reference }
      : {}),
  }));
}

/**
 * Runs the shared pipeline over a delivered batch and splits the outcome.
 *
 * The flow (each step already exists and is reused, never duplicated):
 *   AlertEmail[] → parseAlerts() → buildEmailDrafts() →
 *   isAutoImportable() split → auto rows go through planImport at the call
 *   site (so the ledger-identity check still runs); review rows are queued.
 */
export function processDeliveredEmails(
  input: ProcessDeliveredEmailsInput,
): ProcessDeliveredEmailsOutput {
  const alerts = parseAlerts(input.emails);
  const drafts = buildEmailDrafts({
    alerts,
    categories: input.categories,
    learnedRules: input.learnedRules,
    existing: input.existing,
    seenMessageIds: input.seenMessageIds,
  });

  const auto: EmailDraft[] = [];
  const review: EmailDraft[] = [];
  for (const draft of drafts) {
    if (isAutoImportable(draft)) auto.push(draft);
    else review.push(draft);
  }

  return {
    auto,
    review,
    messageIds: input.emails.map((email) => String(email.id)),
  };
}

/** Plans the auto-import batch through the SAME planner statement import uses
 *  (`planImport`). This is when the ledger-identity check actually runs: a row
 *  the statement path would call "already imported" is skipped here too, and a
 *  row missing a category/date is skipped rather than guessed. `existing` is
 *  the raw ledger (Transaction[] satisfies LedgerTransactionSlice). */
export function planEmailAutoImport(
  drafts: readonly EmailDraft[],
  existing: readonly LedgerTransactionSlice[],
): ImportPlan {
  return planImport(
    drafts.map((draft) => draft.row),
    [],
    existing,
  );
}

/** Plans ONE review-edit after the user has completed/confirmed it. */
export function planEmailDraftImport(
  row: ImportRow,
  existing: readonly LedgerTransactionSlice[],
): ImportPlan {
  return planImport([row], [], existing);
}