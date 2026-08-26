import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyPdfDocument,
  extractStatementRowsWithOcr,
  isOcrAbort,
  ocrPagesToCells,
  ocrPdfToCells,
  ocrTextToCells,
  OCR_MIN_TEXT_LENGTH,
  needsOcr,
  OcrAbortError,
  type OcrOptions,
  type OcrPagesToCellsResult,
  type OcrPhase,
} from "@/lib/statementOcr";
import { PdfPasswordError } from "@/lib/statementPdf";
import type { OcrImage, OcrService } from "@/lib/ocrService";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("@/lib/statementImport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/statementImport")>();
  return {
    ...actual,
    extractStatementRows: vi.fn(actual.extractStatementRows),
  };
});

afterEach(() => {
  // Reset call history AND implementations between tests — the pdfjs mock is
  // module-shared, so a mockReturnValue set in one test must not leak into
  // the next.
  vi.resetAllMocks();
});

function fakeService(overrides?: Partial<OcrService>): OcrService {
  const pages = new Map<number, string>();
  const failing = new Set<number>();
  return {
    name: "Fake OCR",
    isAvailable: vi.fn().mockResolvedValue(true),
    recognize: vi.fn(async (_image: OcrImage, page: number) => {
      if (failing.has(page)) throw new Error(`page ${page} exploded`);
      return pages.get(page) ?? `PAGE ${page} CONTENT`;
    }),
    ...overrides,
  };
}

/** Builds a fake page for the (mocked) pdfjs. */
function pageLike(overrides?: Partial<{ render: () => Promise<void>; cleanup: () => void }>) {
  return {
    getViewport: vi.fn(() => ({ width: 200, height: 400 })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
    ...overrides,
  };
}

/** Stub page renderer — produces a deterministic image per page. */
function stubRenderer() {
  return vi.fn(async () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }));
}

function documentWith(pages: ReturnType<typeof pageLike>[]) {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (n: number) => {
      if (pages[n - 1] === undefined) throw new Error(`no page ${n}`);
      return pages[n - 1];
    }),
  };
}

function collectPhases() {
  const phases: OcrPhase[] = [];
  return { phases, onPhase: (phase: OcrPhase) => phases.push(phase) };
}

/** Builds a fake page for the (mocked) pdfjs. */
function textPage(items: { str: string; x: number; y: number }[]) {
  return {
    getTextContent: vi.fn().mockResolvedValue({
      items: items.map((item) => ({
        str: item.str,
        transform: [10, 0, 0, 10, item.x, item.y],
      })),
    }),
    cleanup: vi.fn(),
  };
}

/** A fake document whose pages expose a text layer (for classifyPdfDocument). */
function textDocument(pageItems: { str: string; x: number; y: number }[][]) {
  return {
    numPages: pageItems.length,
    getPage: vi.fn(async (n: number) => {
      if (pageItems[n - 1] === undefined) throw new Error(`no page ${n}`);
      return textPage(pageItems[n - 1]);
    }),
  };
}

/** Text-layer items for a one-row-per-cell statement table (x separated so
 *  groupPdfRows splits each item into its own cell). */
function statementItems(rows: string[][]): { str: string; x: number; y: number }[] {
  return rows.flatMap((row, i) =>
    row.map((str, j) => ({ str, x: 10 + j * 60, y: 700 - i * 20 })),
  );
}

describe("needsOcr", () => {
  it("says true when there is no text at all (the real scanned Kuda case)", () => {
    expect(needsOcr([])).toBe(true);
    expect(needsOcr([[""], [""]])).toBe(true);
  });

  it("says true for page markers and logo-only headers", () => {
    expect(needsOcr([["Page 1 of 2"]])).toBe(true);
    expect(needsOcr([["Customer Statement"], ["ACME BANK LIMITED"]])).toBe(true);
    expect(
      needsOcr([["ACCOUNT STATEMENT"], ["Period: 01/01/2026 to 02/01/2026"]]),
    ).toBe(true);
  });

  it("says true when text is too short to be a statement", () => {
    expect(needsOcr([["a".repeat(OCR_MIN_TEXT_LENGTH - 1)]])).toBe(true);
  });

  it("says false for a real statement-shaped text layer (PalmPay-like)", () => {
    const cells = [
      ["Transaction Date", "Transaction Detail", "Money In (NGN)", "Money Out (NGN)"],
      ["01/08/2026", "TRF/GL/002034 TRANSFER", "", "50,000.00"],
      ["02/08/2026", "POS/GTB/0001 REFILL", "25,000.00", ""],
    ];
    expect(needsOcr(cells)).toBe(false);
  });

  it("says false for GTCO/OPay-style CSVs with dates and amounts", () => {
    const cells = [
      ["Transaction Date", "Value Date", "Debit", "Credit", "Balance", "Narration"],
      ["01/08/2026", "01/08/2026", "500.00", "99,500.00", "ATM WITHDRAWAL"],
      ["02/08/2026", "02/08/2026", "", "1,200.00", "100,700.00", "TRANSFER"],
    ];
    expect(needsOcr(cells)).toBe(false);
  });

  it("says true for a page number footer that leaked into the text layer", () => {
    expect(needsOcr([["1"], ["2"]])).toBe(true);
  });

  it("says true for a cover page with a date but no amounts", () => {
    expect(needsOcr([["Statement issued 15/07/2026"]])).toBe(true);
  });
});

