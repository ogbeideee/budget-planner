// Bank statement import engine.
//
// Pure client-side parsing (CSV/Excel/PDF) — no network, no external APIs.
// - CSV: hand-rolled RFC-4180-ish parser (quotes, embedded commas/newlines).
// - Excel: SheetJS (xlsx) read into a string[][] via `sheet_to_json`.
// - PDF: pdfjs-dist text extraction, lines grouped by y then cells split by
//   x-gaps, fed through the same column detection as CSV/Excel.
// Nothing here touches the store: `buildCandidates` only DETECTS transactions;
// saving happens in the UI only after the user confirms the review.

import type { Category, CategoryKind } from "./types";
import {
  PdfPasswordError,
  passwordStatusOf,
} from "./statementPdf";

// Bundler asset URL for the pdfjs worker; `new URL(..., import.meta.url)` is
// statically detected by webpack/Turbopack (and supported by Vite), which emit
// the worker file and rewrite this to its hashed public URL at build time. The
// worker only ever loads inside `rowsFromPdf`.
const pdfWorkerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PDFDocumentProxy } from "pdfjs-dist";

export const SUPPORTED_EXTENSIONS = ["csv", "xlsx", "xls", "pdf"] as const;
export type StatementSource = (typeof SUPPORTED_EXTENSIONS)[number];

export interface ImportCandidate {
  id: string;
  date: string | null;
  description: string;
  /** Signed minor units: income positive, expense negative. */
  amount: number;
  type: CategoryKind;
  /** Detected category id, or null when the row could not be categorized. */
  categoryId: string | null;
  row: number;
}

export interface ParseOutcome {
  candidates: ImportCandidate[];
  /** Rows that looked like transactions but were skipped (no date/amount). */
  skipped: number;
}

