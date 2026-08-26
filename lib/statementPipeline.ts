// Bank statement processing pipeline (Prompt 3F, registry-driven since 7A).
//
//   Statement cells
//     → format detection (parser registry: header vocabulary + distinctive
//       columns — GTCO, OPay, …; the bank name is never consulted)
//     → bank-specific parser (BANK_PARSERS, lib/statementRegistry.ts)
//     → normalized transactions
//     → classification (suggested kind + category)
//     → relationship detection (duplicates + links + money movement)
//     → preview-ready transaction list
//
// The pipeline runs through the CONFIRM step: `planImport` turns the reviewed
// session rows into ledger-ready inputs (or explains why a row can't be
// imported). Nothing is ever written here — the caller (the modal's confirm
// button) hands the plan to `addTransactions`.
//
// Unrecognized statements (Prompt 7A §4) are reported as UNSUPPORTED — the
// pipeline never guesses a format. The generic detection path was removed:
// an unknown layout yields an explanation, not invented transactions.

import { classifyTransactions } from "./statementClassify";
import { headerToken } from "./statementColumnar";
import { BANK_PARSERS, supportedBankList } from "./statementRegistry";
import {
  detectRelationships,
  type DuplicateGroup,
  type RelationshipReport,
} from "./statementRelations";
import { matchExistingTransaction, type LedgerTransactionSlice } from "./statementIdentity";
import type { Category, LearnedRule, TransactionInput } from "./types";
import { MAX_NOTE_LENGTH } from "./validate";
import type {
  BankDirection,
  BankSource,
  BankStatementParser,
  BankTransactionKind,
  NormalizationContext,
  NormalizedBankTransaction,
  StatementLineGeometry,
  StatementRowError,
} from "./statementTypes";

export type { StatementRowError } from "./statementTypes";

export interface StatementFormatDetection {
  /** Detected parser id, or "unknown" when no supported bank matched. */
  bank: BankSource;
  confidence: "high" | "medium";
  /** Human-readable explanation (scores) — shown in review. */
  reason: string;
}

function distinctiveCount(
  row: readonly string[],
  tokens: readonly string[],
): number {
  const seen = new Set(row.map(headerToken));
  return tokens.filter((token) => seen.has(token)).length;
}

/** Evidence each registered parser found in the statement's header rows. */
interface ParserEvidence {
  parser: BankStatementParser;
  bestScore: number;
  distinctive: number;
}

function collectEvidence(
  parsers: readonly BankStatementParser[],
  rows: string[][],
): ParserEvidence[] {
  return parsers.map((parser) => {
    let bestScore = 0;
    let distinctive = 0;
    for (const row of rows) {
      bestScore = Math.max(bestScore, parser.headerScore(row));
      distinctive = Math.max(distinctive, distinctiveCount(row, parser.distinctiveTokens));
    }
    return { parser, bestScore, distinctive };
  });
}

/**
 * Identifies the statement's bank from header structure alone (never the
 * file name or a bank name cell). Every registered parser contributes its own
 * detection rule (header vocabulary + distinctive columns); the highest
 * score wins — decisively (gap ≥ 3 → high confidence) or by a distinctive
 * tie-break (medium) — and anything that matches no bank, or matches several
 * too closely, is reported as unknown.
 *
 * `parsers` defaults to the real registry (lib/statementRegistry.ts) and can
 * be overridden for tests — extending the registry never changes how the
 * existing parsers are scored.
 */
export function detectStatementFormat(
  cells: string[][],
  parsers: readonly BankStatementParser[] = BANK_PARSERS,
): StatementFormatDetection {
  const rows = cells
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => !row.every((cell) => cell === ""))
    .slice(0, 12);

  const evidence = collectEvidence(parsers, rows);
  const viable = evidence.filter((entry) => entry.bestScore >= entry.parser.minHeaderScore);

  if (viable.length === 0) {
    return {
      bank: "unknown",
      confidence: "medium",
      reason: "no bank header vocabulary found",
    };
  }

  viable.sort((a, b) => b.bestScore - a.bestScore);
  const top = viable[0];
  const scoreGap = top.bestScore - (viable[1]?.bestScore ?? 0);

  if (scoreGap >= 3) {
    return {
      bank: top.parser.id,
      confidence: "high",
      reason: `${top.parser.label} header vocabulary (score ${top.bestScore}, distinctive ${top.distinctive})`,
    };
  }

  // Close race — within 3 points of the leader, the canonical distinctive
  // columns decide: the contender with the uniquely-highest distinctive count
  // wins (medium confidence); a distinctive tie stays ambiguous.
  const contenders = viable.filter(
    (entry) => top.bestScore - entry.bestScore < 3,
  );
  const maxDistinctive = Math.max(...contenders.map((entry) => entry.distinctive));
  const distinctiveLeaders = contenders.filter(
    (entry) => entry.distinctive === maxDistinctive,
  );
  if (distinctiveLeaders.length === 1) {
    const winner = distinctiveLeaders[0];
    return {
      bank: winner.parser.id,
      confidence: "medium",
      reason: `${winner.parser.label} header vocabulary (score ${winner.bestScore}, distinctive ${winner.distinctive})`,
    };
  }
  return {
    bank: "unknown",
    confidence: "medium",
    reason: `ambiguous headers (${viable
      .map((entry) => `${entry.parser.label} ${entry.bestScore}`)
      .join(", ")})`,
  };
}