describe("ocrTextToCells", () => {
  it("splits lines and multi-space runs", () => {
    const cells = ocrTextToCells(
      "Date  Description  Amount\n01/08/2026  RENT PAYMENT  500,000.00\n",
    );
    expect(cells).toEqual([
      ["Date", "Description", "Amount"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00"],
    ]);
  });

  it("keeps single spaces inside descriptions", () => {
    expect(ocrTextToCells("ATM WITHDRAWAL  5000.00\n")).toEqual([
      ["ATM WITHDRAWAL", "5000.00"],
    ]);
    expect(ocrTextToCells("RENT PAYMENT 5 000\n")).toEqual([["RENT PAYMENT 5 000"]]);
  });

  it("splits on tabs", () => {
    expect(ocrTextToCells("a\tb\tc\n")).toEqual([["a", "b", "c"]]);
  });

  it("skips blank lines and trims cells", () => {
    expect(ocrTextToCells("  \n  a   b  \n\n  c  ")).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });
});

describe("ocrPagesToCells", () => {
  it("merges pages in order with failed pages reported separately", () => {
    const result: OcrPagesToCellsResult = ocrPagesToCells(
      [
        { page: 1, text: "a  b\nc  d" },
        { page: 3, text: "e  f" },
      ],
      [2],
    );
    expect(result.cells).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
    expect(result.failedPages).toEqual([2]);
    expect(result.pages.map((page) => page.page)).toEqual([1, 3]);
  });
});

describe("ocrPdfToCells", () => {
  async function pdfBytes(): Promise<ArrayBuffer> {
    return new ArrayBuffer(8);
  }

  it("renders each page, OCRs it and returns cells in page order", async () => {
    const pdfjs = await import("pdfjs-dist");
    const service = fakeService();
    const renderer = stubRenderer();
    const pages = [pageLike(), pageLike()];
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(documentWith(pages)),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);
    service.recognize = vi.fn(async (_image, page) => `Page ${page}\nDate  Amount\n01/08/2026  500.00`);

    const { phases, onPhase } = collectPhases();
    const outcome = await ocrPdfToCells(await pdfBytes(), {
      service,
      onPhase,
      renderPage: renderer,
    } as OcrOptions);

    expect(outcome.ocrUsed).toBe(true);
    expect(outcome.ocrUnavailable).toBe(false);
    expect(outcome.pages).toEqual([1, 2]);
    expect(outcome.failedPages).toEqual([]);
    expect(outcome.cells[0]).toEqual(["Page 1"]);
    expect(outcome.cells[1]).toEqual(["Date", "Amount"]);
    expect(outcome.cells[2]).toEqual(["01/08/2026", "500.00"]);
    expect(outcome.cells[3]).toEqual(["Page 2"]);
    expect(renderer).toHaveBeenCalledTimes(2);
    expect(service.recognize).toHaveBeenCalledTimes(2);
    expect(phases).toEqual(["reading", "reading", "scanning", "reading", "scanning", "extracting"]);
  });

  it("isolates a page whose recognition fails and keeps the rest", async () => {
    const pdfjs = await import("pdfjs-dist");
    const service = fakeService();
    const recognize = vi.fn(async (_image: OcrImage, page: number) => {
      if (page === 2) throw new Error("recognition exploded");
      return `content ${page}`;
    });
    service.recognize = recognize;
    const renderer = stubRenderer();
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(documentWith([pageLike(), pageLike(), pageLike()])),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await ocrPdfToCells(await pdfBytes(), {
      service,
      renderPage: renderer,
    } as OcrOptions);

    expect(outcome.failedPages).toEqual([2]);
    expect(outcome.pages).toEqual([1, 3]);
    expect(outcome.cells).toEqual([["content 1"], ["content 3"]]);
    expect(recognize).toHaveBeenCalledTimes(3);
  });

  it("isolates a page whose render fails", async () => {
    const pdfjs = await import("pdfjs-dist");
    const service = fakeService();
    const renderer = vi.fn(async (_page: unknown, pageNumber: number) => {
      if (pageNumber === 1) throw new Error("render exploded");
      return { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    });
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(documentWith([pageLike(), pageLike()])),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await ocrPdfToCells(await pdfBytes(), {
      service,
      renderPage: renderer,
    } as OcrOptions);

    expect(outcome.failedPages).toEqual([1]);
    expect(outcome.cells).toEqual([["PAGE 2 CONTENT"]]);
    expect(service.recognize).toHaveBeenCalledTimes(1);
  });

  it("reports OCR unavailable when the service cannot start and OCRs nothing", async () => {
    const pdfjs = await import("pdfjs-dist");
    const service = fakeService({ isAvailable: vi.fn().mockResolvedValue(false) });
    const renderer = stubRenderer();
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(documentWith([pageLike()])),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await ocrPdfToCells(await pdfBytes(), {
      service,
      renderPage: renderer,
    } as OcrOptions);

    expect(outcome).toEqual({
      ocrUsed: false,
      ocrUnavailable: true,
      engineError: null,
      pages: [],
      failedPages: [],
      cells: [],
    });
    expect(renderer).not.toHaveBeenCalled();
    expect(service.recognize).not.toHaveBeenCalled();
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("surfaces the engine start error as a diagnostic when OCR cannot start", async () => {
    const service = fakeService({
      isAvailable: vi.fn().mockResolvedValue(false),
      lastStartError: "Failed to fetch dynamically imported module: /vendor/tesseract/worker.min.js",
    });

    const outcome = await ocrPdfToCells(await pdfBytes(), {
      service,
      renderPage: stubRenderer(),
    } as OcrOptions);

    expect(outcome.ocrUnavailable).toBe(true);
    expect(outcome.engineError).toContain("/vendor/tesseract/worker.min.js");
  });

  it("throws OcrAbortError when aborted mid-way and stops", async () => {
    const pdfjs = await import("pdfjs-dist");
    const service = fakeService();
    const renderer = stubRenderer();
    const controller = new AbortController();
    const recognize = vi.fn(async (_image: OcrImage, page: number) => {
      if (page === 1) {
        // The user closes the modal while page 1 is being OCR'd.
        controller.abort();
        return "page 1";
      }
      return "page 2";
    });
    service.recognize = recognize;
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(documentWith([pageLike(), pageLike()])),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const pending = ocrPdfToCells(await pdfBytes(), {
      service,
      renderPage: renderer,
      signal: controller.signal,
    });

    await expect(pending).rejects.toBeInstanceOf(OcrAbortError);
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  it("throws OcrAbortError when aborted before the first page", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      ocrPdfToCells(await pdfBytes(), {
        service: fakeService(),
        signal: controller.signal,
      } as OcrOptions),
    ).rejects.toBeInstanceOf(OcrAbortError);
  });
});

describe("classifyPdfDocument", () => {
  function loadingTask(doc: unknown, passwordError?: Error) {
    return {
      promise: passwordError ? Promise.reject(passwordError) : Promise.resolve(doc),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never;
  }

  function passwordError(code: number): Error & { name: string; code: number } {
    const error = new Error("password") as Error & { name: string; code: number };
    error.name = "PasswordException";
    error.code = code;
    return error;
  }

  it("classifies a usable text layer as 'text' with the cells", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(
        textDocument([
          statementItems([
            ["Transaction Date", "Debit", "Credit", "Balance", "Narration"],
            ["01/08/2026", "500.00", "99,500.00", "ATM WITHDRAWAL"],
          ]),
        ]),
      ),
    );

    const probe = await classifyPdfDocument(new ArrayBuffer(8));

    expect(probe.kind).toBe("text");
    expect(probe.cells[0]).toEqual([
      "Transaction Date",
      "Debit",
      "Credit",
      "Balance",
      "Narration",
    ]);
    expect(probe.cells[1]).toEqual(["01/08/2026", "500.00", "99,500.00", "ATM WITHDRAWAL"]);
    expect(probe.passwordStatus).toBeUndefined();
  });

  it("classifies a PDF without a usable text layer as 'scanned'", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(textDocument([[], []])),
    );

    const probe = await classifyPdfDocument(new ArrayBuffer(8));

    expect(probe.kind).toBe("scanned");
    expect(probe.cells).toEqual([]);
  });

  it("classifies a page-marker-only text layer as 'scanned'", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(textDocument([statementItems([["Page 1 of 2"]])])),
    );

    const probe = await classifyPdfDocument(new ArrayBuffer(8));

    expect(probe.kind).toBe("scanned");
  });

  it("classifies a password-protected PDF as 'encrypted' (needs-password)", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(loadingTask(undefined, passwordError(1)));

    const probe = await classifyPdfDocument(new ArrayBuffer(8));

    expect(probe.kind).toBe("encrypted");
    expect(probe.passwordStatus).toBe("needs-password");
  });

  it("classifies a wrong-password probe as 'encrypted' (incorrect-password)", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(loadingTask(undefined, passwordError(2)));

    const probe = await classifyPdfDocument(new ArrayBuffer(8), { password: "wrong" });

    expect(probe.kind).toBe("encrypted");
    expect(probe.passwordStatus).toBe("incorrect-password");
  });

  it("classifies an unclassifiable PasswordException as unsupported encryption", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(loadingTask(undefined, passwordError(99)));

    const probe = await classifyPdfDocument(new ArrayBuffer(8), { password: "x" });

    expect(probe.kind).toBe("encrypted");
    expect(probe.passwordStatus).toBe("unsupported-encryption");
  });

  it("classifies a corrupt PDF as 'unsupported'", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(undefined, new Error("corrupt pdf")),
    );

    const probe = await classifyPdfDocument(new ArrayBuffer(8));

    expect(probe.kind).toBe("unsupported");
  });

  it("threads a supplied password into pdfjs", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(
        textDocument([
          statementItems([
            ["Date", "Amount"],
            ["01/08/2026", "500.00"],
          ]),
        ]),
      ),
    );

    await classifyPdfDocument(new ArrayBuffer(8), { password: "secret123" });

    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      data: expect.any(ArrayBuffer),
      password: "secret123",
    });
  });

  it("does not pass a password when none was supplied", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue(
      loadingTask(textDocument([statementItems([["Page 1 of 2"]])])),
    );

    await classifyPdfDocument(new ArrayBuffer(8));

    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) });
  });
});