export function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function isSupportedFile(name: string): boolean {
  const ext = extensionOf(name);
  return ext !== null && (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180-ish: quoted fields, escaped quotes, embedded commas
// and newlines; lenient about missing trailing newlines).
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map(mergeThousands);
}

// Many bank CSVs write amounts like 500,000.00 WITHOUT quoting, so the naive
// splitter cuts them into ["500", "000.00"]. Rejoin runs of 1-3-digit groups
// (with optional CR/DR markers) — RFC 4180 says those commas are delimiters,
// but statements from real banks win.
function mergeThousands(row: string[]): string[] {
  const merged: string[] = [];
  for (const cell of row) {
    const last = merged[merged.length - 1];
    const pureGroup = /^\d{1,3}(,\d{3})*$/;
    const groupPart = /^\d{3}(\.\d{1,2})?(\s*(CR|DR|DB))?$/i;
    if (last !== undefined && pureGroup.test(last) && groupPart.test(cell)) {
      merged[merged.length - 1] = `${last},${cell}`;
    } else {
      merged.push(cell);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Cell parsers (dates + amounts) — the pieces shared by every source format.
// ---------------------------------------------------------------------------

export interface ParsedAmount {
  /** Absolute value in minor units. */
  minor: number;
  /** Direction signalled by the cell itself (CR/DR, minus, parens). */
  direction: "in" | "out" | "unknown";
}

const DIRECTION_TOKEN = /(?:^|[\s-])(CR|DR|DB|C\/R|D\/R)\s*$/i;

export function parseAmountCell(raw: string): ParsedAmount | null {
  let value = String(raw ?? "").trim();
  if (value === "") return null;

  let direction: ParsedAmount["direction"] = "unknown";
  const token = DIRECTION_TOKEN.exec(value);
  if (token) {
    const tag = token[1].toUpperCase();
    direction = tag === "CR" ? "in" : "out";
    value = value.replace(DIRECTION_TOKEN, "").trim();
  }

  let sign = 1;
  const isParenthesized = /^\(.*\)$/.test(value);
  if (isParenthesized) {
    sign = -1;
    value = value.slice(1, -1).trim();
  }
  if (value.startsWith("-")) {
    sign = -1;
    value = value.slice(1).trim();
  } else if (value.startsWith("+")) {
    value = value.slice(1).trim();
  }
  if (value.endsWith("-")) {
    sign = -1;
    value = value.slice(0, -1).trim();
  }

  const digits = value.replace(/[₦$€£¥#,\s]/g, "");
  // Bare integer runs of 10+ digits are account numbers / transaction
  // references ("2607010201000"), never statement amounts — real amounts
  // carry a decimal fraction or a currency/separator marker (the Kuda
  // parser applies the same rule to its token stream). This is a STRUCTURE
  // rule, not a magnitude cap: "₦2,607,010,201,000.00" (a large but
  // well-formed amount) still parses.
  if (/^\d{10,}$/.test(digits)) return null;
  // Whole numbers, decimals, and Excel-style leading-dot decimals (".20").
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(digits)) return null;
  const [whole = "0", fraction = ""] = digits.split(".");
  const minor =
    Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isFinite(minor) || minor <= 0) return null;

  if (sign === -1) direction = "out";
  if (direction === "unknown" && isParenthesized) direction = "out";
  return { minor, direction };
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(name: string): number | null {
  const key = name.toLowerCase().slice(0, 3);
  return MONTH_NAMES[key] ?? null;
}

function normalizeYear(year: number): number | null {
  if (year >= 1000) return year;
  if (year < 0 || year > 99) return null;
  return year <= 69 ? 2000 + year : 1900 + year;
}

function dateParts(
  year: number,
  month: number,
  day: number,
): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const days = new Date(year, month, 0).getDate();
  if (day > days) return null;
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** How an ambiguous d/m/yyyy-style date cell is read: "day-month" is the NGN
 *  norm (day-first, used by GTCO/OPay/Kuda); "month-day" is the US layout
 *  some wallet exports print (e.g. PalmPay's MM/DD/YYYY). The order only
 *  matters when both numbers are ≤ 12. */
export type StatementDateOrder = "day-month" | "month-day";

/**
 * Parses common bank-statement date formats into an ISO "YYYY-MM-DD".
 *
 * `order` disambiguates 12/08/2026-style cells: day-first by default
 * (day > 12 ⇒ dd/mm; month > 12 ⇒ mm/dd), or month-first for wallets that
 * print MM/DD/YYYY (month must be 1–12, day validated against it).
 */
export function parseStatementDate(
  raw: string,
  order: StatementDateOrder = "day-month",
): string | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;

  // 2026-08-12 (with optional time suffix)
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) {
    return dateParts(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // 12/08/2026 · 12-08-2026 · 12.08.2026 (with optional time suffix).
  // Ambiguous dd/mm vs mm/dd: first > 12 ⇒ dd/mm; second > 12 ⇒ mm/dd;
  // otherwise the requested order decides (day-first is the NGN norm).
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/.exec(s);
  if (m) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12 && second <= 12) return dateParts(Number(m[3]), second, first);
    if (second > 12 && first <= 12) return dateParts(Number(m[3]), first, second);
    if (order === "month-day") return dateParts(Number(m[3]), first, second);
    return dateParts(Number(m[3]), second, first);
  }

  // 12/08/26 · 12-08-26 · 12.08.26 — 2-digit year (Kuda statements print
  // dd/mm/yy). Same ambiguity handling as the 4-digit form.
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?:[ T].*)?$/.exec(s);
  if (m) {
    const year = normalizeYear(Number(m[3]));
    if (year === null) return null;
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12 && second <= 12) return dateParts(year, second, first);
    if (second > 12 && first <= 12) return dateParts(year, first, second);
    if (order === "month-day") return dateParts(year, first, second);
    return dateParts(year, second, first);
  }

  // 12 Aug 2026 · 12-Aug-26 · 12 Aug 26
  m = /^(\d{1,2})[\s.\-/]+([A-Za-z]{3,9})[,\s.\-/]*(\d{2,4})$/.exec(s);
  if (m) {
    const mon = monthIndex(m[2]);
    const year = normalizeYear(Number(m[3]));
    if (mon !== null && year !== null) {
      return dateParts(year, mon + 1, Number(m[1]));
    }
  }

  // Aug 12, 2026 · Aug 12 2026
  m = /^([A-Za-z]{3,9})[\s.]+(\d{1,2})[,\s]*(\d{4})$/.exec(s);
  if (m) {
    const mon = monthIndex(m[1]);
    if (mon !== null) {
      return dateParts(Number(m[3]), mon + 1, Number(m[2]));
    }
  }

  return null;
}

export interface ParsedDateTime {
  /** ISO "YYYY-MM-DD". */
  date: string;
  /** "HH:mm" or "HH:mm:ss" (24h) when the cell carried a time. */
  time?: string;
}

const DATE_TIME_SUFFIX_RE = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i;

/** Parses a statement date cell into an ISO date plus an optional 24h time
 *  ("12/08/2026 14:32", "2026-08-12T09:05:07", "12 Aug 2026 2:32 PM").
 *  `order` disambiguates dd/mm vs mm/dd cells (default day-first). */
export function parseStatementDateTime(
  raw: string,
  order: StatementDateOrder = "day-month",
): ParsedDateTime | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;

  const timeMatch = DATE_TIME_SUFFIX_RE.exec(s);
  let dateRaw = s;
  let time: string | undefined;

  if (timeMatch && timeMatch.index > 0) {
    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const seconds = timeMatch[3];
    const meridiem = timeMatch[4]?.toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (hours <= 23 && Number(minutes) <= 59 && Number(seconds ?? "0") <= 59) {
      time = `${String(hours).padStart(2, "0")}:${minutes}${
        seconds !== undefined ? `:${seconds}` : ""
      }`;
      dateRaw = `${s.slice(0, timeMatch.index)} ${s.slice(timeMatch.index + timeMatch[0].length)}`;
    }
  }

  const date = parseStatementDate(dateRaw, order);
  return date === null ? null : { date, time };
}

// ---------------------------------------------------------------------------
// PDF text extraction → rows. pdfjs is lazy-imported so jsdom tests and the
// rest of the bundle never pay for it.
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

export function groupPdfLines(items: PdfTextItem[]): string[][] {
  return groupPdfRows(items).map((row) => row.cells);
}

/** A PDF text-layer line as the app reads it: the split cells plus the
 *  line's y position (pdfjs coordinates, larger = higher on the page). The
 *  y is what lets wrapped-line parsers (PalmPay) attach continuation lines
 *  to the transaction line they belong to (Prompt 8J). */
export interface PdfRow {
  cells: string[];
  y: number;
}

/** Like groupPdfLines but keeps each line's y — the reading-order geometry
 *  behind the grid (top-down: larger y first, page by page). */
export function groupPdfRows(items: PdfTextItem[]): PdfRow[] {
  const lines = clusterPdfLines(items);
  const smallestGap = smallestLineGap(lines);
  if (smallestGap === Infinity) return [];
  // Column breaks are consistently larger than word gaps; clamp so pages with
  // no word gaps (single token per column) still split on real column widths.
  const threshold = Math.min(Math.max(16, smallestGap * 2.5), 40);
  return lines.map((line) => ({ cells: cellsForLine(line, threshold), y: line[0].y }));
}

/** Groups text-layer items into LINES (reading order): pdfjs y grows UPWARD,
 *  so items come out bottom-of-page first — sort by y DESCENDING (top-down)
 *  and cluster items whose y is within 3 units. */
function clusterPdfLines(items: PdfTextItem[]): PdfTextItem[][] {
  const sorted = items
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({ ...item, y: Math.round(item.y * 2) / 2 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last[last.length - 1].y) <= 3) {
      last.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

/** Smallest gap between adjacent items on the page — the word-gap scale the
 *  column-split threshold derives from. */
function smallestLineGap(lines: PdfTextItem[][]): number {
  let smallestGap = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const gap = line[i].x - line[i - 1].x;
      if (gap < smallestGap) smallestGap = gap;
    }
  }
  return smallestGap;
}

/** Splits one line's items into cells: a gap larger than the threshold is a
 *  column break; smaller gaps are word spaces inside one cell. */
function cellsForLine(line: PdfTextItem[], threshold: number): string[] {
  const cells: string[] = [];
  let current = "";
  let cursor: number | null = null;
  for (const item of line) {
    if (cursor !== null && item.x - cursor > threshold) {
      cells.push(current.trim());
      current = "";
    }
    current += `${current === "" ? "" : " "}${item.str}`;
    cursor = item.x;
  }
  if (current.trim() !== "") cells.push(current.trim());
  return cells;
}

/** Normalized header token (mirrors headerToken in lib/statementColumnar.ts —
 *  kept local so the alignment seam stays dependency-free of the parsers):
 *  lowercase, currency-unit parentheses and dots stripped, whitespace
 *  collapsed ("Balance After(₦)" → "balance after"). */
function columnarToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\([₦$€£¥][^)]*\)/g, "")
    .replace(/\((?:ngn|naira|usd|gbp|eur)\)/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Header tokens that mark a line as a COLUMNAR table header (GTCO/OPay
 *  vocabulary). Exact-token matches only — deliberately excludes PalmPay's
 *  "Transaction Date"/"Transaction ID"/"Money In (NGN)"/"Money Out (NGN)"
 *  and Kuda's "Date/Time"/"Money In"/"Money Out" so their rows are never
 *  re-slot by this seam (their parsers read the raw reading-order cells). */
const COLUMNAR_HEADER_TOKEN_RES: readonly RegExp[] = [
  /^trans(?:action)?(?:\.| )?date$/, // "Trans. Date" · "Trans Date" · "Transaction Date"
  /^trans(?:\.| )?time$/, // "Trans. Time"
  /^value date$/,
  /^posting date$/,
  /^txn(?:\.| )?date$/,
  /^date$/,
  /^date\/time$/,
  /^debit$/,
  /^debits$/,
  /^withdrawal$/,
  /^withdrawals$/,
  /^credit$/,
  /^credits$/,
  /^deposit$/,
  /^balance$/,
  /^balance after$/,
  /^reference$/,
  /^ref$/,
  /^ref no$/,
  /^remarks$/,
  /^narrative$/,
  /^narrations$/,
  /^particulars$/,
  /^originating branch$/,
  /^branch$/,
  /^channel$/,
  /^description$/,
  /^details$/,
  /^amount$/,
  /^transaction reference$/,
];

/** How many cells of the line read as columnar header vocabulary. */
function columnarHeaderVocabCount(cells: string[]): number {
  let count = 0;
  for (const cell of cells) {
    const token = columnarToken(cell);
    if (token !== "" && COLUMNAR_HEADER_TOKEN_RES.some((re) => re.test(token))) count += 1;
  }
  return count;
}

/** A PDF text layer emits NO text for empty cells — a GTCO row with an empty
 *  Credits (or Remarks) slot comes out left-packed, and the columnar engine's
 *  misalignment guards correctly reject the shifted numbers. This realignment
 *  re-slots every line's items into the columns anchored by the page's
 *  columnar table header (the line with the most header vocabulary), using
 *  each item's x position: the missing cells become explicit empty cells.
 *
 *  Only columnar-header-shaped pages are realigned (≥5 vocabulary tokens on
 *  the anchor line) — PalmPay/Kuda and headerless documents keep the raw
 *  reading-order rows, so no existing parser changes shape. Returns null
 *  when the page has no columnar header. */
export function alignPdfLinesToColumns(
  lines: PdfTextItem[][],
): PdfRow[] | null {
  let anchor: PdfTextItem[] | null = null;
  let bestVocab = 0;
  for (const line of lines) {
    const items = line.filter((item) => item.str.trim() !== "");
    if (items.length < 4) continue;
    const vocab = columnarHeaderVocabCount(items.map((item) => item.str));
    if (vocab > bestVocab) {
      bestVocab = vocab;
      anchor = items;
    }
  }
  if (anchor === null || bestVocab < 5) return null;

  const anchors = anchor;
  const rows: PdfRow[] = [];
  for (const line of lines) {
    const buckets: string[][] = anchors.map(() => []);
    for (const item of line) {
      if (item.str.trim() === "") continue;
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < anchors.length; i += 1) {
        const distance = Math.abs(item.x - anchors[i].x);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      buckets[bestIndex].push(item.str);
    }
    const cells = buckets.map((bucket) => bucket.join(" ").trim());
    if (cells.some((cell) => cell !== "")) rows.push({ cells, y: line[0].y });
  }
  return rows;
}

/** The rows the app reads from one page's text layer: the reading-order grid
 *  (groupPdfRows behavior) — OR, when the page carries a columnar table
 *  header, the header-anchored column grid with explicit empty cells (a PDF
 *  text layer never emits text for an empty column slot, so sparse rows would
 *  otherwise left-pack and misalign every amount). */
export function rowsFromPdfItems(items: PdfTextItem[]): PdfRow[] {
  const lines = clusterPdfLines(items);
  const aligned = alignPdfLinesToColumns(lines);
  if (aligned !== null) return aligned;
  const smallestGap = smallestLineGap(lines);
  if (smallestGap === Infinity) return [];
  const threshold = Math.min(Math.max(16, smallestGap * 2.5), 40);
  return lines.map((line) => ({ cells: cellsForLine(line, threshold), y: line[0].y }));
}

export async function rowsFromPdf(
  data: ArrayBuffer,
  password?: string,
): Promise<string[][]> {
  return (await pdfRowsFromPdf(data, password)).map((row) => row.cells);
}

/** PDF text-layer rows WITH geometry — cells + each line's y. The PalmPay
 *  parser needs y to merge wrapped lines; CSV/Excel have no geometry.
 *  `password` unlocks password-protected PDFs (memory-only use). */
export async function pdfRowsFromPdf(
  data: ArrayBuffer,
  password?: string,
): Promise<PdfRow[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const params: Record<string, unknown> = { data };
  if (password) params.password = password;
  const loadingTask = pdfjs.getDocument(params);
  let doc: PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    // Password failures surface as pdfjs PasswordException — map them to the
    // shared typed error so every seam reports them the same way.
    await loadingTask.destroy().catch(() => undefined);
    const passwordStatus = passwordStatusOf(error);
    if (passwordStatus !== null) {
      throw new PdfPasswordError(passwordStatus);
    }
    throw error;
  }
  try {
    const rows: PdfRow[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      try {
        const content = await page.getTextContent();
        const items = content.items
          .filter(
            (item): item is TextItem => "str" in item && "transform" in item,
          )
          .map((item) => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
          }));
        rows.push(...rowsFromPdfItems(items));
      } finally {
        page.cleanup();
      }
    }
    return rows;
  } finally {
    await loadingTask.destroy();
  }
}

