import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { ImportStatementModal } from "./ImportStatementModal";
import { STORAGE_KEY } from "@/lib/storage";
import { PdfPasswordError } from "@/lib/statementPdf";

function persistedState(): { state: ReturnType<typeof createInitialState> } {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error("expected a persisted state payload");
  const parsed = JSON.parse(raw);
  return { state: parsed.state ?? parsed };
}

vi.mock("@/lib/statementImport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/statementImport")>();
  return actual;
});

vi.mock("@/lib/statementOcr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/statementOcr")>();
  return { ...actual, extractStatementRowsWithOcr: vi.fn(actual.extractStatementRowsWithOcr) };
});

vi.mock("@/lib/statementPipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/statementPipeline")>();
  return { ...actual, processStatement: vi.fn(actual.processStatement) };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function categoryId(name: string): string {
  return useAppStore.getState().state.categories.find((c) => c.name === name)!.id;
}

function summaryText(): string {
  return (
    screen.getByRole("group", { name: "Statement summary" }).textContent ?? ""
  );
}

function statementCsv(): File {
  const text = [
    "Value Date,Description,Debit,Credit,Balance",
    "01/08/2026,RENT PAYMENT,500,000.00,,1,500,000.00",
    "03/08/2026,SALARY PAYMENT,,900,000.00,2,400,000.00",
    "04/08/2026,MYSTERY CHARGE X7,12,000.00,,2,388,000.00",
  ].join("\n");
  return new File([text], "statement.csv", { type: "text/csv" });
}

function richStatementCsv(): File {
  const text = [
    "ACCOUNT NUMBER: 0123456789,,,,,",
    "Value Date,Description,Debit,Credit,Balance",
    "01/08/2026,RENT PAYMENT,500,000.00,,1,500,000.00",
    "03/08/2026,SALARY PAYMENT,,900,000.00,2,400,000.00",
    "04/08/2026,TRANSFER TO JOHN DOE,30,000.00,,2,370,000.00",
    "05/08/2026,MYSTERY CHARGE X7,12,000.00,,2,358,000.00",
  ].join("\n");
  return new File([text], "rich.csv", { type: "text/csv" });
}

function transferCsv(): File {
  const text = [
    "Value Date,Description,Debit,Credit,Balance",
    "05/08/2026,TRANSFER TO JOHN DOE,30,000.00,,2,358,000.00",
  ].join("\n");
  return new File([text], "transfer.csv", { type: "text/csv" });
}

function duplicateCsv(): File {
  const text = [
    "Value Date,Description,Debit,Credit,Balance",
    "04/08/2026,MYSTERY CHARGE X7,12,000.00,,2,388,000.00",
    "04/08/2026,MYSTERY CHARGE X7,12,000.00,,2,388,000.00",
  ].join("\n");
  return new File([text], "dupes.csv", { type: "text/csv" });
}

async function uploadStatement(
  user: ReturnType<typeof userEvent.setup>,
  file: File = statementCsv(),
) {
  const input = document.getElementById("statement-file-input") as HTMLInputElement;
  await user.upload(input, file);
}

/** Expands a review row so its editing controls (type, category, exclude)
 *  become visible. */
