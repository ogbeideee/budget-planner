import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { computeRollovers } from "@/lib/rollover";
import { budgetProgress } from "@/lib/selectors";
import { validateAppState } from "@/lib/validate";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, Category, Transaction } from "@/lib/types";
import { BudgetForm } from "./BudgetForm";
import { BudgetRow } from "./BudgetRow";

afterEach(cleanup);

const JAN = "2026-01";
const FEB = "2026-02";
const LIMIT = 100000;

const GROCERIES: Category = {
  id: "cat-groceries",
  name: "Groceries",
  icon: "🛒",
  color: "#f97316",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function budget(month: string): Budget {
  return {
    id: `b-${month}`,
    categoryId: GROCERIES.id,
    month,
    limit: LIMIT,
    priority: "medium",
  };
}

const JAN_SPEND: Transaction = {
  id: "t1",
  categoryId: GROCERIES.id,
  amount: 40000,
  type: "expense",
  date: `${JAN}-10`,
  createdAt: "2026-01-10T00:00:00.000Z",
};

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({
    state: {
      ...createInitialState(),
      categories: [GROCERIES],
      budgets: [budget(JAN), budget(FEB)],
      transactions: [JAN_SPEND],
    },
  });
});

describe("the rollover toggle in the budget edit form", () => {
  it("is off by default for a category that never opted in", async () => {
    render(
      <BudgetForm open onClose={vi.fn()} month={FEB} budget={budget(FEB)} />,
    );
    expect(
      screen.getByRole("switch", { name: "Roll over unused funds" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("turning it on sets the flag on the CATEGORY, so it survives the month", async () => {
    const user = userEvent.setup();
    render(
      <BudgetForm open onClose={vi.fn()} month={FEB} budget={budget(FEB)} />,
    );

    await user.click(screen.getByRole("switch", { name: "Roll over unused funds" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const category = useAppStore
      .getState()
      .state.categories.find((c) => c.id === GROCERIES.id);
    expect(category?.rollover).toBe(true);
  });

  it("reflects a category that is already opted in", () => {
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        categories: [{ ...GROCERIES, rollover: true }],
      },
    }));
    render(
      <BudgetForm open onClose={vi.fn()} month={FEB} budget={budget(FEB)} />,
    );
    expect(
      screen.getByRole("switch", { name: "Roll over unused funds" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("turning it back off clears the flag rather than storing false", async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      state: { ...s.state, categories: [{ ...GROCERIES, rollover: true }] },
    }));
    render(
      <BudgetForm open onClose={vi.fn()} month={FEB} budget={budget(FEB)} />,
    );

    await user.click(screen.getByRole("switch", { name: "Roll over unused funds" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const category = useAppStore
      .getState()
      .state.categories.find((c) => c.id === GROCERIES.id);
    expect(category?.rollover).toBeUndefined();
  });

  it("opts in only the one category it was toggled for", async () => {
    const user = userEvent.setup();
    const other: Category = { ...GROCERIES, id: "cat-other", name: "Transport" };
    useAppStore.setState((s) => ({
      state: { ...s.state, categories: [GROCERIES, other] },
    }));
    render(
      <BudgetForm open onClose={vi.fn()} month={FEB} budget={budget(FEB)} />,
    );

    await user.click(screen.getByRole("switch", { name: "Roll over unused funds" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const categories = useAppStore.getState().state.categories;
    expect(categories.find((c) => c.id === GROCERIES.id)?.rollover).toBe(true);
    // Explicitly per category — never bulk-applied.
    expect(categories.find((c) => c.id === other.id)?.rollover).toBeUndefined();
  });
});

describe("the budget row shows where a bigger limit came from", () => {
  function renderRow(rollovers: ReturnType<typeof computeRollovers>) {
    const feb = budget(FEB);
    return render(
      <BudgetRow
        budget={feb}
        category={GROCERIES}
        progress={budgetProgress(feb, [JAN_SPEND], rollovers)}
        currency="USD"
        onEdit={vi.fn()}
        onAllocate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
  }

  const carried = () =>
    computeRollovers({
      budgets: [budget(JAN), budget(FEB)],
      categories: [{ ...GROCERIES, rollover: true }],
      transactions: [JAN_SPEND],
      rollovers: [],
      month: FEB,
    });

  it("spells out base + rolled over = total rather than a bare bigger number", () => {
    const { container } = renderRow(carried());

    // The badge names the whole sum for screen readers and on hover.
    expect(
      screen.getByLabelText("$1,000.00 + $600.00 rolled over = $1,600.00"),
    ).toBeInTheDocument();
    // And the breakdown is visible next to the headline figure.
    expect(container.textContent).toContain("$1,000.00 + $600.00");
    expect(container.textContent).toContain("$1,600.00");
  });

  it("shows no rollover marking at all when nothing carried", () => {
    const { container } = renderRow([]);
    expect(container.textContent).not.toContain("rolled over");
    expect(container.textContent).toContain("$1,000.00");
  });

  it("is not reported as over budget while carried funds remain", () => {
    const rollovers = carried();
    const feb = budget(FEB);
    const spendPastBase: Transaction = {
      ...JAN_SPEND,
      id: "t2",
      date: `${FEB}-05`,
      amount: 120000, // past the 100,000 base, inside the 160,000 effective
    };
    const progress = budgetProgress(feb, [JAN_SPEND, spendPastBase], rollovers);
    expect(progress.over).toBe(false);
    expect(progress.remaining).toBe(40000);
  });
});

describe("state model", () => {
  it("migrates a v6 state forward without opting anyone in", () => {
    const v6 = {
      ...createInitialState(),
      version: 6,
      categories: [GROCERIES],
      budgets: [budget(JAN)],
      transactions: [JAN_SPEND],
      rollovers: undefined,
    };
    const migrated = validateAppState(v6);

    expect(migrated.version).toBe(10);
    expect(migrated.rollovers).toEqual([]);
    // No invented history, and nobody switched on behind the user's back.
    expect(migrated.categories.every((c) => c.rollover === undefined)).toBe(true);
  });

  it("drops carryover records whose category is gone", () => {
    const state = {
      ...createInitialState(),
      version: 7,
      categories: [GROCERIES],
      budgets: [budget(FEB)],
      transactions: [],
      rollovers: [
        {
          id: "ro-orphan",
          categoryId: "cat-deleted",
          month: FEB,
          fromMonth: JAN,
          amount: 100,
          leftover: 100,
          cap: 1000,
          computedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    };
    expect(validateAppState(state).rollovers).toEqual([]);
  });

  it("rejects a record claiming more carried than its own cap allowed", () => {
    const state = {
      ...createInitialState(),
      version: 7,
      categories: [GROCERIES],
      budgets: [budget(FEB)],
      transactions: [],
      rollovers: [
        {
          id: "ro-bad",
          categoryId: GROCERIES.id,
          month: FEB,
          fromMonth: JAN,
          amount: 5000,
          leftover: 5000,
          cap: 1000,
          computedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    };
    expect(() => validateAppState(state)).toThrow(/exceeds cap/);
  });

  it("applyRollovers appends once and ignores a repeat", () => {
    const records = computeRollovers({
      budgets: [budget(JAN), budget(FEB)],
      categories: [{ ...GROCERIES, rollover: true }],
      transactions: [JAN_SPEND],
      rollovers: [],
      month: FEB,
    });

    useAppStore.getState().applyRollovers(records);
    expect(useAppStore.getState().state.rollovers).toHaveLength(1);

    useAppStore.getState().applyRollovers(records);
    expect(useAppStore.getState().state.rollovers).toHaveLength(1);
  });

  it("deleting a category takes its carryover history with it", () => {
    const orphanMaker = computeRollovers({
      budgets: [budget(JAN), budget(FEB)],
      categories: [{ ...GROCERIES, rollover: true }],
      transactions: [JAN_SPEND],
      rollovers: [],
      month: FEB,
    });
    useAppStore.setState((s) => ({
      state: { ...s.state, budgets: [], transactions: [], rollovers: orphanMaker },
    }));

    expect(useAppStore.getState().deleteCategory(GROCERIES.id).ok).toBe(true);
    expect(useAppStore.getState().state.rollovers).toEqual([]);
  });
});
