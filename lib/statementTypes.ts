// Normalized bank transaction model — the canonical intermediate between a
// raw statement (CSV/Excel/PDF from any bank) and the Budget Planner ledger.
//
// Pipeline:
//   BANK STATEMENT → PARSER → NORMALIZED TRANSACTION → CLASSIFICATION
//     → USER REVIEW → IMPORT INTO BUDGET (existing store actions)
//
// Rules:
// - A normalized transaction NEVER assumes debit = expense or credit =
//   income. `direction` is a FACT of the statement cell (CR/DR, minus,
//   parens, balance delta); `type` is a CLASSIFICATION decision and starts
//   as "unknown". Classification (next phase) decides what a row means.
// - The normalized layer is TRANSIENT: it exists only for the current import
//   session and is never written to AppState, localStorage or SQLite. Only
//   the final `Transaction` rows (via `addTransactions`) persist.
// - Privacy: references, raw narrations and balances are kept only while
//   review/classification needs them and are capped in length; they are never
//   logged (Prompt 8K). Only a CONFIRMED row's capped reference and raw
//   narration survive, as `importSource` provenance on the ledger transaction
//   (re-import detection, Prompt 5A); balances, full raw statements and OCR
//   text never persist.

import type { Currency } from "./types";

/** Cap for preserved raw narration (review/classification input only). */
export const MAX_ORIGINAL_DESCRIPTION_LENGTH = 200;

/** What a statement row represents. Set by CLASSIFICATION, never inferred
 *  from the debit/credit sign. */
export type BankTransactionKind =
  | "expense"
  | "income"
  | "transfer"
  | "internal-transfer"
  | "bank-fee"
  | "tax"
  | "refund"
  | "interest"
  | "loan-payment"
  | "savings"
  | "unknown";

/** Money flow direction — a fact of the statement cell. Mirrors
 *  `ParsedAmount["direction"]` in `lib/statementImport.ts`. */
export type BankDirection = "in" | "out" | "unknown";

/** Deterministic transaction type (Prompt 8F) — WHAT a statement row is, as a
 *  descriptive layer SEPARATE from `BankTransactionKind` and from expense
 *  categories. "Transfer to John" is type "transfer" while its expense
 *  category may later become Personal/Family. A type never encodes income vs
 *  expense and never encodes `direction` (an incoming transfer is still
 *  "transfer", never income). Set by classification; "unknown" when the
 *  narration gives no deterministic signal. */
export type TransactionType =
  | "transfer"
  | "card-payment"
  | "bank-charge"
  | "transfer-fee"
  | "vat"
  | "stamp-duty"
  | "sms-charge"
  | "airtime"
  | "mobile-data"
  | "interest"
  | "refund"
  | "savings"
  | "withdrawal"
  | "deposit"
  | "internal-transfer"
  | "loan-payment"
  | "salary"
  | "unknown";

/** How sure classification is. Extends the existing "high" | "low" pattern
 *  from `lib/categorize.ts` with "medium" and a "none" pre-classification
 *  default. */
export type ClassificationConfidence = "high" | "medium" | "low" | "none";

/** Lifecycle of a normalized transaction inside one import session. */
export type ImportStatus =
  | "draft"
  | "classified"
  | "reviewed"
  | "imported"
  | "skipped";

/** The bank that issued the statement. Detection lands with the parsers;
 *  "other" covers banks without a dedicated parser. Adding a bank parser
 *  (Prompt 7A / 8J) extends this union — one line, no engine changes. */
export type BankSource =
  | "gtco"
  | "opay"
  | "kuda"
  | "palmpay"
  | "owealth"
  | "other"
  | "unknown";

