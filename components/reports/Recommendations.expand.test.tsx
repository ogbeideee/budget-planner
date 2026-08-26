import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { currentMonthKey } from "@/lib/date";
import { Recommendations } from "./Recommendations";
import type { Budget, IncomePlan, Transaction } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

const MONTH = currentMonthKey();

function categoryId(name: string): string {
  return useAppStore
    .getState()
    .state.categories.find((c) => c.name === name)!.id;
}

/** Over-budget categories as [name, limit, spent]. */
function seedOverBudget(rows: Array<[string, number, number]>) {
  const state = useAppStore.getState().state;
  const budgets: Budget[] = rows.map(([name, limit], i) => ({
    id: `b-${i}`,
    categoryId: categoryId(name),
    month: MONTH,
    limit,
    priority: "medium",
  }));
  const transactions: Transaction[] = rows.map(([name, , spent], i) => ({
    id: `t-${i}`,
    type: "expense",
    categoryId: categoryId(name),
    amount: spent,
    date: `${MONTH}-05`,
    createdAt: new Date().toISOString(),
  }));
  const plan: IncomePlan = {
    id: "p1",
    month: MONTH,
    name: "Salary",
    icon: "💰",
    expectedAmount: 1000000,
    receivedAmount: 1000000,
  };
  useAppStore.setState({
    state: { ...state, budgets, transactions, incomePlans: [plan] },
  });
}

function view() {
  const s = useAppStore.getState().state;
  return render(
    <Recommendations
      month={MONTH}
      budgets={s.budgets}
      rollovers={s.rollovers}
      categories={s.categories}
      transactions={s.transactions}
      futureExpenses={s.futureExpenses}
      incomePlans={s.incomePlans}
      currency={s.settings.currency}
    />,
  );
}

/** The card whose disclosure button is expanded, by its title text. */
function expandedTitle(): string | null {
  const open = screen
    .queryAllByRole("button", { expanded: true })
    .filter((b) => b.getAttribute("aria-expanded") === "true");
  return open[0]?.textContent?.trim() ?? null;
}

describe("the default-open card tracks live data (regression)", () => {
  /** Renders with props read fresh from the store, as ReportsView does. */
  function Live() {
    const s = useAppStore((state) => state.state);
    return (
      <Recommendations
        month={MONTH}
        budgets={s.budgets}
        rollovers={s.rollovers}
        categories={s.categories}
        transactions={s.transactions}
        futureExpenses={s.futureExpenses}
        incomePlans={s.incomePlans}
        currency={s.settings.currency}
      />
    );
  }

  it("re-derives when the data changes after first render", async () => {
    // Mount with one over-budget category...
    seedOverBudget([["Groceries", 100000, 145000]]);
    render(<Live />);
    const first = expandedTitle();
    expect(first).toContain("Groceries");

    // ...then a far worse one appears while mounted.
    await act(async () => {
      seedOverBudget([
        ["Groceries", 100000, 145000],
        ["Rent", 100000, 400000],
      ]);
    });

    // A lazy useState initializer would still have Groceries open here.
    expect(expandedTitle()).toContain("Rent");
  });

  it("keeps the user's choice once they pick a card", async () => {
    const user = userEvent.setup();
    seedOverBudget([
      ["Groceries", 100000, 145000],
      ["Rent", 100000, 180000],
    ]);
    render(<Live />);

    const groceries = screen
      .getAllByRole("button", { expanded: false })
      .find((b) => (b.textContent ?? "").includes("Groceries"));
    await user.click(groceries!);
    expect(expandedTitle()).toContain("Groceries");

    await act(async () => {
      seedOverBudget([
        ["Groceries", 100000, 145000],
        ["Rent", 100000, 900000],
      ]);
    });

    // Their choice stands even though Rent is now far more urgent.
    expect(expandedTitle()).toContain("Groceries");
  });

  it("treats collapsing everything as a real choice, not as untouched", async () => {
    const user = userEvent.setup();
    seedOverBudget([["Groceries", 100000, 145000]]);
    render(<Live />);

    const open = screen.getAllByRole("button", { expanded: true })[0];
    await user.click(open);
    expect(expandedTitle()).toBeNull();

    await act(async () => {
      seedOverBudget([
        ["Groceries", 100000, 145000],
        ["Rent", 100000, 400000],
      ]);
    });

    // Still collapsed: `null` is an override, not "never touched".
    expect(expandedTitle()).toBeNull();
  });
});

describe("Recommendations default expansion", () => {
  it("opens the largest overage, not whichever budget came first", () => {
    // Groceries is listed first but is the SMALLER overage; Rent is worse.
    seedOverBudget([
      ["Groceries", 100000, 145000], // +450
      ["Rent", 100000, 180000], // +800
    ]);
    view();

    expect(expandedTitle()).toContain("Rent");
    expect(expandedTitle()).not.toContain("Groceries");
  });

  it("still opens the largest overage when list order already favours it", () => {
    seedOverBudget([
      ["Rent", 100000, 180000], // +800, first in the list
      ["Groceries", 100000, 145000],
    ]);
    view();

    expect(expandedTitle()).toContain("Rent");
  });

  it("applies the rule even when data arrives after the first render", () => {
    // Regression: a lazy useState initializer runs ONCE, so if the store
    // hydrates after mount the default never applied and every card stayed
    // collapsed. The open card is derived from the current items instead.
    const empty = useAppStore.getState().state;
    const { rerender } = render(
      <Recommendations
        month={MONTH}
        budgets={[]}
        rollovers={[]}
        categories={empty.categories}
        transactions={[]}
        futureExpenses={[]}
        incomePlans={[]}
        currency={empty.settings.currency}
      />,
    );

    seedOverBudget([
      ["Groceries", 100000, 145000],
      ["Rent", 100000, 180000],
    ]);
    const seeded = useAppStore.getState().state;
    rerender(
      <Recommendations
        month={MONTH}
        budgets={seeded.budgets}
        rollovers={seeded.rollovers}
        categories={seeded.categories}
        transactions={seeded.transactions}
        futureExpenses={seeded.futureExpenses}
        incomePlans={seeded.incomePlans}
        currency={seeded.settings.currency}
      />,
    );

    expect(expandedTitle()).toContain("Rent");
  });

  it("opens nothing when no recommendation is a warning", () => {
    // Everything within limits: the remaining cards are info/success only.
    seedOverBudget([["Rent", 100000, 40000]]);
    view();

    const open = screen
      .queryAllByRole("button")
      .filter((b) => b.getAttribute("aria-expanded") === "true");
    expect(open).toHaveLength(0);
  });
});