export async function rowsFromExcel(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" })
    .map((row) => row.map((cell) => String(cell ?? "").trim()));
}

// ---------------------------------------------------------------------------
// File → rows.
// ---------------------------------------------------------------------------

export interface ExtractedStatement {
  cells: string[][];
  source: StatementSource;
  /** Per-row y (PDF text layer only). Present for PDFs, undefined for
   *  CSV/Excel — wrapped-line parsers (PalmPay) use it to attach
   *  continuation lines to the right transaction (Prompt 8J). */
  rowYs?: number[];
}

export async function extractStatementRows(
  file: File,
  password?: string,
): Promise<ExtractedStatement> {
  const ext = extensionOf(file.name);
  if (ext === "csv") {
    return { cells: parseCsv(await file.text()), source: "csv" };
  }
  const data = await file.arrayBuffer();
  if (ext === "xlsx" || ext === "xls") {
    return { cells: await rowsFromExcel(data), source: ext };
  }
  if (ext === "pdf") {
    const rows = await pdfRowsFromPdf(data, password);
    return {
      cells: rows.map((row) => row.cells),
      source: "pdf",
      rowYs: rows.map((row) => row.y),
    };
  }
  throw new Error(`Unsupported file type: ${ext ?? "unknown"}`);
}

// ---------------------------------------------------------------------------
// Column detection + candidate building.
// ---------------------------------------------------------------------------

