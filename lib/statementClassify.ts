// Bank statement classification layer (Prompt 3D).
//
// Turns a NormalizedBankTransaction's narration (and any parser-extracted
// facts) into a SUGGESTED kind + confidence + existing Category id. This is
// analysis only — nothing is written to the budget, SQLite or storage.
//
// Design rules:
// - One category system: categories are resolved against the EXISTING
//   `Category[]` (by name hint); if nothing matches confidently the row is
//   marked needsReview instead of guessing a category id.
// - Conservative: "Transfer to John Doe" stays a TRANSFER, never a Food /
//   Shopping / Transport guess. Only explicit merchant-payment evidence
//   (payment gateways, "merchant order", "checkout") classifies as expense.
// - Extensible: the rule tables below are DATA — new keywords, providers and
//   banks are added by appending entries, not by changing the engine.
// - Kind vs direction: a rule may fire regardless of the statement direction
//   (e.g. refunds can be debits, interest can be credited); `direction`
//   itself is never rewritten by classification.
//
// Kind vocabulary follows the existing `BankTransactionKind` (kebab-case).
// The prompt's "internal_transfer" → "internal-transfer", "bank_fee" →
// "bank-fee", "tax_or_charge" → "tax", "loan_payment" → "loan-payment".

import { suggestCategory } from "./categorize";
import { matchExpenseCategory } from "./categoryMatching";
import { activeRuleFor } from "./learnedRules";
import { extractMerchantFromNarration } from "./merchant";
import { classifyTransactionType } from "./transactionTypes";
import type { Category, LearnedRule } from "./types";
import type {
  BankTransactionKind,
  ClassificationConfidence,
  NormalizedBankTransaction,
} from "./statementTypes";

export interface ClassifyRule {
  /** Stable id, also used as `classificationReason`. */
  id: string;
  kind: BankTransactionKind;
  confidence: Exclude<ClassificationConfidence, "none">;
  /** Case-insensitive substrings of the normalized narration. */
  patterns: readonly string[];
  /** Preferred existing category names (resolved only when kind matches). */
  categoryNames?: readonly string[];
}

/** Rules run in order; the FIRST match wins (most specific first). */
export const CLASSIFICATION_RULES: ReadonlyArray<ClassifyRule> = [
  { id: "refund", kind: "refund", confidence: "high", patterns: ["refund", "cashback", "reversal"] },
  { id: "loan", kind: "loan-payment", confidence: "high", patterns: ["loan repayment", "loan payment", "easemoni", "loan"] },
  { id: "tax", kind: "tax", confidence: "high", patterns: ["stamp duty", "vat", "vatrecover", "withholding tax", "capital gains", "cac levy"] },
  { id: "bank-fee", kind: "bank-fee", confidence: "high", patterns: ["commission", "sms alert", "sms charge", "ussd charge", "transfer fee", "maintenance fee", "card maintenance", "bank charge", "charges"] },
  { id: "interest", kind: "interest", confidence: "high", patterns: ["interest earned", "interest capitalised", "interest capitalized", "interest"] },
  { id: "savings", kind: "savings", confidence: "high", patterns: ["auto-save", "autosave", "round-up", "roundup", "save to owealth", "savings plan", "spend and save", "spend + save"] },
  { id: "internal-transfer", kind: "internal-transfer", confidence: "medium", patterns: ["owealth withdrawal", "owealth deposit", "owealth transfer", "wallet transfer", "self transfer", "transfer to owealth"] },
  { id: "merchant-gateway", kind: "expense", confidence: "medium", patterns: ["third-party merchant order", "merchant order", "checkout", "paystack", "kora payments", "moniepoint", "flutterwave", "interswitch"] },
  { id: "transfer", kind: "transfer", confidence: "medium", patterns: ["transfer to", "transfer from", "nip transfer", "nibss", "interbank transfer", "intrabank transfer", "local funds transfer", "outward transfer", "incoming transfer"] },
  { id: "income-salary", kind: "income", confidence: "high", patterns: ["salary", "wages", "payroll", "stipend"], categoryNames: ["Salary"] },
  { id: "expense-utilities", kind: "expense", confidence: "high", patterns: ["mobile data", "airtime", "data bundle", "mtn", "airtel", "9mobile", "glo", "electricity", "power bill", "water bill", "internet", "wifi", "broadband", "cable tv", "dstv", "gotv"], categoryNames: ["Utilities"] },
  { id: "expense-groceries", kind: "expense", confidence: "high", patterns: ["groceries", "grocery", "supermarket", "market"], categoryNames: ["Groceries"] },
  { id: "expense-food", kind: "expense", confidence: "medium", patterns: ["restaurant", "cafe", "coffee", "lunch", "dinner", "takeaway", "pizza", "burger", "food"], categoryNames: ["Food", "Groceries"] },
  { id: "expense-transport", kind: "expense", confidence: "high", patterns: ["uber", "taxi", "fuel", "petrol", "bus", "train", "metro", "parking", "transport"], categoryNames: ["Transport"] },
  { id: "expense-housing", kind: "expense", confidence: "high", patterns: ["rent", "mortgage", "landlord"], categoryNames: ["Rent"] },
  { id: "expense-entertainment", kind: "expense", confidence: "high", patterns: ["netflix", "spotify", "disney", "cinema", "movie", "steam", "playstation", "xbox", "youtube", "prime video", "concert", "show"], categoryNames: ["Entertainment"] },
  { id: "expense-shopping", kind: "expense", confidence: "medium", patterns: ["shopping", "clothes", "clothing", "shoes", "fashion", "mall", "electronics"], categoryNames: ["Shopping"] },
  { id: "expense-health", kind: "expense", confidence: "high", patterns: ["hospital", "pharmacy", "medicine", "medical", "doctor", "dentist", "clinic"], categoryNames: ["Health"] },
];

