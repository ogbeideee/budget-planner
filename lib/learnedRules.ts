// Learned classification rules (Prompt 6A) — a lightweight, local learning
// system that turns repeated user corrections into better statement
// classification. NO external AI: everything is deterministic, explainable
// and stored in AppState (validated, migrated, exported, backed up).
//
// How learning works:
// - A "correction" is a user changing a review row's CATEGORY away from the
//   suggested classification during the import preview, then actually
//   importing that row. Merely accepting a suggestion never learns anything.
// - Corrections are keyed by the most specific reliable signal the row has:
//   provider ("MTN") > merchant ("DAVID") > full normalized description.
// - One correction creates a CANDIDATE rule (strength 1, never applied).
//   A second matching correction activates it (strength 2+). A rule is never
//   created from one ambiguous transaction.
// - A correction that CONTRADICTS an existing rule re-baselines it: the
//   mapping is replaced, strength resets to 1 and the rule deactivates until
//   the new direction is corrected twice more. Flip-flopping can never
//   activate anything.
// - Applied rules sit at the TOP of the classification priority (§3 of the
//   prompt): user-created rule > built-in keyword rules > generic suggestion.
//   Within learned rules, provider > merchant > description.

import { createId } from "./ids";
import type { Category, ID, LearnedRule } from "./types";
import type { NormalizedBankTransaction } from "./statementTypes";

/** Corrections needed for a rule to activate. One correction is a candidate
 *  only — "never create a rule from one ambiguous transaction". */
export const RULE_MIN_STRENGTH = 2;

export type RuleSignalKind = LearnedRule["kind"];

/** A confirmed correction from an import session: the row's strongest
 *  signals plus the category the user chose. */
export interface RuleCorrectionInput {
  provider?: string;
  merchant?: string;
  description: string;
  categoryId: ID;
}

/** Normalizes a signal key: lowercase, whitespace collapsed. */
export function normalizeRuleKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Picks the most specific usable signal of a corrected row. Provider beats
 *  merchant beats the full normalized description. Returns null only when
 *  the row has no usable signal at all. */
export function signalForCorrection(
  correction: Pick<RuleCorrectionInput, "provider" | "merchant" | "description">,
): { kind: RuleSignalKind; key: string } | null {
  if (correction.provider) {
    const key = normalizeRuleKey(correction.provider);
    if (key.length > 0) return { kind: "provider", key };
  }
  if (correction.merchant) {
    const key = normalizeRuleKey(correction.merchant);
    if (key.length > 0) return { kind: "merchant", key };
  }
  const key = normalizeRuleKey(correction.description);
  if (key.length === 0) return null;
  return { kind: "description", key };
}

function nowIso(now: string | undefined): string {
  return now ?? new Date().toISOString();
}

/** Records one confirmed correction against the rule list (immutable —
 *  returns a new array). Same (kind, key) mapping to the same category
 *  strengthens the rule; a different category re-baselines it. */
