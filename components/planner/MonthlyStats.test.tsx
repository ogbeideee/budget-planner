import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { MonthlyStats } from "./MonthlyStats";
import type { IncomePlan } from "@/lib/types";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function seedStats() {
  const state = useAppStore.getState().state;
  const rent = state.categories.find((c) => c.name === "Rent")!;
  const groceries = state.categories.find((c) => c.name === "Groceries")!;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: 100000,
    receivedAmount: 100000,
  };
  const now = new Date().toISOString();
  useAppStore.setState({
    state: {
      ...state,
      incomePlans: [incomePlan],
      transactions: [
        {
          id: "t1",
          type: "expense",
          categoryId: rent.id,
          amount: 50000,
          date: "2026-08-02",
          note: "August rent",
          createdAt: now,
        },
        {
          id: "t2",
          type: "expense",
          categoryId: groceries.id,
          amount: 20000,
          date: "2026-08-05",
          createdAt: now,
        },
      ],
      futureExpenses: [
        {
          id: "f1",
          categoryId: rent.id,
          amount: 10000,
          title: "Internet",
          dueDate: "2026-08-20",
          recurring: false,
          priority: "medium",
          status: "upcoming",
          createdAt: now,
        },
      ],
    },
  });
}

function column(label: string): HTMLElement {
  return screen.getByText(label).closest("div")!;
}

describe("MonthlyStats month at a glance", () => {
  it("shows the card title and subtitle", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    expect(screen.getByText("Month at a glance")).toBeInTheDocument();
    expect(
      screen.getByText("Income, expenses and what's left this month."),
    ).toBeInTheDocument();
  });

  it("shows income received with the expected caption", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const income = column("Income");
    expect(within(income).getByText("$1,000.00")).toBeInTheDocument();
    expect(
      within(income).getByText("received of $1,000.00 expected"),
    ).toBeInTheDocument();
  });

  it("shows expenses with the transaction count", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const expenses = column("Expenses");
    expect(within(expenses).getByText("$700.00")).toBeInTheDocument();
    expect(
      within(expenses).getByText("2 transactions this month"),
    ).toBeInTheDocument();
  });

  it("shows remaining as income left after expenses", () => {
    seedStats();
    render(<MonthlyStats month="2026-08" />);

    const remaining = column("Remaining");
    expect(within(remaining).getByText("$300.00")).toBeInTheDocument();
    expect(
      within(remaining).getByText("income left after expenses"),
    ).toBeInTheDocument();
  });

  it("warns when expenses exceed income", () => {
    seedStats();
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === "t2" ? { ...t, amount: 90000 } : t,
        ),
      },
    });
    render(<MonthlyStats month="2026-08" />);

    const remaining = column("Remaining");
    expect(within(remaining).getByText("$0.00")).toBeInTheDocument();
    expect(
      within(remaining).getByText("over income by $400.00"),
    ).toBeInTheDocument();
    expect(remaining.querySelector(".text-warn")).toBeTruthy();
  });
});