export interface ProviderRule {
  /** Canonical display name. */
  provider: string;
  /** Case-insensitive substrings of the narration. */
  patterns: readonly string[];
}

/** Ordered provider table — extend here for new banks/wallets/gateways. */
export const PROVIDER_RULES: ReadonlyArray<ProviderRule> = [
  { provider: "PalmPay", patterns: ["palmpay"] },
  { provider: "OPay", patterns: ["opay"] },
  { provider: "Paystack", patterns: ["paystack"] },
  { provider: "Kora", patterns: ["kora"] },
  { provider: "Moniepoint", patterns: ["moniepoint"] },
  { provider: "Flutterwave", patterns: ["flutterwave"] },
  { provider: "Interswitch", patterns: ["interswitch"] },
  { provider: "MTN", patterns: ["mtn"] },
  { provider: "Airtel", patterns: ["airtel"] },
  { provider: "9mobile", patterns: ["9mobile"] },
  { provider: "Glo", patterns: ["glo"] },
  { provider: "Access Bank", patterns: ["access bank"] },
  { provider: "Sterling Bank", patterns: ["sterling"] },
  { provider: "Wema Bank", patterns: ["wema"] },
  { provider: "Fidelity Bank", patterns: ["fidelity"] },
  { provider: "GTBank", patterns: ["gtbank", "gtb"] },
  { provider: "Zenith Bank", patterns: ["zenith"] },
  { provider: "UBA", patterns: ["uba"] },
  { provider: "First Bank", patterns: ["first bank"] },
  { provider: "Union Bank", patterns: ["union bank"] },
];

/** Detects a provider/merchant-platform name inside a narration. */
export function detectProvider(description: string): string | undefined {
  const text = normalizedText(description);
  for (const rule of PROVIDER_RULES) {
    if (rule.patterns.some((pattern) => matchesWord(pattern, text))) {
      return rule.provider;
    }
  }
  return undefined;
}

export interface ClassifyDecision {
  kind: BankTransactionKind;
  confidence: ClassificationConfidence;
  /** Existing ledger Category id, or null → the user must pick one. */
  categoryId: string | null;
  /** True when the row cannot be imported as-is (unknown kind or no
   *  confident category) — the review stage must flag it. */
  needsReview: boolean;
  /** Rule id that decided (or "no-match"). */
  reason: string;
  /** Prompt 8G: confidence of the automatic CATEGORY assignment (independent
   *  of the kind-level `confidence`). LOW keeps the row flagged for review. */
  categoryConfidence?: "high" | "medium" | "low";
  /** Prompt 8G: why the category was chosen (e.g. "merchant:MTN"). */
  categoryReason?: string;
}