export interface NormalizedBankTransaction {
  /** Session id (stable for this import; NOT a ledger transaction id). */
  id: string;
  /** Statement transaction date in ISO "YYYY-MM-DD"; null when the statement
   *  row carries no readable date. */
  transactionDate: string | null;
  /** Transaction time when the statement provides it ("HH:mm" or "HH:mm:ss",
   *  24h). */
  transactionTime?: string;
  /** Value date (ISO) when the statement reports one separately. */
  valueDate?: string;
  /** Cleaned, human-readable description — the review label and the future
   *  ledger note. */
  description: string;
  /** Raw narration as written by the bank (Prompt 5A provenance). Capped to
   *  MAX_ORIGINAL_DESCRIPTION_LENGTH; classification/review input only, and —
   *  like the reference — persisted ONLY on the confirmed ledger row, capped,
   *  as part of its `importSource` provenance (re-import detection). It is
   *  never logged and never shown in the ledger. */
  originalDescription?: string;
  /** Bank transaction reference — review aid, and provenance for re-import
   *  detection. Only the confirmed row's reference is persisted, capped, as
   *  part of the transaction's importSource provenance; it is never logged. */
  reference?: string;
  /** Absolute debit in minor units, when the statement splits columns. */
  debitAmount?: number;
  /** Absolute credit in minor units, when the statement splits columns. */
  creditAmount?: number;
  /** Running balance after the transaction (minor units), when available. */
  balanceAfter?: number;
  /** Originating branch when the statement reports one (GTCO statements);
   *  provenance for review and classification; only the confirmed row's
   *  reference survives as importSource provenance, never the branch. */
  originatingBranch?: string;
  /** Payment channel when the statement reports one (OPay statements:
   *  "OPay App", "USSD", "Web"…); review aid only, never persisted. */
  channel?: string;
  /** App display currency (from Settings). */
  currency: Currency;
  /** Issuing bank; "unknown" until a parser identifies it. */
  sourceBank: BankSource;
  /** Merchant/recipient — classification output. */
  merchant?: string;
  /** Detected provider (payment processor, wallet…) — classification output. */
  provider?: string;
  /** What the row is. Starts "unknown"; classification decides. */
  type: BankTransactionKind;
  /** What the row is, as a deterministic transaction type (Prompt 8F).
   *  Descriptive only — SEPARATE from `type`/categories, set by
   *  classification, transient, never persisted. */
  txType?: TransactionType;
  /** Flow direction as a statement fact (sign is direction, not meaning). */
  direction: BankDirection;
  confidence: ClassificationConfidence;
  /** Classification output — why the kind/category was chosen (rule id);
   *  transient, shown in review only, never persisted. */
  classificationReason?: string;
  /** Classification output — true when the row cannot be mapped confidently
   *  (unknown kind or no matching category) and the user must review it. */
  needsReview?: boolean;
  /** Classification output — confidence of the automatic CATEGORY assignment
   *  (Prompt 8G). Independent of `confidence` (the kind-level confidence):
   *  "high" = known merchant/provider, "medium" = strong keyword, "low" =
   *  weak evidence that must stay flagged for review. Transient, never
   *  persisted. */
  categoryConfidence?: "high" | "medium" | "low";
  /** Classification output — why the category was chosen (e.g. "merchant:MTN"
   *  or "keyword:shoprite"). Transient, shown in review only. */
  categoryReason?: string;
  status: ImportStatus;
  /** Existing ledger Category id once classified; null until then. */
  categoryId: string | null;
  /** Source row number (1-based) in the parsed statement. */
  row: number;
}

/** Context needed to normalize detection output into ledger-ready rows. */
export interface NormalizationContext {
  /** The app's display currency (from Settings). */
  currency: Currency;
  /** Issuing bank of the statement, once detection exists. */
  sourceBank?: BankSource;
}

// ---------------------------------------------------------------------------
// Bank parser contract (Prompt 7A; hardened 8J).
//
// Every bank parser is a self-contained unit: format detection (headerScore +
// distinctiveTokens), parsing (parse) and format capabilities (capabilities)
// ship together, and the registry (lib/statementRegistry.ts) is the only place
// the pipeline learns about a bank. Adding a bank = 1 new parser file + 1
// registry entry + parser tests; the classification / import engine is never
// touched.
//
//   Statement → format detection (registry) → parser → normalized transactions
// ---------------------------------------------------------------------------

/** Per-row reason a statement row was skipped (parser output). */
export interface StatementRowError {
  /** 1-based row number in the statement (header included). */
  row: number;
  reason: string;
}

/** The output every bank parser produces — the contract's parse side. */
export interface BankParseResult {
  /** Normalized transactions, in statement row order. */
  transactions: NormalizedBankTransaction[];
  /** Rows that looked like transactions but were skipped. */
  skipped: number;
  /** Per-row reasons for the skipped rows. Footer/blank rows are not errors. */
  errors: StatementRowError[];
}

/** How a parser consumes extraction output (Prompt 8J) — what a new bank can
 *  declare when it registers, so the pipeline knows what to expect. */
export interface ParserCapabilities {
  /** True when the parser reads the OCR one-cell-per-line shape (scanned
   *  PDFs). Columnar parsers expect x-split cells and are NOT OCR-aware; a
   *  scanned PDF should only be expected to work for OCR-aware parsers. */
  ocrAware: boolean;
  /** True when the parser merges wrapped continuation lines into transaction
   *  blocks (Kuda's two-line blocks, PalmPay's wrapped Detail/ID). */
  wrappedLines: boolean;
}

/** Per-row y for PDF text-layer statements (larger = higher on the page), or
 *  undefined for CSV/Excel. Wrapped-line parsers (PalmPay) use the geometry
 *  to attach continuation lines to the transaction line they belong to
 *  (Prompt 8J). */
export type StatementLineGeometry = ReadonlyArray<number | undefined>;

/** A bank statement parser — one entry in the parser registry. */
export interface BankStatementParser {
  /** Stable id — also the persisted `importSource.bank` value. */
  id: BankSource;
  /** Display label for the review header ("GTCO", "OPay", …). */
  label: string;
  /** Detection rule — header-vocabulary score for one row (higher = more
   *  evidence this bank wrote the header). */
  headerScore(row: readonly string[]): number;
  /** Detection rule — canonical columns only this bank's exports use;
   *  resolves near-ties between vocabularies. */
  distinctiveTokens: readonly string[];
  /** Detection rule — minimum header evidence before a row counts for this
   *  bank at all. */
  minHeaderScore: number;
  /** How this parser consumes extraction output (OCR-aware, wrapped lines). */
  capabilities: ParserCapabilities;
  /** Converts raw statement cells into normalized transactions. `rowYs` is
   *  the optional PDF geometry (see StatementLineGeometry). */
  parse(
    cells: string[][],
    context: NormalizationContext,
    rowYs?: StatementLineGeometry,
  ): BankParseResult;
}