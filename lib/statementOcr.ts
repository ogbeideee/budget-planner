// OCR fallback for scanned bank statements (Prompt 8D).
//
// Some statements arrive as pure images (scanned) — the real Kuda statement in
// tests/fixtures/statements/Kuda has no text layer at all. This module detects
// those PDFs (`needsOcr`), renders each page to an image and runs a LOCAL OCR
// service (lib/ocrService.ts — Tesseract.js WASM, fully offline, nothing
// leaves the device), then converts the OCR text back into the same cell grid
// the text-layer pipeline produces so the existing parsers and pipeline work
// unchanged.
//
// Routing (extractStatementRowsWithOcr):
// - CSV / Excel: never OCR'd — straight through the existing parser.
// - PDF with a usable text layer: straight through the existing parser.
// - PDF without one (scanned): rendered page by page and OCR'd.
//
// Anything the OCR produces is treated exactly like extraction output: it is
// DETECTION only — nothing is saved until the user confirms the review.

import {
  extensionOf,
  extractStatementRows,
  parseAmountCell,
  parseStatementDate,
  rowsFromPdfItems,
  type StatementSource,
} from "./statementImport";
import type { OcrImage, OcrService } from "./ocrService";
import type { PageViewport } from "pdfjs-dist/types/src/display/page_viewport";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import {
  PdfPasswordError,
  passwordStatusOf,
  type PdfDocumentKind,
  type PdfPasswordStatus,
} from "./statementPdf";

/** When a PDF's text layer has fewer non-space characters than this, it is
 *  treated as scanned (page markers, logos, …). */
export const OCR_MIN_TEXT_LENGTH = 40;

/** Renders pages at 3x (216 dpi) — well past the quality Tesseract's English
 *  data was trained on, so digits survive. One page at a time, ~35 MB
 *  transient for A4; released before the next page is rendered. */
export const OCR_RENDER_SCALE = 3;

export type OcrPhase = "reading" | "scanning" | "extracting";

export interface OcrOptions {
  service: OcrService;
  /** Fired as the import moves through reading/scanning/extracting so the UI
   *  can show what is happening. */
  onPhase?: (phase: OcrPhase) => void;
  /** Abort support — the import is cancelled (e.g. the modal closed). */
  signal?: AbortSignal;
  /** Page → image. Defaults to pdfjs canvas rendering; injectable so tests
   *  don't need a real 2d canvas. */
  renderPage?: (page: PdfPageLike, pageNumber: number) => Promise<OcrImage>;
  /** Password for password-protected PDFs. Held in memory ONLY — never
   *  persisted, logged or sent anywhere. */
  password?: string;
}

export class OcrAbortError extends Error {
  override name = "OcrAbortError";
  constructor() {
    super("Statement import cancelled");
  }
}

export function isOcrAbort(error: unknown): boolean {
  if (error instanceof OcrAbortError) return true;
  if (typeof error !== "object" || error === null) return false;
  // DOMException ("AbortError") is not an Error instance in every runtime.
  return (error as { name?: unknown }).name === "AbortError";
}

// ---------------------------------------------------------------------------
// Is this PDF scanned?
// ---------------------------------------------------------------------------

/**
 * True when the extracted text layer is not usable as a statement: empty,
 * nearly empty, or lacking the tell-tale structure of a statement (rows with
 * both a date and an amount). Text like "Page 1 of 2" or a logo-only header
 * must NOT count as a readable statement.
 */
export function needsOcr(cells: string[][]): boolean {
  const rows = cells.filter((row) =>
    row.some((cell) => String(cell ?? "").trim() !== ""),
  );
  if (rows.length === 0) return true;

  const textLength = rows.reduce(
    (sum, row) =>
      sum +
      row.reduce(
        (cellSum, cell) => cellSum + String(cell ?? "").trim().length,
        0,
      ),
    0,
  );
  if (textLength < OCR_MIN_TEXT_LENGTH) return true;

  let dateRows = 0;
  let amountRows = 0;
  for (const row of rows) {
    let hasDate = false;
    let hasAmount = false;
    for (const cell of row) {
      const value = String(cell ?? "").trim();
      if (value === "") continue;
      if (!hasDate && parseStatementDate(value) !== null) hasDate = true;
      if (!hasAmount && parseAmountCell(value) !== null) hasAmount = true;
    }
    if (hasDate) dateRows += 1;
    if (hasAmount) amountRows += 1;
  }
  return dateRows === 0 || amountRows === 0;
}

