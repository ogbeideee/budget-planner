// PalmPay statement parser (Prompt 8J).
//
// PalmPay's exported statement PDFs carry a text layer, so they arrive as a
// column-split cell grid (lib/statementImport.ts groupPdfLines, top-down
// reading order). The real statement (tests/fixtures/statements/Palmpay/ —
// 75 certified rows, printed totals ₦183,800.71 in / ₦340,270.00 out) prints:
//
//   Name · Phone Number · Account Number · Total Money In · Statement Period
//   · Total Money Out · Print Time · Address
//   Transaction Date | Transaction Detail | Money In (NGN) | Money Out (NGN)
//     | Transaction ID
//   <MM/DD/YYYY HH:MM:SS AM/PM> <detail…> <+amount | −amount> <id…>
//   <wrapped detail/id continuation lines>          ← same printed row, next line
//
// Layout facts this parser honours (Prompt 8C honesty):
// - Dates are US-ordered MM/DD/YYYY (NOT the NGN day-first norm) — parsed
//   month-first so "08/09/2026" is 9 August, never 8 September.
// - Amounts are SIGNED columns: "+" lives only in Money In (income), "−" only
//   in Money Out (expense). Direction comes from the column, never guessed.
// - There is NO running balance, NO category column and NO value date — all
//   stay absent (never fabricated).
// - Transaction Detail and Transaction ID may WRAP across lines; the detail
//   reads as one description and the ID joins with a space (capability
//   `wrappedLines`).
// - Page footers are lone page numbers ("1"…"3") — never transactions.

import {
  parseAmountCell,
  parseStatementDateTime,
  type StatementDateOrder,
} from "./statementImport";
import { headerToken } from "./statementColumnar";
import {
  MAX_ORIGINAL_DESCRIPTION_LENGTH,
  type BankParseResult,
  type NormalizationContext,
  type NormalizedBankTransaction,
  type StatementRowError,
} from "./statementTypes";
/** Cap for the transient Transaction ID (review aid only). */
export const MAX_PALMPAY_REFERENCE_LENGTH = 80;

export interface PalmpayRowError extends StatementRowError {
  reason: "invalid date" | "unparseable amount" | "missing debit and credit";
}

/** PalmPay parser output — conforms to the bank parser contract (Prompt 7A). */
export type PalmpayParseResult = BankParseResult;

const PALMPAY_DATE_ORDER: StatementDateOrder = "month-day";

// ---------------------------------------------------------------------------
// Format detection — the 5-column table header vocabulary.
// ---------------------------------------------------------------------------

const PALMPAY_ROLE_RE = {
  date: /^transaction date$/,
  detail: /^transaction detail$/,
  moneyIn: /^money in$/,
  moneyOut: /^money out$/,
  id: /^transaction id$/,
} as const;

/** Header-vocabulary score for one row — format detection helper
 *  (lib/statementPipeline.ts). Weights: date 3, detail/money-in/money-out/id
 *  2 each → the real table header scores 11; a bare "Transaction Date +
 *  Transaction Detail" scores 5 (< the registry's min 6). */
export function palmpayHeaderScore(row: readonly string[]): number {
  return row.reduce((sum, cell) => {
    const token = headerToken(String(cell ?? ""));
    let score = 0;
    if (PALMPAY_ROLE_RE.date.test(token)) score += 3;
    if (PALMPAY_ROLE_RE.detail.test(token)) score += 2;
    if (PALMPAY_ROLE_RE.moneyIn.test(token)) score += 2;
    if (PALMPAY_ROLE_RE.moneyOut.test(token)) score += 2;
    if (PALMPAY_ROLE_RE.id.test(token)) score += 2;
    return sum + score;
  }, 0);
}

// ---------------------------------------------------------------------------
// Parsing.
// ---------------------------------------------------------------------------

/** A row whose first cell is a PalmPay date ("MM/DD/YYYY HH:MM:SS AM/PM"). */
function isPalmPayDateCell(value: string): boolean {
  return parseStatementDateTime(value, PALMPAY_DATE_ORDER) !== null;
}

function isDateLine(row: readonly string[]): boolean {
  return row.length > 0 && isPalmPayDateCell(String(row[0] ?? "").trim());
}

/** The account/table header row: carries all three table-header markers. */
function isTableHeader(row: readonly string[]): boolean {
  const text = row.join(" ");
  return (
    text.includes("Transaction Date") &&
    text.includes("Transaction Detail") &&
    text.includes("Transaction ID")
  );
}

/** A lone page-number line ("1" … "3") — never a fragment. Tolerates
 *  trailing empty cells so the guard also holds on CSV-style rows. */
function isPageNumber(row: readonly string[]): boolean {
  const cells = row.filter((cell) => String(cell ?? "").trim() !== "");
  return cells.length === 1 && /^\d{1,3}$/.test(cells[0]);
}

