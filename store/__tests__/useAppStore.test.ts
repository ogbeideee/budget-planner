import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInstances } from "@/lib/recurrence";
import { STORAGE_KEY } from "@/lib/storage";
import type { Budget, Category, RecurrenceRule } from "@/lib/types";
import { createAppStore } from "../useAppStore";

type Store = ReturnType<typeof createAppStore>;

beforeEach(() => {
  window.localStorage.clear();
});

function expenseCategory(store: Store): Category {
  return store.getState().state.categories.find((c) => c.kind === "expense")!;
}

function weeklyRule(categoryId: string): RecurrenceRule {
  return {
    id: "rule-1",
    categoryId,
    amount: 1000,
    type: "expense",
    frequency: "weekly",
    anchorDate: "2026-08-03",
    enabled: true,
    exceptions: {},
  };
}

describe("persistence (AC-08)", () => {
  it("writes every mutation to localStorage", () => {
    const store = createAppStore();
    store.getState().addTransaction({
      categoryId: expenseCategory(store).id,
      amount: 5000,
      type: "expense",
      date: "2026-08-03",
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw!);
    expect(persisted.state.transactions).toHaveLength(1);
  });

  it("restores state into a fresh store from localStorage", async () => {
    const first = createAppStore();
    first.getState().addTransaction({
      categoryId: expenseCategory(first).id,
      amount: 5000,
      type: "expense",
      date: "2026-08-03",
    });
    const second = createAppStore();
    await vi.waitFor(() => {
      expect(second.getState().state.transactions).toHaveLength(1);
    });
  });

  it("sets hydrateError when persisted data is corrupt", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { version: 2 }, version: 1 }),
    );
    const store = createAppStore();
    await vi.waitFor(() => {
      expect(store.getState().hydrateError).toBe("corrupt");
    });
  });
});

describe("budgets (AC-02)", () => {
  it("rejects a duplicate budget for the same category and month", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    expect(
      store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 1000, priority: "medium" }),
    ).toBe(true);
    expect(
      store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 2000, priority: "high" }),
    ).toBe(false);
    expect(store.getState().state.budgets).toHaveLength(1);
  });

  it("allows the same category in different months", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    expect(
      store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 1000, priority: "medium" }),
    ).toBe(true);
    expect(
      store.getState().addBudget({ categoryId: category.id, month: "2026-09", limit: 1000, priority: "medium" }),
    ).toBe(true);
  });
});

describe("updateBudget / moveTransactionToNextMonth (AC-17)", () => {
  it("updates a budget limit and priority", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 1000, priority: "low" });
    const budget = store.getState().state.budgets[0];
    store.getState().updateBudget(budget.id, { limit: 2500, priority: "high" });
    const updated = store.getState().state.budgets[0];
    expect(updated.limit).toBe(2500);
    expect(updated.priority).toBe("high");
  });

  it("ignores invalid patch values", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 1000, priority: "medium" });
    const budget = store.getState().state.budgets[0];
    store.getState().updateBudget(
      budget.id,
      { limit: -5, priority: "urgent" } as unknown as Partial<Pick<Budget, "limit" | "priority">>,
    );
    expect(store.getState().state.budgets[0].limit).toBe(1000);
    expect(store.getState().state.budgets[0].priority).toBe("medium");
  });

  it("moves an expense to the next month with day clamping", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addTransaction({
      categoryId: category.id,
      amount: 1000,
      type: "expense",
      date: "2026-01-31",
    });
    const transaction = store.getState().state.transactions[0];
    store.getState().moveTransactionToNextMonth(transaction.id);
    expect(store.getState().state.transactions[0].date).toBe("2026-02-28");
    expect(store.getState().state.transactions[0].deferred).toBe(true);
  });

  it("does not move income transactions", () => {
    const store = createAppStore();
    const category = store.getState().state.categories.find((c) => c.kind === "income")!;
    store.getState().addTransaction({
      categoryId: category.id,
      amount: 1000,
      type: "income",
      date: "2026-08-01",
    });
    const transaction = store.getState().state.transactions[0];
    store.getState().moveTransactionToNextMonth(transaction.id);
    expect(store.getState().state.transactions[0].date).toBe("2026-08-01");
  });

  it("detaches generated instances and excludes them from regeneration (AC-17)", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addRecurrenceRule({
      categoryId: category.id,
      amount: 1000,
      type: "expense",
      frequency: "weekly",
      anchorDate: "2026-08-03",
    });
    const rule = store.getState().state.recurrenceRules[0];
    const instances = generateInstances(rule, "2026-08");
    store.getState().addGeneratedInstances(instances);
    const moved = instances[0];

    store.getState().moveTransactionToNextMonth(moved.id);
    const state = store.getState().state;
    const transaction = state.transactions.find((t) => t.id === moved.id)!;
    expect(transaction.date).toBe("2026-09-03");
    expect(transaction.recurringRuleId).toBeUndefined();
    expect(state.recurrenceRules[0].exceptions["2026-08"]).toContain(moved.id);

    store.getState().addGeneratedInstances(
      generateInstances(store.getState().state.recurrenceRules[0], "2026-08"),
    );
    const after = store.getState().state;
    expect(after.transactions.filter((t) => t.id === moved.id)).toHaveLength(1);
    expect(
      after.transactions.filter(
        (t) => t.date.startsWith("2026-08") && t.recurringRuleId === rule.id,
      ),
    ).toHaveLength(4);
  });
});