// ---------------------------------------------------------------------------
// PDF document classification (Kuda OCR part 1).
// ---------------------------------------------------------------------------

export interface PdfDocumentProbe {
  kind: PdfDocumentKind;
  /** Only when kind === "encrypted": what the password probe reported. */
  passwordStatus?: PdfPasswordStatus;
  /** Text-layer cells (only for kind === "text"). */
  cells: string[][];
  /** Per-row y geometry (only for kind === "text"). */
  rowYs?: number[];
}

const pdfWorkerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * Tells the import flow what kind of PDF this is BEFORE extraction commits to
 * a reading strategy: usable text layer ("text"), scanned ("scanned"),
 * password-protected ("encrypted") or unreadable ("unsupported"). The probe
 * opens the document with pdfjs and reads the text layer — pages are never
 * rendered. A password can be supplied to re-probe after unlock.
 */
export async function classifyPdfDocument(
  data: ArrayBuffer,
  options?: { password?: string },
): Promise<PdfDocumentProbe> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const params: Record<string, unknown> = { data };
  if (options?.password) params.password = options.password;
  const loadingTask = pdfjs.getDocument(params);
  try {
    const doc = await loadingTask.promise;
    try {
      const cells: string[][] = [];
      const rowYs: number[] = [];
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
          const rows = rowsFromPdfItems(items);
          cells.push(...rows.map((row) => row.cells));
          rowYs.push(...rows.map((row) => row.y));
        } finally {
          page.cleanup();
        }
      }
      return needsOcr(cells)
        ? { kind: "scanned", cells: [], rowYs: undefined }
        : { kind: "text", cells, rowYs };
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    const passwordStatus = passwordStatusOf(error);
    if (passwordStatus !== null) {
      return { kind: "encrypted", passwordStatus, cells: [] };
    }
    return { kind: "unsupported", cells: [] };
  }
}

// ---------------------------------------------------------------------------
// OCR text → the cell grid the pipeline expects.
// ---------------------------------------------------------------------------

/**
 * Splits OCR text into rows/cells: one line per row; cells separated by tabs
 * or runs of whitespace of two+ characters (which is how a scanned table
 * survives OCR — single spaces stay inside a description).
 */
export function ocrTextToCells(text: string): string[][] {
  const cells: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const row = trimmed
      .split(/\t|\s{2,}/)
      .map((cell) => cell.trim())
      .filter((cell) => cell !== "");
    if (row.length > 0) cells.push(row);
  }
  return cells;
}

export interface OcrPageText {
  /** 1-based PDF page number the text came from. */
  page: number;
  text: string;
}

export interface OcrPagesToCellsResult {
  /** Statement cells, page order preserved (pages merged in order). */
  cells: string[][];
  /** Pages that produced usable text. */
  pages: OcrPageText[];
  /** 1-based page numbers whose OCR failed (render or recognition). */
  failedPages: number[];
}

export function ocrPagesToCells(
  pages: OcrPageText[],
  failedPages: number[],
): OcrPagesToCellsResult {
  const cells: string[][] = [];
  for (const page of pages) {
    cells.push(...ocrTextToCells(page.text));
  }
  return { cells, pages, failedPages };
}

// ---------------------------------------------------------------------------
// Page rendering (browser default).
// ---------------------------------------------------------------------------

export interface PdfPageLike {
  getViewport(opts: { scale: number }): PageViewport;
  render(opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PageViewport;
    canvas: HTMLCanvasElement;
  }): { promise: Promise<unknown> };
  cleanup(): void;
}

export async function renderPageToImage(page: PdfPageLike): Promise<OcrImage> {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas is unavailable for statement rendering");
  }
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: pixels.width, height: pixels.height, data: pixels.data };
}

// ---------------------------------------------------------------------------
// Full PDF → cells.
// ---------------------------------------------------------------------------

export interface OcrPdfOutcome {
  /** Whether OCR actually ran (false for text-layer PDFs and non-PDF files). */
  ocrUsed: boolean;
  /** True when the statement is scanned but the OCR engine could not start —
   *  it cannot be read on this device. */
  ocrUnavailable: boolean;
  /** Why the OCR engine could not start, when it could not (asset/worker
   *  errors from the service — never statement content). */
  engineError?: string | null;
  /** 1-based page numbers that produced usable text. */
  pages: number[];
  /** 1-based page numbers whose OCR failed (render or recognition) — the
   *  rest of the statement is still usable. */
  failedPages: number[];
  /** Statement cells (OCR result, page order preserved). */
  cells: string[][];
}

