import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { SummaryCards } from "./SummaryCards";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("SummaryCards expected income", () => {
  it("shows Set expected income when the month has no income plan", () => {
    render(<SummaryCards month="2026-08" />);
    const incomeButton = screen.getByRole("button", {
      name: /Set expected income/,
    });
    expect(incomeButton).toBeInTheDocument();
    expect(within(incomeButton).getByText("$0.00")).toBeInTheDocument();
  });

  it("opens the Expected income modal from the income card", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);
    await user.click(
      screen.getByRole("button", { name: /Set expected income/ }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Expected income"),
    ).toBeInTheDocument();
  });

  it("saving updates the store, the card, and the other summary values", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(
      screen.getByRole("button", { name: /Set expected income/ }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /Add income source/ }),
    );
    await user.type(within(dialog).getByLabelText("Income name"), "Salary");
    await user.type(
      within(dialog).getByLabelText("Expected amount for Salary"),
      "2500",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const { state } = useAppStore.getState();
    expect(state.incomePlans[0]).toMatchObject({
      month: "2026-08",
      name: "Salary",
      icon: "💰",
      expectedAmount: 250000,
      receivedAmount: 0,
    });

    await waitFor(() => {
      const incomeButton = screen.getByRole("button", {
        name: "Expected income",
      });
      expect(within(incomeButton).getByText("$2,500.00")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Savings rate" }));
    const netDialog = screen.getByRole("dialog");
    expect(within(netDialog).getByText("Expected income")).toBeInTheDocument();
    expect(within(netDialog).getByText("$2,500.00")).toBeInTheDocument();
    expect(within(netDialog).getAllByText("+$0.00")).toHaveLength(2);
  });

  it("pre-fills the modal with the saved amount when reopened", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(
      screen.getByRole("button", { name: /Set expected income/ }),
    );
    let dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /Add income source/ }),
    );
    await user.type(within(dialog).getByLabelText("Income name"), "Salary");
    await user.type(
      within(dialog).getByLabelText("Expected amount for Salary"),
      "2500",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await user.click(
      screen.getByRole("button", { name: "Expected income" }),
    );
    dialog = screen.getByRole("dialog");
    expect(
      (
        within(dialog).getByLabelText("Expected amount for Salary") as HTMLInputElement
      ).value,
    ).toBe("2500");
  });

  it("computes Remaining and Net from received income, not expected", async () => {
    const state = createInitialState();
    const expenseCategory = state.categories.find(
      (c) => c.kind === "expense",
    )!;
    state.incomePlans = [
      {
        id: "plan-1",
        month: "2026-08",
        name: "Salary",
        icon: "💰",
        expectedAmount: 350000,
        receivedAmount: 250000,
      },
    ];
    state.transactions = [
      {
        id: "txn-1",
        categoryId: expenseCategory.id,
        amount: 175000,
        type: "expense",
        date: "2026-08-05",
        note: undefined,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    useAppStore.setState({ state });

    render(<SummaryCards month="2026-08" />);

    const remaining = screen.getByRole("button", {
      name: "Remaining allocation",
    });
    expect(within(remaining).getByText("$750.00")).toBeInTheDocument();

    const net = screen.getByRole("button", { name: "Savings rate" });
    expect(within(net).getByText(/\$750\.00 remaining/)).toBeInTheDocument();

    await userEvent.setup().click(net);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("+$2,500.00")).toBeInTheDocument();
    expect(within(dialog).getByText("$3,500.00")).toBeInTheDocument();
    expect(within(dialog).getByText("-$1,750.00")).toBeInTheDocument();
    expect(within(dialog).getByText("+$750.00")).toBeInTheDocument();
  });
});

describe("SummaryCards allocate-remaining entry point", () => {
  function seedBudgets() {
    const state = useAppStore.getState().state;
    const id = (name: string) =>
      state.categories.find((category) => category.name === name)!.id;
    useAppStore.setState({
      state: {
        ...state,
        incomePlans: [
          {
            id: "plan-1",
            month: "2026-08",
            name: "Salary",
            icon: "💰",
            expectedAmount: 1000000,
            receivedAmount: 1000000,
          },
        ],
        budgets: [
          {
            id: "budget-rent",
            categoryId: id("Rent"),
            month: "2026-08",
            limit: 100000,
            priority: "high",
          },
          {
            id: "budget-groceries",
            categoryId: id("Groceries"),
            month: "2026-08",
            limit: 80000,
            priority: "medium",
          },
        ],
        transactions: [
          {
            id: "t1",
            type: "expense",
            categoryId: id("Rent"),
            amount: 150000,
            date: "2026-08-05",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
  }

  it("mounts no allocation sliders until a category is chosen", async () => {
    const user = userEvent.setup();
    seedBudgets();
    render(<SummaryCards month="2026-08" />);

    expect(screen.queryAllByRole("slider")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Remaining/ }));
    const picker = screen.getByRole("dialog");
    expect(within(picker).getByText("Allocate remaining")).toBeInTheDocument();
    expect(within(picker).queryAllByRole("slider")).toHaveLength(0);
    expect(within(picker).getByText("$500.00 over")).toBeInTheDocument();
  });

  it("opens the shared drawer for the category picked there", async () => {
    const user = userEvent.setup();
    seedBudgets();
    render(<SummaryCards month="2026-08" />);

    await user.click(screen.getByRole("button", { name: /Remaining/ }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Rent/ }),
    );

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Add funds to Rent")).toBeInTheDocument();
    expect(
      within(drawer).getByText(/Rent is \$500\.00 over its \$1,000\.00 limit/),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("slider", { name: "Move from Groceries" }),
    ).toBeInTheDocument();
  });
});
