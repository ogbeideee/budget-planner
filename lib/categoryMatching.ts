// Automatic expense category matching (Prompt 8G) — a deterministic, local
// category matching layer built on top of the existing one-category system.
//
// - Uses the app's EXISTING categories: merchant/keyword evidence is mapped to
//   *category-name hints*, which are resolved against whatever expense
//   categories the user actually has (exact name first, then containment).
//   Nothing here hard-codes a category id ("MTN → Utilities" is not written as
//   an id; it is "MTN → hints ['utilities', 'mobile data', …]" resolved
//   adaptively).
// - Every assignment carries a confidence: HIGH (known merchant/provider),
//   MEDIUM (strong whole-word keyword/alias), LOW (weak/short alias — caller
//   must keep the row flagged for review, never silently certain).
// - Offline & deterministic: no AI, no network, no randomness.
// - Reuses the existing alias vocabulary (KEYWORD_ALIASES) and the merchant
//   normalization layer (lib/merchant.ts) so there is exactly ONE way to
//   normalize a merchant name.

import { KNOWN_MERCHANTS, knownMerchantFor, knownMerchantIn, normalizeMerchantKey, merchantKeyMatches } from "./merchant";
import { KEYWORD_ALIASES } from "./statementImport";
import type { Category } from "./types";

export type CategoryConfidence = "high" | "medium" | "low";

export interface CategoryMatch {
  /** Existing expense Category id. */
  categoryId: string;
  /** HIGH = known merchant/provider · MEDIUM = strong keyword · LOW = weak. */
  confidence: CategoryConfidence;
  /** Human/debug explanation, e.g. "merchant:MTN" or "keyword:shoprite". */
  reason: string;
}

/** Merchant → category-name hints. Hints are category NAMES (resolved
 *  adaptively), ordered most-specific-first; the first hint that matches an
 *  existing expense category wins. Banks/wallets are deliberately absent —
 *  they are transfer counterparties, not merchants. */
export const MERCHANT_CATEGORY_HINTS: ReadonlyArray<{ merchant: string; hints: readonly string[] }> = [
  { merchant: "MTN", hints: ["utilities", "mobile data", "data", "internet", "phone", "airtime"] },
  { merchant: "Airtel", hints: ["utilities", "mobile data", "data", "internet", "phone", "airtime"] },
  { merchant: "9mobile", hints: ["utilities", "mobile data", "data", "internet", "phone", "airtime"] },
  { merchant: "Glo", hints: ["utilities", "mobile data", "data", "internet", "phone", "airtime"] },
  { merchant: "Spectranet", hints: ["utilities", "internet", "data", "broadband"] },
  { merchant: "Smile", hints: ["utilities", "internet", "data", "broadband"] },
  { merchant: "DSTV", hints: ["entertainment", "cable tv", "utilities"] },
  { merchant: "GoTV", hints: ["entertainment", "cable tv", "utilities"] },
  { merchant: "StarTimes", hints: ["entertainment", "cable tv", "utilities"] },
  { merchant: "Netflix", hints: ["entertainment"] },
  { merchant: "Spotify", hints: ["entertainment"] },
  { merchant: "Showmax", hints: ["entertainment"] },
  { merchant: "Disney+", hints: ["entertainment"] },
  { merchant: "Apple TV", hints: ["entertainment"] },
  { merchant: "Amazon Prime", hints: ["entertainment"] },
  { merchant: "YouTube Premium", hints: ["entertainment"] },
  { merchant: "Uber", hints: ["transport"] },
  { merchant: "Bolt", hints: ["transport"] },
  { merchant: "inDrive", hints: ["transport"] },
  { merchant: "Shoprite", hints: ["groceries", "shopping", "food"] },
  { merchant: "SPAR", hints: ["groceries", "shopping"] },
  { merchant: "Checkers", hints: ["groceries", "shopping"] },
  { merchant: "Justu", hints: ["groceries", "shopping"] },
  { merchant: "Jumia", hints: ["shopping", "groceries"] },
  { merchant: "Konga", hints: ["shopping", "groceries"] },
  { merchant: "Game", hints: ["shopping", "entertainment"] },
  { merchant: "Park N Shop", hints: ["groceries", "shopping"] },
  { merchant: "Chowdeck", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Glovo", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Uber Eats", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Pizza Hut", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Domino's", hints: ["food", "groceries", "restaurant"] },
  { merchant: "KFC", hints: ["food", "groceries", "restaurant"] },
  { merchant: "McDonald's", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Chicken Republic", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Kilimanjaro", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Tantalizers", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Mr Bigg's", hints: ["food", "groceries", "restaurant"] },
  { merchant: "Total", hints: ["transport", "fuel", "filling station"] },
  { merchant: "Oando", hints: ["transport", "fuel", "filling station"] },
  { merchant: "NNPC", hints: ["transport", "fuel", "filling station"] },
  { merchant: "Conoil", hints: ["transport", "fuel", "filling station"] },
  { merchant: "11 PLC", hints: ["transport", "fuel", "filling station"] },
  { merchant: "MedPlus", hints: ["health", "pharmacy"] },
  { merchant: "HealthPlus", hints: ["health", "pharmacy"] },
];

