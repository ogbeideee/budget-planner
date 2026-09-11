// Pending email-alert review drafts (FR-24, sync stage).
//
// Parsed alerts that the user must confirm live HERE — a small, non-ledger
// record stored through the single persistence seam (SQLite on desktop,
// localStorage in the browser) under its own key, deliberately NOT part of
// AppState: it references no category ids beyond the row's own suggestion,
// survives an import/restore of the ledger untouched, and needs no schema
// migration. Once a draft is imported or rejected it is removed; only
// needs-review / uncertain items are retained.
//
// The ledger source of truth is unchanged: nothing here is ever written to a
// transaction store. The UI takes the draft row through the existing
// `planImport` -> `addTransactions` confirm step, exactly like a statement.
import { getStorageBackend } from "./storageAdapter";
import type { AlertField, Institution } from "./emailAlerts";
import type { ImportRow } from "./statementPipeline";
import type { CategorySuggestion } from "./learnedRules";

export const EMAIL_DRAFTS_STORAGE_KEY = "budget-planner:email-drafts";

/** A duplicate candidate kept for the review UI (a stable slice of the
 *  pipeline's full DuplicateCandidate — the existing transaction's note is
 *  enough for the user to decide; the engine re-runs planImport on import). */
export interface PendingDuplicate {
  existingId: string;
  score: number;
  note?: string;
}

/** The persisted shape of a draft awaiting review. JSON-safe by construction. */
export interface PendingEmailDraft {
  messageId: string;
  institution: Institution;
  label: string;
  /** The ImportRow the pipeline produced. Not persisted anywhere else. */
  row: ImportRow;
  needsReview?: {
    missing: AlertField[];
    snippet: string;
  };
  suggestion?: {
    categoryId: string;
    match: CategorySuggestion["match"];
    confident: boolean;
  };
  duplicates: PendingDuplicate[];
  /** True when the date came from the mail header rather than the body. */
  dateFromHeader: boolean;
  createdAt: string;
}

const MESSAGE_ID_MAX = 120;

function isInstitution(value: unknown): value is Institution {
  return (
    typeof value === "string" &&
    /^(gtbank|wema|quickmfb|zenith|access|uba|kuda|moniepoint|palmpay|opay)$/.test(
      value,
    )
  );
}

function isObj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Defensive normalization of a persisted draft; malformed entries are
 *  dropped rather than crashing the app (same policy as the validator). */
export function normalizePendingDraft(raw: unknown): PendingEmailDraft | null {
  if (!isObj(raw)) return null;
  if (
    typeof raw.messageId !== "string" ||
    raw.messageId.length === 0 ||
    raw.messageId.length > MESSAGE_ID_MAX
  ) {
    return null;
  }
  if (!isInstitution(raw.institution)) return null;
  if (typeof raw.label !== "string") return null;
  if (!isObj(raw.row)) return null;
  const row = raw.row as unknown as ImportRow;
  if (typeof row.id !== "string" || typeof row.description !== "string") {
    return null; // planImport needs at least a stable id + a description
  }

  const needsReview =
    isObj(raw.needsReview) &&
    Array.isArray(raw.needsReview.missing) &&
    raw.needsReview.missing.every(
      (field) =>
        typeof field === "string" &&
        ["amount", "direction", "description", "date"].includes(field),
    ) &&
    typeof raw.needsReview.snippet === "string"
      ? {
          missing: raw.needsReview.missing as AlertField[],
          snippet: raw.needsReview.snippet,
        }
      : undefined;

  const suggestion =
    isObj(raw.suggestion) &&
    typeof raw.suggestion.categoryId === "string" &&
    (raw.suggestion.match === "exact" ||
      raw.suggestion.match === "fuzzy" ||
      raw.suggestion.match === "provider" ||
      raw.suggestion.match === "merchant" ||
      raw.suggestion.match === "description")
      ? {
          categoryId: raw.suggestion.categoryId,
          match: raw.suggestion.match as CategorySuggestion["match"],
          confident: raw.suggestion.confident === true,
        }
      : undefined;

  const duplicates = Array.isArray(raw.duplicates)
    ? raw.duplicates
        .filter(
          (entry) =>
            isObj(entry) &&
            typeof entry.existingId === "string" &&
            typeof entry.score === "number",
        )
        .map((entry) => ({
          existingId: entry.existingId as string,
          score: entry.score as number,
          ...(typeof entry.note === "string" && entry.note.length > 0
            ? { note: entry.note as string }
            : {}),
        }))
        .slice(0, 20)
    : [];

  return {
    messageId: raw.messageId,
    institution: raw.institution,
    label: raw.label,
    row: {
      ...(row as ImportRow),
      // Keep the persisted copy harmless: excluded defaults false for
      // planImport semantics, duplicate decisions come from the UI at import.
      id: row.id,
      type: row.type ?? "unknown",
      direction: row.direction ?? "unknown",
      categoryId: typeof row.categoryId === "string" ? row.categoryId : null,
      transactionDate:
        typeof row.transactionDate === "string" ? row.transactionDate : null,
      description: row.description,
      excluded: false,
      sourceBank: row.sourceBank ?? "other",
    },
    ...(needsReview ? { needsReview } : {}),
    ...(suggestion ? { suggestion } : {}),
    duplicates,
    dateFromHeader: raw.dateFromHeader === true,
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

/** Loads the pending queue. Corrupt/absent data → empty list, never throws. */
export function loadEmailDrafts(): PendingEmailDraft[] {
  try {
    const raw = getStorageBackend().getItem(EMAIL_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePendingDraft).filter((draft) => draft !== null);
  } catch {
    return [];
  }
}

/** Persists the queue. A failed write must never block a review flow — the
 *  worst case is the draft reappearing after a restart (main's mailbox-level
 *  dedupe already prevents a re-download; the draft is just re-offered). */
export function saveEmailDrafts(drafts: readonly PendingEmailDraft[]): void {
  try {
    getStorageBackend().setItem(
      EMAIL_DRAFTS_STORAGE_KEY,
      JSON.stringify(drafts),
    );
  } catch {
    // same reasoning as loadEmailDrafts
  }
}

/** Removes the whole queue (used when an account disconnects). */
export function clearEmailDrafts(): void {
  try {
    getStorageBackend().removeItem(EMAIL_DRAFTS_STORAGE_KEY);
  } catch {
    // non-critical cleanup
  }
}