export async function ocrPdfToCells(
  data: ArrayBuffer,
  options: OcrOptions,
): Promise<OcrPdfOutcome> {
  const { service, signal } = options;
  if (signal?.aborted) throw new OcrAbortError();

  options.onPhase?.("reading");
  let available = false;
  try {
    available = await service.isAvailable();
  } catch {
    available = false;
  }
  if (!available) {
    return {
      ocrUsed: false,
      ocrUnavailable: true,
      engineError: service.lastStartError ?? null,
      pages: [],
      failedPages: [],
      cells: [],
    };
  }

  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const params: Record<string, unknown> = { data };
  if (options.password) params.password = options.password;
  const loadingTask = pdfjs.getDocument(params);
  const doc = await loadingTask.promise;
  try {
    const texts: OcrPageText[] = [];
    const failedPages: number[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      if (signal?.aborted) throw new OcrAbortError();
      const page = await doc.getPage(pageNumber);
      let text = "";
      try {
        options.onPhase?.("reading");
        const image = await (options.renderPage ?? renderPageToImage)(page, pageNumber);
        if (signal?.aborted) throw new OcrAbortError();
        options.onPhase?.("scanning");
        text = await service.recognize(image, pageNumber);
      } catch (error) {
        if (isOcrAbort(error)) throw error;
        // One unreadable page never kills the import — keep the rest.
        failedPages.push(pageNumber);
      } finally {
        page.cleanup();
      }
      if (text.trim() !== "") texts.push({ page: pageNumber, text });
    }
    options.onPhase?.("extracting");
    const converted = ocrPagesToCells(texts, failedPages);
    return {
      ocrUsed: true,
      ocrUnavailable: false,
      pages: texts.map((page) => page.page),
      failedPages: converted.failedPages,
      cells: converted.cells,
    };
  } finally {
    void loadingTask.destroy();
  }
}

// ---------------------------------------------------------------------------
// Routing entry point (used by the import modal).
// ---------------------------------------------------------------------------

export interface StatementOcrOutcome {
  cells: string[][];
  source: StatementSource;
  /** Per-row y (PDF text layer only, see extractStatementRows). */
  rowYs?: number[];
  /** What happened with OCR — `ocrUsed: false` for CSV/Excel and for PDFs
   *  whose text layer was readable. */
  ocr: OcrPdfOutcome;
}

export async function extractStatementRowsWithOcr(
  file: File,
  options: OcrOptions,
): Promise<StatementOcrOutcome> {
  // PDFs go through document classification FIRST: a password-protected PDF
  // throws PdfPasswordError (the UI shows its password screen), an
  // unreadable one throws (the generic "couldn't read that file" path), and
  // a scanned one is OCR'd — page order preserved, failures isolated.
  if (extensionOf(file.name) === "pdf") {
    const data = await file.arrayBuffer();
    const probe = await classifyPdfDocument(data, { password: options.password });
    if (probe.kind === "encrypted") {
      throw new PdfPasswordError(probe.passwordStatus ?? "needs-password");
    }
    if (probe.kind === "unsupported") {
      throw new Error("Unsupported or unreadable PDF document");
    }
    if (probe.kind === "scanned") {
      // pdfjs detaches the ArrayBuffer it is given (transfers it to its
      // worker), so the classification above leaves `data` unusable — re-read
      // the file for the OCR pass (same as the plain scanned path below).
      const ocr = await ocrPdfToCells(await file.arrayBuffer(), options);
      // OCR lines carry no reliable y (and Kuda's OCR parser is not
      // geometry-dependent), so geometry is dropped once OCR takes over.
      return { cells: ocr.cells, source: "pdf", ocr };
    }
    return {
      cells: probe.cells,
      source: "pdf",
      rowYs: probe.rowYs,
      ocr: { ocrUsed: false, ocrUnavailable: false, pages: [], failedPages: [], cells: [] },
    };
  }

  const { cells, source, rowYs } = await extractStatementRows(file);
  if (source !== "pdf" || !needsOcr(cells)) {
    return {
      cells,
      source,
      rowYs,
      ocr: { ocrUsed: false, ocrUnavailable: false, pages: [], failedPages: [], cells: [] },
    };
  }
  const ocr = await ocrPdfToCells(await file.arrayBuffer(), options);
  // OCR lines carry no reliable y (and Kuda's OCR parser is not
  // geometry-dependent), so geometry is dropped once OCR takes over.
  return { cells: ocr.cells, source, ocr };
}