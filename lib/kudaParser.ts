// Kuda (Kuda Microfinance Bank) statement parser (Prompt 8E).
//
// Kuda statements arrive in TWO forms, and both land here through the SAME
// cell grid:
//
//   1. Text-based PDFs — the pdfjs text layer produces one row per visual
//      line (cells split by column x-gaps).
//   2. Scanned PDFs — OCR (lib/statementOcr.ts) produces the same grid, but
//      with a twist: OCR'd lines usually survive as ONE CELL per line (single
//      spaces, no column gaps), so this parser works on a WHITESPACE TOKEN
//      STREAM rather than fixed cell positions. That is also why the
//      detection rule (kudaHeaderScore) matches multi-word phrases inside
//      cells instead of whole cells.
//
// REAL LAYOUT (from the actual scanned fixture, tests/fixtures/statements/
// Kuda — OCR ground truth in kuda.ocr.txt):
//
//   Account Number  Date
//   <name> <account number> <period: 01/07/2026 - 14/08/2026>
//   <address> ...
//   Opening Balance  Closing Balance
//   ... <opening> <closing>
//   Summary
//   Type  Opening Balance  Closing Balance
//   Spend Account <open> <close>
//   Spend + Save (1 Pocket) <open> <close>
//   Spend Account                       ← per-account section
//   Money In Money Out Opening Balance Closing Balance
//   <totals> <opening> <closing>
//   Date/Time Money In Money Out Category To/From Description Balance  ← header
//   <dd/mm/yy> <amount> <category…> <to/from…> <description…> <balance>  ← line 1
//   <hh:mm:ss> <category…> <description…>                               ← line 2
//   ...
//   Page 1 of 2
//
// Transactions print as TWO lines (date line + time line); the date line
// carries the flow amount and the running balance, the time line continues
// the wrapped category/description. Sections repeat per Kuda pocket.
//
// Notes:
// - Dates print as dd/mm/yy (parseStatementDate gained a 2-digit-year form).
// - The printed naira sign survives OCR as "#" (parseAmountCell tolerates it).
// - There is NO reference column (the "/"-separated strings in Description
//   are narration, preserved verbatim — never parsed as amounts: bare 10+
//   digit runs are treated as text).
// - Direction is a STRUCTURAL fact: the running-balance delta decides first
//   (exact-match chain), then Kuda's own printed Category tag ("outward
//   transfer", "local funds transfer", "spend and save"…). The word
//   "Transfer" alone never decides anything.
// - No channel, value-date or reference columns exist — they stay absent
//   (Prompt 8C honesty — a parser must not fabricate missing fields).
// - One bad row never fails the import: unreadable rows are skipped and
//   reported per-row in `errors`.

import {
  parseAmountCell,
  parseStatementDate,
  type ParsedAmount,
} from "./statementImport";
import {
  MAX_ORIGINAL_DESCRIPTION_LENGTH,
  type BankParseResult,
  type NormalizationContext,
  type NormalizedBankTransaction,
  type StatementRowError,
} from "./statementTypes";

export interface KudaRowError extends StatementRowError {
  reason: "missing debit and credit" | "unresolved direction";
}

/** Kuda parser output — conforms to the bank parser contract (Prompt 7A). */
export type KudaParseResult = BankParseResult;

// ---------------------------------------------------------------------------
// Format detection — phrase-aware (Prompt 8E: OCR'd lines arrive as one cell
// per line, so vocabulary is matched inside cells, never by cell position).
// ---------------------------------------------------------------------------

/** Unit/currency markers that add no vocabulary ("(NGN)", "(₦)"). */
const UNIT_TOKEN_RE = /^(ngn|naira|usd|gbp|eur|₦|n)$/i;

/** Normalized tokens of a cell: lowercase, parens and stray dots removed
 *  ("Money In (NGN)" → ["money", "in"], "Trans." → ["trans"]). */
function cellTokens(cell: string): string[] {
  return String(cell ?? "")
    .toLowerCase()
    .split(/[()]/g)
    .flatMap((part) => part.replace(/\./g, "").split(/\s+/))
    .filter((token) => token !== "" && !UNIT_TOKEN_RE.test(token));
}

/** Weighted Kuda header phrases — multi-word anchors that survive both the
 *  column-split text layer AND the one-cell-per-line OCR form. */
