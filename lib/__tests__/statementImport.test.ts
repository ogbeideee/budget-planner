import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/types";
import {
  buildCandidates,
  detectCategory,
  extractStatementRows,
  groupPdfLines,
  isSupportedFile,
  parseAmountCell,
  parseCsv,
  parseStatementDate,
  parseStatementDateTime,
  rowsFromExcel,
  rowsFromPdf,
  rowsFromPdfItems,
} from "@/lib/statementImport";

vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function category(
  name: string,
  kind: "income" | "expense",
  color = "#0ea5a4",
): Category {
  return {
    id: `cat-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    icon: "•",
    color,
    kind,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const CATEGORIES: Category[] = [
  category("Rent", "expense"),
  category("Groceries", "expense"),
  category("Transport", "expense"),
  category("Utilities", "expense"),
  category("Internet", "expense"),
  category("Entertainment", "expense"),
  category("Salary", "income"),
  category("Business", "income"),
];

describe("parseCsv", () => {
  it("splits simple rows and handles CRLF", () => {
    expect(parseCsv("a,b\nc,d\r\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("keeps commas and newlines inside quoted fields", () => {
    expect(parseCsv('"a,b","c\nd"\ne,f')).toEqual([
      ["a,b", "c\nd"],
      ["e", "f"],
    ]);
  });

  it("unwraps escaped quotes", () => {
    expect(parseCsv('"he said ""hi"""')).toEqual([['he said "hi"']]);
  });

  it("handles a trailing newline and blank rows", () => {
    expect(parseCsv("a,b\n\nc,d\n")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });

  it("rejoins unquoted comma-thousands amounts", () => {
    expect(parseCsv("Date,Amount\n01/08/2026,500,000.00")).toEqual([
      ["Date", "Amount"],
      ["01/08/2026", "500,000.00"],
    ]);
    expect(parseCsv("01/08/2026,1,500,000.00 DR")).toEqual([
      ["01/08/2026", "1,500,000.00 DR"],
    ]);
    // Quoted commas stay untouched.
    expect(parseCsv('"a,b",c')).toEqual([["a,b", "c"]]);
  });
});

describe("parseAmountCell", () => {
  it("parses plain amounts to minor units", () => {
    expect(parseAmountCell("1,234.56")).toEqual({
      minor: 123456,
      direction: "unknown",
    });
    expect(parseAmountCell("1250")).toEqual({ minor: 125000, direction: "unknown" });
    expect(parseAmountCell("12.5")).toEqual({ minor: 1250, direction: "unknown" });
  });

  it("parses Excel-style leading-dot decimal amounts", () => {
    expect(parseAmountCell(".20")).toEqual({ minor: 20, direction: "unknown" });
    expect(parseAmountCell(".75")).toEqual({ minor: 75, direction: "unknown" });
    expect(parseAmountCell(".0")).toBeNull();
  });

  it("strips currency symbols and whitespace", () => {
    expect(parseAmountCell("₦1,000.00")).toEqual({
      minor: 100000,
      direction: "unknown",
    });
    expect(parseAmountCell(" $ 50.25 ")).toEqual({
      minor: 5025,
      direction: "unknown",
    });
  });

  it("reads minus signs, parentheses and trailing minus as out", () => {
    expect(parseAmountCell("-500.00")?.direction).toBe("out");
    expect(parseAmountCell("(250.50)")?.direction).toBe("out");
    expect(parseAmountCell("250.50-")?.direction).toBe("out");
  });

  it("treats a bare plus as neutral — the column context decides", () => {
    // A leading "+" carries no direction of its own: in a signed single
    // amount column (PalmPay's Money In) the parser's own column knowledge
    // decides "in"; in a debit/credit table the column membership decides.
    // The cell parser must not guess income from a sign alone.
    expect(parseAmountCell("+1,234.56")).toEqual({
      minor: 123456,
      direction: "unknown",
    });
  });

  it("reads CR/DR/DB markers as direction", () => {
    expect(parseAmountCell("1,000.00 CR")).toEqual({
      minor: 100000,
      direction: "in",
    });
    expect(parseAmountCell("2,000.00 DR")).toEqual({
      minor: 200000,
      direction: "out",
    });
    expect(parseAmountCell("500 DB")).toEqual({
      minor: 50000,
      direction: "out",
    });
  });

  it("rejects non-numeric and zero cells", () => {
    expect(parseAmountCell("")).toBeNull();
    expect(parseAmountCell("N/A")).toBeNull();
    expect(parseAmountCell("0.00")).toBeNull();
    expect(parseAmountCell("1.234")).toBeNull();
  });

  it("rejects bare 10+ digit runs (references, never amounts)", () => {
    expect(parseAmountCell("2607010201000")).toBeNull();
    expect(parseAmountCell("2607010101020")).toBeNull();
    expect(parseAmountCell("3000127755")).toBeNull();
    expect(parseAmountCell("100004")).toEqual({
      minor: 10_000_400,
      direction: "unknown",
    });
    expect(parseAmountCell("999999")).toEqual({
      minor: 99_999_900,
      direction: "unknown",
    });
  });

  it("still parses large but well-formed amounts (no magnitude cap)", () => {
    expect(parseAmountCell("₦2,607,010,201,000.00")).toEqual({
      minor: 260_701_020_100_000,
      direction: "unknown",
    });
    expect(parseAmountCell("2,500,000,000.00")).toEqual({
      minor: 250_000_000_000,
      direction: "unknown",
    });
  });
});

describe("parseStatementDate", () => {
  it("parses ISO dates", () => {
    expect(parseStatementDate("2026-08-12")).toBe("2026-08-12");
  });

  it("parses day-first dates (NGN convention) when ambiguous", () => {
    expect(parseStatementDate("12/08/2026")).toBe("2026-08-12");
    expect(parseStatementDate("12-08-2026")).toBe("2026-08-12");
    expect(parseStatementDate("12.08.2026")).toBe("2026-08-12");
  });

  it("disambiguates when one part exceeds 12", () => {
    expect(parseStatementDate("31/01/2026")).toBe("2026-01-31");
    expect(parseStatementDate("24/12/2026")).toBe("2026-12-24");
  });

  it("parses named-month formats", () => {
    expect(parseStatementDate("12 Aug 2026")).toBe("2026-08-12");
    expect(parseStatementDate("12-Aug-26")).toBe("2026-08-12");
    expect(parseStatementDate("Aug 12, 2026")).toBe("2026-08-12");
  });

  it("strips time suffixes", () => {
    expect(parseStatementDate("12/08/2026 09:41:23")).toBe("2026-08-12");
    expect(parseStatementDate("2026-08-12T09:41:23")).toBe("2026-08-12");
  });

  it("rejects invalid dates", () => {
    expect(parseStatementDate("99/99/2026")).toBeNull();
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("hello")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
  });
});

describe("parseStatementDateTime", () => {
  it("parses a space-separated time into 24h", () => {
    expect(parseStatementDateTime("12/08/2026 14:32")).toEqual({
      date: "2026-08-12",
      time: "14:32",
    });
    expect(parseStatementDateTime("12/08/2026 09:41:23")).toEqual({
      date: "2026-08-12",
      time: "09:41:23",
    });
  });

  it("parses an ISO T-separated datetime", () => {
    expect(parseStatementDateTime("2026-08-12T09:05:07")).toEqual({
      date: "2026-08-12",
      time: "09:05:07",
    });
  });

  it("normalizes AM/PM to 24h", () => {
    expect(parseStatementDateTime("12 Aug 2026 2:32 PM")).toEqual({
      date: "2026-08-12",
      time: "14:32",
    });
    expect(parseStatementDateTime("12/08/2026 12:00 AM")).toEqual({
      date: "2026-08-12",
      time: "00:00",
    });
  });

  it("returns date-only cells without a time", () => {
    expect(parseStatementDateTime("12/08/2026")).toEqual({ date: "2026-08-12" });
    expect(parseStatementDateTime("2026-08-12")?.time).toBeUndefined();
  });

  it("ignores malformed times but keeps the date", () => {
    expect(parseStatementDateTime("12/08/2026 99:99")).toEqual({
      date: "2026-08-12",
    });
  });

  it("rejects unparseable input", () => {
    expect(parseStatementDateTime("hello")).toBeNull();
    expect(parseStatementDateTime("")).toBeNull();
  });
});

describe("isSupportedFile", () => {
  it("accepts csv, xlsx, xls and pdf", () => {
    for (const name of ["stmt.csv", "stmt.xlsx", "stmt.xls", "stmt.PDF"]) {
      expect(isSupportedFile(name)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    expect(isSupportedFile("stmt.txt")).toBe(false);
    expect(isSupportedFile("stmt.json")).toBe(false);
    expect(isSupportedFile("noextension")).toBe(false);
  });
});

describe("buildCandidates", () => {
  it("detects a GTB-style debit/credit statement", () => {
    const csv = [
      ["Value Date", "Description", "Debit", "Credit", "Balance"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00", "", "1,500,000.00"],
      ["02/08/2026", "SHOPRITE SUPERMARKET", "85,250.00", "", "1,414,750.00"],
      ["03/08/2026", "SALARY PAYMENT", "", "900,000.00", "2,314,750.00"],
      ["04/08/2026", "NETFLIX SUBSCRIPTION", "12,000.00", "", "2,302,750.00"],
    ];
    const { candidates, skipped } = buildCandidates(csv, CATEGORIES);

    expect(skipped).toBe(0);
    expect(candidates).toHaveLength(4);
    expect(candidates[0]).toMatchObject({
      date: "2026-08-01",
      description: "RENT PAYMENT",
      amount: -50000000,
      type: "expense",
      categoryId: "cat-rent",
    });
    expect(candidates[1].categoryId).toBe("cat-groceries");
    expect(candidates[2]).toMatchObject({
      amount: 90000000,
      type: "income",
      categoryId: "cat-salary",
    });
    expect(candidates[3].categoryId).toBe("cat-entertainment");
  });

  it("parses a single Amount column with CR/DR suffixes", () => {
    const csv = [
      ["Date", "Narration", "Amount", "Balance"],
      ["01/08/2026", "FUEL PURCHASE", "20,000.00 DR", "980,000.00"],
      ["02/08/2026", "TRANSFER FROM CHI", "50,000.00 CR", "1,030,000.00"],
    ];
    const { candidates } = buildCandidates(csv, CATEGORIES);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      date: "2026-08-01",
      amount: -2000000,
      type: "expense",
      categoryId: "cat-transport",
    });
    expect(candidates[1]).toMatchObject({
      date: "2026-08-02",
      amount: 5000000,
      type: "income",
    });
  });

  it("infers direction from the balance column when signs are absent", () => {
    const csv = [
      ["Date", "Narration", "Amount", "Balance"],
      ["01/08/2026", "SALARY", "500,000.00", "500,000.00"],
      ["02/08/2026", "RENT", "150,000.00", "350,000.00"],
      ["03/08/2026", "INTEREST", "2,000.00", "352,000.00"],
    ];
    const { candidates } = buildCandidates(csv, CATEGORIES);
    expect(candidates).toHaveLength(3);
    expect(candidates[0].amount).toBeGreaterThan(0);
    expect(candidates[0].type).toBe("income");
    expect(candidates[1].amount).toBeLessThan(0);
    expect(candidates[1].type).toBe("expense");
  });

  it("skips rows without a date or amount", () => {
    const csv = [
      ["Date", "Description", "Debit", "Credit"],
      ["01/08/2026", "SOMETHING", "", ""],
      ["not-a-date", "BAD ROW", "10.00", ""],
      ["02/08/2026", "GOOD ROW", "10.00", ""],
    ];
    const { candidates, skipped } = buildCandidates(csv, CATEGORIES);
    expect(candidates).toHaveLength(1);
    expect(skipped).toBe(2);
    expect(candidates[0].description).toBe("GOOD ROW");
  });

  it("leaves unmatched descriptions uncategorized", () => {
    const csv = [
      ["Date", "Description", "Debit"],
      ["01/08/2026", "MYSTERY CHARGE X7", "100.00"],
    ];
    const { candidates } = buildCandidates(csv, CATEGORIES);
    expect(candidates[0].categoryId).toBeNull();
  });

  it("works on headerless rows (PDF-style)", () => {
    const rows = [
      ["01/08/2026", "RENT PAYMENT", "500,000.00"],
      ["02/08/2026", "SALARY PAYMENT", "900,000.00"],
    ];
    const { candidates } = buildCandidates(rows, CATEGORIES);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].amount).toBeLessThan(0);
    expect(candidates[1].amount).toBeGreaterThan(0);
  });

  it("joins multiple narration columns into the description", () => {
    const csv = [
      ["Date", "Narration", "Ref No", "Amount"],
      ["01/08/2026", "MTN DATA RECHARGE", "REF-123", "5,000.00 DR"],
    ];
    const { candidates } = buildCandidates(csv, CATEGORIES);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].description).toBe("MTN DATA RECHARGE · REF-123");
    expect(candidates[0].categoryId).toBe("cat-internet");
  });
});

describe("detectCategory", () => {
  it("matches aliases with the longest keyword winning", () => {
    expect(detectCategory("EKEDC PREPAID POWER", "expense", CATEGORIES)).toBe(
      "cat-utilities",
    );
    expect(detectCategory("BOLT RIDE", "expense", CATEGORIES)).toBe(
      "cat-transport",
    );
  });

  it("only matches categories of the row's kind", () => {
    expect(detectCategory("SALARY WAGE", "income", CATEGORIES)).toBe("cat-salary");
    expect(detectCategory("SALARY WAGE", "expense", CATEGORIES)).toBeNull();
  });

  it("matches custom category names directly", () => {
    const custom = [...CATEGORIES, category("PalmPay", "expense")];
    expect(detectCategory("PALMPAY TRANSFER IN", "expense", custom)).toBe(
      "cat-palmpay",
    );
  });

  it("returns null when nothing matches", () => {
    expect(detectCategory("QR CODE PAYMENT", "expense", CATEGORIES)).toBeNull();
  });
});

describe("groupPdfLines", () => {
  it("groups text items into lines and splits columns by x-gaps", () => {
    const items = [
      { str: "01/08/2026", x: 40, y: 100 },
      { str: "RENT", x: 160, y: 100 },
      { str: "PAYMENT", x: 196, y: 100 },
      { str: "500,000.00", x: 420, y: 100 },
      { str: "02/08/2026", x: 40, y: 122 },
      { str: "SALARY", x: 160, y: 122 },
      { str: "900,000.00", x: 420, y: 122 },
    ];
    expect(groupPdfLines(items)).toEqual([
      ["02/08/2026", "SALARY", "900,000.00"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00"],
    ]);
  });

  it("ignores empty strings", () => {
    expect(groupPdfLines([{ str: "  ", x: 10, y: 10 }])).toEqual([]);
  });
});

describe("rowsFromPdfItems — header-anchored column alignment (GTCO)", () => {
  // The REAL GTCO text layer emits NO text for empty cells, so a row whose
  // Credits (or Remarks) slot is empty arrives left-packed — the columnar
  // engine's misalignment guards then correctly reject the shifted numbers
  // (the balance lands in the Credits slot, etc.). rowsFromPdfItems re-slots
  // every line into the columns anchored by the page's columnar table header
  // (nearest x, empties made explicit) when that header carries enough
  // columnar vocabulary.
  const header = [
    { str: "Trans. Date", x: 50, y: 100 },
    { str: "Value Date", x: 100, y: 100 },
    { str: "Reference", x: 150, y: 100 },
    { str: "Debits", x: 200, y: 100 },
    { str: "Credits", x: 250, y: 100 },
    { str: "Balance", x: 300, y: 100 },
    { str: "Originating Branch", x: 350, y: 100 },
    { str: "Remarks", x: 400, y: 100 },
  ];

  it("realigns a sparse row into explicit 8-cell columns (balance stays in Balance)", () => {
    const rows = rowsFromPdfItems([
      ...header,
      // .20 debit, empty Credits, balance 21.79, branch, empty Remarks.
      { str: "01-Nov-2025", x: 50, y: 90 },
      { str: "01-Nov-2025", x: 100, y: 90 },
      { str: "'", x: 150, y: 90 },
      { str: ".20", x: 200, y: 90 },
      { str: "21.79", x: 300, y: 90 },
      { str: "INTL AIRPORT RD ISOLO", x: 350, y: 90 },
    ]);
    expect(rows.map((row) => row.cells)).toEqual([
      [
        "Trans. Date",
        "Value Date",
        "Reference",
        "Debits",
        "Credits",
        "Balance",
        "Originating Branch",
        "Remarks",
      ],
      ["01-Nov-2025", "01-Nov-2025", "'", ".20", "", "21.79", "INTL AIRPORT RD ISOLO", ""],
    ]);
    expect(rows[1].y).toBe(90);
  });

  it("keeps dense rows identical (alignment is a no-op on full rows)", () => {
    const rows = rowsFromPdfItems([
      ...header,
      { str: "04-Nov-2025", x: 50, y: 90 },
      { str: "04-Nov-2025", x: 100, y: 90 },
      { str: "'GTW", x: 150, y: 90 },
      { str: "79,500.00", x: 200, y: 90 },
      { str: "521.77", x: 300, y: 90 },
      { str: "635 AKIN ADESOLA", x: 350, y: 90 },
      { str: "Commission", x: 400, y: 90 },
    ]);
    expect(rows[1].cells).toEqual([
      "04-Nov-2025",
      "04-Nov-2025",
      "'GTW",
      "79,500.00",
      "",
      "521.77",
      "635 AKIN ADESOLA",
      "Commission",
    ]);
  });

  it("slots wrapped narration lines into the nearest column (branch slot)", () => {
    const rows = rowsFromPdfItems([
      ...header,
      { str: "04-Nov-2025", x: 50, y: 90 },
      { str: "'GTW", x: 150, y: 90 },
      { str: "1,000.00", x: 200, y: 90 },
      { str: "19,441.14", x: 300, y: 90 },
      { str: "635 AKIN ADESOLA", x: 350, y: 90 },
      // The wrapped narration continuation prints on its own line.
      { str: "PALMPAY - DAVID OSAHON OGBEIDE", x: 350, y: 85 },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[2].cells[6]).toBe("PALMPAY - DAVID OSAHON OGBEIDE");
    expect(rows[2].cells[7]).toBe("");
  });

  it("does not realign pages without a columnar header (fallback = raw cells)", () => {
    // PalmPay's 5-column header vocabulary is deliberately excluded, and the
    // 4-token "Transaction Date/Debit/Credit/Balance/Narration" mock header
    // stays below the trigger — both keep the raw reading-order cells.
    const palmpayHeader = [
      { str: "Transaction Date", x: 40, y: 100 },
      { str: "Transaction Detail", x: 160, y: 100 },
      { str: "Money In (NGN)", x: 300, y: 100 },
      { str: "Money Out (NGN)", x: 420, y: 100 },
      { str: "Transaction ID", x: 540, y: 100 },
    ];
    const sparse = [
      { str: "07/22/2026", x: 40, y: 90 },
      { str: "Money Out", x: 420, y: 90 },
    ];
    const rows = rowsFromPdfItems([...palmpayHeader, ...sparse]);
    // Two cells per line: date and the amount — NOT re-slotted into a grid.
    expect(rows.map((row) => row.cells)).toEqual([
      ["Transaction Date", "Transaction Detail", "Money In (NGN)", "Money Out (NGN)", "Transaction ID"],
      ["07/22/2026", "Money Out"],
    ]);
  });

  it("page-marker-only pages yield zero rows (nothing to read)", () => {
    expect(rowsFromPdfItems([{ str: "Page 1 of 5", x: 280, y: 22.9 }])).toEqual([]);
  });
});

describe("rowsFromExcel", () => {
  it("reads the first sheet into trimmed rows", async () => {
    const xlsx = await import("xlsx");
    vi.mocked(xlsx.read).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    } as never);
    vi.mocked(xlsx.utils.sheet_to_json).mockReturnValue([
      ["Date", "Description", "Debit"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00"],
      ["", null],
    ] as never);

    const rows = await rowsFromExcel(new ArrayBuffer(8));
    expect(xlsx.read).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      type: "array",
    });
    expect(rows).toEqual([
      ["Date", "Description", "Debit"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00"],
      ["", ""],
    ]);
  });
});

describe("rowsFromPdf", () => {
  it("extracts pages and destroys the document", async () => {
    const pdfjs = await import("pdfjs-dist");
    const destroy = vi.fn().mockResolvedValue(undefined);
    const page1 = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: "01/08/2026", transform: [1, 0, 0, 1, 40, 100] },
          { str: "RENT", transform: [1, 0, 0, 1, 160, 100] },
          { str: "500,000.00", transform: [1, 0, 0, 1, 420, 100] },
        ],
      }),
      cleanup: vi.fn(),
    };
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(page1),
      }),
      destroy,
    } as never);

    const rows = await rowsFromPdf(new ArrayBuffer(8));
    expect(rows).toEqual([["01/08/2026", "RENT", "500,000.00"]]);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).not.toBe("");
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe("extractStatementRows", () => {
  it("routes CSV files through the CSV parser", async () => {
    const file = new File(["a,b\nc,d"], "statement.csv", {
      type: "text/csv",
    });
    const { cells, source } = await extractStatementRows(file);
    expect(source).toBe("csv");
    expect(cells).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("routes Excel files through rowsFromExcel", async () => {
    const xlsx = await import("xlsx");
    vi.mocked(xlsx.read).mockReturnValue({
      SheetNames: ["S"],
      Sheets: { S: {} },
    } as never);
    vi.mocked(xlsx.utils.sheet_to_json).mockReturnValue([
      ["Date", "Amount"],
      ["01/08/2026", "10.00"],
    ] as never);
    const file = new File(["x"], "statement.xlsx");
    const { source } = await extractStatementRows(file);
    expect(source).toBe("xlsx");
  });

  it("rejects unsupported files", async () => {
    const file = new File(["x"], "statement.txt");
    await expect(extractStatementRows(file)).rejects.toThrow(/Unsupported/);
  });
});

describe("pdfRowsFromPdf — password-protected PDFs", () => {
  function pageWithText(rows: string[][]) {
    return {
      getViewport: vi.fn(),
      render: vi.fn(),
      cleanup: vi.fn(),
      getTextContent: vi.fn().mockResolvedValue({
        items: rows.flatMap((row, i) =>
          row.map((str, j) => ({
            str,
            transform: [10, 0, 0, 10, 10 + j * 60, 700 - i * 20],
          })),
        ),
      }),
    };
  }

  it("threads the password into pdfjs and unlocks the document", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(
          pageWithText([
            ["Date", "Amount"],
            ["01/08/2026", "500.00"],
          ]),
        ),
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const rows = await rowsFromPdf(new ArrayBuffer(8), "secret123");

    expect(pdfjs.getDocument).toHaveBeenCalledWith({
      data: expect.any(ArrayBuffer),
      password: "secret123",
    });
    expect(rows[0]).toEqual(["Date", "Amount"]);
    expect(rows[1]).toEqual(["01/08/2026", "500.00"]);
  });

  it("maps a pdfjs NEED_PASSWORD failure to PdfPasswordError", async () => {
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

    await expect(rowsFromPdf(new ArrayBuffer(8))).rejects.toMatchObject({
      name: "PdfPasswordError",
      status: "needs-password",
    });
  });

  it("maps a pdfjs INCORRECT_PASSWORD failure to PdfPasswordError", async () => {
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

    await expect(rowsFromPdf(new ArrayBuffer(8), "wrong")).rejects.toMatchObject({
      name: "PdfPasswordError",
      status: "incorrect-password",
    });
  });

  it("passes non-password failures through unchanged", async () => {
    const pdfjs = await import("pdfjs-dist");
    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(new Error("corrupt pdf")),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    await expect(rowsFromPdf(new ArrayBuffer(8))).rejects.toThrow("corrupt pdf");
  });
});
