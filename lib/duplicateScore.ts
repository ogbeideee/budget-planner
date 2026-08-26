import { daysBetween } from "./date";
import { keySimilarity, normalizeRuleKey } from "./learnedRules";

/**
 * Duplicate-likelihood scoring (FR-23).
 *
 * Pure and deterministic: no store access, no I/O, no AI. Deliberately NOT
 * tied to statement import — it takes plain values, so the planned
 * email-alert parser (and any future import source) can score against the
 * same ledger without a second, divergent implementation.
 *
 * The output is a SCORE, not a boolean, because "same amount, same day" and
 * "same amount, last week" deserve very different amounts of suspicion, and a
 * boolean cannot express that difference to the user or to the caller.
 */

/* ------------------------------------------------------------------------ */
/* Tunables — every threshold lives here, and nowhere else                    */
/* ------------------------------------------------------------------------ */

/** Days either side of the incoming date that are considered at all.
 *  Outside this window nothing is compared and no match is produced. */
export const DUPLICATE_DATE_WINDOW_DAYS = 2;

/** Score at or above which a row is flagged for explicit resolution. */
export const DUPLICATE_FLAG_THRESHOLD = 0.6;

/** Relative amount difference still treated as "near-match" (1%). */
export const DUPLICATE_AMOUNT_TOLERANCE = 0.01;

/** Component weights. They sum to 1, so a score reads as a percentage. */
export const DUPLICATE_WEIGHTS = {
  amountExact: 0.45,
  amountNear: 0.3,
  sameDay: 0.25,
  description: 0.25,
  sameCategory: 0.05,
} as const;

/**
 * Multiplier applied when both descriptions are substantial and share NO
 * words at all.
 *
 * Without this, two unrelated round-number transactions on the same day
 * ("₦5,000 to a friend" and "₦5,000 for fuel") score amount + date alone and
 * clear the threshold on coincidence. Having nothing in common textually is
 * positive evidence they are DIFFERENT transactions, so it must pull the
 * score down rather than merely fail to push it up.
 */
export const DUPLICATE_CONFLICT_PENALTY = 0.5;

/** Minimum tokens a description needs before its disagreement counts as
 *  evidence. A one-word note ("Groceries") is too thin to argue from. */
const MIN_TOKENS_FOR_CONFLICT = 2;

/* ------------------------------------------------------------------------ */
/* Types                                                                      */
/* ------------------------------------------------------------------------ */

/** An incoming transaction from any import source. */
export interface IncomingTransaction {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  /** Minor units, > 0. */
  amount: number;
  direction: "in" | "out";
  description: string;
  /** Set only once the row has been categorized. */
  categoryId?: string | null;
  /** The source's own reference, when it has one. */
  reference?: string;
}

/** The fields of an existing ledger transaction this needs. Manual entries
 *  and previously-imported ones are both compared — a manual entry simply has
 *  no `reference`. */
export interface ExistingTransaction {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  note?: string;
  categoryId?: string;
  reference?: string;
}

/** Why a score came out as it did — shown to the user, not just logged. */
export interface DuplicateReasons {
  amount: "exact" | "near" | "different";
  daysApart: number;
  descriptionSimilarity: number;
  sameCategory: boolean;
  /** True when the conflicting-description penalty was applied. */
  descriptionsConflict: boolean;
  /** True when both sides carry the same source reference — a certainty. */
  sameReference: boolean;
}

export interface DuplicateCandidate {
  existing: ExistingTransaction;
  /** 0..1. Compare against `DUPLICATE_FLAG_THRESHOLD`. */
  score: number;
  reasons: DuplicateReasons;
}

/* ------------------------------------------------------------------------ */
/* Scoring                                                                    */
/* ------------------------------------------------------------------------ */

function directionOf(type: ExistingTransaction["type"]): "in" | "out" {
  return type === "income" ? "in" : "out";
}

/** Exact, within tolerance, or neither. */
function amountAgreement(a: number, b: number): DuplicateReasons["amount"] {
  if (a === b) return "exact";
  const larger = Math.max(a, b);
  if (larger === 0) return "different";
  return Math.abs(a - b) / larger <= DUPLICATE_AMOUNT_TOLERANCE
    ? "near"
    : "different";
}

/** Date closeness, tapering to zero at the edge of the window. */
function dateScore(daysApart: number): number {
  if (daysApart === 0) return DUPLICATE_WEIGHTS.sameDay;
  const decay = 1 - daysApart / (DUPLICATE_DATE_WINDOW_DAYS + 1);
  return DUPLICATE_WEIGHTS.sameDay * decay;
}

/**
 * Scores one incoming transaction against one existing transaction.
 *
 * Returns `null` — not a zero — when the pair is not comparable at all
 * (opposite directions, outside the date window, amounts unrelated). That
 * keeps "we looked and it is not a match" distinct from "we never looked".
 */
