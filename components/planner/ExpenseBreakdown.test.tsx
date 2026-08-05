import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import type { Budget, Transaction } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function categoryId(name: string): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.name === name)!.id;
}

function seedTransactions(entries: Array<[categoryName: string, amount: number]>) {
  const state = useAppStore.getState().state;
  const now = new Date().toISOString();
  const transactions: Transaction[] = entries.map(([name, amount]) => ({
    id: crypto.randomUUID(),
    type: "expense",
    categoryId: categoryId(name),
    amount,
    date: "2026-08-15",
    createdAt: now,
  }));
  useAppStore.setState({ state: { ...state, transactions } });
}

function seedBudget(categoryName: string, limit: number) {
  const state = useAppStore.getState().state;
  const budget: Budget = {
    id: crypto.randomUUID(),
    categoryId: categoryId(categoryName),
    month: "2026-08",
    limit,
    priority: "medium",
  };
  useAppStore.setState({
    state: { ...state, budgets: [...state.budgets, budget] },
  });
}

function row(label: string): HTMLElement {
  return screen.getAllByText(label)[0].closest("div")!;
}

describe("ExpenseBreakdown bar presentation", () => {
  it("sits the amount and percentage beside each bar in a right-aligned column", () => {
    seedTransactions([
      ["Rent", 50000],
      ["Groceries", 30000],
    ]);
    render(<ExpenseBreakdown month="2026-08" />);

    const rent = row("Rent");
    expect(within(rent).getAllByText("$500.00").length).toBeGreaterThan(0);
    expect(within(rent).getAllByText("63%").length).toBeGreaterThan(0);
    const groceries = row("Groceries");
    expect(within(groceries).getAllByText("$300.00").length).toBeGreaterThan(0);
    expect(within(groceries).getAllByText("38%").length).toBeGreaterThan(0);
  });

  it("caps the longest bar at 80% while preserving proportions", () => {
    seedTransactions([
      ["Rent", 100000],
      ["Groceries", 50000],
    ]);
    render(<ExpenseBreakdown month="2026-08" />);

    const fill = (r: HTMLElement) =>
      r.querySelector<HTMLDivElement>("div[class*='h-full']");

    expect(fill(row("Rent"))?.style.width).toBe("80%");
    expect(fill(row("Groceries"))?.style.width).toBe("40%");
  });
});

describe("ExpenseBreakdown budget tooltips", () => {
  it("shows category, amount, percentage, budget limit and spent on hover", async () => {
    seedTransactions([
      ["Rent", 50000],
      ["Groceries", 30000],
    ]);
    seedBudget("Rent", 40000);
    render(<ExpenseBreakdown month="2026-08" />);

    await userEvent.hover(screen.getAllByText("Rent")[0]);

    const rent = row("Rent");
    expect(within(rent).getByText("Amount")).toBeInTheDocument();
    expect(within(rent).getByText("Percentage")).toBeInTheDocument();
    expect(within(rent).getByText("Budget limit")).toBeInTheDocument();
    expect(within(rent).getByText("Spent")).toBeInTheDocument();
    expect(within(rent).getByText("$400.00")).toBeInTheDocument();
    expect(within(rent).getByText("$500.00 of $400.00")).toHaveClass(
      "text-danger",
    );
  });

  it("says Not budgeted for categories without a budget limit", async () => {
    seedTransactions([
      ["Rent", 50000],
      ["Groceries", 30000],
    ]);
    render(<ExpenseBreakdown month="2026-08" />);

    await userEvent.hover(screen.getAllByText("Groceries")[0]);

    expect(
      within(row("Groceries")).getByText("Not budgeted"),
    ).toBeInTheDocument();
  });
});

describe("ExpenseBreakdown collapse after five", () => {
  const seven = () =>
    seedTransactions([
      ["Rent", 70000],
      ["Groceries", 60000],
      ["Transport", 50000],
      ["Utilities", 40000],
      ["Entertainment", 30000],
      ["Salary", 20000],
      ["Business", 10000],
    ]);

  it("shows five categories and a Show-more button instead of plain text", () => {
    seven();
    render(<ExpenseBreakdown month="2026-08" />);

    expect(screen.getAllByText("Rent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Entertainment").length).toBeGreaterThan(0);
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    expect(screen.queryByText("Business")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show 2 more categories" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("2 more categories when expanded"),
    ).not.toBeInTheDocument();
  });

  it("reveals the remaining categories on click with an animated entrance", async () => {
    seven();
    const user = userEvent.setup();
    render(<ExpenseBreakdown month="2026-08" />);

    const stable = row("Rent");
    expect(stable.className).not.toContain("list-in");

    await user.click(screen.getByRole("button", { name: "Show 2 more categories" }));

    expect(screen.getAllByText("Salary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Business").length).toBeGreaterThan(0);
    expect(row("Business").className).toContain("list-in");
    expect(
      screen.queryByRole("button", { name: /Show \d+ more categor/ }),
    ).not.toBeInTheDocument();
  });

  it("renders no button when five or fewer categories exist", () => {
    seedTransactions([
      ["Rent", 40000],
      ["Groceries", 30000],
    ]);
    render(<ExpenseBreakdown month="2026-08" />);

    expect(
      screen.queryByRole("button", { name: /Show \d+ more categor/ }),
    ).not.toBeInTheDocument();
  });
});

describe("ExpenseBreakdown preview (limit + onExpand)", () => {
  it("calls onExpand when Show-more is clicked", async () => {
    seedTransactions([
      ["Rent", 70000],
      ["Groceries", 60000],
      ["Transport", 50000],
      ["Utilities", 40000],
      ["Entertainment", 30000],
      ["Salary", 20000],
      ["Business", 10000],
    ]);
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseBreakdown month="2026-08" bare limit={5} onExpand={onExpand} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Show 2 more categories" }),
    );

    expect(onExpand).toHaveBeenCalledOnce();
  });
});

describe("ExpenseBreakdown empty state", () => {
  it("shows the empty illustration when nothing was recorded", () => {
    render(<ExpenseBreakdown month="2026-08" />);
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
  });
});