/** A signed amount cell ("+1,234.56" / "-1,234.56"). PalmPay amounts are
 *  always signed, which is what keeps a pure-digit Transaction ID from ever
 *  being read as an amount. */
const SIGNED_AMOUNT_RE = /^[+\-]/;

function signedMinor(cell: string): { minor: number; direction: "in" | "out" } | null {
  if (!SIGNED_AMOUNT_RE.test(cell)) return null;
  const parsed = parseAmountCell(cell);
  if (parsed === null) return null;
  // PalmPay's money columns are SIGNED: "+" lives only in Money In, "−" only
  // in Money Out. The sign decides the direction, never the amount parser's
  // "unknown" default.
  return {
    minor: parsed.minor,
    direction: String(cell).trim().startsWith("+") ? "in" : "out",
  };
}

/** An ID fragment: a word-like token (no spaces) carrying a digit or "_"
 *  ("20260809114820399392", "0649447", "at_38koe31701"). Detail fragments
 *  carry spaces or are pure letters ("Received from DAVID", "OSAHON
 *  OGBEIDE", "loan"). */
function isIdFragment(cell: string): boolean {
  const value = String(cell ?? "").trim();
  if (value === "" || value.includes(" ")) return false;
  return /[\d_]/.test(value);
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

interface PalmPayBlock {
  rowNumber: number;
  date: string;
  time?: string;
  /** Reading-order description fragments. */
  detail: string[];
  /** Reading-order Transaction ID fragments. */
  id: string[];
  /** The signed amount cell's minor units + direction. */
  amount: { minor: number; direction: "in" | "out" };
}

export function parsePalmPayStatement(
  cells: string[][],
  context: NormalizationContext,
  rowYs?: readonly (number | undefined)[],
): PalmpayParseResult {
  const rows = cells
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => !row.every((cell) => cell === ""));

  const headerIndex = rows.findIndex(isTableHeader);
  const dateLineIndexes = new Set<number>();
  rows.forEach((row, index) => {
    if (index !== headerIndex && isDateLine(row)) dateLineIndexes.add(index);
  });

  /** Fragments (detail vs Transaction-ID) of a continuation line, in reading
   *  order — the ID carries digits/_ and no spaces; everything else is
   *  narration detail. */
  const classifyFragments = (
    cells: readonly string[],
    detail: string[],
    id: string[],
  ): void => {
    for (const cell of cells) {
      const value = String(cell ?? "").trim();
      if (value === "") continue;
      if (signedMinor(value) !== null) continue;
      if (isIdFragment(value)) id.push(value);
      else detail.push(value);
    }
  };

  const blocks: PalmPayBlock[] = [];
  const errors: PalmpayRowError[] = [];
  let skipped = 0;

  if (rowYs !== undefined && rowYs.length >= rows.length) {
    // ---------------------------------------------------------------------
    // Geometry path (PDF text layer): a continuation line sits ~4 units from
    // ITS transaction line and ~21 from the neighbouring one, so each
    // continuation is attached to the date line it is closest to in y. This
    // is what makes the real PalmPay wrapped rows merge correctly — index
    // adjacency alone is ambiguous (Prompt 8J).
    //
    // pdfjs y RESETS on every page, so within a page y is monotone-decreasing
    // and jumps back up at each page break. Attachments must never cross a
    // page boundary — a page-2 fragment at y=568.5 would otherwise glue onto
    // a page-1 date line at y=570.5. Pages are derived from the y jumps.
    // ---------------------------------------------------------------------
    const pageIds: number[] = [];
    let pageId = 0;
    for (let i = 0; i < rowYs.length; i += 1) {
      const prev = i > 0 ? rowYs[i - 1] : undefined;
      const cur = rowYs[i];
      if (prev !== undefined && cur !== undefined && cur > prev) pageId += 1;
      pageIds.push(pageId);
    }

    const candidates: Array<{ index: number; y: number; page: number }> = [];
    rows.forEach((row, index) => {
      if (dateLineIndexes.has(index) || index === headerIndex || isPageNumber(row)) {
        return;
      }
      if (row.some((cell) => signedMinor(cell) !== null)) return;
      const y = rowYs[index];
      if (y === undefined) return;
      candidates.push({ index, y, page: pageIds[index] });
    });

    for (const index of [...dateLineIndexes].sort((a, b) => a - b)) {
      const dateY = rowYs[index] as number;
      const page = pageIds[index];
      const before: string[] = [];
      const after: string[] = [];
      const idBefore: string[] = [];
      const idAfter: string[] = [];
      for (const candidate of candidates) {
        if (candidate.page !== page) continue;
        const distance = Math.abs(candidate.y - dateY);
        // Fragments print at ±4; date lines are ~25 apart, so "within 8" is
        // unambiguous (a candidate is never within 8 of two date lines).
        if (distance > 8) continue;
        // Reading order is top-down (larger y first): a fragment ABOVE the
        // date line (its first wrapped line) precedes it, one below follows.
        if (candidate.y > dateY) {
          classifyFragments(rows[candidate.index], before, idBefore);
        } else {
          classifyFragments(rows[candidate.index], after, idAfter);
        }
      }
      const block = buildBlock(rows[index], index, before, after, idBefore, idAfter);
      if (block === null) {
        skipped += 1;
        errors.push({ row: index + 1, reason: "missing debit and credit" });
        continue;
      }
      blocks.push(block);
    }
  } else {
    // ---------------------------------------------------------------------
    // Index fallback (CSV/Excel or geometry-less input): a transaction line
    // claims the continuation rows immediately above and below it, walking
    // until a guard stops the run. Correct for simple layouts; the real
    // PalmPay PDF should always arrive with rowYs.
    // ---------------------------------------------------------------------
    const consumed = new Set<number>();
    const collectSide = (
      start: number,
      step: 1 | -1,
    ): { detail: string[]; id: string[] } => {
      const detail: string[] = [];
      const id: string[] = [];
      let cursor = start;
      while (cursor >= 0 && cursor < rows.length) {
        if (consumed.has(cursor)) break;
        const row = rows[cursor];
        const isContinuation =
          !dateLineIndexes.has(cursor) &&
          cursor !== headerIndex &&
          !isPageNumber(row) &&
          !row.some((cell) => signedMinor(cell) !== null);
        if (!isContinuation) break;
        consumed.add(cursor);
        classifyFragments(row, detail, id);
        cursor += step;
      }
      return { detail, id };
    };

    for (const index of [...dateLineIndexes].sort((a, b) => a - b)) {
      const before = collectSide(index - 1, -1);
      const after = collectSide(index + 1, 1);
      const block = buildBlock(
        rows[index],
        index,
        before.detail,
        after.detail,
        before.id,
        after.id,
      );
      if (block === null) {
        skipped += 1;
        errors.push({ row: index + 1, reason: "missing debit and credit" });
        continue;
      }
      blocks.push(block);
    }
  }

  // Grid order is top-down (newest first), matching the review screen.
  const transactions: NormalizedBankTransaction[] = [];
  for (const block of blocks) {
    const { date, time } = block;
    const description = truncate(
      block.detail.join(" ").replace(/\s+/g, " ").trim(),
      MAX_ORIGINAL_DESCRIPTION_LENGTH,
    );
    const reference =
      block.id.length === 0
        ? undefined
        : truncate(
            block.id.join(" ").replace(/\s+/g, " ").trim(),
            MAX_PALMPAY_REFERENCE_LENGTH,
          );
    transactions.push({
      id: `pp-r${block.rowNumber}`,
      transactionDate: date,
      transactionTime: time,
      description: description === "" ? "(no description)" : description,
      originalDescription: description === "" ? undefined : description,
      reference,
      debitAmount: block.amount.direction === "out" ? block.amount.minor : undefined,
      creditAmount: block.amount.direction === "in" ? block.amount.minor : undefined,
      currency: context.currency,
      sourceBank: "palmpay",
      type: "unknown",
      direction: block.amount.direction,
      confidence: "none",
      status: "draft",
      categoryId: null,
      row: block.rowNumber,
    });
  }

  return { transactions, skipped, errors };
}