describe("recurring materialization (AC-06, AC-07)", () => {
  it("materializes generated instances idempotently", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    const rule = weeklyRule(category.id);
    const instances = generateInstances(rule, "2026-08");
    expect(instances).toHaveLength(5);
    store.getState().addGeneratedInstances(instances);
    store.getState().addGeneratedInstances(instances);
    expect(store.getState().state.transactions).toHaveLength(5);
  });

  it("marks edits on generated instances and never overwrites them", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addRecurrenceRule({
      categoryId: category.id,
      amount: 1000,
      type: "expense",
      frequency: "weekly",
      anchorDate: "2026-08-03",
    });
    const rule = store.getState().state.recurrenceRules[0];
    const instances = generateInstances(rule, "2026-08");
    store.getState().addGeneratedInstances(instances);

    store.getState().updateTransaction(instances[0].id, { amount: 500 });
    const edited = store
      .getState()
      .state.transactions.find((t) => t.id === instances[0].id)!;
    expect(edited.amount).toBe(500);
    expect(edited.edited).toBe(true);

    store.getState().addGeneratedInstances(
      generateInstances(store.getState().state.recurrenceRules[0], "2026-08"),
    );
    const afterRegeneration = store
      .getState()
      .state.transactions.find((t) => t.id === instances[0].id)!;
    expect(afterRegeneration.amount).toBe(500);
    expect(store.getState().state.transactions).toHaveLength(5);
  });

  it("records exceptions on delete and does not regenerate the deleted instance", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addRecurrenceRule({
      categoryId: category.id,
      amount: 1000,
      type: "expense",
      frequency: "weekly",
      anchorDate: "2026-08-03",
    });
    const rule = store.getState().state.recurrenceRules[0];
    const instances = generateInstances(rule, "2026-08");
    store.getState().addGeneratedInstances(instances);

    store.getState().deleteTransaction(instances[0].id);
    expect(store.getState().state.transactions).toHaveLength(4);
    const exceptions = store.getState().state.recurrenceRules[0].exceptions["2026-08"];
    expect(exceptions).toContain(instances[0].id);

    store.getState().addGeneratedInstances(
      generateInstances(store.getState().state.recurrenceRules[0], "2026-08"),
    );
    expect(store.getState().state.transactions).toHaveLength(4);
  });
});

describe("categories (AC-11)", () => {
  it("blocks deletion when the category is used by transactions", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addTransaction({
      categoryId: category.id,
      amount: 100,
      type: "expense",
      date: "2026-08-01",
    });
    const result = store.getState().deleteCategory(category.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("in-use-transactions");
    expect(store.getState().state.categories.some((c) => c.id === category.id)).toBe(true);
  });

  it("blocks deletion when the category has a budget", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addBudget({ categoryId: category.id, month: "2026-08", limit: 1000, priority: "medium" });
    const result = store.getState().deleteCategory(category.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("in-use-budgets");
  });

  it("blocks deletion when the category has a recurrence rule", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addRecurrenceRule({
      categoryId: category.id,
      amount: 100,
      type: "expense",
      frequency: "monthly",
      anchorDate: "2026-08-15",
    });
    const result = store.getState().deleteCategory(category.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("in-use-rules");
  });

  it("deletes an unused category immediately", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    const result = store.getState().deleteCategory(category.id);
    expect(result.ok).toBe(true);
    expect(store.getState().state.categories.some((c) => c.id === category.id)).toBe(false);
  });

  it("updates a category's name, icon, and color via updateCategory", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().updateCategory(category.id, { name: "Rent", icon: "🏠", color: "#123456" });
    const updated = store.getState().state.categories.find((c) => c.id === category.id);
    expect(updated).toMatchObject({ name: "Rent", icon: "🏠", color: "#123456" });
    expect(updated?.kind).toBe("expense");
  });
});