/** Resolves category-name hints against the existing EXPENSE categories —
 *  exact name first, then containment ("Bills & Utilities" satisfies the
 *  "Utilities" hint). Same semantics as the classify-layer resolveCategory. */
export function resolveCategoryHint(
  hints: readonly string[],
  categories: readonly Category[],
): Category | null {
  for (const hint of hints) {
    const lowered = hint.toLowerCase();
    const match = categories.find(
      (category) =>
        category.kind === "expense" &&
        (category.name.toLowerCase() === lowered ||
          category.name.toLowerCase().includes(lowered) ||
          lowered.includes(category.name.toLowerCase())),
    );
    if (match) return match;
  }
  return null;
}

export interface CategoryMatchInput {
  description: string;
  /** Parser-extracted provider, e.g. "MTN", "PalmPay". */
  provider?: string;
}

/** Matches a narration to one of the existing expense categories. Returns
 *  null when there is no confident-enough assignment. The original
 *  `description` is never modified.
 *
 *  Phase 1 — known merchant/provider (whole-word): HIGH.
 *  Phase 2 — whole-word keyword/alias vs each expense category: HIGH when the
 *  winning alias is the category's own name or a known merchant, MEDIUM
 *  otherwise, LOW for short/weak aliases (< 5 chars). */
export function matchExpenseCategory(
  input: CategoryMatchInput,
  categories: readonly Category[],
): CategoryMatch | null {
  const expenseCategories = categories.filter((category) => category.kind === "expense");
  if (expenseCategories.length === 0) return null;

  // Phase 1: known merchant/provider → category-name hints → HIGH.
  const merchants = new Set<string>();
  const fromProvider = knownMerchantFor(input.provider);
  if (fromProvider) merchants.add(fromProvider);
  const fromText = knownMerchantIn(input.description);
  if (fromText) merchants.add(fromText);
  for (const canonical of merchants) {
    const entry = MERCHANT_CATEGORY_HINTS.find((hint) => hint.merchant === canonical);
    if (!entry) continue;
    const category = resolveCategoryHint(entry.hints, expenseCategories);
    if (category) return { categoryId: category.id, confidence: "high", reason: `merchant:${canonical}` };
  }

  // Phase 2: whole-word keyword/alias matches (normalized: lowercase,
  // punctuation stripped, whitespace collapsed). Longest alias wins.
  const text = normalizeMerchantKey(input.description);
  let best: { category: Category; alias: string } | null = null;
  for (const category of expenseCategories) {
    const ownName = normalizeMerchantKey(category.name);
    const aliases = [ownName, ...(KEYWORD_ALIASES[category.name] ?? [])];
    for (const alias of aliases) {
      const key = normalizeMerchantKey(alias);
      if (key.length === 0) continue;
      if (!merchantKeyMatches(key, text)) continue;
      if (!best || key.length > best.alias.length) best = { category, alias: key };
    }
  }
  if (best) {
    const { category, alias } = best;
    const ownName = normalizeMerchantKey(category.name);
    const isOwnName = alias === ownName;
    const isMerchant = KNOWN_MERCHANTS.some((merchant) => merchant.keys.some((key) => key === alias));
    const confidence: CategoryConfidence =
      isOwnName || isMerchant ? "high" : alias.length >= 5 ? "medium" : "low";
    return { categoryId: category.id, confidence, reason: `keyword:${alias}` };
  }

  return null;
}