describe("extractStatementRowsWithOcr", () => {
  it("never OCRs CSV files", async () => {
    const statementImport = await import("@/lib/statementImport");
    vi.mocked(statementImport.extractStatementRows).mockResolvedValue({
      cells: [["a", "b"]],
      source: "csv",
    });
    const service = fakeService();
    const file = new File(["a,b\n"], "statement.csv", { type: "text/csv" });

    const outcome = await extractStatementRowsWithOcr(file, {
      service,
    } as OcrOptions);

    expect(outcome.source).toBe("csv");
    expect(outcome.ocr.ocrUsed).toBe(false);
    expect(service.recognize).not.toHaveBeenCalled();
  });

  it("skips OCR when the PDF text layer is already usable (GTCO-like)", async () => {
    const service = fakeService();
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(
        textDocument([
          statementItems([
            ["Transaction Date", "Debit", "Credit", "Balance", "Narration"],
            ["01/08/2026", "500.00", "99,500.00", "ATM WITHDRAWAL"],
          ]),
        ]),
      ),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await extractStatementRowsWithOcr(
      new File(["x"], "statement.pdf"),
      { service } as OcrOptions,
    );

expect(outcome.ocr.ocrUsed).toBe(false);
    expect(service.recognize).not.toHaveBeenCalled();
    expect(pdfjs.getDocument).toHaveBeenCalledTimes(1);
    expect(outcome.cells[1]).toEqual([
      "01/08/2026",
      "500.00",
      "99,500.00",
      "ATM WITHDRAWAL",
    ]);
  });

  it("OCR for a scanned PDF and returns the OCR cells as the statement cells", async () => {
    const service = fakeService();
    const renderer = stubRenderer();
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument)
      .mockReturnValueOnce({
        promise: Promise.resolve(textDocument([[]])),
        destroy: vi.fn().mockResolvedValue(undefined),
      } as never)
      .mockReturnValueOnce({
        promise: Promise.resolve(documentWith([pageLike()])),
        destroy: vi.fn().mockResolvedValue(undefined),
      } as never);

    const outcome = await extractStatementRowsWithOcr(
      new File(["x"], "Customer Statement.pdf", { type: "application/pdf" }),
      { service, renderPage: renderer } as OcrOptions,
    );

    expect(outcome.source).toBe("pdf");
    expect(outcome.ocr.ocrUsed).toBe(true);
    expect(outcome.cells).toEqual([["PAGE 1 CONTENT"]]);
  });

  it("reports OCR unavailable for scanned PDFs and returns empty cells", async () => {
    const service = fakeService({ isAvailable: vi.fn().mockResolvedValue(false) });
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(textDocument([[]])),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await extractStatementRowsWithOcr(
      new File(["x"], "statement.pdf"),
      { service } as OcrOptions,
    );

    expect(outcome.ocr).toMatchObject({ ocrUsed: false, ocrUnavailable: true });
    expect(outcome.cells).toEqual([]);
  });

  it("throws PdfPasswordError for a password-protected PDF", async () => {
    const service = fakeService();
    const pdfjs = await import("pdfjs-dist");
    const passwordError = new Error("No password given") as Error & {
      name: string;
      code: number;
    };
    passwordError.name = "PasswordException";
    passwordError.code = 1;
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(passwordError),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(
      extractStatementRowsWithOcr(new File(["x"], "statement.pdf"), {
        service,
      } as OcrOptions),
    ).rejects.toMatchObject({
      name: "PdfPasswordError",
      status: "needs-password",
    });
    expect(service.recognize).not.toHaveBeenCalled();
  });

  it("rejects a wrong password with incorrect-password status", async () => {
    const service = fakeService();
    const pdfjs = await import("pdfjs-dist");
    const passwordError = new Error("Incorrect Password") as Error & {
      name: string;
      code: number;
    };
    passwordError.name = "PasswordException";
    passwordError.code = 2;
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(passwordError),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(
      extractStatementRowsWithOcr(new File(["x"], "statement.pdf"), {
        service,
        password: "wrong",
      } as OcrOptions),
    ).rejects.toBeInstanceOf(PdfPasswordError);
    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      data: expect.any(ArrayBuffer),
      password: "wrong",
    });
  });

  it("unlocks an encrypted text PDF with the right password and reads its cells", async () => {
    const service = fakeService();
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve(
        textDocument([
          statementItems([
            ["Transaction Date", "Debit", "Credit", "Balance", "Narration"],
            ["01/08/2026", "500.00", "99,500.00", "ATM WITHDRAWAL"],
          ]),
        ]),
      ),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const outcome = await extractStatementRowsWithOcr(
      new File(["x"], "statement.pdf"),
      { service, password: "secret123" } as OcrOptions,
    );

expect(outcome.ocr.ocrUsed).toBe(false);
    expect(outcome.cells[1]).toEqual([
      "01/08/2026",
      "500.00",
      "99,500.00",
      "ATM WITHDRAWAL",
    ]);
    expect(service.recognize).not.toHaveBeenCalled();
  });

  it("routes an encrypted scanned PDF (unlocked) into OCR", async () => {
    const service = fakeService();
    const renderer = stubRenderer();
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument)
      .mockReturnValueOnce({
        promise: Promise.resolve(textDocument([[], []])),
        destroy: vi.fn().mockResolvedValue(undefined),
      } as never)
      .mockReturnValueOnce({
        promise: Promise.resolve(documentWith([pageLike(), pageLike()])),
        destroy: vi.fn().mockResolvedValue(undefined),
      } as never);

    const outcome = await extractStatementRowsWithOcr(
      new File(["x"], "encrypted-scanned.pdf"),
      { service, renderPage: renderer, password: "secret123" } as OcrOptions,
    );

    expect(outcome.ocr.ocrUsed).toBe(true);
    expect(outcome.ocr.pages).toEqual([1, 2]);
    expect(outcome.cells).toEqual([["PAGE 1 CONTENT"], ["PAGE 2 CONTENT"]]);
  });

  it("throws for a corrupt/unreadable PDF", async () => {
    const service = fakeService();
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(new Error("corrupt pdf")),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(
      extractStatementRowsWithOcr(new File(["x"], "statement.pdf"), {
        service,
      } as OcrOptions),
    ).rejects.toThrow("Unsupported or unreadable PDF document");
    expect(service.recognize).not.toHaveBeenCalled();
  });
});

describe("OcrAbortError", () => {
  it("is recognized by isOcrAbort", () => {
    expect(isOcrAbort(new OcrAbortError())).toBe(true);
    expect(isOcrAbort(new DOMException("boom", "AbortError"))).toBe(true);
    expect(isOcrAbort(new Error("other"))).toBe(false);
  });
});
