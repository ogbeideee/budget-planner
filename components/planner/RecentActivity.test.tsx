import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { monthKeyFromIso, monthOffset, todayIso } from "@/lib/date";
import { monthFinance } from "@/lib/finance";
import { createInitialState } from "@/lib/seed";
import { spendingByCategory } from "@/lib/selectors";
import { useAppStore } from "@/store/useAppStore";
import { RecentActivity } from "./RecentActivity";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: { pathname: string } | string;
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedTransactions() {
  const { state } = useAppStore.getState();
  const incomeCategory = state.categories.find((c) => c.kind === "income")!;
  const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
  const now = new Date().toISOString();
  const month = monthKeyFromIso(todayIso());
  useAppStore.setState({
    state: {
      ...state,
      transactions: [
        {
          id: "txn-income",
          categoryId: incomeCategory.id,
          amount: 10000000,
          type: "income" as const,
          date: `${month}-02`,
          note: "Backdated salary",
          createdAt: now,
        },
        {
          id: "txn-rent",
          categoryId: expenseCategory.id,
          amount: 2000000,
          type: "expense" as const,
          date: `${month}-03`,
          note: "Rent",
          createdAt: now,
        },
        {
          id: "txn-groceries",
          categoryId: expenseCategory.id,
          amount: 500000,
          type: "expense" as const,
          date: `${month}-04`,
          note: "Groceries",
          createdAt: now,
        },
      ],
    },
  });
}