async function expandRow(
  user: ReturnType<typeof userEvent.setup>,
  description: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Show details for ${description}` }),
  );
}

/**
 * FR-23: answers every row the duplicate scorer flagged. The import stays
 * blocked until each one is decided, so tests that reach the confirm step
 * must resolve them explicitly — which is the whole point of the feature.
 */
async function resolveAllDuplicates(
  user: ReturnType<typeof userEvent.setup>,
  choice: "Skip this one" | "Import anyway" | "Replace existing",
) {
  for (;;) {
    const pending = screen
      .queryAllByRole("button", { name: choice })
      .filter((button) => button.getAttribute("aria-pressed") === "false");
    if (pending.length === 0) break;
    await user.click(pending[0]);
  }
}

/** Gives the base statement's uncategorized row a category so import can
 *  proceed. */
async function assignMysteryCategory(user: ReturnType<typeof userEvent.setup>) {
  const mystery = (await screen.findAllByTitle("MYSTERY CHARGE X7"))[0];
  const row = mystery.closest("li") as HTMLElement;
  await expandRow(user, "MYSTERY CHARGE X7");
  await user.selectOptions(
    within(row).getByRole("combobox", {
      name: /Category for MYSTERY CHARGE X7/i,
    }),
    categoryId("Utilities"),
  );
}

describe("ImportStatementModal — upload stage", () => {
  it("renders the import scaffold copy", () => {
    render(<ImportStatementModal open onClose={() => {}} />);
    expect(
      screen.getByRole("dialog", { name: "Import Bank Statement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse files")).toBeInTheDocument();
    expect(screen.getByText(/CSV, Excel or PDF bank statement/i)).toBeInTheDocument();
    for (const label of ["CSV", "XLSX / XLS", "PDF"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("rejects unsupported file types", () => {
    render(<ImportStatementModal open onClose={() => {}} />);
    const dropzone = screen.getByRole("button", {
      name: "Upload a bank statement file",
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(["x"], "statement.txt")] },
    });
    expect(
      screen.getByText(/statement\.txt isn't a supported file type/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
  });

  it("accepts dropped files and opens the preview", async () => {
    render(<ImportStatementModal open onClose={() => {}} />);
    const dropzone = screen.getByRole("button", {
      name: "Upload a bank statement file",
    });
    fireEvent.drop(dropzone, { dataTransfer: { files: [statementCsv()] } });
    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
  });

  it("explains an empty file", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, new File([""], "blank.csv", { type: "text/csv" }));
    expect(
      await screen.findByText(/That file looks empty/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
  });

  it("explains a file with no readable transactions", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(
      user,
      new File(["Value Date,Description,Debit,Credit,Balance\n"], "empty.csv", {
        type: "text/csv",
      }),
    );
    expect(
      await screen.findByText(/No transactions could be detected in that file/i),
    ).toBeInTheDocument();
  });

  it("explains a file that could not be read at all", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
      new Error("corrupt"),
    );
    await uploadStatement(
      user,
      new File(["corrupt"], "broken.pdf", { type: "application/pdf" }),
    );
    expect(
      await screen.findByText(/We couldn't read that file/i),
    ).toBeInTheDocument();
  });
});

describe("ImportStatementModal — processing stage", () => {
  it("shows a processing state while parsing (UI stays interactive)", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    let release: (value: Awaited<ReturnType<typeof statementOcr.extractStatementRowsWithOcr>>) => void =
      () => {};
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    expect(await screen.findByText(/Parsing your statement…/i)).toBeInTheDocument();
    expect(screen.getByText("statement.csv")).toBeInTheDocument();
    // The modal stays open and closable during processing.
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    release({
      cells: [
        ["Value Date", "Description", "Debit", "Credit", "Balance"],
        ["01/08/2026", "RENT PAYMENT", "500,000.00", "", "1,500,000.00"],
      ],
      source: "csv",
      ocr: { ocrUsed: false, ocrUnavailable: false, pages: [], failedPages: [], cells: [] },
    });
    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
  });
});

describe("ImportStatementModal — preview header", () => {
  it("shows the bank, period, currency and breakdown counts", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());

    expect(await screen.findByText(/OPay statement/i)).toBeInTheDocument();
    expect(screen.getByText("Aug 1, 2026 – Aug 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("$")).toBeInTheDocument();

    expect(summaryText()).toContain("4transactions");
    expect(summaryText()).toContain("1expenses");
    expect(summaryText()).toContain("1income");
    expect(summaryText()).toContain("1transfers");
    expect(summaryText()).toContain("2needs review");
  });

  it("masks the account number from the statement header", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());

    expect(await screen.findByText(/Account \u2022\u2022\u2022\u2022 6789/)).toBeInTheDocument();
    expect(screen.queryByText("0123456789")).not.toBeInTheDocument();
  });

  it("shows an unsupported-format error for unrecognized statement layouts", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(
      user,
      new File(
        ["Date,Description,Amount\n01/08/2026,RENT PAYMENT,500,000.00\n"],
        "generic.csv",
        { type: "text/csv" },
      ),
    );

    expect(
      await screen.findByText(/Unsupported bank statement format/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/GTCO, OPay/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing was read/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Statement summary" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("RENT PAYMENT")).not.toBeInTheDocument();
  });
});

describe("ImportStatementModal — transaction list", () => {
  it("shows date, description, amount, direction, kind and category", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("RENT PAYMENT")).toBeInTheDocument();
    expect(screen.getByText("-$500,000.00")).toBeInTheDocument();
    expect(screen.getByText("SALARY PAYMENT")).toBeInTheDocument();

    const rentRow = screen
      .getByText("RENT PAYMENT")
      .closest("li") as HTMLElement;
    expect(within(rentRow).getByText("2026-08-01")).toBeInTheDocument();
    await expandRow(user, "RENT PAYMENT");
    expect(
      within(rentRow).getByRole("combobox", { name: "Type for RENT PAYMENT" }),
    ).toHaveValue("expense");
    expect(within(rentRow).getByText("High")).toBeInTheDocument();
    expect(within(rentRow).getByText("Rent")).toBeInTheDocument();
    expect(within(rentRow).getByLabelText("Money out")).toBeInTheDocument();

    const salaryRow = screen
      .getByText("SALARY PAYMENT")
      .closest("li") as HTMLElement;
    expect(within(salaryRow).getByLabelText("Money in")).toBeInTheDocument();
  });

  it("marks unknown transactions for review", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
    expect(summaryText()).toContain("1needs review");
    const mystery = screen
      .getByText("MYSTERY CHARGE X7")
      .closest("li") as HTMLElement;
    await expandRow(user, "MYSTERY CHARGE X7");
    expect(
      within(mystery).getByRole("combobox", { name: "Type for MYSTERY CHARGE X7" }),
    ).toHaveValue("unknown");
    expect(within(mystery).getByText("Uncertain")).toBeInTheDocument();
    expect(within(mystery).getByText("Needs review")).toBeInTheDocument();
  });

  it("never lets transfers be miscategorized — no category offered", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, transferCsv());

    const row = (await screen.findByText("TRANSFER TO JOHN DOE")).closest(
      "li",
    ) as HTMLElement;
    expect(within(row).getByText("Low")).toBeInTheDocument();
    await expandRow(user, "TRANSFER TO JOHN DOE");
    expect(
      within(row).getByRole("combobox", { name: "Type for TRANSFER TO JOHN DOE" }),
    ).toHaveValue("transfer");
    expect(
      within(row).queryByRole("combobox", { name: /Category for TRANSFER TO JOHN DOE/i }),
    ).not.toBeInTheDocument();
    expect(within(row).getByText("Needs review")).toBeInTheDocument();
  });

  it("lets the user change a detected category", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    const mystery = await screen.findByText("MYSTERY CHARGE X7");
    const row = mystery.closest("li") as HTMLElement;
    await expandRow(user, "MYSTERY CHARGE X7");
    await user.selectOptions(
      within(row).getByRole("combobox", {
        name: /Category for MYSTERY CHARGE X7/i,
      }),
      categoryId("Utilities"),
    );
    expect(within(row).getByText("Utilities")).toBeInTheDocument();
  });

  it("badges rows that look like duplicates", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, duplicateCsv());

    expect(
      await screen.findByText(/1 possible duplicate detected/i),
    ).toBeInTheDocument();
    const rows = screen.getAllByText("MYSTERY CHARGE X7");
    expect(rows).toHaveLength(2);
    for (const rowText of rows) {
      const row = rowText.closest("li") as HTMLElement;
      expect(within(row).getByText("Duplicate")).toBeInTheDocument();
    }
  });
});

describe("ImportStatementModal — filtering", () => {
  async function openRichPreview() {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
  }

  it("filters by expense and income", async () => {
    await openRichPreview();
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await userEvent.click(within(filters).getByRole("button", { name: /Expenses/ }));
    expect(screen.getByText("RENT PAYMENT")).toBeInTheDocument();
    expect(screen.queryByText("SALARY PAYMENT")).not.toBeInTheDocument();
    expect(screen.queryByText("TRANSFER TO JOHN DOE")).not.toBeInTheDocument();

    await userEvent.click(within(filters).getByRole("button", { name: /Income/ }));
    expect(screen.getByText("SALARY PAYMENT")).toBeInTheDocument();
    expect(screen.queryByText("RENT PAYMENT")).not.toBeInTheDocument();
  });

  it("filters by transfers and shows only movement rows", async () => {
    await openRichPreview();
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await userEvent.click(within(filters).getByRole("button", { name: /Transfers/ }));
    expect(screen.getByText("TRANSFER TO JOHN DOE")).toBeInTheDocument();
    expect(screen.queryByText("RENT PAYMENT")).not.toBeInTheDocument();
    expect(screen.queryByText("SALARY PAYMENT")).not.toBeInTheDocument();
  });

  it("filters to rows needing review", async () => {
    await openRichPreview();
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await userEvent.click(
      within(filters).getByRole("button", { name: /Needs review/ }),
    );
    expect(screen.getByText("TRANSFER TO JOHN DOE")).toBeInTheDocument();
    expect(screen.getAllByTitle("MYSTERY CHARGE X7").length).toBeGreaterThan(0);
    expect(screen.queryAllByTitle("RENT PAYMENT")).toHaveLength(0);
  });

  it("filters to possible duplicates", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, duplicateCsv());
    await screen.findByText(/1 possible duplicate detected/i);
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await userEvent.click(
      within(filters).getByRole("button", { name: /Duplicates/ }),
    );
    expect(screen.getAllByText("MYSTERY CHARGE X7")).toHaveLength(2);
  });

  it("shows an empty state when no rows match the filter", async () => {
    await openRichPreview();
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await userEvent.click(within(filters).getByRole("button", { name: /Duplicates/ }));
    expect(
      screen.getByText("No transactions match this filter."),
    ).toBeInTheDocument();
  });

  it("shows per-filter counts on the pills", async () => {
    await openRichPreview();
    const filters = screen.getByRole("group", { name: "Filter transactions" });
    expect(
      within(filters).getByRole("button", { name: "All 4" }),
    ).toBeInTheDocument();
    expect(
      within(filters).getByRole("button", { name: "Transfers 1" }),
    ).toBeInTheDocument();
    expect(
      within(filters).getByRole("button", { name: "Needs review 2" }),
    ).toBeInTheDocument();
  });
});

describe("ImportStatementModal — review editing", () => {
  function addFoodCategory() {
    useAppStore.setState((state) => ({
      state: {
        ...state.state,
        categories: [
          ...state.state.categories,
          {
            id: "c-food",
            name: "Food",
            icon: "🍔",
            color: "#f59e0b",
            kind: "expense",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    }));
  }

  it("lets the user reclassify a transfer as an expense with a category", async () => {
    addFoodCategory();
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, transferCsv());

    const row = (await screen.findByText("TRANSFER TO JOHN DOE")).closest(
      "li",
    ) as HTMLElement;
    await expandRow(user, "TRANSFER TO JOHN DOE");
    await user.selectOptions(
      within(row).getByRole("combobox", { name: "Type for TRANSFER TO JOHN DOE" }),
      "expense",
    );
    const categorySelect = within(row).getByRole("combobox", {
      name: "Category for TRANSFER TO JOHN DOE",
    });
    await user.selectOptions(categorySelect, "c-food");

    expect(
      within(row).getByRole("combobox", { name: "Type for TRANSFER TO JOHN DOE" }),
    ).toHaveValue("expense");
    expect(within(row).getByText("Food")).toBeInTheDocument();
    expect(within(row).queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("resets a mismatched category when the type changes", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    const row = (await screen.findAllByTitle("RENT PAYMENT"))[0].closest("li") as HTMLElement;
    await expandRow(user, "RENT PAYMENT");
    await user.selectOptions(
      within(row).getByRole("combobox", { name: "Type for RENT PAYMENT" }),
      "income",
    );

    const categorySelect = within(row).getByRole("combobox", {
      name: "Category for RENT PAYMENT",
    });
    expect(categorySelect).toHaveValue("");
    expect(within(categorySelect).getByText("Salary")).toBeInTheDocument();
    expect(within(categorySelect).queryByText("Rent")).not.toBeInTheDocument();
  });

  it("lets the user change a suggested category", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    const mystery = await screen.findByText("MYSTERY CHARGE X7");
    const row = mystery.closest("li") as HTMLElement;
    await expandRow(user, "MYSTERY CHARGE X7");
    await user.selectOptions(
      within(row).getByRole("combobox", {
        name: /Category for MYSTERY CHARGE X7/i,
      }),
      categoryId("Utilities"),
    );
    expect(within(row).getByText("Utilities")).toBeInTheDocument();
  });
});

describe("ImportStatementModal — excluding transactions", () => {
  it("marks a row excluded while keeping it visible", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    const row = (await screen.findAllByTitle("RENT PAYMENT"))[0].closest("li") as HTMLElement;
    await expandRow(user, "RENT PAYMENT");
    await user.click(within(row).getByRole("button", { name: "Exclude RENT PAYMENT" }));

    expect(within(row).getByText("Excluded")).toBeInTheDocument();
    expect(screen.getAllByText("RENT PAYMENT").length).toBeGreaterThan(0);
    expect(summaryText()).toContain("1excluded");
    expect(summaryText()).toContain("0expenses");
    expect(
      screen.getByRole("button", { name: "Import 1 transaction" }),
    ).toBeDisabled();

    await user.click(within(row).getByRole("button", { name: "Include RENT PAYMENT" }));
    expect(within(row).queryByText("Excluded")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import 2 transactions" }),
    ).toBeDisabled();
  });
});

describe("ImportStatementModal — bulk actions", () => {
  async function selectRows(names: string[]) {
    for (const name of names) {
      await userEvent.click(screen.getByRole("checkbox", { name: `Select ${name}` }));
    }
    return screen.getByRole("group", { name: "Bulk actions" });
  }

  it("assigns a category to several selected rows at once", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByText("RENT PAYMENT");

    const bulk = await selectRows(["RENT PAYMENT", "MYSTERY CHARGE X7"]);
    expect(within(bulk).getByText("2 selected")).toBeInTheDocument();

    await user.selectOptions(
      within(bulk).getByRole("combobox", { name: "Assign category to selected" }),
      categoryId("Utilities"),
    );

    const rentRow = screen.getAllByTitle("RENT PAYMENT")[0].closest("li") as HTMLElement;
    expect(within(rentRow).getByText(/Utilities/)).toBeInTheDocument();
    const mysteryRow = screen.getAllByTitle("MYSTERY CHARGE X7")[0].closest("li") as HTMLElement;
    expect(within(mysteryRow).getByText(/Utilities/)).toBeInTheDocument();
  });

  it("excludes and re-includes several rows at once", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByText("RENT PAYMENT");

    const bulk = await selectRows(["RENT PAYMENT", "SALARY PAYMENT"]);
    await user.click(within(bulk).getByRole("button", { name: /Exclude/ }));

    expect(
      screen.getByRole("button", { name: "Nothing to import" }),
    ).toBeDisabled();
    expect(summaryText()).toContain("2excluded");

    await user.click(within(bulk).getByRole("button", { name: /Include/ }));
    expect(
      screen.getByRole("button", { name: "Import 2 transactions" }),
    ).toBeDisabled();
    expect(summaryText()).toContain("0excluded");
  });
});

describe("ImportStatementModal — select all master checkbox", () => {
  async function openPreview(file: File = statementCsv()) {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, file);
    await screen.findByRole("group", { name: "Statement summary" });
    return user;
  }

  it("shows Select all with nothing selected and selects every selectable row", async () => {
    const user = await openPreview();

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    const master = within(bulk).getByRole("checkbox", {
      name: "Select all transactions",
    });
    expect(master).not.toBeChecked();
    expect(within(bulk).getByText("Select all")).toBeInTheDocument();
    expect(within(bulk).queryByText(/\d+ selected/)).not.toBeInTheDocument();

    await user.click(master);

    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }),
    ).toBeChecked();
    expect(within(bulk).getByText("3 selected")).toBeInTheDocument();
    expect(
      within(bulk).getByRole("checkbox", { name: "Deselect all transactions" }),
    ).toBeChecked();
    expect(within(bulk).getByText("Deselect all")).toBeInTheDocument();
  });

  it("Deselect all clears the selection back to the Select all state", async () => {
    const user = await openPreview();

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    await user.click(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    );
    await user.click(
      within(bulk).getByRole("checkbox", { name: "Deselect all transactions" }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }),
    ).not.toBeChecked();
    expect(within(bulk).queryByText(/\d+ selected/)).not.toBeInTheDocument();
    expect(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    ).not.toBeChecked();
    expect(within(bulk).getByText("Select all")).toBeInTheDocument();
  });

  it("is indeterminate while some but not all rows are selected", async () => {
    const user = await openPreview();

    await user.click(screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }));

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    const master = within(bulk).getByRole("checkbox", {
      name: "Select all transactions",
    });
    expect(master).toBePartiallyChecked();
    expect(within(bulk).getByText("Select all")).toBeInTheDocument();

    // Selecting every remaining eligible row flips it to fully checked.
    await user.click(screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }));
    await user.click(screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }));
    expect(master).toBeChecked();
    expect(within(bulk).getByText("Deselect all")).toBeInTheDocument();

    // Unchecking one row returns it to the indeterminate state.
    await user.click(screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }));
    expect(master).toBePartiallyChecked();
    expect(within(bulk).getByText("Select all")).toBeInTheDocument();
  });

  it("never selects excluded rows or money movements", async () => {
    const user = await openPreview(richStatementCsv());

    const rentRow = screen.getAllByTitle("RENT PAYMENT")[0].closest("li") as HTMLElement;
    await expandRow(user, "RENT PAYMENT");
    await user.click(within(rentRow).getByRole("button", { name: "Exclude RENT PAYMENT" }));

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    await user.click(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select TRANSFER TO JOHN DOE" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }),
    ).toBeChecked();
    expect(within(bulk).getByText("2 selected")).toBeInTheDocument();
    expect(within(bulk).getByText("Deselect all")).toBeInTheDocument();
  });

  it("never selects rows that are already in the budget", async () => {
    useAppStore.setState((state) => ({
      state: {
        ...state.state,
        transactions: [
          ...state.state.transactions,
          {
            id: "seed-rent",
            categoryId: categoryId("Rent"),
            amount: 50_000_000,
            type: "expense",
            date: "2026-08-01",
            note: "RENT PAYMENT",
            createdAt: "2026-01-01T00:00:00.000Z",
            importSource: { source: "statement-import", bank: "opay" },
          },
        ],
      },
    }));
    const user = await openPreview();

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    await user.click(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }),
    ).toBeChecked();
    expect(within(bulk).getByText("2 selected")).toBeInTheDocument();
  });

  it("keeps individual row checkboxes fully functional", async () => {
    const user = await openPreview();

    await user.click(screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }));
    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    expect(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    ).toBePartiallyChecked();
    expect(within(bulk).getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }));
    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).not.toBeChecked();
    expect(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    ).not.toBeChecked();
    expect(within(bulk).queryByText(/\d+ selected/)).not.toBeInTheDocument();
  });

  it("Clear selection still clears every selected row", async () => {
    const user = await openPreview();

    const bulk = screen.getByRole("group", { name: "Bulk actions" });
    await user.click(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    );
    await user.click(within(bulk).getByRole("button", { name: "Clear selection" }));

    expect(
      screen.getByRole("checkbox", { name: "Select RENT PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select SALARY PAYMENT" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select MYSTERY CHARGE X7" }),
    ).not.toBeChecked();
    expect(within(bulk).queryByText(/\d+ selected/)).not.toBeInTheDocument();
    expect(
      within(bulk).getByRole("checkbox", { name: "Select all transactions" }),
    ).not.toBeChecked();
    expect(within(bulk).getByText("Select all")).toBeInTheDocument();
  });
});

describe("ImportStatementModal — review counter", () => {
  it("counts down as rows are reviewed", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());

    await screen.findByRole("group", { name: "Statement summary" });
    expect(summaryText()).toContain("2needs review");

    const transferRow = (await screen.findByText("TRANSFER TO JOHN DOE")).closest(
      "li",
    ) as HTMLElement;
    await expandRow(user, "TRANSFER TO JOHN DOE");
    await user.selectOptions(
      within(transferRow).getByRole("combobox", { name: "Type for TRANSFER TO JOHN DOE" }),
      "expense",
    );

    expect(summaryText()).toContain("1needs review");
  });
});

describe("ImportStatementModal — confirm & import", () => {
  it("stays blocked until every ledger row has a category", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);

    await screen.findByRole("group", { name: "Statement summary" });
    const importButton = screen.getByRole("button", { name: "Import 2 transactions" });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAttribute(
      "title",
      "Pick a category for 1 transaction before importing",
    );
  });

  it("imports the reviewed rows into the budget", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);

    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    expect(
      screen.getByText("3 transactions added to your budget"),
    ).toBeInTheDocument();
    const { transactions } = useAppStore.getState().state;
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toMatchObject({
      amount: 50_000_000,
      type: "expense",
      categoryId: categoryId("Rent"),
      date: "2026-08-01",
      note: "RENT PAYMENT",
    });
    expect(transactions[1]).toMatchObject({
      amount: 90_000_000,
      type: "income",
      categoryId: categoryId("Salary"),
    });
    expect(transactions[2]).toMatchObject({
      amount: 1_200_000,
      type: "expense",
      categoryId: categoryId("Utilities"),
      note: "MYSTERY CHARGE X7",
    });
    expect(transactions[0].importSource).toMatchObject({
      source: "statement-import",
      bank: "opay",
      reference: undefined,
    });
  });

  it("never imports money movements into the budget", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
    await assignMysteryCategory(user);

    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    expect(screen.getByText(/Skipped: 1 money movement/)).toBeInTheDocument();
    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    expect(notes).not.toContain("TRANSFER TO JOHN DOE");
    expect(notes).toContain("RENT PAYMENT");
    expect(notes).toContain("SALARY PAYMENT");
    expect(notes).toContain("MYSTERY CHARGE X7");
  });

  it("imports only the first of a duplicate group", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, duplicateCsv());
    await screen.findByText(/1 possible duplicate detected/i);

    const expandButtons = screen.getAllByRole("button", {
      name: "Show details for MYSTERY CHARGE X7",
    });
    expect(expandButtons).toHaveLength(2);
    for (const button of expandButtons) {
      await user.click(button);
    }
    const categorySelects = screen.getAllByRole("combobox", {
      name: /Category for MYSTERY CHARGE X7/i,
    });
    expect(categorySelects).toHaveLength(2);
    await user.selectOptions(categorySelects[0], categoryId("Utilities"));

    await resolveAllDuplicates(user, "Import anyway");

    await user.click(screen.getByRole("button", { name: "Import 1 transaction" }));

    expect(screen.getByText(/Skipped: 1 duplicate/)).toBeInTheDocument();
    expect(useAppStore.getState().state.transactions).toHaveLength(1);
  });

  it("honours excluded rows at import time", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    const rentRow = (await screen.findAllByTitle("RENT PAYMENT"))[0].closest("li") as HTMLElement;
    await expandRow(user, "RENT PAYMENT");
    await user.click(within(rentRow).getByRole("button", { name: "Exclude RENT PAYMENT" }));
    await assignMysteryCategory(user);

    await user.click(screen.getByRole("button", { name: "Import 2 transactions" }));

    expect(
      screen.getByText(/2 imported · 0 skipped as duplicates · 1 requiring review/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1 excluded/)).toBeInTheDocument();
    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    expect(notes).not.toContain("RENT PAYMENT");
    expect(notes).toContain("SALARY PAYMENT");
    expect(notes).toContain("MYSTERY CHARGE X7");
  });

  it("reports the full five-way result after importing", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
    await assignMysteryCategory(user);

    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    expect(
      screen.getByText(/3 imported · 0 skipped as duplicates · 1 requiring review/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Skipped: 1 money movement/),
    ).toBeInTheDocument();
  });

  it("detects a re-import of the same statement — nothing is double-booked", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));
    expect(useAppStore.getState().state.transactions).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Add another file" }));
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });
    await assignMysteryCategory(user);
    // Every row now matches something already in the ledger, so each is
    // flagged and the import is blocked until answered — nothing is
    // discarded behind the user's back.
    expect(
      screen.getByRole("button", { name: /^(?:Import \d+ transactions?|Nothing to import)$/ }),
    ).toBeDisabled();
    await resolveAllDuplicates(user, "Skip this one");
    await user.click(screen.getByRole("button", { name: "Nothing to import" }));

    expect(
      screen.getByText("Nothing new was imported"),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 imported/)).toBeInTheDocument();
    // The rows are now reported as explicitly skipped duplicates rather than
    // silently dropped as "already existing" — the point of FR-23.
    expect(screen.getByText(/skipped as duplicate/)).toBeInTheDocument();
    // What actually matters: the second import double-booked nothing.
    expect(useAppStore.getState().state.transactions).toHaveLength(3);
  });

  it("Done closes the modal and discards the session", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<ImportStatementModal open onClose={onClose} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().state.transactions).toHaveLength(3);
    unmount();

    render(<ImportStatementModal open onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Import Bank Statement" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop your statement here/i)).toBeInTheDocument();
  });
});

describe("ImportStatementModal — duplicate status against the ledger (5B)", () => {
  function seedLedger(entries: Array<{
    note: string;
    amount: number;
    date: string;
    type?: "expense" | "income";
    importSource?: {
      source: "statement-import";
      bank: "gtco" | "opay" | "owealth" | "other" | "unknown";
      reference?: string;
    };
  }>) {
    useAppStore.setState((state) => ({
      state: {
        ...state.state,
        transactions: [
          ...state.state.transactions,
          ...entries.map((entry, index) => ({
            id: `seed-${index}`,
            categoryId: categoryId("Rent"),
            amount: entry.amount,
            type: entry.type ?? "expense",
            date: entry.date,
            note: entry.note,
            createdAt: "2026-01-01T00:00:00.000Z",
            importSource: entry.importSource,
          })),
        ],
      },
    }));
  }

  it("shows Already imported status against the existing ledger and never a New chip", async () => {
    seedLedger([
      {
        note: "RENT PAYMENT",
        amount: 50_000_000,
        date: "2026-08-01",
        importSource: { source: "statement-import", bank: "opay" },
      },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });

    const rentRow = screen.getAllByTitle("RENT PAYMENT")[0].closest("li") as HTMLElement;
    expect(within(rentRow).getByText("Already imported")).toBeInTheDocument();
    expect(within(rentRow).queryByText("New")).not.toBeInTheDocument();

    const salaryRow = screen.getAllByTitle("SALARY PAYMENT")[0].closest("li") as HTMLElement;
    expect(within(salaryRow).queryByText("New")).not.toBeInTheDocument();

    const filters = screen.getByRole("group", { name: "Filter transactions" });
    expect(
      within(filters).getByRole("button", { name: "Already imported 1" }),
    ).toBeInTheDocument();
    expect(
      within(filters).getByRole("button", { name: "Possible duplicates 0" }),
    ).toBeInTheDocument();
  });

  it("flags possible duplicates and lets the user skip or keep them", async () => {
    seedLedger([
      { note: "RENT PAID CASH", amount: 50_000_000, date: "2026-08-01" },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });

    expect(
      screen.getByText(/1 transaction may already be in your budget/i),
    ).toBeInTheDocument();
    const rentRow = screen.getAllByTitle("RENT PAYMENT")[0].closest("li") as HTMLElement;
    // FR-23 owns this row now: a side-by-side comparison and three explicit
    // choices, in place of the older Skip/Keep toggle.
    expect(
      within(rentRow).getByText("Likely duplicate — decide"),
    ).toBeInTheDocument();
    expect(
      within(rentRow).getByText("Already in your budget"),
    ).toBeInTheDocument();
    await assignMysteryCategory(user);

    await user.click(
      within(rentRow).getByRole("button", { name: "Skip this one" }),
    );
    expect(
      within(rentRow).getByText("Duplicate resolved"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import 2 transactions" }));
    expect(
      screen.getByText(/2 imported · 1 skipped as duplicate · 1 requiring review/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1 possible duplicate/)).toBeInTheDocument();
    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    expect(notes).not.toContain("RENT PAYMENT");
    expect(notes).toContain("SALARY PAYMENT");
    expect(notes).toContain("MYSTERY CHARGE X7");
  });

  it("blocks the import until a flagged duplicate is answered", async () => {
    seedLedger([
      { note: "RENT PAID CASH", amount: 50_000_000, date: "2026-08-01" },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);

    // Pre-FR-23 this imported straight through, silently double-counting a
    // transaction the user had already entered by hand.
    // Only the resolvable rows are counted while one is still unanswered.
    const importButton = screen.getByRole("button", { name: /^(?:Import \d+ transactions?|Nothing to import)$/ });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAttribute(
      "title",
      expect.stringContaining("possible duplicate"),
    );

    await resolveAllDuplicates(user, "Import anyway");
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    expect(
      screen.getByText("3 transactions added to your budget"),
    ).toBeInTheDocument();
    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    expect(notes).toContain("RENT PAYMENT");
  });

  it("skip keeps the existing entry and imports nothing extra", async () => {
    seedLedger([
      { note: "RENT PAID CASH", amount: 50_000_000, date: "2026-08-01" },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);

    await resolveAllDuplicates(user, "Skip this one");
    await user.click(screen.getByRole("button", { name: /^(?:Import \d+ transactions?|Nothing to import)$/ }));

    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    // The hand-entered original survives; the statement copy did not land.
    expect(notes).toContain("RENT PAID CASH");
    expect(notes).not.toContain("RENT PAYMENT");
  });

  it("replace swaps the existing entry for the imported one", async () => {
    seedLedger([
      { note: "RENT PAID CASH", amount: 50_000_000, date: "2026-08-01" },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);

    await resolveAllDuplicates(user, "Replace existing");
    await user.click(screen.getByRole("button", { name: /^(?:Import \d+ transactions?|Nothing to import)$/ }));

    const notes = useAppStore
      .getState()
      .state.transactions.map((transaction) => transaction.note);
    expect(notes).toContain("RENT PAYMENT");
    // The less-detailed manual entry was removed, not left alongside it.
    expect(notes).not.toContain("RENT PAID CASH");
  });

  it("filters to Already imported and Possible duplicates", async () => {
    seedLedger([
      { note: "RENT PAYMENT", amount: 50_000_000, date: "2026-08-01" },
      { note: "MYSTERY CHARGE", amount: 1_200_000, date: "2026-08-04" },
    ]);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await user.click(
      within(filters).getByRole("button", { name: "Already imported 1" }),
    );
    expect(screen.getAllByTitle("RENT PAYMENT").length).toBeGreaterThan(0);
    expect(screen.queryAllByTitle("SALARY PAYMENT")).toHaveLength(0);
    expect(screen.queryAllByTitle("MYSTERY CHARGE X7")).toHaveLength(0);

    await user.click(
      within(filters).getByRole("button", { name: "Possible duplicates 1" }),
    );
    expect(screen.getAllByTitle("MYSTERY CHARGE X7").length).toBeGreaterThan(0);
    expect(screen.queryAllByTitle("RENT PAYMENT")).toHaveLength(0);
  });

  it("a full re-import needs no category reassignment — nothing is double-booked", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    await user.click(screen.getByRole("button", { name: "Add another file" }));
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });

    // Categories still carry over from the first import — the point of this
    // test — but each row now needs a duplicate decision before finishing.
    expect(
      screen.queryByText(/Pick a category for/),
    ).not.toBeInTheDocument();
    await resolveAllDuplicates(user, "Skip this one");

    const importButton = screen.getByRole("button", { name: "Nothing to import" });
    expect(importButton).toBeEnabled();
    await user.click(importButton);

    expect(screen.getByText("Nothing new was imported")).toBeInTheDocument();
    expect(useAppStore.getState().state.transactions).toHaveLength(3);
  });
});

describe("ImportStatementModal — preview only", () => {
  it("never writes anything to the budget", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });

    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Import 2 transactions" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Your edits stay in this session — nothing has been added to your budget yet/i),
    ).toBeInTheDocument();
  });

  it("cancel discards the parse without touching the store", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportStatementModal open onClose={onClose} />);
    await uploadStatement(user);
    await screen.findByRole("group", { name: "Statement summary" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ImportStatementModal — learning from corrections (Prompt 6A)", () => {
  function addFoodCategory() {
    useAppStore.setState((state) => ({
      state: {
        ...state.state,
        categories: [
          ...state.state.categories,
          {
            id: "c-food",
            name: "Food",
            icon: "🍔",
            color: "#f59e0b",
            kind: "expense",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    }));
  }

  function mtnCsv(description: string): File {
    const text = [
      "Value Date,Description,Debit,Credit,Balance",
      `09/08/2026,${description},2,000.00,,9,998,000.00`,
    ].join("\n");
    return new File([text], "mtn.csv", { type: "text/csv" });
  }

  async function correctRowToFood(
    user: ReturnType<typeof userEvent.setup>,
    description: RegExp,
  ) {
    const row = (await screen.findAllByTitle(description))[0].closest("li") as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: /Show details for/i }),
    );
    await user.selectOptions(
      within(row).getByRole("combobox", { name: /Category for/i }),
      categoryId("Food"),
    );
    return row;
  }

  it("learns a provider rule from repeated corrections and applies it to future statements", async () => {
    addFoodCategory();
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);

    // First MTN row: built-in rules suggest Utilities — the user corrects to
    // Food. Imported → one candidate correction.
    await uploadStatement(user, mtnCsv("Mobile Data | MTN | 3.2GB 2 Days Plan"));
    await correctRowToFood(user, /Mobile Data \| MTN/);
    await resolveAllDuplicates(user, "Import anyway");
    await user.click(screen.getByRole("button", { name: "Import 1 transaction" }));
    await screen.findByText(/1 transaction added to your budget/);
    await user.click(screen.getByRole("button", { name: "Add another file" }));

    // Second MTN row, same correction, imported → rule activates.
    await uploadStatement(user, mtnCsv("Airtime | MTN | 500MB"));
    await correctRowToFood(user, /Airtime \| MTN/);
    await resolveAllDuplicates(user, "Import anyway");
    await user.click(screen.getByRole("button", { name: "Import 1 transaction" }));
    await screen.findByText(/1 transaction added to your budget/);
    await user.click(screen.getByRole("button", { name: "Add another file" }));

    expect(useAppStore.getState().state.learnedRules).toHaveLength(1);
    expect(useAppStore.getState().state.learnedRules[0]).toMatchObject({
      kind: "provider",
      key: "mtn",
      strength: 2,
      enabled: true,
    });

    // Third MTN row: pre-classified by the learned rule — no correction
    // needed, and importing it doesn't touch the store.
    await uploadStatement(user, mtnCsv("Mobile Data | MTN | 1GB Plan"));
    const row = (await screen.findAllByTitle(/Mobile Data \| MTN/))[0].closest("li") as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: /Show details for/i }),
    );
    const categorySelect = within(row).getByRole("combobox", {
      name: /Category for/i,
    }) as HTMLSelectElement;
    expect(categorySelect.value).toBe(categoryId("Food"));
    await resolveAllDuplicates(user, "Import anyway");
    await user.click(screen.getByRole("button", { name: "Import 1 transaction" }));
    await screen.findByText(/1 transaction added to your budget/);
    expect(useAppStore.getState().state.learnedRules).toHaveLength(1);
  });

  it("never learns from a cancelled session or an excluded correction", async () => {
    addFoodCategory();
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);

    // Correct, then cancel: no correction survives.
    await uploadStatement(user, mtnCsv("Mobile Data | MTN | 3.2GB 2 Days Plan"));
    await correctRowToFood(user, /Mobile Data \| MTN/);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useAppStore.getState().state.learnedRules).toHaveLength(0);

    // Correct, then exclude: the row never enters the ledger → no learning.
    await uploadStatement(user, mtnCsv("Airtime | MTN | 500MB"));
    await correctRowToFood(user, /Airtime \| MTN/);
    const row = (await screen.findAllByText(/Airtime \| MTN/))[0].closest(
      "li",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /Exclude Airtime/ }));
    await user.click(screen.getByRole("button", { name: "Nothing to import" }));
    await screen.findByText("Nothing new was imported");
    expect(useAppStore.getState().state.learnedRules).toHaveLength(0);
  });
});

describe("ImportStatementModal — privacy & failure cleanup (Prompt 7B)", () => {
  it("a failed parse leaves no session state behind (parser failure cleanup)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ImportStatementModal open onClose={() => {}} />);
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
      new Error("corrupt pdf"),
    );
    await uploadStatement(
      user,
      new File(["corrupt"], "broken.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByText(/We couldn't read that file/i)).toBeInTheDocument();
    // Back on the upload stage: drop zone visible, no file name, no preview,
    // nothing stale in the session.
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("broken.pdf")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Statement summary" }),
    ).not.toBeInTheDocument();
    expect(useAppStore.getState().state.transactions).toHaveLength(0);

    // Closing and reopening starts clean too — nothing from the failed parse
    // survives the modal.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    unmount();
    render(<ImportStatementModal open onClose={() => {}} />);
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
  });

  it("a registered parser throwing mid-pipeline is a generic error (parser failure)", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    const pipeline = await import("@/lib/statementPipeline");
    vi.mocked(pipeline.processStatement).mockImplementationOnce(() => {
      throw new Error("parser exploded on row 9: TRANSFER REF ABC123");
    });
    await uploadStatement(user, statementCsv());

    // The pipeline crash is a generic user-facing error — no parser
    // internals, no statement contents.
    expect(
      await screen.findByText(/We couldn't read that file/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ABC123|exploded|row 9/i)).not.toBeInTheDocument();
    // Back on the upload stage with a clean session and an untouched budget.
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Statement summary" }),
    ).not.toBeInTheDocument();
    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    // Nothing leaked into the persisted database either.
    expect(persistedState().state.transactions).toHaveLength(0);
  });

  it("never logs statement contents, even when parsing fails", async () => {
    const spies = {
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
    };
    try {
      const user = userEvent.setup();
      render(<ImportStatementModal open onClose={() => {}} />);
      const statementOcr = await import("@/lib/statementOcr");
      vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
        new Error("PAN 0123456789 TRANSFER REF ABC123XYZ FAILED"),
      );
      await uploadStatement(
        user,
        new File(["corrupt"], "sensitive.pdf", { type: "application/pdf" }),
      );
      expect(
        await screen.findByText(/We couldn't read that file/i),
      ).toBeInTheDocument();

      const allCalls = [
        ...spies.error.mock.calls,
        ...spies.warn.mock.calls,
        ...spies.log.mock.calls,
      ]
        .flat()
        .map((arg) => String(arg));
      expect(allCalls.join(" ")).not.toMatch(/0123456789|ABC123XYZ|PAN/);
      // The generic user-facing message exposes no internals either.
      expect(screen.queryByText(/0123456789|ABC123XYZ|PAN/)).not.toBeInTheDocument();
    } finally {
      spies.error.mockRestore();
      spies.warn.mockRestore();
      spies.log.mockRestore();
    }
  });

  it("raw statement contents never enter app state during review", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
    // The account number is only ever shown masked in the UI…
    expect(screen.getByText("Account •••• 6789")).toBeInTheDocument();
    expect(screen.queryByText("0123456789")).not.toBeInTheDocument();
    // …and never lands in app state (the only persistence gate).
    expect(
      JSON.stringify(useAppStore.getState().state),
    ).not.toMatch(/0123456789/);
    expect(useAppStore.getState().state.transactions).toHaveLength(0);
  });
});

describe("ImportStatementModal — the database through the persistence seam (8A)", () => {
  it("canceling a review writes nothing to the persisted database", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const persisted = persistedState().state;
    expect(persisted.transactions).toHaveLength(0);
    // The raw payload holds no statement content whatsoever — not the
    // descriptions, not the account number, not the transfer narration.
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/RENT PAYMENT|SALARY PAYMENT|TRANSFER TO JOHN DOE/);
    expect(raw).not.toMatch(/0123456789/);
  });

  it("a confirmed import lands in the persisted database exactly once", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user);
    await assignMysteryCategory(user);
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));
    await screen.findByText("3 transactions added to your budget");

    const persisted = persistedState().state;
    expect(persisted.transactions).toHaveLength(3);

    // Imported expense: exact amount, date, note, category and provenance.
    const rent = persisted.transactions.find((tx) => tx.note === "RENT PAYMENT");
    expect(rent).toMatchObject({
      amount: 50_000_000,
      type: "expense",
      date: "2026-08-01",
      categoryId: categoryId("Rent"),
      importSource: {
        source: "statement-import",
        bank: "opay",
        originalDescription: "RENT PAYMENT",
        statementDate: "2026-08-01",
      },
    });
    // Imported income.
    const salary = persisted.transactions.find(
      (tx) => tx.note === "SALARY PAYMENT",
    );
    expect(salary).toMatchObject({
      amount: 90_000_000,
      type: "income",
      categoryId: categoryId("Salary"),
    });
    // No transfers, no money movements, no duplicates — exactly three rows.
    expect(
      persisted.transactions.every(
        (tx) => tx.type === "expense" || tx.type === "income",
      ),
    ).toBe(true);
    expect(persisted.transactions.map((tx) => tx.note).sort()).toEqual([
      "MYSTERY CHARGE X7",
      "RENT PAYMENT",
      "SALARY PAYMENT",
    ]);
  });
});

describe("ImportStatementModal — OCR fallback for scanned statements (8D)", () => {
  const scannedPdf = () => new File(["x"], "scan.pdf", { type: "application/pdf" });

  it("explains scanned statements when the built-in OCR can't start", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockResolvedValueOnce({
      cells: [],
      source: "pdf",
      ocr: { ocrUsed: false, ocrUnavailable: true, pages: [], failedPages: [], cells: [] },
    });
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, scannedPdf());

    expect(
      await screen.findByText(
        /This statement is scanned and doesn't contain selectable text/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/CSV or Excel export, use that instead/i)).toBeInTheDocument();
  });

  it("imports a scanned statement via OCR and shows the preview", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    const ocrCells = [
      ["Value Date", "Description", "Debit", "Credit", "Balance"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00", "", "1,500,000.00"],
      ["03/08/2026", "SALARY PAYMENT", "", "900,000.00", "2,400,000.00"],
    ];
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockResolvedValueOnce({
      cells: ocrCells,
      source: "pdf",
      ocr: { ocrUsed: true, ocrUnavailable: false, pages: [1], failedPages: [], cells: ocrCells },
    });
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, scannedPdf());

    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("RENT PAYMENT")).toBeInTheDocument();
    expect(screen.getByText("SALARY PAYMENT")).toBeInTheDocument();
  });

  it("switches the processing label while a scanned statement is scanned", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockImplementationOnce(
      (_file, options) =>
        new Promise((resolve) => {
          options?.onPhase?.("scanning");
          setTimeout(
            () =>
              resolve({
                cells: [],
                source: "pdf",
                ocr: {
                  ocrUsed: false,
                  ocrUnavailable: true,
                  pages: [],
                  failedPages: [],
                  cells: [],
                },
              }),
            60,
          );
        }),
    );
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, scannedPdf());

    expect(await screen.findByText(/Scanning pages…/i)).toBeInTheDocument();
    await screen.findByText(/This statement is scanned/i);
  });

  it("warns when some scanned pages couldn't be read", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    const ocrCells = [
      ["Value Date", "Description", "Debit", "Credit", "Balance"],
      ["01/08/2026", "RENT PAYMENT", "500,000.00", "", "1,500,000.00"],
    ];
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockResolvedValueOnce({
      cells: ocrCells,
      source: "pdf",
      ocr: {
        ocrUsed: true,
        ocrUnavailable: false,
        pages: [1, 2],
        failedPages: [3],
        cells: ocrCells,
      },
    });
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, scannedPdf());

    expect(
      await screen.findByText(/1 scanned page couldn't be read/i),
    ).toBeInTheDocument();
  });

  it("explains when OCR ran but could not read any page (OCR failure)", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    // The engine started (isAvailable true) but every page came back
    // unreadable — the modal must say the scanned pages couldn't be read
    // (NOT the "OCR unavailable" copy, NOT an empty-file message).
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockResolvedValueOnce({
      cells: [],
      source: "pdf",
      ocr: {
        ocrUsed: true,
        ocrUnavailable: false,
        pages: [],
        failedPages: [1, 2],
        cells: [],
      },
    });
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, scannedPdf());

    expect(
      await screen.findByText(/We couldn't read the scanned pages/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/doesn't contain selectable text/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/looks empty/i)).not.toBeInTheDocument();
    // Session is clean — the drop zone is back and nothing was persisted.
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
    expect(useAppStore.getState().state.transactions).toHaveLength(0);
  });

  it("closing mid-OCR cancels the import without side effects", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    let release!: (value: Awaited<ReturnType<typeof statementOcr.extractStatementRowsWithOcr>>) => void;
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={onClose} />);
    await uploadStatement(user, scannedPdf());
    expect(await screen.findByText(/Scanning your…|Parsing your statement…/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();

    // The OCR resolves AFTER the close — the session was cancelled, so
    // nothing is shown and nothing is persisted.
    release({
      cells: [
        ["Value Date", "Description", "Debit"],
        ["01/08/2026", "RENT PAYMENT", "500,000.00"],
      ],
      source: "pdf",
      ocr: { ocrUsed: true, ocrUnavailable: false, pages: [1], failedPages: [], cells: [] },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(
      screen.queryByRole("group", { name: "Statement summary" }),
    ).not.toBeInTheDocument();
    const persisted = persistedState().state;
    expect(persisted.transactions).toHaveLength(0);
  });
});

describe("ImportStatementModal — atomicity when the write fails (8H)", () => {
  it("a failed save leaves nothing persisted and returns to the upload stage", async () => {
    const original = useAppStore.getState().addTransactions;
    useAppStore.setState({
      addTransactions: () => {
        throw new Error("disk full");
      },
    });
    try {
      const user = userEvent.setup();
      render(<ImportStatementModal open onClose={() => {}} />);
      await uploadStatement(user, richStatementCsv());
      await assignMysteryCategory(user);
      await user.click(
        screen.getByRole("button", { name: "Import 3 transactions" }),
      );

      expect(
        await screen.findByRole("alert"),
      ).toHaveTextContent(
        "We couldn't save these transactions — nothing was changed. Please try again.",
      );
      expect(
        screen.getByText(/Drag & drop your statement here/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: "Statement summary" }),
      ).not.toBeInTheDocument();

      // The whole batch is one atomic write — a failure mid-way means no
      // partial statement ever reaches the ledger or the persisted database.
      const persisted = persistedState().state;
      expect(persisted.transactions).toHaveLength(0);
    } finally {
      useAppStore.setState({ addTransactions: original });
    }
  });
});

describe("ImportStatementModal — review & confirmation experience (8I)", () => {
  it("summarizes duplicates, uncategorized and low-confidence rows in the review header", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());

    await screen.findByRole("group", { name: "Statement summary" });
    expect(summaryText()).toContain("4transactions");
    expect(summaryText()).toContain("1expenses");
    expect(summaryText()).toContain("1income");
    expect(summaryText()).toContain("1transfers");
    expect(summaryText()).toContain("2needs review");
    expect(summaryText()).toContain("0duplicates");
    expect(summaryText()).toContain("1uncategorized");
    expect(summaryText()).toContain("2low confidence");
  });

  it("counts within-statement duplicate rows in the review header", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, duplicateCsv());

    await screen.findByText(/1 possible duplicate detected/i);
    expect(summaryText()).toContain("2duplicates");
  });

  it("never shows raw parser scores in the review header", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());

    await screen.findByText(/OPay statement/i);
    expect(screen.queryByText(/header vocabulary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score \d+/i)).not.toBeInTheDocument();
  });

  it("filters to uncategorized and low-confidence rows", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
    const filters = screen.getByRole("group", { name: "Filter transactions" });

    await user.click(
      within(filters).getByRole("button", { name: "Uncategorized 1" }),
    );
    expect(screen.getByText("MYSTERY CHARGE X7")).toBeInTheDocument();
    expect(screen.queryByText("RENT PAYMENT")).not.toBeInTheDocument();
    expect(screen.queryByText("SALARY PAYMENT")).not.toBeInTheDocument();

    await user.click(
      within(filters).getByRole("button", { name: "Low confidence 2" }),
    );
    expect(screen.getByText("TRANSFER TO JOHN DOE")).toBeInTheDocument();
    expect(screen.getByText("MYSTERY CHARGE X7")).toBeInTheDocument();
    expect(screen.queryByText("RENT PAYMENT")).not.toBeInTheDocument();
  });

  it("shows a concise confirmation summary before the final import action", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
    await assignMysteryCategory(user);

    expect(
      screen.getByText("You're about to import 3 transactions."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import 3 transactions" }),
    ).toBeEnabled();
  });

  it("explains when nothing new can be imported yet", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");

    expect(
      screen.getByText("Assign a category to the highlighted rows to import."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import 2 transactions" }),
    ).toBeDisabled();
  });

  it("reports imported, skipped-as-duplicates and requiring-review after import", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, richStatementCsv());
    await screen.findByText("RENT PAYMENT");
    await assignMysteryCategory(user);
    await user.click(screen.getByRole("button", { name: "Import 3 transactions" }));

    expect(
      screen.getByText("3 imported · 0 skipped as duplicates · 1 requiring review"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1 money movement/)).toBeInTheDocument();
  });

  it("counts skipped duplicates separately when only one of a group is imported", async () => {
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, duplicateCsv());
    await screen.findByText(/1 possible duplicate detected/i);
    for (const button of screen.getAllByRole("button", {
      name: "Show details for MYSTERY CHARGE X7",
    })) {
      await user.click(button);
    }
    const categorySelects = screen.getAllByRole("combobox", {
      name: /Category for MYSTERY CHARGE X7/i,
    });
    await user.selectOptions(categorySelects[0], categoryId("Utilities"));
    await resolveAllDuplicates(user, "Import anyway");
    await user.click(screen.getByRole("button", { name: "Import 1 transaction" }));

    expect(
      screen.getByText("1 imported · 1 skipped as duplicate · 1 requiring review"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1 duplicate/)).toBeInTheDocument();
  });
});

describe("ImportStatementModal — password-protected PDFs", () => {
  const lockedPdf = () => new File(["x"], "locked.pdf", { type: "application/pdf" });
  const ocrCells = [
    ["Value Date", "Description", "Debit", "Credit", "Balance"],
    ["01/08/2026", "RENT PAYMENT", "500,000.00", "", "1,500,000.00"],
  ];
  const unlocked = {
    cells: ocrCells,
    source: "pdf" as const,
    ocr: { ocrUsed: false, ocrUnavailable: false, pages: [], failedPages: [], cells: [] },
  };

  it("asks for the password when the imported PDF is protected", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
      new PdfPasswordError("needs-password"),
    );
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, lockedPdf());

    expect(
      await screen.findByText("Password-protected statement"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This PDF is protected with a password. Enter the PDF password to continue.",
      ),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("PDF password");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByText("locked.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unlock & continue" }),
    ).toBeDisabled();
  });

  it("unlocks with the correct password and opens the preview", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr)
      .mockRejectedValueOnce(new PdfPasswordError("needs-password"))
      .mockResolvedValueOnce(unlocked);
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, lockedPdf());
    await screen.findByText("Password-protected statement");

    await user.type(screen.getByLabelText("PDF password"), "s3cret");
    await user.click(screen.getByRole("button", { name: "Unlock & continue" }));

    expect(
      await screen.findByRole("group", { name: "Statement summary" }),
    ).toBeInTheDocument();
    expect(screen.getByText("RENT PAYMENT")).toBeInTheDocument();
    expect(vi.mocked(statementOcr.extractStatementRowsWithOcr)).toHaveBeenLastCalledWith(
      expect.any(File),
      expect.objectContaining({ password: "s3cret" }),
    );
  });

  it("stays on the password stage with a retry message for a wrong password", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr)
      .mockRejectedValueOnce(new PdfPasswordError("needs-password"))
      .mockRejectedValueOnce(new PdfPasswordError("incorrect-password"));
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, lockedPdf());
    await screen.findByText("Password-protected statement");

    await user.type(screen.getByLabelText("PDF password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Unlock & continue" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("That password is incorrect — try again.");
    expect(
      screen.getByText("Password-protected statement"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("PDF password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unlock & continue" }),
    ).toBeEnabled();
  });

  it("sends unsupported encryption back to upload with a specific message", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
      new PdfPasswordError("unsupported-encryption"),
    );
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, lockedPdf());

    expect(
      await screen.findByText(
        /This PDF uses an encryption method that isn't supported/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag & drop your statement here/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Password-protected statement"),
    ).not.toBeInTheDocument();
  });

  it("closes the modal from the password stage without persisting the password", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr).mockRejectedValueOnce(
      new PdfPasswordError("needs-password"),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={onClose} />);
    await uploadStatement(user, lockedPdf());
    await screen.findByText("Password-protected statement");

    await user.type(screen.getByLabelText("PDF password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("hunter2")).toBeNull();
  });

  it("never persists or logs the password", async () => {
    const statementOcr = await import("@/lib/statementOcr");
    vi.mocked(statementOcr.extractStatementRowsWithOcr)
      .mockRejectedValueOnce(new PdfPasswordError("needs-password"))
      .mockResolvedValueOnce(unlocked);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    render(<ImportStatementModal open onClose={() => {}} />);
    await uploadStatement(user, lockedPdf());
    await screen.findByText("Password-protected statement");

    await user.type(screen.getByLabelText("PDF password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Unlock & continue" }));
    await screen.findByRole("group", { name: "Statement summary" });

    const everything = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...setItemSpy.mock.calls,
    ]
      .flat()
      .map((value) => JSON.stringify(value))
      .join(" ");
    expect(everything).not.toContain("hunter2");

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
