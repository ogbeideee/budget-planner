import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, IncomePlan, Transaction } from "@/lib/types";
import { BudgetSuggestions } from "./BudgetSuggestions";

afterEach(cleanup);

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} onClick={() => pushMock(href)} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  const fresh = createInitialState();
  useAppStore.setState({
    state: { ...fresh, settings: { ...fresh.settings, currency: "NGN" } },
  });
  pushMock.mockClear();
});

function seedSuggestions() {
  const state = useAppStore.getState().state;
  const rent = state.categories.find((c) => c.name === "Rent")!;
  const groceries = state.categories.find((c) => c.name === "Groceries")!;
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: "2026-08",
    name: "Salary",
    icon: "💰",
    expectedAmount: 10600000,
    receivedAmount: 10600000,
  };
  const budgets: Budget[] = [
    {
      id: "b-rent",
      categoryId: rent.id,
      month: "2026-08",
      limit: 4000000,
      priority: "high",
    },
    {
      id: "b-groceries",
      categoryId: groceries.id,
      month: "2026-08",
      limit: 5000000,
      priority: "medium",
    },
  ];
  const transactions: Transaction[] = [
    {
      id: "t1",
      categoryId: rent.id,
      amount: 4870000,
      type: "expense",
      date: "2026-08-05",
      note: undefined,
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "t2",
      categoryId: groceries.id,
      amount: 5200000,
      type: "expense",
      date: "2026-08-06",
      note: undefined,
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ];
  useAppStore.setState({
    state: { ...useAppStore.getState().state, incomePlans: [incomePlan], budgets, transactions },
  });
}

describe("BudgetSuggestions recommendations panel", () => {
  it("renders nothing when no budget is over its limit", () => {
    render(<BudgetSuggestions month="2026-08" onAdjust={vi.fn()} />);
    expect(
      screen.queryByText("A few budgets are over their limits"),
    ).not.toBeInTheDocument();
  });

  it("shows the warm panel header and one row per over-budget budget", () => {
    seedSuggestions();
    render(<BudgetSuggestions month="2026-08" onAdjust={vi.fn()} />);

    expect(
      screen.getByText("A few budgets are over their limits"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("writes 'reduce spending' for budgets not covered by remaining income and 'increase limit' for covered ones", () => {
    seedSuggestions();
    render(<BudgetSuggestions month="2026-08" onAdjust={vi.fn()} />);

    // Rent overspent by ₦8,700.00 against ₦60,000.00 remaining income — not covered.
    expect(
      screen.getByText(
        /reduce spending by ₦8,700\.00 to stay within limit/,
      ),
    ).toBeInTheDocument();
    // Groceries overspent by ₦2,000.00 — covered by remaining income.
    expect(
      screen.getByText(/increase limit by ₦2,000\.00 or reduce spending/),
    ).toBeInTheDocument();
  });

  it("shows a colored category indicator before each recommendation", () => {
    seedSuggestions();
    render(<BudgetSuggestions month="2026-08" onAdjust={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(
        button.querySelector('[aria-hidden="true"].h-6.w-6'),
      ).toBeTruthy();
    }
  });

  it("opens the adjust flow when a recommendation row is clicked", async () => {
    const user = userEvent.setup();
    seedSuggestions();
    const onAdjust = vi.fn();
    render(<BudgetSuggestions month="2026-08" onAdjust={onAdjust} />);

    await user.click(
      screen.getByRole("button", { name: /Rent → reduce spending/ }),
    );
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b-rent" }),
    );
  });

  it("links 'View recommendations' to the reports page", () => {
    seedSuggestions();
    render(<BudgetSuggestions month="2026-08" onAdjust={vi.fn()} />);

    const link = screen.getByRole("link", { name: /View recommendations/ });
    expect(link).toHaveAttribute("href", "/reports");
  });
});
