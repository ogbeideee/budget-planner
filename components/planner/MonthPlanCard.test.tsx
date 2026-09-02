import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type {
  Category,
  FutureExpense,
  IncomePlan,
  RolloverRecord,
} from "@/lib/types";
import { MonthPlanCard } from "./MonthPlanCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

/** Far enough ahead that it stays a future month regardless of run date. */
const MONTH = "2099-09";

const RENT: Category = {
  id: "cat-rent",
  name: "Rent",
  icon: "🏠",
  color: "#f97316",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const FOOD: Category = {
  id: "cat-food",
  name: "Groceries",
  icon: "🛒",
  color: "#22c55e",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function budget(categoryId: string, limit: number): { id: string; categoryId: string; month: string; limit: number; priority: "medium" } {
  return {
    id: `b-${categoryId}`,
    categoryId,
    month: MONTH,
    limit,
    priority: "medium",
  };
}

function plannedExpense(
  id: string,
  categoryId: string,
  amount: number,
  dueDate: string,
  status: "upcoming" | "paid" = "upcoming",
): FutureExpense {
  return {
    id,
    categoryId,
    amount,
    title: "Bill",
    dueDate,
    recurring: false,
    priority: "medium",
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function incomePlan(expectedAmount: number): IncomePlan {
  return {
    id: "plan-salary",
    month: MONTH,
    name: "Salary",
    icon: "💰",
    expectedAmount,
    receivedAmount: 0,
  };
}

function seed(state: {
  incomePlans?: IncomePlan[];
  budgets?: ReturnType<typeof budget>[];
  futureExpenses?: FutureExpense[];
  rollovers?: RolloverRecord[];
}) {
  useAppStore.setState({
    state: {
      ...createInitialState(),
      categories: [RENT, FOOD],
      incomePlans: state.incomePlans ?? [],
      budgets: state.budgets ?? [],
      futureExpenses: state.futureExpenses ?? [],
      rollovers: state.rollovers ?? [],
    },
  });
}

describe("MonthPlanCard (FR-27)", () => {
  it("shows an adequately funded plan with the commitments breakdown", () => {
    seed({
      incomePlans: [incomePlan(500000)], // $5,000.00
      budgets: [budget("cat-rent", 200000), budget("cat-food", 100000)],
    });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText("Planning September 2099")).toBeInTheDocument();
    expect(screen.getByText("Adequately funded")).toBeInTheDocument();
    expect(screen.getByText(/Total planned commitments: \$3,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$3,000\.00 budgeted \+ \$0\.00 still needs funding/)).toBeInTheDocument();
    expect(screen.getByText(/spare after every commitment/)).toBeInTheDocument();
  });

  it("shows an underfunded plan with the shortfall and its funding gaps", () => {
    seed({
      incomePlans: [incomePlan(250000)], // $2,500.00
      budgets: [budget("cat-rent", 200000)],
      futureExpenses: [plannedExpense("e1", "cat-food", 100000, `${MONTH}-10`)],
    });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText("Underfunded")).toBeInTheDocument();
    expect(screen.getByText(/falls \$500\.00 short of planned commitments/)).toBeInTheDocument();
    // The unbudgeted Groceries obligation is a real gap; the budgeted Rent
    // category is not.
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Unbudgeted")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
  });

  it("does not double count an obligation its budget already covers", () => {
    seed({
      incomePlans: [incomePlan(300000)],
      budgets: [budget("cat-rent", 100000)],
      futureExpenses: [plannedExpense("e1", "cat-rent", 100000, `${MONTH}-05`)],
    });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText("Adequately funded")).toBeInTheDocument();
    expect(screen.getByText(/Total planned commitments: \$1,000\.00/)).toBeInTheDocument();
    expect(screen.queryByText("Still needs funding")).not.toBeInTheDocument();
  });

  it("asks for income before judging the month, and opens the shared income modal", async () => {
    const user = userEvent.setup();
    seed({ budgets: [budget("cat-rent", 50000)] });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText("No income planned")).toBeInTheDocument();
    expect(
      screen.getByText(/No income planned for this month yet/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit income" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("ignores paid and other-month expenses in the planned total", () => {
    seed({
      incomePlans: [incomePlan(500000)],
      budgets: [budget("cat-rent", 200000)],
      futureExpenses: [
        plannedExpense("e1", "cat-food", 10000, `${MONTH}-10`, "paid"),
        plannedExpense("e2", "cat-food", 20000, "2099-10-01"),
      ],
    });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText("Adequately funded")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled yet")).toBeInTheDocument();
    expect(screen.getByText(/Total planned commitments: \$2,000\.00/)).toBeInTheDocument();
  });

  it("budgets at BASE limits even if a rollover record exists for the month", () => {
    // FR-27 decision (user-approved): future months use base limits only.
    // The transition never writes records for a future month; this proves a
    // stray record cannot boost the plan either, because monthPlan never
    // reads rollovers at all.
    seed({
      incomePlans: [incomePlan(500000)],
      budgets: [budget("cat-rent", 200000)],
      rollovers: [
        {
          id: "ro-1",
          categoryId: "cat-rent",
          month: MONTH,
          fromMonth: "2099-08",
          amount: 50000,
          leftover: 50000,
          cap: 1,
          computedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    render(<MonthPlanCard month={MONTH} />);

    expect(screen.getByText(/Total planned commitments: \$2,000\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/Total planned commitments: \$2,500\.00/)).not.toBeInTheDocument();
  });
});