export function recordCorrection(
  rules: readonly LearnedRule[],
  correction: RuleCorrectionInput,
  now?: string,
): LearnedRule[] {
  const signal = signalForCorrection(correction);
  if (!signal) return rules as LearnedRule[];
  const categoryId = correction.categoryId;
  const existing = rules.find(
    (rule) => rule.kind === signal.kind && rule.key === signal.key,
  );
  const timestamp = nowIso(now);
  if (existing) {
    if (existing.categoryId === categoryId) {
      return rules.map((rule) =>
        rule.id === existing.id
          ? {
              ...rule,
              strength: rule.strength + 1,
              enabled: rule.strength + 1 >= RULE_MIN_STRENGTH,
              updatedAt: timestamp,
            }
          : rule,
      );
    }
    return rules.map((rule) =>
      rule.id === existing.id
        ? {
            ...rule,
            categoryId,
            strength: 1,
            enabled: false,
            updatedAt: timestamp,
          }
        : rule,
    );
  }
  return [
    ...rules,
    {
      id: createId(),
      source: "statement-import",
      kind: signal.kind,
      key: signal.key,
      categoryId,
      strength: 1,
      enabled: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

/** True when the rule's category kind is consistent with the row's flow
 *  direction — an expense rule never fires on credits, an income rule never
 *  on debits (mirrors the built-in rule engine's direction guards). */
function directionCompatible(
  tx: { direction?: NormalizedBankTransaction["direction"] },
  category: Category,
): boolean {
  if (category.kind === "expense" && tx.direction === "in") return false;
  if (category.kind === "income" && tx.direction === "out") return false;
  return true;
}

/* ------------------------------------------------------------------------ */
/* Matching                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Similarity at or above which a NON-exact key counts as the same merchant.
 *
 * Deliberately high. A false positive here silently files money under the
 * wrong category, which is worse than asking the user to pick once more — so
 * the bar is "obviously the same merchant with noise attached", not "vaguely
 * similar".
 */
export const FUZZY_MATCH_THRESHOLD = 0.82;

/** Distinct whitespace-separated tokens of a normalized key. */
function tokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((token) => token.length > 0));
}

/**
 * Token-overlap similarity (Dice coefficient) between two normalized keys,
 * 0..1.
 *
 * Token-based rather than character-based on purpose: statement noise arrives
 * as extra WORDS ("shoprite lekki" vs "shoprite lekki store 4"), and an edit
 * distance would score a long shared prefix as similar even when the trailing
 * words name a different payee entirely.
 */
export function keySimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

/** How a rule was matched, for display and for tests. */
export type MatchKind = "exact" | "fuzzy";

export interface CategorySuggestion {
  rule: LearnedRule;
  category: Category;
  match: MatchKind;
  /** 1 for an exact key match, otherwise the token similarity. */
  similarity: number;
  /**
   * True once the mapping has been confirmed enough times to apply without
   * review (`RULE_MIN_STRENGTH`). A suggestion below that still pre-fills the
   * category, but the row stays flagged so the user actually looks at it —
   * pre-fill, never auto-finalize.
   */
  confident: boolean;
}

/** The signals a description can be matched on. Everything except
 *  `description` is optional, so a caller holding only a raw string can use
 *  this engine unchanged — see `suggestCategoryForText`. */
export interface SuggestionInput {
  description: string;
  merchant?: string;
  provider?: string;
  /** Omit when unknown; direction guards are then skipped. Accepts the
   *  statement pipeline's "unknown" too, which guards nothing. */
  direction?: NormalizedBankTransaction["direction"];
}

/**
 * The shared categorization entry point (FR-22).
 *
 * Deliberately NOT tied to statement import: it takes plain strings and
 * returns a suggestion, so the planned email-alert parser (and anything else
 * needing a category for a description) can call this rather than growing a
 * second, divergent copy of the same learning.
 *
 * Matching order is most-specific-signal-first (provider > merchant >
 * description), and EXACT matches are exhausted across every signal before
 * any fuzzy match is considered — an exact key is the thing the user actually
 * corrected, so it must never lose to a fuzzy match on a stronger signal.
 */
export function suggestCategory(
  input: SuggestionInput,
  rules: readonly LearnedRule[],
  categories: readonly Category[],
): CategorySuggestion | null {
  if (rules.length === 0) return null;

  const usable = (rule: LearnedRule): Category | null => {
    const category = categories.find((entry) => entry.id === rule.categoryId);
    if (!category) return null;
    if (
      input.direction &&
      !directionCompatible({ direction: input.direction }, category)
    ) {
      return null;
    }
    return category;
  };

  const signals: Array<{ kind: RuleSignalKind; key: string }> = [];
  if (input.provider) {
    const key = normalizeRuleKey(input.provider);
    if (key) signals.push({ kind: "provider", key });
  }
  if (input.merchant) {
    const key = normalizeRuleKey(input.merchant);
    if (key) signals.push({ kind: "merchant", key });
  }
  const descriptionKey = normalizeRuleKey(input.description);
  if (descriptionKey) signals.push({ kind: "description", key: descriptionKey });

  for (const signal of signals) {
    // Scans ALL rules of the kind. The previous implementation looked at only
    // the FIRST rule of each kind, so a second learned merchant could never
    // fire — the feature quietly stopped learning after one per signal.
    for (const rule of rules) {
      if (rule.kind !== signal.kind || rule.key !== signal.key) continue;
      const category = usable(rule);
      if (!category) continue;
      return { rule, category, match: "exact", similarity: 1, confident: rule.enabled };
    }
  }

  for (const signal of signals) {
    let best: CategorySuggestion | null = null;
    for (const rule of rules) {
      if (rule.kind !== signal.kind) continue;
      const similarity = keySimilarity(signal.key, rule.key);
      if (similarity < FUZZY_MATCH_THRESHOLD) continue;
      const category = usable(rule);
      if (!category) continue;
      if (best === null || similarity > best.similarity) {
        best = { rule, category, match: "fuzzy", similarity, confident: rule.enabled };
      }
    }
    // Resolved per signal, so a fuzzy provider hit still beats a fuzzy
    // description hit rather than whichever happened to score higher.
    if (best) return best;
  }
  return null;
}

/**
 * Convenience wrapper for callers holding nothing but a raw statement or
 * alert line. The planned email parser is expected to use this.
 */
export function suggestCategoryForText(
  description: string,
  rules: readonly LearnedRule[],
  categories: readonly Category[],
): CategorySuggestion | null {
  return suggestCategory({ description }, rules, categories);
}

/** Stamps rules as used, so a mapping that has gone quiet can be spotted
 *  later. Immutable; unknown ids are ignored. */
export function markRulesUsed(
  rules: readonly LearnedRule[],
  ids: readonly ID[],
  now?: string,
): LearnedRule[] {
  if (ids.length === 0) return rules as LearnedRule[];
  const target = new Set(ids);
  const timestamp = nowIso(now);
  return rules.map((rule) =>
    target.has(rule.id) ? { ...rule, lastUsedAt: timestamp } : rule,
  );
}

/**
 * The best APPLICABLE learned rule for a statement row — the ENABLED-only
 * view used by automatic classification. Kept as the import pipeline's entry
 * point; `suggestCategory` is the general one, and also surfaces
 * not-yet-enabled candidates as pre-fills.
 */
export function activeRuleFor(
  tx: Pick<NormalizedBankTransaction, "direction" | "provider" | "merchant" | "description">,
  rules: readonly LearnedRule[],
  categories: readonly Category[],
): { rule: LearnedRule; category: Category } | null {
  const hit = suggestCategory(
    {
      description: tx.description,
      merchant: tx.merchant,
      provider: tx.provider,
      direction: tx.direction,
    },
    rules.filter((rule) => rule.enabled),
    categories,
  );
  return hit ? { rule: hit.rule, category: hit.category } : null;
}