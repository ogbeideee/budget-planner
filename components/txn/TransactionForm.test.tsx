import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultDateForMonth, monthKeyFromIso, monthOffset, todayIso } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { createInitialState } from "@/lib/seed";
import { totals } from "@/lib/selectors";
import { useAppStore } from "@/store/useAppStore";
import { TransactionForm } from "./TransactionForm";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function expenseCategoryId(): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.kind === "expense")!.id;
}

function transactionCategoryName(categoryId: string): string {
  const category = useAppStore
    .getState()
    .state.categories.find((category) => category.id === categoryId);
  return category ? `${category.icon} ${category.name}` : "";
}

describe("TransactionForm (AC-04, AC-05)", () => {
  it("adds an expense and updates totals immediately", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(1250);
    expect(state.transactions[0].type).toBe("expense");
    // The form defaults the date to today — assert against the CURRENT
    // month, not a hard-coded one, or this breaks at every month boundary.
    expect(
      totals(state.transactions, monthKeyFromIso(todayIso())).expenses,
    ).toBe(1250);
  });

  it("edits a transaction and updates totals (AC-05)", async () => {
    const user = userEvent.setup();
    const categoryId = expenseCategoryId();
    useAppStore.getState().addTransaction({
      categoryId,
      amount: 500,
      type: "expense",
      date: "2026-08-10",
    });
    const transaction = useAppStore.getState().state.transactions[0];

    render(
      <TransactionForm open onClose={() => {}} transaction={transaction} />,
    );
    const amount = screen.getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "30.00");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(3000);
    expect(totals(state.transactions, "2026-08").expenses).toBe(3000);
  });

  it("rejects an invalid amount without adding anything", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.type(screen.getByLabelText("Amount"), "abc");
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount");
  });

  it("shows no false category selection while the form state is empty", () => {
    render(<TransactionForm open onClose={() => {}} />);
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe("");
    const shown = select.selectedOptions[0]?.textContent ?? null;
    expect(shown).toBe("Select…");
    expect(shown).not.toMatch(/Transport/);
  });

  it("satisfies validation once a real category is chosen", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(useAppStore.getState().state.transactions).toHaveLength(1);
  });

  it("seeds the category into both the select and the form when editing", () => {
    const categoryId = expenseCategoryId();
    useAppStore.getState().addTransaction({
      categoryId,
      amount: 500,
      type: "expense",
      date: "2026-08-10",
    });
    const transaction = useAppStore.getState().state.transactions[0];

    render(
      <TransactionForm open onClose={() => {}} transaction={transaction} />,
    );
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe(categoryId);
    expect(select.selectedOptions[0]?.value).toBe(categoryId);
    const preview = select.selectedOptions[0]?.textContent ?? "";
    expect(preview).toContain(transactionCategoryName(categoryId));
  });

  it("defaults the date inside the passed planner month", () => {
    const past = monthOffset(monthKeyFromIso(todayIso()), -2);
    render(<TransactionForm open onClose={() => {}} defaultMonth={past} />);
    const dateInput = screen.getByLabelText("Date") as HTMLInputElement;
    expect(monthKeyFromIso(dateInput.value)).toBe(past);
    expect(dateInput.value).toBe(defaultDateForMonth(past));
  });

  it("records a backdated transaction in its calendar month, not the current one", async () => {
    const user = userEvent.setup();
    const past = monthOffset(monthKeyFromIso(todayIso()), -1);
    render(<TransactionForm open onClose={() => {}} defaultMonth={past} />);
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "100000.00");
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(monthKeyFromIso(state.transactions[0].date)).toBe(past);
    const finance = monthFinance(
      state.transactions,
      state.incomePlans,
      past,
    );
    expect(finance.expenses).toBe(10000000);
    expect(finance.net).toBe(-10000000);
  });

  it("records a transfer as a deferred expense (timeline Transfers)", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "40.00");
    await user.click(screen.getByRole("button", { name: "Add Transfer" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].type).toBe("expense");
    expect(state.transactions[0].deferred).toBe(true);
  });

  it("offers expense categories on the Transfer tab", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.textContent).toContain("Transport");
    expect(
      useAppStore
        .getState()
        .state.categories.some(
          (category) =>
            category.kind === "expense" && category.name === "Transport",
        ),
    ).toBe(true);
  });

  it("opens the Transfer tab when editing a deferred expense", () => {
    useAppStore.getState().addTransaction({
      categoryId: expenseCategoryId(),
      amount: 500,
      type: "expense",
      date: "2026-08-10",
      deferred: true,
    });
    const transaction = useAppStore.getState().state.transactions[0];

    render(
      <TransactionForm open onClose={() => {}} transaction={transaction} />,
    );
    expect(
      screen.getByRole("button", { name: "Transfer" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the deferred flag when an edited transfer is saved as an expense", async () => {
    const user = userEvent.setup();
    useAppStore.getState().addTransaction({
      categoryId: expenseCategoryId(),
      amount: 500,
      type: "expense",
      date: "2026-08-10",
      deferred: true,
    });
    const transaction = useAppStore.getState().state.transactions[0];

    render(
      <TransactionForm open onClose={() => {}} transaction={transaction} />,
    );
    await user.click(screen.getByRole("button", { name: "Expense" }));
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const { state } = useAppStore.getState();
    expect(state.transactions[0].deferred).toBeUndefined();
  });

  it("adds an income record from the Income tab", async () => {
    const user = userEvent.setup();
    const incomeCategory = useAppStore
      .getState()
      .state.categories.find((category) => category.kind === "income")!;
    render(<TransactionForm open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Income" }));
    await user.selectOptions(
      screen.getByLabelText("Category"),
      incomeCategory.id,
    );
    await user.type(screen.getByLabelText("Amount"), "1500.00");
    await user.click(screen.getByRole("button", { name: "Add Income" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].type).toBe("income");
    expect(state.transactions[0].categoryId).toBe(incomeCategory.id);
    expect(state.transactions[0].deferred).toBeUndefined();
  });

  it("titles the modal Add Expense for a new expense", () => {
    render(<TransactionForm open onClose={() => {}} />);
    expect(
      screen.getByRole("heading", { name: "Add Expense" }),
    ).toBeInTheDocument();
  });

  it("closes the modal via the close icon", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TransactionForm open onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the currency prefix on the Amount field", () => {
    render(<TransactionForm open onClose={() => {}} />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("shows the note character counter while typing", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    expect(screen.getByText("0/200")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("Add a note..."),
      "Groceries",
    );
    expect(screen.getByText("9/200")).toBeInTheDocument();
  });
});