describe("RecentActivity", () => {
  it("deletes an expense after confirmation and recalculates totals", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const rows = screen.getAllByRole("listitem");
    const rentRow = rows.find((row) =>
      within(row).queryByText("Rent"),
    )!;
    await user.click(
      within(rentRow).getByRole("button", { name: "Delete transaction" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Delete this transaction? This cannot be undone."),
    ).toBeTruthy();
    await user.click(
      within(dialog).getByRole("button", { name: "Delete transaction" }),
    );

    const { state } = useAppStore.getState();
    expect(state.transactions.map((t) => t.id)).toEqual([
      "txn-income",
      "txn-groceries",
    ]);

    const finance = monthFinance(state.transactions, state.incomePlans, month);
    expect(finance.expenses).toBe(500000);
    expect(finance.received).toBe(10000000);
    expect(finance.net).toBe(9500000);
    expect(finance.savingsRate).toBe(95);
  });

  it("leaves unrelated transactions untouched when one expense is deleted", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const row = screen.getByText("Groceries").closest("li")!;
    await user.click(
      within(row).getByRole("button", { name: "Delete transaction" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete transaction",
      }),
    );

    const remaining = useAppStore.getState().state.transactions;
    expect(remaining).toHaveLength(2);
    const income = remaining.find((t) => t.id === "txn-income")!;
    const rent = remaining.find((t) => t.id === "txn-rent")!;
    expect(income.amount).toBe(10000000);
    expect(rent.amount).toBe(2000000);
  });

  it("opens the edit form when the row itself is clicked", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    await user.click(screen.getByText("Rent"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit transaction")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("20000");
    expect(within(dialog).getByLabelText("Date")).toHaveValue(`${month}-03`);
    expect(within(dialog).getByLabelText("Note (optional)")).toHaveValue(
      "Rent",
    );
  });

  it("opens the edit form when an income row is clicked", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    await user.click(screen.getByText("Backdated salary"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit transaction")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("100000");
    expect(within(dialog).getByLabelText("Date")).toHaveValue(`${month}-02`);
  });

  it("cancelling the dialog keeps the transaction", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const row = screen.getByText("Rent").closest("li")!;
    await user.click(
      within(row).getByRole("button", { name: "Delete transaction" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(useAppStore.getState().state.transactions).toHaveLength(3);
  });
});

describe("RecentActivity · expense management", () => {
  const TRANSPORT = {
    id: "cat-transport",
    name: "Transport",
    icon: "🚌",
    color: "#0ea5e9",
    kind: "expense" as const,
    createdAt: "2026-08-01T00:00:00.000Z",
  };

  function expenseCategoryId(): string {
    return useAppStore
      .getState()
      .state.categories.find((c) => c.kind === "expense")!.id;
  }

  function seedWithTransport() {
    seedTransactions();
    const { state } = useAppStore.getState();
    useAppStore.setState({
      state: { ...state, categories: [...state.categories, TRANSPORT] },
    });
  }

  async function openEdit(user: ReturnType<typeof userEvent.setup>, title: string) {
    const row = screen.getByText(title).closest("li")!;
    await user.click(
      within(row).getByRole("button", { name: "Edit transaction" }),
    );
    return screen.getByRole("dialog");
  }

  it("opens the existing expense pre-populated in the shared form", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("20000");
    expect(within(dialog).getByLabelText("Date")).toHaveValue(`${month}-03`);
    expect(within(dialog).getByLabelText("Note (optional)")).toHaveValue(
      "Rent",
    );
    const category = within(dialog).getByLabelText("Category") as HTMLSelectElement;
    expect(category.value).toBe(expenseCategoryId());
    expect(category.selectedOptions[0]?.textContent).toContain(
      useAppStore.getState().state.categories.find(
        (c) => c.id === expenseCategoryId(),
      )!.name,
    );
  });

  it("edits the amount in place: one record, recalculated totals", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    const amount = within(dialog).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "50000.00");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(3);
    const rent = state.transactions.find((t) => t.id === "txn-rent")!;
    expect(rent.amount).toBe(5000000);

    const finance = monthFinance(state.transactions, state.incomePlans, month);
    expect(finance.expenses).toBe(5500000);
    expect(finance.net).toBe(4500000);
    expect(finance.savingsRate).toBe(45);
    expect(rent.note).toBe("Rent");
    expect(rent.categoryId).toBe(expenseCategoryId());
    expect(rent.date).toBe(`${month}-03`);
  });

  it("moves the spending from the old category to the new category", async () => {
    const user = userEvent.setup();
    seedWithTransport();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    await user.selectOptions(
      within(dialog).getByLabelText("Category"),
      TRANSPORT.id,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const { state } = useAppStore.getState();
    expect(
      state.transactions.find((t) => t.id === "txn-rent")!.categoryId,
    ).toBe(TRANSPORT.id);
    const spend = spendingByCategory(state.transactions, month);
    expect(spend.find((s) => s.categoryId === expenseCategoryId())?.amount).toBe(
      500000,
    );
    expect(spend.find((s) => s.categoryId === TRANSPORT.id)?.amount).toBe(
      2000000,
    );
  });

  it("moves the expense to its new calendar month on date change", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    const nextMonth = monthOffset(month, 1);
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    const date = within(dialog).getByLabelText("Date");
    await user.clear(date);
    await user.type(date, `${nextMonth}-05`);
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const { state } = useAppStore.getState();
    const rent = state.transactions.find((t) => t.id === "txn-rent")!;
    expect(rent.date).toBe(`${nextMonth}-05`);
    expect(screen.queryByText("Rent")).toBeNull();
    const thisMonth = monthFinance(state.transactions, state.incomePlans, month);
    expect(thisMonth.expenses).toBe(500000);
    const movedMonth = monthFinance(
      state.transactions,
      state.incomePlans,
      nextMonth,
    );
    expect(movedMonth.expenses).toBe(2000000);
  });

  it("edits the note only, keeping everything else intact", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    const note = within(dialog).getByLabelText("Note (optional)");
    await user.clear(note);
    await user.type(note, "Lease renewed");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const rent = useAppStore
      .getState()
      .state.transactions.find((t) => t.id === "txn-rent")!;
    expect(rent.note).toBe("Lease renewed");
    expect(rent.amount).toBe(2000000);
    expect(rent.date).toBe(`${month}-03`);
  });

  it("cancelling an edit leaves the transaction unchanged", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    const dialog = await openEdit(user, "Rent");
    const amount = within(dialog).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "1.00");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    const rent = useAppStore
      .getState()
      .state.transactions.find((t) => t.id === "txn-rent")!;
    expect(rent.amount).toBe(2000000);
    expect(rent.note).toBe("Rent");
  });

  it("edits multiple expenses independently without cross-talk", async () => {
    const user = userEvent.setup();
    seedTransactions();
    const month = monthKeyFromIso(todayIso());
    render(<RecentActivity month={month} />);

    let dialog = await openEdit(user, "Rent");
    const rentAmount = within(dialog).getByLabelText("Amount");
    await user.clear(rentAmount);
    await user.type(rentAmount, "15000.00");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    dialog = await openEdit(user, "Groceries");
    const groceriesAmount = within(dialog).getByLabelText("Amount");
    await user.clear(groceriesAmount);
    await user.type(groceriesAmount, "750.00");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(3);
    const rent = state.transactions.find((t) => t.id === "txn-rent")!;
    const groceries = state.transactions.find((t) => t.id === "txn-groceries")!;
    const income = state.transactions.find((t) => t.id === "txn-income")!;
    expect(rent.amount).toBe(1500000);
    expect(rent.note).toBe("Rent");
    expect(groceries.amount).toBe(75000);
    expect(groceries.note).toBe("Groceries");
    expect(income.amount).toBe(10000000);
    expect(income.date).toBe(`${month}-02`);
  });
});