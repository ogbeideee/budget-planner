import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInstances } from "@/lib/recurrence";
import { setWritesEnabled, STORAGE_KEY } from "@/lib/storage";
import type { AppState, Budget, Category, RecurrenceRule } from "@/lib/types";
import { createAppStore, useAppStoreErrors } from "../useAppStore";

type Store = ReturnType<typeof createAppStore>;

beforeEach(() => {
  window.localStorage.clear();
  setWritesEnabled(true);
  useAppStoreErrors.setState({ hydrateError: null });
});

function expenseCategory(store: Store): Category {
  return store.getState().state.categories.find((c) => c.kind === "expense")!;
}

function expenseCategories(store: Store): Category[] {
  return store.getState().state.categories.filter((c) => c.kind === "expense");
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

  it("sets hydrateError without overwriting the persisted payload", async () => {
    const corrupt = JSON.stringify({ state: { version: 2 }, version: 1 });
    window.localStorage.setItem(STORAGE_KEY, corrupt);
    createAppStore();
    await vi.waitFor(() => {
      expect(useAppStoreErrors.getState().hydrateError).toBe("corrupt");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  });

  it("upgrades version 1 data in place instead of discarding it", async () => {
    const first = createAppStore();
    const expense = expenseCategory(first);
    const income = first
      .getState()
      .state.categories.find((c) => c.kind === "income")!;
    const legacy: Omit<AppState, "version" | "incomePlans"> & { version: 1 } = {
      version: 1,
      categories: first.getState().state.categories,
      budgets: [],
      transactions: [
        {
          id: "legacy-income-tx",
          categoryId: income.id,
          amount: 250000,
          type: "income",
          date: "2026-08-01",
          note: "Monthly income",
          createdAt: "2026-08-01T00:00:00.000Z",
          monthlyIncome: true,
        },
        {
          id: "legacy-rent-tx",
          categoryId: expense.id,
          amount: 40000,
          type: "expense",
          date: "2026-08-02",
          createdAt: "2026-08-02T00:00:00.000Z",
        },
      ],
      futureExpenses: [],
      recurrenceRules: [],
      settings: first.getState().state.settings,
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: legacy, version: 1 }),
    );

    const second = createAppStore();
    await vi.waitFor(() => {
      const { state } = second.getState();
      expect(useAppStoreErrors.getState().hydrateError).toBeNull();
      expect(state.transactions).toHaveLength(2);
      expect(
        state.transactions.find((t) => t.id === "legacy-rent-tx"),
      ).toBeDefined();
      expect(state.incomePlans).toEqual([
        expect.objectContaining({
          month: "2026-08",
          name: income.name,
          icon: income.icon,
          expectedAmount: 250000,
          receivedAmount: 250000,
        }),
      ]);
      expect(state.categories.filter((c) => c.kind === "income")).toHaveLength(6);
      expect(state.version).toBe(3);
    });
  });

  it("never writes over a failed payload after hydration errors", async () => {
    const corrupt = '{"state":{"version":2,"transactions":"broken"}}';
    window.localStorage.setItem(STORAGE_KEY, corrupt);
    createAppStore();
    await vi.waitFor(() => {
      expect(useAppStoreErrors.getState().hydrateError).toBe("corrupt");
    });
    const store = createAppStore();
    store.getState().addTransaction({
      categoryId: store.getState().state.categories.find((c) => c.kind === "expense")!.id,
      amount: 5000,
      type: "expense",
      date: "2026-08-03",
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  });

  it("restores from an auto backup after corruption and re-enables persistence", async () => {
    const first = createAppStore();
    first.getState().setIncomePlan("2026-08", null, {
      name: "Salary",
      icon: "💰",
      expectedAmount: 120000,
    });
    await vi.waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
    const payload = window.localStorage.getItem(STORAGE_KEY)!;

    window.localStorage.setItem(STORAGE_KEY, '{"state":{"version":2,"transactions":"broken"}}');
    createAppStore();
    await vi.waitFor(() => {
      expect(useAppStoreErrors.getState().hydrateError).toBe("corrupt");
    });

    const backupKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key !== null && key.startsWith("budget-planner:backup:")) {
        backupKeys.push(key);
      }
    }
    const backup = backupKeys.find((key) =>
      window.localStorage.getItem(key)!.includes("transactions"),
    )!;
    window.localStorage.setItem(backup, JSON.stringify({
      app: "budget-planner",
      backup: true,
      kind: "manual",
      createdAt: "2026-08-03T00:00:00.000Z",
      sourceVersion: "current",
      raw: payload,
    }));

    const store = createAppStore();
    const result = store.getState().recoverFromBackup(backup);
    expect(result.ok).toBe(true);
    expect(useAppStoreErrors.getState().hydrateError).toBeNull();
    expect(
      store.getState().state.incomePlans.find((p) => p.expectedAmount === 120000),
    ).toBeDefined();

    store.getState().addTransaction({
      categoryId: store.getState().state.categories.find((c) => c.kind === "expense")!.id,
      amount: 700,
      type: "expense",
      date: "2026-08-04",
    });
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(persisted.state.transactions.length).toBeGreaterThan(0);
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

  it("moves a budget to another category in the same month", () => {
    const store = createAppStore();
    const categories = expenseCategories(store);
    const budgetCategory = categories[0];
    const otherCategory = categories[1];
    store.getState().addBudget({ categoryId: budgetCategory.id, month: "2026-08", limit: 1000, priority: "medium" });
    const budget = store.getState().state.budgets[0];
    store.getState().updateBudget(budget.id, { categoryId: otherCategory.id });
    expect(store.getState().state.budgets[0].categoryId).toBe(otherCategory.id);
  });

  it("rejects a category change that would collide with another budget", () => {
    const store = createAppStore();
    const categories = expenseCategories(store);
    store.getState().addBudget({ categoryId: categories[0].id, month: "2026-08", limit: 1000, priority: "medium" });
    store.getState().addBudget({ categoryId: categories[1].id, month: "2026-08", limit: 2000, priority: "low" });
    const first = store.getState().state.budgets.find((b) => b.categoryId === categories[0].id)!;
    store.getState().updateBudget(first.id, { categoryId: categories[1].id });
    expect(store.getState().state.budgets[0].categoryId).toBe(categories[0].id);
    expect(store.getState().state.budgets).toHaveLength(2);
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
    expect(store.getState().state.categories).toHaveLength(11);
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
    expect(store.getState().state.categories).toHaveLength(11);
    expect(store.getState().state.incomePlans).toHaveLength(0);
    expect(useAppStoreErrors.getState().hydrateError).toBeNull();
  });
});

describe("setIncomePlan", () => {
  function basePlan() {
    return {
      name: "Salary",
      icon: "💰",
      expectedAmount: 250000,
    };
  }

  it("creates an income plan for the month", () => {
    const store = createAppStore();
    expect(store.getState().setIncomePlan("2026-08", null, basePlan())).toBe(true);
    expect(store.getState().state.incomePlans).toHaveLength(1);
    expect(store.getState().state.incomePlans[0]).toMatchObject({
      month: "2026-08",
      name: "Salary",
      icon: "💰",
      expectedAmount: 250000,
      receivedAmount: 0,
    });
  });

  it("updates the existing plan instead of duplicating", () => {
    const store = createAppStore();
    store.getState().setIncomePlan("2026-08", null, basePlan());
    const id = store.getState().state.incomePlans[0].id;
    expect(
      store.getState().setIncomePlan("2026-08", id, { expectedAmount: 300000 }),
    ).toBe(true);
    expect(store.getState().state.incomePlans).toHaveLength(1);
    expect(store.getState().state.incomePlans[0].expectedAmount).toBe(300000);
  });

  it("editing one source never wipes another source", () => {
    const store = createAppStore();
    store.getState().setIncomePlan("2026-08", null, basePlan());
    const salaryId = store.getState().state.incomePlans[0].id;
    store.getState().setIncomePlan("2026-08", null, {
      name: "Forex",
      icon: "💱",
      expectedAmount: 100000,
    });
    expect(
      store.getState().setIncomePlan("2026-08", salaryId, {
        name: "Salary",
        icon: "💰",
        expectedAmount: 260000,
        receivedAmount: 50000,
      }),
    ).toBe(true);
    expect(store.getState().state.incomePlans).toHaveLength(2);
    const salary = store
      .getState()
      .state.incomePlans.find((p) => p.id === salaryId)!;
    expect(salary.expectedAmount).toBe(260000);
    expect(salary.receivedAmount).toBe(50000);
    const forex = store.getState().state.incomePlans.find((p) => p.name === "Forex")!;
    expect(forex.expectedAmount).toBe(100000);
  });

  it("scopes plans to month", () => {
    const store = createAppStore();
    store.getState().setIncomePlan("2026-08", null, basePlan());
    store.getState().setIncomePlan("2026-09", null, {
      ...basePlan(),
      expectedAmount: 300000,
    });
    expect(store.getState().state.incomePlans).toHaveLength(2);
    const months = store
      .getState()
      .state.incomePlans.map((plan) => plan.month)
      .sort();
    expect(months).toEqual(["2026-08", "2026-09"]);
  });

  it("removes a plan when both amounts are zero", () => {
    const store = createAppStore();
    store.getState().setIncomePlan("2026-08", null, basePlan());
    const id = store.getState().state.incomePlans[0].id;
    expect(
      store.getState().setIncomePlan("2026-08", id, {
        expectedAmount: 0,
        receivedAmount: 0,
      }),
    ).toBe(true);
    expect(store.getState().state.incomePlans).toHaveLength(0);
  });

  it("rejects invalid amounts and names", () => {
    const store = createAppStore();
    expect(
      store.getState().setIncomePlan("2026-08", null, { ...basePlan(), expectedAmount: -5 }),
    ).toBe(false);
    expect(
      store.getState().setIncomePlan("2026-08", null, { ...basePlan(), expectedAmount: 10.5 }),
    ).toBe(false);
    expect(
      store.getState().setIncomePlan("2026-08", null, { name: "   ", icon: "💰", expectedAmount: 100 }),
    ).toBe(false);
    expect(store.getState().state.incomePlans).toHaveLength(0);
  });

  it("rejects updates to unknown plans", () => {
    const store = createAppStore();
    expect(
      store.getState().setIncomePlan("2026-08", "missing-id", { expectedAmount: 250000 }),
    ).toBe(false);
    expect(store.getState().state.incomePlans).toHaveLength(0);
  });

  it("persists income plans to localStorage", () => {
    const store = createAppStore();
    store.getState().setIncomePlan("2026-08", null, basePlan());
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const persisted = JSON.parse(raw!);
    expect(persisted.state.incomePlans[0]).toMatchObject({
      month: "2026-08",
      name: "Salary",
      icon: "💰",
      expectedAmount: 250000,
    });
  });

  it("allows deleting an income category that has income plans", () => {
    const store = createAppStore();
    const category = store.getState().state.categories.find((c) => c.kind === "income")!;
    store.getState().setIncomePlan("2026-08", null, basePlan());
    expect(store.getState().deleteCategory(category.id)).toEqual({ ok: true });
    expect(store.getState().state.incomePlans).toHaveLength(1);
  });
});

describe("future expenses", () => {
  function addValid(store: Store) {
    const category = expenseCategory(store);
    return store.getState().addFutureExpense({
      categoryId: category.id,
      amount: 1500,
      title: "Netflix",
      dueDate: "2026-08-15",
      notes: "Monthly plan",
      recurring: true,
      priority: "low",
    });
  }

  it("adds a future expense with defaults", () => {
    const store = createAppStore();
    expect(addValid(store)).toBe(true);
    const added = store.getState().state.futureExpenses[0];
    expect(added).toMatchObject({
      title: "Netflix",
      amount: 1500,
      dueDate: "2026-08-15",
      recurring: true,
      priority: "low",
      status: "upcoming",
    });
    expect(added.id).toBeDefined();
  });

  it("rejects invalid inputs", () => {
    const store = createAppStore();
    const category = expenseCategory(store);
    const base = {
      categoryId: category.id,
      amount: 1500,
      title: "Netflix",
      dueDate: "2026-08-15",
    };
    expect(store.getState().addFutureExpense({ ...base, amount: 0 })).toBe(false);
    expect(store.getState().addFutureExpense({ ...base, title: "  " })).toBe(false);
    expect(store.getState().addFutureExpense({ ...base, dueDate: "15-08-2026" })).toBe(false);
    expect(
      store.getState().addFutureExpense({
        ...base,
        categoryId: store.getState().state.categories.find((c) => c.kind === "income")!.id,
      }),
    ).toBe(false);
    expect(store.getState().state.futureExpenses).toHaveLength(0);
  });

  it("updates fields through sanitized patches", () => {
    const store = createAppStore();
    addValid(store);
    const id = store.getState().state.futureExpenses[0].id;
    store.getState().updateFutureExpense(id, {
      title: "Netflix Premium",
      status: "paid",
      priority: "high",
      notes: "Updated",
    });
    expect(store.getState().state.futureExpenses[0]).toMatchObject({
      title: "Netflix Premium",
      status: "paid",
      priority: "high",
      notes: "Updated",
    });
    store.getState().updateFutureExpense(id, { amount: -5, title: "" });
    expect(store.getState().state.futureExpenses[0].amount).toBe(1500);
  });

  it("deletes a future expense", () => {
    const store = createAppStore();
    addValid(store);
    store.getState().deleteFutureExpense(store.getState().state.futureExpenses[0].id);
    expect(store.getState().state.futureExpenses).toHaveLength(0);
  });

  it("blocks deleting a category used by future expenses", () => {
    const store = createAppStore();
    addValid(store);
    const category = expenseCategory(store);
    expect(store.getState().deleteCategory(category.id)).toEqual({
      ok: false,
      reason: "in-use-future-expenses",
    });
  });

  it("persists future expenses to localStorage", () => {
    const store = createAppStore();
    addValid(store);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const persisted = JSON.parse(raw!);
    expect(persisted.state.futureExpenses).toHaveLength(1);
    expect(persisted.state.futureExpenses[0].title).toBe("Netflix");
  });
});