/** Builds one PalmPay transaction block from a date line plus its fragment
 *  groups, in reading order: [before-fragments] + [own cells] +
 *  [after-fragments]. Returns null when the date line carries no signed
 *  amount — that row is skipped and reported, never silently dropped. */
function buildBlock(
  row: readonly string[],
  index: number,
  before: readonly string[],
  after: readonly string[],
  idBefore: readonly string[],
  idAfter: readonly string[],
): PalmPayBlock | null {
  const rowNumber = index + 1;
  const parsed = parseStatementDateTime(String(row[0] ?? ""), PALMPAY_DATE_ORDER);
  if (parsed === null) throw new Error("buildBlock requires a date line");

  // Split the date line by the signed amount cell: detail cells sit to its
  // left, Transaction ID cells to its right (x-order is preserved).
  const own: string[] = [];
  const ownId: string[] = [];
  let amount: PalmPayBlock["amount"] | null = null;
  let foundAmount = false;
  for (let cellIndex = 1; cellIndex < row.length; cellIndex += 1) {
    const cell = row[cellIndex];
    const parsedAmount = signedMinor(cell);
    if (parsedAmount !== null && !foundAmount) {
      amount = parsedAmount;
      foundAmount = true;
      continue;
    }
    if (foundAmount) {
      if (String(cell).trim() !== "") ownId.push(cell);
    } else if (String(cell).trim() !== "") {
      own.push(cell);
    }
  }
  if (amount === null) {
    return null;
  }

  const detail = [...before, ...own, ...after];
  const id = [...idBefore, ...ownId, ...idAfter];

  return {
    rowNumber,
    date: parsed.date,
    time: parsed.time,
    detail,
    id,
    amount,
  };
}
