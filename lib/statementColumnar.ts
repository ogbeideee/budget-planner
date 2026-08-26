// Shared columnar statement parser engine (Prompt 8J).
//
// Most Nigerian bank exports are COLUMN-HEADER-DRIVEN tables: a header row
// ("Trans. Date · Value Date · Reference · Debits · Credits · Balance …")
// names the columns, and every following row is one transaction. GTCO and
// OPay used to ship TWO nearly-identical copies of this machinery (header
// tokenizer, column vocabulary scoring, header detection, positional
// fallback, the date/debit/credit/reference/balance row loop). This module
// extracts the common engine: a bank registers a `ColumnarSpec` (its column
// vocabulary + weights, roles, caps and an optional per-row `enrich` hook)
// and gets a headerScore + parse — no new parse loop.
//
// Bank-specific differences stay INSIDE the spec: GTCO reads a branch column,
// OPay reads channel + lifts merchant/provider from "|"-separated narrations,
// and both keep their own vocabulary. A new columnar bank = a spec (or a
// config over this engine), not a rewritten parser.

import {
  parseAmountCell,
  parseStatementDate,
  parseStatementDateTime,
  type StatementDateOrder,
} from "./statementImport";
import { checkAmountSanity } from "./statementNormalize";
import {
  MAX_ORIGINAL_DESCRIPTION_LENGTH,
  type BankParseResult,
  type BankSource,
  type NormalizationContext,
  type NormalizedBankTransaction,
  type StatementLineGeometry,
  type StatementRowError,
} from "./statementTypes";

/** Normalized header token: lowercase, dots and currency/unit markers
 *  stripped, whitespace collapsed ("Balance After(₦)" → "balance after",
 *  "Money In (NGN)" → "money in"). */
