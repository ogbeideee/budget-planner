import { findDuplicateCandidates, type DuplicateCandidate, type ExistingTransaction } from "./duplicateScore";
import { suggestCategory, type CategorySuggestion } from "./learnedRules";
import type { AlertField, Institution, ParsedAlert, UnparsedAlert } from "./emailAlerts";
import type { ImportRow } from "./statementPipeline";
import type { Category, LearnedRule } from "./types";

/**
 * Turns parsed bank-alert emails into draft rows for the existing review flow
 * (FR-24, requirements 6 and 7).
 *
 * This module deliberately owns NO categorization and NO duplicate logic of
 * its own. It calls `suggestCategory` (lib/learnedRules.ts) and
 * `findDuplicateCandidates` (lib/duplicateScore.ts) — the exact modules the
 * statement importer uses — so an email-sourced transaction is categorized and
 * de-duplicated by the same rules, and a correction learned from one source
 * benefits the other. Growing a second engine here was the main thing to avoid.
 *
 * Output rows are `ImportRow`-shaped, so they feed `planImport` unchanged and
 * inherit the whole confirm step: nothing reaches the ledger without the user
 * approving the batch.
 */

/** An email-sourced draft: the shared row plus what the review UI needs. */
export interface EmailDraft {
  /** Fed straight to `planImport`. */
  row: ImportRow;
  messageId: string;
  institution: Institution;
  label: string;
  /**
   * Present when the parser could not extract every required field. The row
   * is still produced and still shown — never dropped — but it cannot be
   * imported until the user completes it.
   */
  needsReview?: {
    missing: AlertField[];
    /** Body excerpt, so the user can see what actually arrived. */
    snippet: string;
  };
  /** Learned-rule suggestion, when one applied. */
  suggestion?: {
    categoryId: string;
    match: CategorySuggestion["match"];
    /** False for a single-correction candidate: pre-fill, but still review. */
    confident: boolean;
  };
  /** Existing ledger rows this may duplicate, strongest first. */
  duplicates: DuplicateCandidate[];
  /** True when the date came from the mail header rather than the body. */
  dateFromHeader: boolean;
}

export interface BuildEmailDraftsInput {
  alerts: ReadonlyArray<ParsedAlert | UnparsedAlert>;
  categories: readonly Category[];
  learnedRules: readonly LearnedRule[];
  /** The ledger as it stands, for duplicate scoring. */
  existing: readonly ExistingTransaction[];
  /** Message ids already turned into drafts or imported before, so a repeat
   *  sync does not re-offer the same alert. */
  seenMessageIds?: ReadonlySet<string>;
}

/** Stable row id derived from the message id, so re-running is idempotent. */
function rowId(messageId: string): string {
  return `email:${messageId}`;
}

function institutionToBank(institution: Institution): ImportRow["sourceBank"] {
  // The statement pipeline's BankSource covers the banks it can parse
  // statements for; anything else is "other". An email alert is not a
  // statement, so this is provenance only and never affects matching.
  switch (institution) {
    case "kuda":
      return "kuda";
    case "opay":
      return "opay";
    case "palmpay":
      return "palmpay";
    case "gtbank":
      return "gtco";
    default:
      return "other";
  }
}

/**
 * Builds one draft per alert.
 *
 * `needs-review` alerts produce a row too — with whatever WAS parsed and a
 * null category — so a half-readable alert is visible and completable rather
 * than vanishing (requirement 9).
 */
export function buildEmailDrafts({
  alerts,
  categories,
  learnedRules,
  existing,
  seenMessageIds,
}: BuildEmailDraftsInput): EmailDraft[] {
  const drafts: EmailDraft[] = [];

  for (const alert of alerts) {
    if (seenMessageIds?.has(alert.messageId)) continue;

    const parsed = alert.status === "parsed";
    const description = parsed ? alert.description : (alert.partial.description ?? "");
    const direction = parsed ? alert.direction : alert.partial.direction;
    const amount = parsed ? alert.amount : alert.partial.amount;
    const date = parsed ? alert.date : alert.partial.date;

    // Categorization — the SAME engine the importer uses. Skipped when there
    // is no description to match on.
    const suggestion =
      description.length > 0
        ? suggestCategory(
            { description, merchant: description, direction },
            learnedRules,
            categories,
          )
        : null;

    // Duplicate scoring — again the shared module, so an alert that mirrors a
    // transaction the user typed by hand is caught exactly as an imported row
    // would be. Only scoreable once amount, direction and date are known.
    const duplicates =
      amount !== undefined && direction !== undefined && date !== undefined
        ? findDuplicateCandidates(
            {
              date,
              amount,
              direction,
              description,
              categoryId: suggestion?.category.id ?? null,
            },
            existing,
          )
        : [];

    const row: ImportRow = {
      id: rowId(alert.messageId),
      type: direction === "in" ? "income" : direction === "out" ? "expense" : "unknown",
      direction: direction ?? "unknown",
      categoryId: suggestion?.category.id ?? null,
      transactionDate: date ?? null,
      description,
      ...(direction === "out" && amount !== undefined ? { debitAmount: amount } : {}),
      ...(direction === "in" && amount !== undefined ? { creditAmount: amount } : {}),
      excluded: false,
      sourceBank: institutionToBank(alert.institution),
      originalDescription: description,
      // A flagged duplicate must be answered before the batch can be imported,
      // exactly as with a statement row.
      ...(duplicates.length > 0
        ? { duplicateResolution: "unresolved" as const, duplicateOfId: duplicates[0].existing.id }
        : {}),
    };

    drafts.push({
      row,
      messageId: alert.messageId,
      institution: alert.institution,
      label: alert.label,
      ...(alert.status === "needs-review"
        ? { needsReview: { missing: alert.missing, snippet: alert.snippet } }
        : {}),
      ...(suggestion
        ? {
            suggestion: {
              categoryId: suggestion.category.id,
              match: suggestion.match,
              confident: suggestion.confident,
            },
          }
        : {}),
      duplicates,
      dateFromHeader: alert.status === "parsed" ? alert.dateFromHeader : false,
    });
  }

  return drafts;
}

/** Drafts that cannot be imported yet: a parse gap or an unanswered duplicate. */
export function blockedDrafts(drafts: readonly EmailDraft[]): EmailDraft[] {
  return drafts.filter(
    (draft) =>
      draft.needsReview !== undefined ||
      draft.row.duplicateResolution === "unresolved" ||
      draft.row.categoryId === null,
  );
}