const KUDA_HEADER_PHRASES: ReadonlyArray<[RegExp, number]> = [
  [/date\/time/, 3],
  [/\bmoney in\b/, 2],
  [/\bmoney out\b/, 2],
  [/\bopening balance\b/, 3],
  [/\bclosing balance\b/, 3],
  [/to\/from/, 2],
  [/\bspend account\b/, 2],
  [/\bspend\s*\+\s*save\b/, 2],
  [/\bcategory\b/, 1],
  [/\bdescription\b/, 1],
  [/\bsummary\b/, 1],
  [/\baccount number\b/, 1],
];

/** Header-vocabulary score for one row — format detection helper
 *  (lib/statementPipeline.ts). Scans the row's token stream for Kuda's
 *  multi-word anchors; generic words ("transfer", "statement", "date" alone)
 *  contribute NOTHING, so a random transfer-heavy statement scores zero. */
export function kudaHeaderScore(row: readonly string[]): number {
  const text = row.flatMap((cell) => cellTokens(cell)).join(" ");
  return KUDA_HEADER_PHRASES.reduce(
    (sum, [re, weight]) => (re.test(text) ? sum + weight : sum),
    0,
  );
}

// ---------------------------------------------------------------------------
// Parsing.
// ---------------------------------------------------------------------------

/** Row whose leading words mark a section boundary (not transaction content):
 *  summary rows, pocket headers, table headers, page footers. Closes the
 *  current transaction and resets the balance chain. */
const SECTION_MARKER_RE =
  /^(date\/time|money in|money out|opening balance|closing balance|spend account|spend\s*\+\s*save|summary|type|account number|date)(\s.*)?$/i;
const PAGE_MARKER_RE = /^page \d+ of \d+(\s.*)?$/i;