export function headerToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\([₦$€£¥][^)]*\)/g, "")
    .replace(/\((?:ngn|naira|usd|gbp|eur)\)/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A single column role: its header-token regex (matched against ONE
 *  normalized header token) and its weight in header detection. */
export interface ColumnarRole {
  /** Weight this role contributes when its token appears in a header row. */
  weight: number;
  /** Header-token regex for this role ("Balance After(₦)" → "balance after"). */
  re: RegExp;
}

/** Extra per-row normalized fields — the bank-specific part (branch, channel,
 *  merchant/provider …). `cell(role)` reads a raw cell by role name. */
export interface ColumnarRowContext {
  rowNumber: number;
  row: readonly string[];
  /** The row's description (truncated, or "(no description)" when absent). */
  description: string;
  /** Reads the raw cell at the given role's column ("" when absent). */
  cell: (role: string) => string;
  /** Whether the role's column exists in this statement's header (or the
   *  positional fallback). "No" means the bank did not print that column. */
  hasColumn: (role: string) => boolean;
}

export interface ColumnarSpec {
  id: BankSource;
  label: string;
  /** Session id prefix ("gt-r", "op-r"). */
  idPrefix: string;
  /** Column vocabulary: role → header-token regex + weight. */
  roles: Record<string, ColumnarRole>;
  /** A header row scoring below this is not trusted (positional fallback). */
  minHeaderScore: number;
  /** Fallback column indexes for headerless exports (canonical order). */
  positional: Record<string, number>;
  /** Role whose cell is the transaction date (date or date+time). */
  dateRole: string;
  /** Role whose cell is the narration/description. */
  descriptionRole: string;
  /** How ambiguous date cells are read (default day-first for NGN). */
  dateOrder?: StatementDateOrder;
  /** Optional roles — the columns this bank actually reads. */
  debitRole?: string;
  creditRole?: string;
  balanceRole?: string;
  referenceRole?: string;
  valueDateRole?: string;
  /** Cap for the transient reference (review aid only). */
  referenceMax?: number;
  /** Bank-specific per-row enrichment (branch, channel, merchant/provider). */
  enrich?: (ctx: ColumnarRowContext) => Partial<NormalizedBankTransaction>;
}

const NO_COLUMN = -1;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Header-vocabulary score for one row — format detection helper. */
export function columnarHeaderScore(
  spec: ColumnarSpec,
  row: readonly string[],
): number {
  return row.reduce(
    (sum, cell) => sum + roleScore(spec, headerToken(String(cell ?? ""))),
    0,
  );
}

function roleScore(spec: ColumnarSpec, token: string): number {
  let score = 0;
  for (const role of Object.values(spec.roles)) {
    if (role.re.test(token)) score += role.weight;
  }
  return score;
}

function detectColumns(spec: ColumnarSpec, rows: string[][]): {
  headerIndex: number;
  columns: Record<string, number>;
} {
  let headerIndex = NO_COLUMN;
  let bestScore = 0;
  for (let i = 0; i < Math.min(12, rows.length); i += 1) {
    const score = columnarHeaderScore(spec, rows[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  if (bestScore < spec.minHeaderScore) headerIndex = NO_COLUMN;

  const columns: Record<string, number> = { ...spec.positional };
  if (headerIndex >= 0) {
    const headerRow = rows[headerIndex].map(headerToken);
    for (const role of Object.keys(spec.roles)) {
      columns[role] = headerRow.findIndex((token) => {
        const definition = spec.roles[role];
        return definition.re.test(token);
      });
    }
  }

  return { headerIndex, columns };
}

/**
 * Parses a column-header-driven statement (CSV/Excel/PDF text layer) into
 * normalized transactions. Columns are located BY HEADER NAME (tolerant of
 * variants); positions are only a fallback for headerless files. A single
 * malformed row never fails the import — bad rows are skipped and reported.
 */
export function parseColumnarStatement(
  spec: ColumnarSpec,
  cells: string[][],
  context: NormalizationContext,
  rowYs?: StatementLineGeometry,
): BankParseResult {
  const rawRows = cells.map((row, index) => ({
    cells: row.map((cell) => String(cell ?? "").trim()),
    y: rowYs?.[index],
  }));
  const rows = rawRows.filter((row) => !row.cells.every((cell) => cell === ""));

  const { headerIndex, columns } = detectColumns(
    spec,
    rows.map((row) => row.cells),
  );
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  const transactions: NormalizedBankTransaction[] = [];
  const errors: StatementRowError[] = [];
  let skipped = 0;

  const cellAt = (row: readonly string[], role: string | undefined): string => {
    const column = role === undefined ? NO_COLUMN : columns[role];
    return column >= 0 ? (row[column] ?? "") : "";
  };

  // PDF text layers wrap long narrations: the continuation prints on its OWN
  // line (its own row) carrying no date or amounts — only narration
  // fragments. Consecutive continuation lines form a GROUP; the group is
  // flushed when the next data row arrives and attaches to whichever of the
  // previous transaction / this new row is NEAREST on the page (rowYs),
  // falling back to the previous transaction when geometry is unknown. This
  // keeps fragments printed ABOVE a row on that row (the remarks of the
  // table's first row wrap upward, before any prior row exists) and fragments
  // printed BELOW a row on that row.
  interface PendingGroup {
    fragments: string[];
    ys: number[];
  }
  let pendingGroups: PendingGroup[] = [];
  const transactionYs: number[] = [];

  const attachFragments = (
    target: NormalizedBankTransaction,
    fragments: string[],
    prepend: boolean,
  ): void => {
    const extra = truncate(
      fragments.join(" "),
      MAX_ORIGINAL_DESCRIPTION_LENGTH,
    );
    const base =
      target.description === "(no description)" ? extra : target.description;
    const merged =
      target.description === "(no description)" || prepend
        ? `${extra} ${base}`.trim()
        : `${target.description} ${extra}`;
    target.description = truncate(merged, MAX_ORIGINAL_DESCRIPTION_LENGTH);
    target.originalDescription = truncate(
      merged,
      MAX_ORIGINAL_DESCRIPTION_LENGTH,
    );
  };

  const flushPending = (
    next: NormalizedBankTransaction | undefined,
    nextY: number | undefined,
  ): void => {
    for (const group of pendingGroups) {
      const groupY =
        group.ys.length > 0
          ? group.ys.reduce((sum, y) => sum + y, 0) / group.ys.length
          : NaN;
      // Without page geometry the wrap direction is unknown — keep the
      // historical behavior: fragments belong to the PREVIOUS transaction.
      let attachSelf = false;
      if (
        Number.isFinite(groupY) &&
        next !== undefined &&
        nextY !== undefined &&
        Number.isFinite(nextY)
      ) {
        const lastIndex = transactions.length - 1;
        const lastY = lastIndex >= 0 ? transactionYs[lastIndex] : NaN;
        const distLast = Number.isFinite(lastY)
          ? Math.abs(groupY - lastY)
          : Infinity;
        const distSelf = Math.abs(groupY - nextY);
        // Ties go to the NEXT transaction: its narration block sits directly
        // below the fragments, while the previous row's block already read.
        attachSelf = distSelf <= distLast;
      }
      if (attachSelf && next !== undefined) {
        attachFragments(next, group.fragments, true);
      } else if (transactions.length > 0) {
        attachFragments(transactions[transactions.length - 1], group.fragments, false);
      }
    }
    pendingGroups = [];
  };

  // `stop` is set when a NEW account's table starts — everything after it is
  // never read (multi-account statements must not mix accounts).
  let stop = false;
  for (let offset = 0; offset < dataRows.length && !stop; offset += 1) {
    const row = dataRows[offset].cells;
    const rowY = dataRows[offset].y;
    const rowNumber = (headerIndex >= 0 ? headerIndex + 1 : 0) + offset + 1;

    // A repeated account-header block marks the START of another account's
    // table (multi-account statements print each account as its own header +
    // table). Never mix accounts: stop reading at the first "CUSTOMER
    // STATEMENT" seen after the data started — and at the label/value block
    // ("Statement Period 01-Nov-2025-30-Nov-2025") that introduces it, so
    // the block itself is not reported as junk rows.
    if (row.some((cell) => headerToken(cell) === "customer statement")) {
      stop = true;
      break;
    }
    if (
      transactions.length > 0 &&
      headerToken(row[0] ?? "") === "statement period" &&
      /^\d{1,2}-\w{3,4}-\d{4}-\d{1,2}-\w{3,4}-\d{4}$/.test(String(row[1] ?? ""))
    ) {
      stop = true;
      break;
    }

    // A repeated table header (pages of the same table reprint it) is a
    // section marker, not a data row — skip it silently.
    if (columnarHeaderScore(spec, row) >= spec.minHeaderScore) {
      continue;
    }

    const dateCell = cellAt(row, spec.dateRole);
    const debitCell = cellAt(row, spec.debitRole);
    const creditCell = cellAt(row, spec.creditRole);
    const balanceCell = cellAt(row, spec.balanceRole);

    // Narration-only continuation line (no date, no amounts, no balance) —
    // attach its fragments to the nearest transaction instead of dropping
    // them: the wrapped lines of the REAL GTCO statement ("NIP TRANSFER TO" /
    // "PALMPAY - DAVID OSAHON OGBEIDE") only make sense joined to a row.
    if (
      dateCell === "" &&
      debitCell === "" &&
      creditCell === "" &&
      balanceCell === "" &&
      row.some((cell) => cell !== "")
    ) {
      const fragment = row.filter((cell) => cell !== "").join(" ");
      if (pendingGroups.length > 0) {
        pendingGroups[pendingGroups.length - 1].fragments.push(fragment);
        if (rowY !== undefined && Number.isFinite(rowY)) {
          pendingGroups[pendingGroups.length - 1].ys.push(rowY);
        }
      } else {
        pendingGroups.push({
          fragments: [fragment],
          ys: rowY !== undefined && Number.isFinite(rowY) ? [rowY] : [],
        });
      }
      continue;
    }

    const parsedDate =
      dateCell === "" ? null : parseStatementDateTime(dateCell, spec.dateOrder);
    if (dateCell !== "" && parsedDate === null) {
      skipped += 1;
      errors.push({ row: rowNumber, reason: "invalid date" });
      continue;
    }
    const debit = debitCell === "" ? null : parseAmountCell(debitCell);
    const credit = creditCell === "" ? null : parseAmountCell(creditCell);
    if (
      (debitCell !== "" && debit === null) ||
      (creditCell !== "" && credit === null)
    ) {
      skipped += 1;
      errors.push({ row: rowNumber, reason: "unparseable amount" });
      continue;
    }

    if (debit === null && credit === null) {
      // Balance-only footer/total rows are silent; dated rows without amounts
      // are reported.
      if (parsedDate === null) continue;
      skipped += 1;
      errors.push({ row: rowNumber, reason: "missing debit and credit" });
      continue;
    }

    // A single-sided table row must never carry BOTH a debit and a credit —
    // when that happens, the columns were misaligned (a missing cell shifted
    // every number one slot left) and the "amounts" are really reference or
    // balance values. Reject the row rather than inventing a transaction.
    if (debit !== null && credit !== null) {
      skipped += 1;
      errors.push({ row: rowNumber, reason: "conflicting debit and credit" });
      continue;
    }

    const referenceCell = cellAt(row, spec.referenceRole);
    // A reference that parses as an amount means the same left-shift landed
    // a reference in the money columns — the "amount" it produced belongs
    // to a different column. Reject rather than importing a phantom value.
    if (referenceCell !== "" && parseAmountCell(referenceCell) !== null) {
      skipped += 1;
      errors.push({ row: rowNumber, reason: "misaligned row" });
      continue;
    }

    const valueDateCell = cellAt(row, spec.valueDateRole);
    const valueDate =
      valueDateCell === ""
        ? undefined
        : parseStatementDate(valueDateCell, spec.dateOrder) ?? undefined;

    // When a statement has no date column (only a value date — some OPay
    // exports), the value date becomes the transaction date rather than
    // leaving it null.
    const transactionDate = parsedDate?.date ?? valueDate ?? null;

    const reference =
      referenceCell === ""
        ? undefined
        : truncate(referenceCell, spec.referenceMax ?? MAX_ORIGINAL_DESCRIPTION_LENGTH);

    const balance =
      balanceCell === "" ? undefined : parseAmountCell(balanceCell)?.minor;

    const descriptionCell = cellAt(row, spec.descriptionRole);
    const description =
      descriptionCell === ""
        ? "(no description)"
        : truncate(descriptionCell, MAX_ORIGINAL_DESCRIPTION_LENGTH);
    const originalDescription =
      descriptionCell === ""
        ? undefined
        : truncate(descriptionCell, MAX_ORIGINAL_DESCRIPTION_LENGTH);

    const transaction: NormalizedBankTransaction = {
      id: `${spec.idPrefix}r${rowNumber}`,
      transactionDate,
      transactionTime: parsedDate?.time,
      valueDate,
      description,
      originalDescription,
      reference,
      debitAmount: debit?.minor,
      creditAmount: credit?.minor,
      balanceAfter: balance,
      currency: context.currency,
      sourceBank: spec.id,
      type: "unknown",
      direction: debit !== null ? "out" : "in",
      confidence: "none",
      status: "draft",
      categoryId: null,
      row: rowNumber,
    };

    const extra = spec.enrich?.({
      rowNumber,
      row,
      description,
      cell: (role: string) => cellAt(row, role),
      hasColumn: (role: string) => (columns[role] ?? NO_COLUMN) >= 0,
    });
    const enriched = extra ? { ...transaction, ...extra } : transaction;
    // Narration fragments seen since the last data row attach here (nearest
    // by page line) before this row is pushed.
    flushPending(enriched, rowY);
    // Normalized-layer integrity gate (no magnitude caps — structural only).
    const sanity = checkAmountSanity(enriched, { singleSided: true });
    if (!sanity.ok) {
      skipped += 1;
      errors.push({ row: rowNumber, reason: sanity.reason });
      continue;
    }
    transactions.push(enriched);
    transactionYs.push(Number.isFinite(rowY ?? NaN) ? (rowY as number) : NaN);
  }

  // Continuation fragments after the LAST data row (a page's bottom wrap)
  // attach to the nearest transaction instead of being dropped. When the
  // loop STOPPED at an account boundary, any pending fragments belong to the
  // NEXT account's label block ("Account Name/Number …") — never merge those
  // into this account's last transaction.
  if (pendingGroups.length > 0 && !stop) {
    flushPending(undefined, undefined);
  }

  return { transactions, skipped, errors };
}