function normalizedText(raw: string): string {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Word-boundary substring match — "SALARY" never matches
 *  "QWE786JSALARYXQWERTY", but "SALARY PAYMENT" does. Patterns are
 *  regex-escaped so literal phrases like "spend + save" match as written. */
function matchesWord(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function ruleMatches(text: string, rule: ClassifyRule): boolean {
  return rule.patterns.some((pattern) => matchesWord(pattern, text));
}

/** Resolves preferred category names against the EXISTING categories of the
 *  rule's kind. Exact name first, then containment ("Bills & Utilities"
 *  satisfies the "Utilities" hint). Null = needs review. */
function resolveCategory(
  categoryNames: readonly string[] | undefined,
  categories: readonly Category[],
  kind: BankTransactionKind,
): string | null {
  if (!categoryNames || categoryNames.length === 0) return null;
  for (const hint of categoryNames) {
    const lowered = hint.toLowerCase();
    const match = categories.find(
      (category) =>
        category.kind === (kind === "income" ? "income" : "expense") &&
        (category.name.toLowerCase() === lowered ||
          category.name.toLowerCase().includes(lowered) ||
          lowered.includes(category.name.toLowerCase())),
    );
    if (match) return match.id;
  }
  return null;
}

/** Fallback: reuse the existing keyword-suggestion system for expense
 *  narrations that matched no explicit rule. Only confident suggestions are
 *  applied — otherwise the row stays unknown/needs review.
 *
 *  The keyword system matches substrings ("bus" inside "BUSINESS", "food"
 *  inside "FOODSTUFF"); for statements that is too eager — a confident but
 *  wrong category is worse than Needs Review (prompt 6B). The matched keyword
 *  must therefore be present as a whole word before the suggestion is used. */
function suggestExpenseCategory(
  description: string,
  categories: readonly Category[],
): { categoryId: string; reason: string } | null {
  const text = normalizedText(description);
  const suggestion = suggestCategory(description, categories, {});
  if (!suggestion || suggestion.confidence !== "high") return null;
  if (!matchesWord(suggestion.keyword, text)) return null;
  const category = categories.find((entry) => entry.id === suggestion.categoryId);
  if (!category || category.kind !== "expense") return null;
  return { categoryId: suggestion.categoryId, reason: "keyword-suggestion" };
}

/** Extracts the useful merchant/recipient from a narration (Prompt 8G) —
 *  see lib/merchant.ts. Returns a known merchant/provider name or a transfer
 *  recipient; the original description is never modified. */

function decide(
  tx: NormalizedBankTransaction,
  categories: readonly Category[],
  learnedRules?: readonly LearnedRule[],
): { decision: ClassifyDecision; merchant?: string; provider?: string } {
  const text = normalizedText(tx.description);
  const provider = tx.provider ?? detectProvider(tx.description);

  let decision: ClassifyDecision | null = null;

  // Prompt 6A: learned rules are checked FIRST — the user's repeated
  // corrections take precedence over every built-in rule. A learned match
  // classifies with high confidence and never needs review.
  if (learnedRules && learnedRules.length > 0) {
    const learned = activeRuleFor({ ...tx, provider }, learnedRules, categories);
    if (learned) {
      decision = {
        kind: learned.category.kind,
        confidence: "high",
        categoryId: learned.category.id,
        needsReview: false,
        reason: `learned:${learned.rule.kind}:${learned.rule.key}`,
        categoryConfidence: "high",
        categoryReason: `learned:${learned.rule.kind}:${learned.rule.key}`,
      };
    }
  }

  if (!decision) {
    for (const rule of CLASSIFICATION_RULES) {
      // Expense patterns on credits and income patterns on debits are
      // ambiguous — leave those rows to the review stage.
      if (rule.kind === "expense" && tx.direction === "in") continue;
      if (rule.kind === "income" && tx.direction === "out") continue;
      if (ruleMatches(text, rule)) {
        decision = {
          kind: rule.kind,
          confidence: rule.confidence,
          categoryId: resolveCategory(rule.categoryNames, categories, rule.kind),
          needsReview: true,
          reason: rule.id,
        };
        break;
      }
    }
  }

  // Prompt 8G: for expense rows, the category matcher (known merchants +
  // keyword aliases, resolved against the EXISTING categories) refines the
  // category and records WHY + HOW confident it is. A HIGH merchant match
  // overrides the rule hint; a MEDIUM/LOW keyword match keeps the rule's
  // category when one was already resolved. LOW keeps the row flagged.
  // Learned-rule decisions (Prompt 6A) are never refined — the user's own
  // repeated corrections always win.
  if (
    decision &&
    decision.kind === "expense" &&
    !decision.reason.startsWith("learned:")
  ) {
    const match = matchExpenseCategory({ description: tx.description, provider }, categories);
    if (match && match.confidence !== "low") {
      decision.categoryId = match.categoryId;
      decision.categoryConfidence = match.confidence;
      decision.categoryReason = match.reason;
    } else if (decision.categoryId !== null) {
      decision.categoryConfidence = decision.confidence === "high" ? "high" : "medium";
      decision.categoryReason = decision.reason;
    }
  }

  if (!decision && tx.direction === "out") {
    const suggestion = suggestExpenseCategory(tx.description, categories);
    if (suggestion) {
      decision = {
        kind: "expense",
        confidence: "medium",
        categoryId: suggestion.categoryId,
        needsReview: false,
        reason: suggestion.reason,
      };
    }
  }

  // Prompt 8G: a narration that matched no built-in rule can still be a real
  // expense when it names a KNOWN merchant/provider (e.g. "SHOPRITE PURCHASE"
  // or "PAYMENT TO NETFLIX"). Only HIGH-confidence merchant evidence upgrades
  // an unknown debit to expense — weak/ambiguous evidence stays in review.
  if (!decision && tx.direction === "out") {
    const match = matchExpenseCategory({ description: tx.description, provider }, categories);
    if (match && match.confidence === "high") {
      decision = {
        kind: "expense",
        confidence: "high",
        categoryId: match.categoryId,
        needsReview: false,
        reason: match.reason,
        categoryConfidence: "high",
        categoryReason: match.reason,
      };
    }
  }

  if (!decision) {
    decision = {
      kind: "unknown",
      confidence: "none",
      categoryId: null,
      needsReview: true,
      reason: "no-match",
    };
  }
  // A transfer with no structure ("Transfer to JOHN DOE") is weaker evidence
  // than a "Transfer to X | Provider" narration.
  if (
    decision.kind === "transfer" &&
    decision.confidence === "medium" &&
    !/\|/.test(tx.description) &&
    provider === undefined
  ) {
    decision.confidence = "low";
  }
  decision.needsReview =
    decision.kind === "unknown" ||
    decision.categoryId === null ||
    decision.categoryConfidence === "low";

  let merchant = tx.merchant;
  if (!merchant && (decision.kind === "transfer" || decision.kind === "expense")) {
    merchant = extractMerchantFromNarration(tx.description, provider)?.merchant;
  }

  return { decision, merchant, provider };
}

/** Classifies one normalized transaction (pure; returns a new object).
 *  `direction`, amounts and the original narration are never rewritten.
 *  `learnedRules` (Prompt 6A) are applied before the built-in rule table. */
export function classifyTransaction(
  tx: NormalizedBankTransaction,
  categories: readonly Category[],
  learnedRules?: readonly LearnedRule[],
): NormalizedBankTransaction {
  const { decision, merchant, provider } = decide(tx, categories, learnedRules);
  return {
    ...tx,
    type: decision.kind,
    txType: classifyTransactionType(tx.description),
    confidence: decision.confidence,
    categoryId: decision.categoryId,
    needsReview: decision.needsReview,
    categoryConfidence: decision.categoryConfidence,
    categoryReason: decision.categoryReason,
    classificationReason: decision.reason,
    status: decision.kind === "unknown" ? tx.status : "classified",
    merchant,
    provider,
  };
}

/** Classifies a batch of normalized transactions. */
export function classifyTransactions(
  transactions: readonly NormalizedBankTransaction[],
  categories: readonly Category[],
  learnedRules?: readonly LearnedRule[],
): NormalizedBankTransaction[] {
  return transactions.map((tx) => classifyTransaction(tx, categories, learnedRules));
}