function isSectionRow(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const text = tokens
    .map((token) => token.toLowerCase().split(/[()]/g).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return SECTION_MARKER_RE.test(text) || PAGE_MARKER_RE.test(text);
}

/** "HH:mm[:ss]" → normalized 24h time, or null when not a time token. */
const TIME_TOKEN_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function timeToken(token: string): string | null {
  const m = TIME_TOKEN_RE.exec(token);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = m[3] === undefined ? undefined : Number(m[3]);
  if (hours > 23 || minutes > 59 || (seconds !== undefined && seconds > 59)) {
    return null;
  }
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}${
    seconds !== undefined ? `:${pad(seconds)}` : ""
  }`;
}

/** Bare 10+ digit runs are account numbers / reference-like strings, never
 *  statement amounts ("3000127755" ≠ ₦3000127755). */
const BARE_DIGIT_RE = /^\d{10,}$/;

function amountToken(token: string): ParsedAmount | null {
  if (BARE_DIGIT_RE.test(token)) return null;
  return parseAmountCell(token);
}

/** Kuda's own printed Category tags — direction fallback when the balance
 *  chain cannot decide. The statement's structure, never the narration's
 *  generic words. */
const DIRECTION_TAGS: ReadonlyArray<[RegExp, "in" | "out"]> = [
  [/\blocal funds\b/i, "in"],
  [/\bincoming\b/i, "in"],
  [/\btop up\b/i, "in"],
  [/\bsalary\b/i, "in"],
  [/\bdeposit\b/i, "in"],
  [/\brefund\b/i, "in"],
  [/\binterest\b/i, "in"],
  [/\bcredit\b/i, "in"],
  [/\boutward\b/i, "out"],
  [/\bspend\b/i, "out"],
  [/\bmerchant payment\b/i, "out"],
  [/\bwithdraw\w*\b/i, "out"],
  [/\bbill payment\b/i, "out"],
  [/\bstamp duty\b/i, "out"],
  [/\bbank charges\b/i, "out"],
  [/\bdebit\b/i, "out"],
];

/** Balance-delta must match the flow amount exactly (kobo); the printed
 *  balances are exact, so any larger mismatch means OCR noise → untrusted. */
const BALANCE_EPSILON = 1;

function tagDirection(text: string): "in" | "out" | undefined {
  let inHit = false;
  let outHit = false;
  for (const [re, direction] of DIRECTION_TAGS) {
    if (!re.test(text)) continue;
    if (direction === "in") inHit = true;
    else outHit = true;
  }
  if (inHit && !outHit) return "in";
  if (outHit && !inHit) return "out";
  return undefined;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** One transaction block in flight: the date row plus its continuation lines
 *  (wrapped category/description). */
interface KudaTransaction {
  rowNumber: number;
  date: string;
  time?: string;
  /** Token stream of the whole printed block (date row + continuation rows),
   *  amounts and times excluded — the preserved original description. */
  textTokens: string[];
  /** Amount tokens in row order. */
  amountTokens: ParsedAmount[];
  /** True once a time-led continuation (or a date-row time) was merged —
   *  stray text-only rows after that are OCR noise, not more description. */
  hasTimeRow: boolean;
}

export function parseKudaStatement(
  cells: string[][],
  context: NormalizationContext,
  _rowYs?: readonly (number | undefined)[],
): KudaParseResult {
  const rows = cells
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => !row.every((cell) => cell === ""));

  const transactions: NormalizedBankTransaction[] = [];
  const errors: KudaRowError[] = [];
  let skipped = 0;

  /** Previous resolved transaction's running balance — the direction chain. */
  let previousBalance: number | null = null;
  let open: KudaTransaction | null = null;

  const finalize = (): void => {
    if (open === null) return;
    const tx = open;
    open = null;

    const text = tx.textTokens.join(" ").replace(/\s+/g, " ").trim();
    if (tx.amountTokens.length === 0) {
      skipped += 1;
      errors.push({ row: tx.rowNumber, reason: "missing debit and credit" });
      return;
    }

    const flow = tx.amountTokens[0].minor;
    // A separate trailing amount is the running balance; a single amount is
    // the flow only (the balance column was lost — never mislabel it).
    const balance =
      tx.amountTokens.length >= 2
        ? tx.amountTokens[tx.amountTokens.length - 1].minor
        : undefined;

    let direction: "in" | "out" | undefined;
    let trusted = false;
    if (balance !== undefined && previousBalance !== null) {
      const delta = balance - previousBalance;
      if (delta !== 0 && Math.abs(Math.abs(delta) - flow) <= BALANCE_EPSILON) {
        direction = delta > 0 ? "in" : "out";
        trusted = true;
      }
    }
    if (direction === undefined) direction = tagDirection(text);
    if (direction === undefined) {
      skipped += 1;
      errors.push({ row: tx.rowNumber, reason: "unresolved direction" });
      return;
    }
    // An untrusted delta (mismatch) poisons the chain — drop it rather than
    // propagate a wrong anchor.
    previousBalance = trusted && balance !== undefined ? balance : null;

    const description = truncate(text, MAX_ORIGINAL_DESCRIPTION_LENGTH);

    transactions.push({
      id: `kd-r${tx.rowNumber}`,
      transactionDate: tx.date,
      transactionTime: tx.time,
      description: description === "" ? "(no description)" : description,
      originalDescription: description === "" ? undefined : description,
      debitAmount: direction === "out" ? flow : undefined,
      creditAmount: direction === "in" ? flow : undefined,
      balanceAfter: balance,
      currency: context.currency,
      sourceBank: "kuda",
      type: "unknown",
      direction,
      confidence: "none",
      status: "draft",
      categoryId: null,
      row: tx.rowNumber,
    });
  };

  rows.forEach((row, offset) => {
    const tokens = row
      .flatMap((cell) => String(cell ?? "").split(/\s+/))
      .filter((token) => token !== "");
    if (tokens.length === 0) return;

    const first = tokens[0];
    const parsedDate = parseStatementDate(first);

    if (parsedDate !== null) {
      // A transaction's date row. The optional immediate next token is its
      // time ("01/08/26 13:05:08" printed as one visual line).
      finalize();
      const time =
        tokens.length > 1 ? timeToken(tokens[1]) ?? undefined : undefined;
      const textStart = time !== undefined ? 2 : 1;
      const amountTokens: ParsedAmount[] = [];
      const textTokens: string[] = [];
      for (const token of tokens.slice(textStart)) {
        const amount = amountToken(token);
        if (amount !== null) amountTokens.push(amount);
        else textTokens.push(token);
      }
      open = {
        rowNumber: offset + 1,
        date: parsedDate,
        time,
        textTokens,
        amountTokens,
        hasTimeRow: time !== undefined,
      };
      return;
    }

    if (isSectionRow(tokens)) {
      finalize();
      previousBalance = null;
      return;
    }

    if (open !== null) {
      // Continuation line of the open transaction. Line 2 carries the time;
      // once that time row is merged, only time-led lines continue the
      // description — stray text after a completed block is OCR noise
      // (e.g. page-1 footer junk), never transaction content.
      const time = timeToken(first);
      if (time !== null) {
        if (open.time === undefined) open.time = time;
        open.hasTimeRow = true;
        open.textTokens.push(...tokens.slice(1));
      } else if (!open.hasTimeRow) {
        open.textTokens.push(...tokens);
      }
      return;
    }

    // Header/metadata region: not a date, not a section row, no open
    // transaction (account header block, address lines, OCR noise).
  });

  finalize();

  return { transactions, skipped, errors };
}