export interface StatementPipelineInput {
  /** Raw statement cells (from parseCsv / rowsFromExcel / rowsFromPdf). */
  cells: string[][];
  /** Currency + optional source bank for the normalized layer. */
  context: NormalizationContext;
  /** Existing app categories — the single category system. */
  categories: readonly Category[];
  /** Learned rules (Prompt 6A) — applied before the built-in rules. */
  learnedRules?: readonly LearnedRule[];
  /** Per-row y for PDF text-layer statements (see StatementLineGeometry). */
  rowYs?: StatementLineGeometry;
}

const EMPTY_RELATIONSHIP_REPORT: RelationshipReport = {
  duplicates: [],
  links: [],
  movementIds: [],
};

export type StatementSupportStatus = "supported" | "unsupported";

export interface StatementPreview {
  /** "unsupported" when no registered parser recognized the statement —
   *  nothing was guessed or read. */
  status: StatementSupportStatus;
  /** Why the statement was not recognized (shown verbatim). */
  unsupportedReason?: string;
  /** How the statement was identified. */
  detectedBank: BankSource;
  /** Display label of the detected parser ("GTCO", "OPay"). */
  detectedLabel: string;
  detectionReason: string;
  /** Classified transactions, in statement row order. */
  transactions: NormalizedBankTransaction[];
  /** Duplicates, links and money-movement ids. */
  report: RelationshipReport;
  /** Rows that looked like transactions but were skipped. */
  skipped: number;
  /** Per-row parser errors (bank parsers only). */
  errors: StatementRowError[];
}

/**
 * Runs the full statement pipeline and STOPS at the preview. Pure — never
 * writes to the budget, the store or storage. Statements no registered
 * parser recognizes come back as `status: "unsupported"` with a useful
 * explanation and zero transactions — the pipeline does not guess.
 *
 * `parsers` defaults to the real registry and can be overridden for tests.
 */
export function processStatement(
  input: StatementPipelineInput,
  parsers: readonly BankStatementParser[] = BANK_PARSERS,
): StatementPreview {
  const detection = detectStatementFormat(input.cells, parsers);

  const parser = parsers.find((candidate) => candidate.id === detection.bank);
  if (detection.bank === "unknown" || parser === undefined) {
    return {
      status: "unsupported",
      unsupportedReason: unsupportedExplanation(detection),
      detectedBank: "unknown",
      detectedLabel: "Unknown",
      detectionReason: detection.reason,
      transactions: [],
      report: EMPTY_RELATIONSHIP_REPORT,
      skipped: 0,
      errors: [],
    };
  }

  const parsed = parser.parse(input.cells, input.context, input.rowYs);
  return finish(
    parsed.transactions,
    parsed.skipped,
    parsed.errors,
    parser,
    detection,
    input.categories,
    input.learnedRules,
  );
}

/** "Unsupported bank statement format" explanation (Prompt 7A §4) — why the
 *  statement was not recognized and that nothing was guessed. */
export function unsupportedExplanation(detection: StatementFormatDetection): string {
  const known = supportedBankList();
  if (detection.reason === "no bank header vocabulary found") {
    return (
      `We couldn't recognize this statement's layout — it matches none of the ` +
      `supported banks (${known}). Nothing was read from the file. It may be ` +
      `from a bank we don't support yet, or not a bank statement.`
    );
  }
  return (
    `We couldn't tell which bank this statement is from — its layout looks like ` +
    `a mix of several supported banks (${known}). Nothing was read from the file. ` +
    `We only import statements we can identify confidently.`
  );
}

