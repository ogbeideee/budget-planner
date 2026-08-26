import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, FutureExpense, IncomePlan, Transaction } from "@/lib/types";
import { BudgetStatusBand } from "./BudgetStatusBand";
import { REVIEW_BUDGETS_HREF } from "./reviewBudgets";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

const MONTH = "2026-08";

function category(name: string) {
  return useAppStore
    .getState()
    .state.categories.find((entry) => entry.name === name)!;
}

/** Give every expense category a budget so nothing shows as unfunded. */
function fundEverything(limit = 500000) {
  const state = useAppStore.getState().state;
  const budgets: Budget[] = state.categories
    .filter((entry) => entry.kind === "expense")
    .map((entry) => ({
      id: `b-${entry.id}`,
      categoryId: entry.id,
      month: MONTH,
      limit,
      priority: "medium",
    }));
  useAppStore.setState({ state: { ...state, budgets } });
}

function setTransactions(transactions: Transaction[]) {
  const state = useAppStore.getState().state;
  useAppStore.setState({ state: { ...state, transactions } });
}

function expense(name: string, amount: number, id: string): Transaction {
  return {
    id,
    type: "expense",
    categoryId: category(name).id,
    amount,
    date: `${MONTH}-05`,
    createdAt: new Date().toISOString(),
  };
}

function setIncome(expected: number, received: number) {
  const state = useAppStore.getState().state;
  const plan: IncomePlan = {
    id: "plan-1",
    month: MONTH,
    name: "Salary",
    icon: "💰",
    expectedAmount: expected,
    receivedAmount: received,
  };
  useAppStore.setState({ state: { ...state, incomePlans: [plan] } });
}

function flagTexts(): string[] {
  return screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
}

describe("BudgetStatusBand", () => {
  it("renders one card with the score ring, the flags and the review button", () => {
    fundEverything();
    setIncome(1000000, 1000000);
    const { container } = render(<BudgetStatusBand month={MONTH} />);

    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(screen.getByRole("img", { name: /Budget health score/ })).toBeInTheDocument();
    expect(screen.getByText("Budget health")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review budgets/ }),
    ).toHaveAttribute("href", REVIEW_BUDGETS_HREF);
  });

  it("does not render at all when no categories are configured", () => {
    const state = useAppStore.getState().state;
    useAppStore.setState({ state: { ...state, categories: [], budgets: [] } });
    const { container } = render(<BudgetStatusBand month={MONTH} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the numeric score and a red 'At risk' pill below 60", () => {
    fundEverything(10000);
    // Two heavy overages plus an income shortfall drive the score under 60.
    setTransactions([
      expense("Rent", 100000, "t1"),
      expense("Groceries", 100000, "t2"),
    ]);
    render(<BudgetStatusBand month={MONTH} />);

    const pill = screen.getByText("At risk");
    expect(pill.className).toContain("text-danger");
    const ring = screen.getByRole("img", { name: /Budget health score/ });
    expect(Number(ring.textContent)).toBeLessThan(60);
  });

  it("shows a teal 'Good' pill at 60 and above", () => {
    fundEverything();
    setIncome(1000000, 1000000);
    render(<BudgetStatusBand month={MONTH} />);

    const pill = screen.getByText("Good");
    expect(pill.className).toContain("text-brand-500");
    const ring = screen.getByRole("img", { name: /Budget health score/ });
    expect(Number(ring.textContent)).toBeGreaterThanOrEqual(60);
  });

  it("explains the score behind an info tooltip", () => {
    fundEverything();
    render(<BudgetStatusBand month={MONTH} />);

    expect(
      screen.getByRole("button", { name: "How is budget health calculated?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Reflects how many budgets are within limit, funded, and covered by income",
    );
  });

  it("lists every over-limit category with its overage amount", () => {
    fundEverything(10000);
    setTransactions([
      expense("Rent", 25000, "t1"),
      expense("Groceries", 13000, "t2"),
    ]);
    render(<BudgetStatusBand month={MONTH} />);

    const flag = flagTexts().find((text) => text.includes("over their limit"))!;
    expect(flag).toContain("2 budgets over their limit");
    expect(flag).toContain("Rent +$150.00");
    expect(flag).toContain("Groceries +$30.00");
  });

  it("omits the over-limit flag entirely when nothing is over", () => {
    fundEverything();
    setIncome(1000000, 1000000);
    render(<BudgetStatusBand month={MONTH} />);

    expect(
      flagTexts().some((text) => text.includes("over their limit")),
    ).toBe(false);
  });

  it("reports the combined funded flag when funding and income are both fine", () => {
    fundEverything();
    setIncome(1000000, 1000000);
    render(<BudgetStatusBand month={MONTH} />);

    expect(flagTexts()).toContain(
      "Every category funded · Income covers expenses",
    );
  });

  it("replaces the funded flag with a count when categories need funding", () => {
    setTransactions([]);
    render(<BudgetStatusBand month={MONTH} />);

    const flags = flagTexts();
    expect(flags.some((text) => text.includes("need funding"))).toBe(true);
    expect(flags.some((text) => text.includes("Every category funded"))).toBe(
      false,
    );
  });

  it("falls back to a single on-track flag when there is nothing to report", () => {
    const state = useAppStore.getState().state;
    // Income categories only: nothing to fund, nothing over limit.
    useAppStore.setState({
      state: {
        ...state,
        categories: state.categories.filter(
          (entry) => entry.kind === "income",
        ),
        budgets: [],
        futureExpenses: [] as FutureExpense[],
      },
    });
    render(<BudgetStatusBand month={MONTH} />);

    expect(flagTexts()).toEqual(["All budgets on track this month."]);
  });

  it("scrolls to Budget Allocation when Review budgets is clicked", () => {
    fundEverything();
    const section = document.createElement("section");
    section.id = "budget-allocation";
    const scrollIntoView = vi.fn();
    section.scrollIntoView = scrollIntoView;
    document.body.appendChild(section);

    render(<BudgetStatusBand month={MONTH} />);
    screen.getByRole("link", { name: /Review budgets/ }).click();

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    section.remove();
  });
});
