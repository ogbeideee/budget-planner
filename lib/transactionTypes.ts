// Deterministic transaction-type layer (Prompt 8F).
//
// A descriptive classification of WHAT a statement row is — independent of
// `BankTransactionKind` (expense/income/...) and independent of expense
// categories. "Transfer to John Doe" is type "transfer"; its kind is
// "transfer" and its expense category (if any) may later become
// Personal/Family.
//
// Rules:
// - Deterministic: the same narration always produces the same type.
// - Narration-only: `direction` is NOT consulted. An incoming transfer is
//   still type "transfer", never income; income/expense is the classification
//   layer's (3D) job.
// - Money movement (internal-transfer, savings) has its own types so
//   own-account movement is never confused with spending.
// - Fees/charges are split (transfer-fee / vat / stamp-duty / sms-charge /
//   bank-charge) so a charge is never silently treated as an ordinary
//   expense.
// - First match wins; the table is DATA — new types/keywords are added by
//   appending entries, not by changing the engine.

import type { TransactionType } from "./statementTypes";

export interface TransactionTypeRule {
  type: Exclude<TransactionType, "unknown">;
  /** Case-insensitive, word-boundary substrings of the normalized narration. */
  patterns: readonly string[];
}

/** Ordered rules — the FIRST match wins (most specific first). */
export const TRANSACTION_TYPE_RULES: ReadonlyArray<TransactionTypeRule> = [
  { type: "refund", patterns: ["refund", "cashback", "reversal"] },
  { type: "loan-payment", patterns: ["loan repayment", "loan payment", "easemoni", "loan"] },
  { type: "stamp-duty", patterns: ["stamp duty"] },
  { type: "vat", patterns: ["vat", "vatrecover", "withholding tax", "capital gains", "cac levy"] },
  { type: "transfer-fee", patterns: ["transfer fee", "transfer charge", "transfer charges", "commission on", "nip transfer charge"] },
  { type: "sms-charge", patterns: ["sms alert", "sms charge"] },
  { type: "interest", patterns: ["interest earned", "interest capitalised", "interest capitalized", "interest"] },
  { type: "savings", patterns: ["auto-save", "autosave", "round-up", "roundup", "save to owealth", "savings plan", "spend and save", "spend + save"] },
  { type: "internal-transfer", patterns: ["owealth withdrawal", "owealth deposit", "owealth transfer", "wallet transfer", "self transfer", "transfer to owealth", "internal transfer"] },
  { type: "airtime", patterns: ["airtime", "recharge"] },
  { type: "mobile-data", patterns: ["mobile data", "data bundle", "data plan"] },
  { type: "card-payment", patterns: ["pos", "card payment", "card purchase", "card transaction", "debit card", "checkout", "merchant order", "third-party merchant order", "paystack", "kora payments", "moniepoint", "flutterwave", "interswitch"] },
  { type: "salary", patterns: ["salary", "wages", "payroll", "stipend"] },
  { type: "withdrawal", patterns: ["withdrawal", "withdraw", "cash withdrawal", "atm withdrawal"] },
  { type: "deposit", patterns: ["deposit"] },
  { type: "bank-charge", patterns: ["commission", "ussd charge", "maintenance fee", "card maintenance", "bank charge", "charges", "levy"] },
  { type: "transfer", patterns: ["transfer to", "transfer from", "nip transfer", "nibss", "interbank transfer", "intrabank transfer", "local funds transfer", "outward transfer", "incoming transfer", "money transfer", "local funds"] },
];

function escapeRegex(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedText(raw: string): string {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesWord(pattern: string, text: string): boolean {
  return new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i").test(text);
}

/** Classifies a narration's deterministic transaction type. Pure and
 *  deterministic; `"unknown"` when no rule matches. */
export function classifyTransactionType(description: string): TransactionType {
  const text = normalizedText(description);
  for (const rule of TRANSACTION_TYPE_RULES) {
    if (rule.patterns.some((pattern) => matchesWord(pattern, text))) {
      return rule.type;
    }
  }
  return "unknown";
}