function finish(
  transactions: NormalizedBankTransaction[],
  skipped: number,
  errors: StatementRowError[],
  parser: BankStatementParser,
  detection: StatementFormatDetection,
  categories: readonly Category[],
  learnedRules?: readonly LearnedRule[],
): StatementPreview {
  const classified = classifyTransactions(transactions, categories, learnedRules);
  const report = detectRelationships(classified);
  return {
    status: "supported",
    detectedBank: parser.id,
    detectedLabel: parser.label,
    detectionReason: detection.reason,
    transactions: classified,
    report,
    skipped,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Import planning — the Confirm step (Prompts 4D + 5A).
//
// The preview holds classified rows the USER may have edited (type, category,
// excluded). `planImport` turns the current session state into ledger-ready
// `TransactionInput`s — or explains why a row can't be imported. Pure and
// deterministic: the plan is recomputed at Import-click time, so it always
// matches what the user sees. Confirmed inputs carry `importSource`
// provenance (bank, reference, original description, statement date) so
// re-imports of the same statement can be detected and skipped (Prompt 5A).
// ---------------------------------------------------------------------------

/** The ledger side a classified row can take, when any: expense and income
 *  kinds map to categories; refunds and interest are income; an unknown row
 *  gets a pool by its flow direction. Transfers, fees, taxes, savings and
 *  loan payments are NOT spending or earning — they get no category and are
 *  never imported into the ledger. */
export function ledgerKindFor(
  tx: Pick<NormalizedBankTransaction, "type" | "direction">,
): "income" | "expense" | null {
  if (tx.type === "expense") return "expense";
  if (tx.type === "income" || tx.type === "refund" || tx.type === "interest") {
    return "income";
  }
  if (tx.type === "unknown") return tx.direction === "in" ? "income" : "expense";
  return null;
}

/** The slice of a review row the import planner needs. */
export interface ImportRow {
  id: string;
  type: BankTransactionKind;
  direction: BankDirection;
  categoryId: string | null;
  transactionDate: string | null;
  description: string;
  debitAmount?: number;
  creditAmount?: number;
  /** User-chosen skip (session-only). */
  excluded: boolean;
  /** Issuing bank (provenance). */
  sourceBank: BankSource;
  /** Bank transaction reference (capped) — provenance + re-import signal. */
  reference?: string;
  /** Raw narration as written by the bank (capped) — provenance. */
  originalDescription?: string;
  /** Value date from the statement (provenance). */
  valueDate?: string;
  /** User decision for POSSIBLE-duplicate rows: skip this row when
   *  importing. Session-only; confirmed duplicates are skipped regardless. */
  skipAsDuplicate?: boolean;
  /**
   * FR-23: the user's explicit choice for a row flagged as a likely
   * duplicate. `undefined` means the row was never flagged; "unresolved"
   * means it was flagged and the user has not chosen yet, which BLOCKS the
   * import rather than guessing on their behalf.
   */
  duplicateResolution?: DuplicateResolution;
  /** The existing ledger id this row was flagged against, carried through so
   *  "replace" knows what to remove. */
  duplicateOfId?: string;
}

export interface ImportSkipCounts {
  /** User excluded the row. */
  excluded: number;
  /** Transfers, fees, taxes, savings, loan payments — not ledger items. */
  movements: number;
  /** No readable date — the ledger requires one. */
  noDate: number;
  /** Extra copies inside a duplicate group (the first is kept). */
  duplicates: number;
  /** Rows already in the ledger (same reference, or same amount + date +
   *  description when the ledger row has no reference) — re-imported
   *  statements are detected and not double-booked. */
  alreadyExisting: number;
  /** Possible-duplicate rows the user chose to skip. */
  possibleSkipped: number;
  /** Rows that could not be mapped to a ledger row. */
  failed: number;
}

/**
 * What the user decided about a row flagged as a likely duplicate (FR-23).
 * There is deliberately no default: every flagged row must be answered.
 */
export type DuplicateResolution =
  /** Flagged, not yet answered — the import cannot finish. */
  | "unresolved"
  /** Keep the existing entry only; do not import this row. */
  | "skip"
  /** Genuinely different — import it as its own transaction. */
  | "import"
  /** The import has better detail; delete the existing entry and import. */
  | "replace";

export interface ImportPlan {
  /** Ledger rows ready for `addTransactions`: type matches the category
   *  kind, amount > 0 (absolute, minor units), ISO date, note capped,
   *  provenance attached. */
  inputs: TransactionInput[];
  /** Session ids of the rows that were actually imported — used to learn
   *  classification corrections only from rows that entered the ledger. */
  importedIds: string[];
  /** Why the other rows were not imported (for the done summary). */
  skipped: ImportSkipCounts;
  /** Ledger-able rows that still have no category — import MUST NOT
   *  proceed until these get one (the ledger requires a category). */
  missingCategory: number;
  /** FR-23: flagged duplicates the user has not answered yet. Import MUST
   *  NOT proceed while this is above zero — the whole point is that nothing
   *  is silently double-counted OR silently discarded. */
  unresolvedDuplicates: number;
  /** Existing ledger ids to delete because the user chose "replace". The
   *  caller performs the deletion alongside the write. */
  replacedTransactionIds: string[];
}

/** Plans the confirm-step write from the current review session. The first
 *  importable row of each duplicate group is kept; the rest are skipped.
 *  `existing` is the ledger as it stands right now — rows matched by
 *  statement identity (Prompt 5B) are reported as already existing and never
 *  written twice; possible duplicates are imported unless the user chose to
 *  skip them (`skipAsDuplicate`). */
export function planImport(
  rows: ImportRow[],
  duplicates: DuplicateGroup[],
  existing: readonly LedgerTransactionSlice[] = [],
): ImportPlan {
  const skipped: ImportSkipCounts = {
    excluded: 0,
    movements: 0,
    noDate: 0,
    duplicates: 0,
    alreadyExisting: 0,
    possibleSkipped: 0,
    failed: 0,
  };
  const inputs: TransactionInput[] = [];
  const importedIds: string[] = [];
  const replacedTransactionIds: string[] = [];
  let missingCategory = 0;
  let unresolvedDuplicates = 0;

  const importable = rows.filter((row) => {
    if (row.excluded) {
      skipped.excluded += 1;
      return false;
    }
    if (ledgerKindFor(row) === null) {
      skipped.movements += 1;
      return false;
    }
    if (row.transactionDate === null) {
      skipped.noDate += 1;
      return false;
    }
    return true;
  });

  const duplicateExtras = new Set<string>();
  for (const group of duplicates) {
    const members = group.ids.filter((id) => importable.some((row) => row.id === id));
    if (members.length > 1) {
      for (const id of members.slice(1)) duplicateExtras.add(id);
    }
  }

  for (const row of importable) {
    if (duplicateExtras.has(row.id)) {
      skipped.duplicates += 1;
      continue;
    }
    // FR-23: an explicitly flagged row is answered by the user, never by us.
    // This runs BEFORE the identity check so a "replace" or "import anyway"
    // decision is honoured even for a row identity would have discarded.
    if (row.duplicateResolution !== undefined) {
      if (row.duplicateResolution === "unresolved") {
        unresolvedDuplicates += 1;
        continue;
      }
      if (row.duplicateResolution === "skip") {
        skipped.possibleSkipped += 1;
        continue;
      }
      if (row.duplicateResolution === "replace" && row.duplicateOfId) {
        replacedTransactionIds.push(row.duplicateOfId);
      }
      // "import" and "replace" both fall through to the normal write path.
    } else {
      const match = matchExistingTransaction(row, existing);
      if (match.status === "already-imported") {
        skipped.alreadyExisting += 1;
        continue;
      }
      if (match.status === "possible-duplicate") {
        if (row.skipAsDuplicate === true) {
          skipped.possibleSkipped += 1;
          continue;
        }
      }
    }
    const ledger = ledgerKindFor(row);
    if (ledger === null) continue;
    if (row.categoryId === null) {
      missingCategory += 1;
      continue;
    }
    const amount = ledger === "expense" ? row.debitAmount : row.creditAmount;
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
      skipped.failed += 1;
      continue;
    }
    const note = row.description.slice(0, MAX_NOTE_LENGTH);
    inputs.push({
      categoryId: row.categoryId,
      amount,
      type: ledger,
      date: row.transactionDate as string,
      note,
      importSource: {
        source: "statement-import",
        bank: row.sourceBank,
        reference: row.reference,
        originalDescription: row.originalDescription,
        statementDate: row.valueDate,
      },
    });
    importedIds.push(row.id);
  }

  return {
    inputs,
    importedIds,
    skipped,
    missingCategory,
    unresolvedDuplicates,
    replacedTransactionIds,
  };
}