const HEADER_DATE_RE =
  /^(date|value date|value_date|txn date|transaction date|posting date|post date|trans date)$/;
const HEADER_DEBIT_RE = /^(debit|withdrawal|withdrawals|withdrawn|paid out|money out|cash out|dr)$/;
const HEADER_CREDIT_RE = /^(credit|deposit|paid in|money in|cash in|cr)$/;
const HEADER_BALANCE_RE = /^(balance|bal|running balance|available balance)$/;
const HEADER_AMOUNT_RE = /^(amount|value|amt|transaction amount|txn amount|amount paid|amount received)$/;
const HEADER_DESC_RE =
  /^(desc|description|narrative|narration|particulars|details|remark|remarks|reference|ref|ref no|story|transaction details|transaction description)$/;

function headerScore(row: string[]): number {
  let score = 0;
  for (const raw of row) {
    const token = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (HEADER_DATE_RE.test(token)) score += 3;
    else if (HEADER_DEBIT_RE.test(token)) score += 2;
    else if (HEADER_CREDIT_RE.test(token)) score += 2;
    else if (HEADER_BALANCE_RE.test(token)) score += 2;
    else if (HEADER_AMOUNT_RE.test(token)) score += 2;
    else if (HEADER_DESC_RE.test(token) && token.length < 30) score += 1;
  }
  return score;
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

interface ColumnMap {
  date: number;
  debit: number;
  credit: number;
  amount: number;
  balance: number;
  description: number[];
  headerIndex: number;
}

function columnStats(cells: string[][]) {
  const dateCount: number[] = [];
  const amountCount: number[] = [];
  const textLength: number[] = [];
  for (const row of cells) {
    row.forEach((raw, col) => {
      const value = String(raw ?? "").trim();
      if (value === "") return;
      dateCount[col] = (dateCount[col] ?? 0) + (parseStatementDate(value) ? 1 : 0);
      amountCount[col] =
        (amountCount[col] ?? 0) + (parseAmountCell(value) ? 1 : 0);
      textLength[col] = (textLength[col] ?? 0) + value.length;
    });
  }
  return { dateCount, amountCount, textLength };
}

function pickColumn(
  predicate: (col: number) => boolean,
  fallback: number[],
): number {
  return fallback.find(predicate) ?? -1;
}

function detectColumns(cells: string[][], rows: string[][]): ColumnMap {
  const width = Math.max(0, ...rows.map((row) => row.length));
  const stats = columnStats(cells);

  // Header: the first 12 rows with the strongest header vocabulary.
  let headerIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(12, rows.length); i += 1) {
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  if (bestScore < 3) headerIndex = -1;

  const headerRow = headerIndex >= 0 ? rows[headerIndex].map((h) => h.trim().toLowerCase().replace(/\s+/g, " ")) : [];

  const isDateCol = (col: number) => HEADER_DATE_RE.test(headerRow[col] ?? "");
  const isDebitCol = (col: number) => HEADER_DEBIT_RE.test(headerRow[col] ?? "");
  const isCreditCol = (col: number) => HEADER_CREDIT_RE.test(headerRow[col] ?? "");
  const isBalanceCol = (col: number) => HEADER_BALANCE_RE.test(headerRow[col] ?? "");
  const isAmountCol = (col: number) => HEADER_AMOUNT_RE.test(headerRow[col] ?? "");
  const isDescCol = (col: number) => HEADER_DESC_RE.test(headerRow[col] ?? "");

  const dateCandidates: number[] = [];
  const amountCandidates: number[] = [];
  for (let col = 0; col < width; col += 1) {
    if ((stats.dateCount[col] ?? 0) >= 1) dateCandidates.push(col);
    if ((stats.amountCount[col] ?? 0) >= 1) amountCandidates.push(col);
  }

  const date =
    headerIndex >= 0
      ? pickColumn(isDateCol, dateCandidates)
      : dateCandidates.find((col) => (stats.dateCount[col] ?? 0) >= 2) ?? -1;
  const debit =
    headerIndex >= 0
      ? pickColumn(isDebitCol, amountCandidates)
      : -1;
  const credit =
    headerIndex >= 0
      ? pickColumn(isCreditCol, amountCandidates)
      : -1;

  let balance = -1;
  if (headerIndex >= 0) {
    balance = pickColumn(isBalanceCol, amountCandidates);
  }

  let amount = -1;
  if (headerIndex >= 0) {
    amount = pickColumn(isAmountCol, amountCandidates);
  }
  if (amount === -1) {
    // Most amount-looking column that isn't already claimed.
    const claimed = new Set([date, debit, credit, balance]);
    amount = amountCandidates.find((col) => !claimed.has(col)) ?? -1;
  }

  const claimedByAmount = new Set([date, debit, credit, balance, amount]);
  const description: number[] = [];
  for (let col = 0; col < width; col += 1) {
    if (claimedByAmount.has(col)) continue;
    if (headerIndex >= 0 && isDescCol(col)) description.push(col);
    else if ((stats.textLength[col] ?? 0) > 0) description.push(col);
  }
  if (description.length === 0) {
    // No narration column at all — fall back to any unclaimed column.
    for (let col = 0; col < width; col += 1) {
      if (!claimedByAmount.has(col) && (stats.textLength[col] ?? 0) > 0) {
        description.push(col);
      }
    }
  }

  return { date, debit, credit, amount, balance, description, headerIndex };
}

const INCOME_HINTS =
  /\b(salary|wage|interest|refund|deposit|credit|bonus|transfer from|payment received|payment in|loan received|airtime\s+reward)\b/i;

const BALANCE_EPSILON = 50; // minor units of slack for balance-delta math

function descriptionOf(row: string[], columns: ColumnMap): string {
  const parts = columns.description
    .map((col) => String(row[col] ?? "").trim())
    .filter((part) => part !== "");
  return parts.length > 0 ? parts.join(" · ") : "";
}

/** Builds the candidates for a statement's cells using the app categories. */
export function buildCandidates(
  cells: string[][],
  categories: Category[],
): ParseOutcome {
  const rows = cells
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => !isBlankRow(row));
  const columns = detectColumns(cells, rows);
  const dataRows = columns.headerIndex >= 0 ? rows.slice(columns.headerIndex + 1) : rows;

  const hasDebitCredit = columns.debit >= 0 || columns.credit >= 0;
  const useBalanceDelta =
    !hasDebitCredit && columns.amount < 0 && columns.balance >= 0;

  const candidates: ImportCandidate[] = [];
  let skipped = 0;
  let previousBalance: number | null = null;

  const cellAt = (row: string[], col: number): string =>
    col >= 0 ? String(row[col] ?? "").trim() : "";

  dataRows.forEach((row, offset) => {
    const rowNumber = (columns.headerIndex >= 0 ? columns.headerIndex + 1 : 0) + offset;
    const dateRaw = cellAt(row, columns.date);
    const rowHasDate =
      columns.date >= 0 && parseStatementDate(dateRaw) !== null;
    let amount: number | null = null;

    if (hasDebitCredit) {
      const debit = columns.debit >= 0 ? parseAmountCell(cellAt(row, columns.debit)) : null;
      const credit = columns.credit >= 0 ? parseAmountCell(cellAt(row, columns.credit)) : null;
      if (debit === null && credit === null) {
        if (rowHasDate) skipped += 1;
        return;
      }
      amount = (credit?.minor ?? 0) - (debit?.minor ?? 0);
    } else if (columns.amount >= 0) {
      const parsed = parseAmountCell(cellAt(row, columns.amount));
      if (parsed === null) {
        if (rowHasDate) skipped += 1;
        return;
      }
      let direction = parsed.direction;
      if (direction === "unknown" && columns.balance >= 0) {
        const balance = parseAmountCell(cellAt(row, columns.balance));
        if (balance !== null && previousBalance !== null) {
          const delta = balance.minor - previousBalance;
          if (Math.abs(Math.abs(delta) - parsed.minor) <= BALANCE_EPSILON) {
            direction = delta >= 0 ? "in" : "out";
          }
        }
        if (balance !== null) previousBalance = balance.minor;
        else previousBalance = null;
      }
      if (direction === "unknown") {
        direction = INCOME_HINTS.test(descriptionOf(row, columns)) ? "in" : "out";
      }
      amount = direction === "in" ? parsed.minor : -parsed.minor;
    } else if (useBalanceDelta) {
      const balance = parseAmountCell(cellAt(row, columns.balance));
      if (balance === null) {
        previousBalance = null;
        return;
      }
      if (previousBalance !== null) {
        const delta = balance.minor - previousBalance;
        if (delta !== 0) amount = delta;
      }
      previousBalance = balance.minor;
      if (amount === null) return;
    } else {
      return;
    }

    if (amount === null || amount === 0) return;

    const date = columns.date >= 0 ? parseStatementDate(dateRaw) : null;
    if (columns.date >= 0 && date === null) {
      skipped += 1;
      return;
    }

    const type: CategoryKind = amount < 0 ? "expense" : "income";
    const description = descriptionOf(row, columns) || "(no description)";
    candidates.push({
      id: `r${rowNumber}`,
      date,
      description,
      amount,
      type,
      categoryId: detectCategory(description, type, categories),
      row: rowNumber,
    });
  });

  return { candidates, skipped };
}