export function scoreDuplicate(
  incoming: IncomingTransaction,
  existing: ExistingTransaction,
  windowDays: number = DUPLICATE_DATE_WINDOW_DAYS,
): DuplicateCandidate | null {
  // Money in is never money out, whatever else agrees.
  if (directionOf(existing.type) !== incoming.direction) return null;

  const daysApart = Math.abs(daysBetween(incoming.date, existing.date));
  if (daysApart > windowDays) return null;

  const amount = amountAgreement(incoming.amount, existing.amount);
  if (amount === "different") return null;

  // Descriptions are normalized with the SAME function the categorization
  // learning uses, so "the same merchant" means one thing across the app.
  const incomingKey = normalizeRuleKey(incoming.description);
  const existingKey = normalizeRuleKey(existing.note ?? "");
  const descriptionSimilarity = keySimilarity(incomingKey, existingKey);

  const sameReference =
    incoming.reference !== undefined &&
    existing.reference !== undefined &&
    normalizeRuleKey(incoming.reference) === normalizeRuleKey(existing.reference) &&
    normalizeRuleKey(incoming.reference).length > 0;

  const sameCategory =
    incoming.categoryId !== undefined &&
    incoming.categoryId !== null &&
    existing.categoryId !== undefined &&
    incoming.categoryId === existing.categoryId;

  const tokenCount = (key: string) =>
    key.split(" ").filter((token) => token.length > 0).length;
  const descriptionsConflict =
    descriptionSimilarity === 0 &&
    tokenCount(incomingKey) >= MIN_TOKENS_FOR_CONFLICT &&
    tokenCount(existingKey) >= MIN_TOKENS_FOR_CONFLICT;

  const reasons: DuplicateReasons = {
    amount,
    daysApart,
    descriptionSimilarity,
    sameCategory,
    descriptionsConflict,
    sameReference,
  };

  // The source's own reference is an identity, not a hint: if both sides
  // carry the same one it IS the same transaction.
  if (sameReference) {
    return { existing, score: 1, reasons };
  }

  let score =
    (amount === "exact"
      ? DUPLICATE_WEIGHTS.amountExact
      : DUPLICATE_WEIGHTS.amountNear) +
    dateScore(daysApart) +
    descriptionSimilarity * DUPLICATE_WEIGHTS.description +
    (sameCategory ? DUPLICATE_WEIGHTS.sameCategory : 0);

  if (descriptionsConflict) score *= DUPLICATE_CONFLICT_PENALTY;

  return { existing, score: Math.min(1, Math.round(score * 1000) / 1000), reasons };
}

export interface FindDuplicatesOptions {
  windowDays?: number;
  threshold?: number;
  /** Ledger ids to ignore — e.g. rows written earlier in this same batch. */
  exclude?: ReadonlySet<string>;
}

/**
 * Every existing transaction that looks like `incoming`, strongest first.
 *
 * Returns ALL candidates above the threshold rather than only the best one,
 * because the review UI shows the user what it matched against and a genuine
 * double-entry can have produced more than one existing row.
 */
export function findDuplicateCandidates(
  incoming: IncomingTransaction,
  existing: readonly ExistingTransaction[],
  options: FindDuplicatesOptions = {},
): DuplicateCandidate[] {
  const {
    windowDays = DUPLICATE_DATE_WINDOW_DAYS,
    threshold = DUPLICATE_FLAG_THRESHOLD,
    exclude,
  } = options;

  const matches: DuplicateCandidate[] = [];
  for (const entry of existing) {
    if (exclude?.has(entry.id)) continue;
    const scored = scoreDuplicate(incoming, entry, windowDays);
    if (scored && scored.score >= threshold) matches.push(scored);
  }
  return matches.sort(
    (a, b) => b.score - a.score || (a.existing.id < b.existing.id ? -1 : 1),
  );
}

/** True when `incoming` should be flagged for explicit resolution. */
export function isLikelyDuplicate(
  incoming: IncomingTransaction,
  existing: readonly ExistingTransaction[],
  options: FindDuplicatesOptions = {},
): boolean {
  return findDuplicateCandidates(incoming, existing, options).length > 0;
}

/** "Same amount, same day" / "Within 1%, 2 days apart" — one plain line
 *  explaining a flag, for the review UI. */
export function describeDuplicateReasons(reasons: DuplicateReasons): string {
  if (reasons.sameReference) return "Same bank reference";
  const parts: string[] = [
    reasons.amount === "exact" ? "Same amount" : "Amount within 1%",
    reasons.daysApart === 0
      ? "same day"
      : `${reasons.daysApart} day${reasons.daysApart === 1 ? "" : "s"} apart`,
  ];
  if (reasons.descriptionSimilarity >= 0.5) parts.push("similar description");
  if (reasons.sameCategory) parts.push("same category");
  return parts.join(" · ");
}
