import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { monthOffset } from "@/lib/date";
import { validateAppState } from "@/lib/validate";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, Category, Transaction } from "@/lib/types";
import { BudgetStatusBand } from "./BudgetStatusBand";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

/** The band renders for this month; the streak counts the months before it. */
const MONTH = "2026-06";
const LIMIT = 100000;

const GROCERIES: Category = {
  id: "c1",
  name: "Groceries",
  icon: "🛒",
  color: "#f97316",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function budget(month: string): Budget {
  return { id: `b-${month}`, categoryId: "c1", month, limit: LIMIT, priority: "medium" };
}

function spend(month: string, amount: number): Transaction {
  return {
    id: `t-${month}`,
    categoryId: "c1",
    amount,
    type: "expense",
    date: `${month}-10`,
    createdAt: "2026-01-10T00:00:00.000Z",
  };
}

/** Seeds `count` consecutive on-track months ending just before MONTH. */
function seedStreak(count: number) {
  const budgets: Budget[] = [];
  const transactions: Transaction[] = [];
  for (let i = 1; i <= count; i += 1) {
    const month = monthOffset(MONTH, -i);
    budgets.push(budget(month));
    transactions.push(spend(month, 40000));
  }
  useAppStore.setState({
    state: {
      ...createInitialState(),
      categories: [GROCERIES],
      budgets,
      transactions,
      badges: [],
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({
    state: { ...createInitialState(), categories: [GROCERIES] },
  });
});

describe("the streak flag in the Budget status band", () => {
  it("shows the count inside the existing band, not as a new card", () => {
    seedStreak(3);
    const { container } = render(<BudgetStatusBand month={MONTH} />);

    expect(screen.getByText("3-month streak")).toBeInTheDocument();
    // One band, one card — nothing new added to the dashboard.
    expect(container.querySelectorAll("section").length).toBe(1);
  });

  it("says nothing at all when there is no streak", () => {
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        budgets: [budget(monthOffset(MONTH, -1))],
        transactions: [spend(monthOffset(MONTH, -1), LIMIT * 3)],
      },
    }));
    render(<BudgetStatusBand month={MONTH} />);

    // An empty "0-month streak" would be clutter.
    expect(screen.queryByText(/month streak/)).toBeNull();
  });

  it("reads in the singular at one month", () => {
    seedStreak(1);
    render(<BudgetStatusBand month={MONTH} />);
    expect(screen.getByText("1-month streak")).toBeInTheDocument();
  });

  it("does not count the month in progress", () => {
    // Two finished months, plus a spotless current month.
    seedStreak(2);
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        budgets: [...s.state.budgets, budget(MONTH)],
      },
    }));
    render(<BudgetStatusBand month={MONTH} />);
    expect(screen.getByText("2-month streak")).toBeInTheDocument();
  });
});

