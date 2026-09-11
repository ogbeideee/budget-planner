// Mapper between the pipeline's EmailDraft and the persisted pending draft.
// The pipeline output is intentionally left untouched; only the persisted
// slice is built here (JSON-safe, capped duplicates).
import type { EmailDraft } from "./emailPipeline";
import type { PendingEmailDraft } from "./emailDrafts";

/** Converts one pipeline draft into its persisted review shape. */
export function toPendingDraft(draft: EmailDraft): PendingEmailDraft {
  return {
    messageId: draft.messageId,
    institution: draft.institution,
    label: draft.label,
    row: draft.row,
    ...(draft.needsReview ? { needsReview: draft.needsReview } : {}),
    ...(draft.suggestion
      ? {
          suggestion: {
            categoryId: draft.suggestion.categoryId,
            match: draft.suggestion.match,
            confident: draft.suggestion.confident,
          },
        }
      : {}),
    duplicates: draft.duplicates.slice(0, 20).map((duplicate) => ({
      existingId: duplicate.existing.id,
      score: duplicate.score,
      ...(duplicate.existing.note ? { note: duplicate.existing.note } : {}),
    })),
    dateFromHeader: draft.dateFromHeader,
    createdAt: new Date().toISOString(),
  };
}