describe("import / export (AC-09, AC-10)", () => {
  it("rejects an invalid import without mutating state", () => {
    const store = createAppStore();
    const result = store.getState().importState({ version: 2 });
    expect(result.ok).toBe(false);
    expect(store.getState().state.categories).toHaveLength(6);
    expect(store.getState().state.transactions).toHaveLength(0);
  });

  it("replaces state with a valid export", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    const current = store.getState().state;
    const exportState = {
      ...current,
      transactions: [
        {
          id: "t-1",
          categoryId: category.id,
          amount: 100,
          type: "expense",
          date: "2026-08-01",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    const result = store.getState().importState(exportState);
    expect(result.ok).toBe(true);
    expect(store.getState().state.transactions).toHaveLength(1);
  });
});

describe("resetAll", () => {
  it("restores the initial seeded state", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    store.getState().addTransaction({
      categoryId: category.id,
      amount: 100,
      type: "expense",
      date: "2026-08-01",
    });
    store.getState().resetAll();
    expect(store.getState().state.transactions).toHaveLength(0);
    expect(store.getState().state.categories).toHaveLength(6);
    expect(store.getState().hydrateError).toBeNull();
  });
});

describe("setMonthlyIncome", () => {
  it("creates a tagged income transaction for the month when none exists", () => {
    const store = createAppStore();
    const ok = store.getState().setMonthlyIncome("2026-08", 250000);
    expect(ok).toBe(true);
    const created = store.getState().state.transactions.find(
      (t) => t.monthlyIncome === true,
    );
    expect(created).toBeDefined();
    expect(created).toMatchObject({
      type: "income",
      amount: 250000,
      date: "2026-08-01",
      note: "Monthly income",
      monthlyIncome: true,
    });
  });

  it("updates the existing monthly income instead of duplicating", () => {
    const store = createAppStore();
    store.getState().setMonthlyIncome("2026-08", 250000);
    const ok = store.getState().setMonthlyIncome("2026-08", 300000);
    expect(ok).toBe(true);
    const tagged = store
      .getState()
      .state.transactions.filter((t) => t.monthlyIncome === true);
    expect(tagged).toHaveLength(1);
    expect(tagged[0].amount).toBe(300000);
  });

  it("scopes monthly income to the selected month", () => {
    const store = createAppStore();
    store.getState().setMonthlyIncome("2026-08", 250000);
    store.getState().setMonthlyIncome("2026-09", 300000);
    const tagged = store
      .getState()
      .state.transactions.filter((t) => t.monthlyIncome === true);
    expect(tagged).toHaveLength(2);
    const august = tagged.find((t) => t.date === "2026-08-01");
    expect(august?.amount).toBe(250000);
  });

  it("removes monthly income when the amount is zero", () => {
    const store = createAppStore();
    store.getState().setMonthlyIncome("2026-08", 250000);
    expect(
      store.getState().state.transactions.filter((t) => t.monthlyIncome),
    ).toHaveLength(1);
    const ok = store.getState().setMonthlyIncome("2026-08", 0);
    expect(ok).toBe(true);
    expect(
      store.getState().state.transactions.filter((t) => t.monthlyIncome),
    ).toHaveLength(0);
  });

  it("rejects invalid amounts", () => {
    const store = createAppStore();
    expect(store.getState().setMonthlyIncome("2026-08", -5)).toBe(false);
    expect(store.getState().setMonthlyIncome("2026-08", 10.5)).toBe(false);
    expect(store.getState().state.transactions).toHaveLength(0);
  });

  it("returns false when no income category exists", () => {
    const store = createAppStore();
    store.getState().deleteCategory(
      store.getState().state.categories.find((c) => c.kind === "income")!.id,
    );
    expect(store.getState().setMonthlyIncome("2026-08", 250000)).toBe(false);
  });

  it("persists monthly income to localStorage", () => {
    const store = createAppStore();
    store.getState().setMonthlyIncome("2026-08", 250000);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const persisted = JSON.parse(raw!);
    expect(persisted.state.transactions[0]).toMatchObject({
      monthlyIncome: true,
      amount: 250000,
    });
  });
});