// ---------------------------------------------------------------------------
// Category detection — local keyword heuristics only (no AI, no network).
// ---------------------------------------------------------------------------

/** Category-name → keyword aliases. Shared with the category matcher
 *  (lib/categoryMatching.ts) so manual entry and statement import agree. */
export const KEYWORD_ALIASES: Record<string, string[]> = {
  Rent: ["rent", "house rent", "apartment", "accommodation", "landlord", "tenant"],
  Groceries: [
    "groceries",
    "grocery",
    "supermarket",
    "supermarket purchase",
    "shoprite",
    "checkers",
    "spar",
    "foodstuff",
    "food stuff",
  ],
  Transport: [
    "transport",
    "taxi",
    "uber",
    "bolt",
    "lyft",
    "bus",
    "busfare",
    "fare",
    "fuel",
    "petrol",
    "diesel",
    "filling station",
  ],
  Utilities: [
    "electric",
    "electricity",
    "power",
    "prepaid",
    "utility",
    "utilities",
    "phcn",
    "ikeja",
    "eko electric",
    "water bill",
    "energy",
  ],
  Internet: [
    "internet",
    "wifi",
    "wi-fi",
    "broadband",
    "data",
    "airtime",
    "recharge",
    "mtn",
    "glo",
    "airtel",
    "9mobile",
    "spectranet",
    "smile",
  ],
  Entertainment: [
    "entertainment",
    "movie",
    "cinema",
    "netflix",
    "spotify",
    "showmax",
    "youtube",
    "game",
    "gaming",
    "steam",
    "playstation",
  ],
  Salary: ["salary", "wage", "payroll", "compensation", "emolument", "net pay"],
  Business: ["business", "enterprise", "shop sales", "store sales"],
  Freelancing: ["freelance", "freelancing", "upwork", "fiverr", "gig", "gigs"],
  Forex: [
    "forex",
    "fx",
    "trading",
    "crypto",
    "binance",
    "coinbase",
    "paxful",
    "bitcoin",
    "bybit",
    "okx",
  ],
  Bonus: ["bonus", "gratuity", "13th month", "commission", "incentive"],
  "Rental Income": ["rental income", "rent received", "rent income", "property income"],
};

const DIRECT_NAME_MIN_LENGTH = 3;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Picks the category whose name or alias appears in the description. */
export function detectCategory(
  description: string,
  type: CategoryKind,
  categories: Category[],
): string | null {
  const pool = categories.filter((category) => category.kind === type);
  if (pool.length === 0) return null;
  const text = normalizeText(description);
  let bestId: string | null = null;
  let bestScore = 0;

  for (const category of pool) {
    const nameKey = normalizeText(category.name);
    const aliases = [nameKey, ...(KEYWORD_ALIASES[category.name] ?? [])];
    for (const alias of aliases) {
      const keyword = normalizeText(alias);
      if (keyword.length < DIRECT_NAME_MIN_LENGTH) continue;
      if (!text.includes(keyword)) continue;
      const score = keyword.length;
      if (score > bestScore) {
        bestScore = score;
        bestId = category.id;
      }
    }
  }
  return bestId;
}