describe("the badges drawer", () => {
  it("opens from the streak flag", async () => {
    const user = userEvent.setup();
    seedStreak(3);
    render(<BudgetStatusBand month={MONTH} />);

    await user.click(screen.getByRole("button", { name: /view badges/ }));
    expect(screen.getByRole("dialog", { name: "Streak & badges" })).toBeInTheDocument();
  });

  it("shows earned and locked badges together, never hiding the locked ones", async () => {
    const user = userEvent.setup();
    seedStreak(3);
    render(<BudgetStatusBand month={MONTH} />);
    await user.click(screen.getByRole("button", { name: /view badges/ }));

    const dialog = screen.getByRole("dialog");
    // Earned at a 3-month streak.
    expect(within(dialog).getByText("First month")).toBeInTheDocument();
    expect(within(dialog).getByText("Three in a row")).toBeInTheDocument();
    // Still to come — visible, not hidden.
    expect(within(dialog).getByText("Half a year")).toBeInTheDocument();
    expect(within(dialog).getByText("Full year")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Locked")).toHaveLength(2);
    expect(within(dialog).getAllByText("Earned")).toHaveLength(2);
  });

  it("says what a locked badge still needs, with progress", async () => {
    const user = userEvent.setup();
    seedStreak(3);
    render(<BudgetStatusBand month={MONTH} />);
    await user.click(screen.getByRole("button", { name: /view badges/ }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Stay within budget for 6 months in a row · 3 of 6/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Half a year progress" }),
    ).toHaveAttribute("aria-valuenow", "3");
  });

  it("states plainly that badges unlock nothing", async () => {
    const user = userEvent.setup();
    seedStreak(3);
    render(<BudgetStatusBand month={MONTH} />);
    await user.click(screen.getByRole("button", { name: /view badges/ }));

    expect(
      within(screen.getByRole("dialog")).getByText(/don’t\s+unlock anything/),
    ).toBeInTheDocument();
  });
});

describe("badge persistence", () => {
  it("grantBadges records new badges and ignores ones already held", () => {
    seedStreak(3);
    const store = useAppStore.getState();

    store.grantBadges([
      { id: "first-month", earnedAt: "2026-05-01T00:00:00.000Z", value: 1 },
      { id: "streak-3", earnedAt: "2026-05-01T00:00:00.000Z", value: 3 },
    ]);
    expect(useAppStore.getState().state.badges).toHaveLength(2);

    // A later launch re-evaluates and offers the same ones again.
    useAppStore.getState().grantBadges([
      { id: "first-month", earnedAt: "2026-06-01T00:00:00.000Z", value: 1 },
    ]);
    const held = useAppStore.getState().state.badges;
    expect(held).toHaveLength(2);
    // The original timestamp survives — it is not re-stamped.
    expect(held.find((b) => b.id === "first-month")?.earnedAt).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("keeps a badge earned, and reachable, after the streak resets", async () => {
    const user = userEvent.setup();
    // A blown last month, but a 3-month badge already banked.
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        budgets: [budget(monthOffset(MONTH, -1))],
        transactions: [spend(monthOffset(MONTH, -1), LIMIT * 3)],
        badges: [{ id: "streak-3", earnedAt: "2026-03-01T00:00:00.000Z", value: 3 }],
      },
    }));
    render(<BudgetStatusBand month={MONTH} />);

    // The count is gone...
    expect(screen.queryByText(/month streak/)).toBeNull();
    // ...but the row remains, or the badges would be unreachable.
    expect(screen.getByText("1 badge earned")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View badges" }));
    const dialog = screen.getByRole("dialog");
    // The achievement survives the reset rather than being revoked.
    const row = within(dialog).getByText("Three in a row").closest("li")!;
    expect(within(row).getByText("Earned")).toBeInTheDocument();
    expect(within(dialog).getByText(/No streak running/)).toBeInTheDocument();
  });

  it("migrates a v8 state forward and awards nothing retroactively", () => {
    const v8 = {
      ...createInitialState(),
      version: 8,
      categories: [GROCERIES],
      badges: undefined,
    };
    const migrated = validateAppState(v8);
    expect(migrated.version).toBe(11);
    expect(migrated.badges).toEqual([]);
  });

  it("drops a saved badge whose definition no longer exists", () => {
    const state = {
      ...createInitialState(),
      version: 9,
      categories: [GROCERIES],
      badges: [
        { id: "retired-badge", earnedAt: "2026-01-01T00:00:00.000Z", value: 1 },
        { id: "streak-3", earnedAt: "2026-01-01T00:00:00.000Z", value: 3 },
      ],
    };
    const result = validateAppState(state).badges;
    expect(result.map((b) => b.id)).toEqual(["streak-3"]);
  });

  it("keeps only one record per badge id", () => {
    const state = {
      ...createInitialState(),
      version: 9,
      categories: [GROCERIES],
      badges: [
        { id: "streak-3", earnedAt: "2026-01-01T00:00:00.000Z", value: 3 },
        { id: "streak-3", earnedAt: "2026-05-01T00:00:00.000Z", value: 9 },
      ],
    };
    const result = validateAppState(state).badges;
    expect(result).toHaveLength(1);
    expect(result[0].earnedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
