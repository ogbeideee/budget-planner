import { describe, expect, it } from "vitest";
import { createInitialState } from "../seed";
import { ValidationError, validateAppState } from "../validate";
import type { AppState, Budget, IncomePlan, Transaction } from "../types";

function validState(): AppState {
  return createInitialState();
}

function clone(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

describe("validateAppState", () => {
  it("accepts a valid initial state", () => {
    const result = validateAppState(validState());
    expect(result.categories).toHaveLength(11);
    expect(result.incomePlans).toEqual([]);
    expect(result.version).toBe(3);
    expect(result.settings.firstRunDone).toBe(true);
  });

  it("rejects an unsupported version (AC-10)", () => {
    const state = clone(validState());
    (state as { version: number }).version = 4;
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("migrates a version 2 state to version 3", () => {
    const state = clone(validState());
    (state as { version: number }).version = 2;
    expect(validateAppState(state).version).toBe(3);
  });

  it("migrates a version 1 state: backfills income categories and converts monthly income to plans", () => {
    const state = clone(validState());
    (state as { version: number }).version = 1;
    state.categories = state.categories.filter((c) => c.kind === "expense");
    const incomeCategory = { id: "legacy-income", name: "Salary", icon: "💰", color: "#0ea5e9", kind: "income", createdAt: "2026-01-01T00:00:00.000Z" } as never;
    state.categories = [...state.categories, incomeCategory];
    state.transactions = [
      {
        id: "t1",
        categoryId: "legacy-income",
        amount: 250000,
        type: "income",
        date: "2026-08-01",
        note: "Monthly income",
        createdAt: "2026-08-01T00:00:00.000Z",
        monthlyIncome: true,
      },
    ] as unknown as Transaction[];
    (state as unknown as Record<string, unknown>).incomePlans = undefined;
    const result = validateAppState(state);
    expect(result.version).toBe(3);
    expect(result.incomePlans).toEqual([
      expect.objectContaining({
        month: "2026-08",
        name: "Salary",
        icon: "💰",
        expectedAmount: 250000,
        receivedAmount: 250000,
      }),
    ]);
    const incomeCount = result.categories.filter((c) => c.kind === "income").length;
    expect(incomeCount).toBeGreaterThanOrEqual(3);
  });

  it("migrates fractional monthly income amounts instead of rejecting them", () => {
    const state = clone(validState());
    (state as { version: number }).version = 1;
    const incomeCategory = state.categories.find((c) => c.kind === "income")!;
    state.transactions = [
      {
        id: "t1",
        categoryId: incomeCategory.id,
        amount: 2500.5,
        type: "income",
        date: "2026-08-01",
        createdAt: "2026-08-01T00:00:00.000Z",
        monthlyIncome: true,
      },
    ] as unknown as Transaction[];
    (state as unknown as Record<string, unknown>).incomePlans = undefined;
    const result = validateAppState(state);
    expect(result.incomePlans[0].expectedAmount).toBe(2501);
    expect(result.transactions).toHaveLength(1);
  });

  it("validates income plans", () => {
    const state = clone(validState());
    state.incomePlans = [
      {
        id: "p1",
        month: "2026-08",
        name: "Salary",
        icon: "💰",
        expectedAmount: 1000,
        receivedAmount: 0,
      },
    ];
    expect(() => validateAppState(state)).not.toThrow();

    state.incomePlans = [{ ...state.incomePlans[0], name: "  " }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.incomePlans = [{ ...state.incomePlans[0], month: "2026-13" }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.incomePlans = [{ ...state.incomePlans[0], month: "2026-08", expectedAmount: -5 }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.incomePlans = [{ ...state.incomePlans[0], expectedAmount: 10.5 }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.incomePlans = [{ ...state.incomePlans[0], receivedAmount: -1 }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.incomePlans = [
      {
        id: "p1",
        month: "2026-08",
        categoryId: expenseCategory.id,
        expected: 1000,
      } as unknown as IncomePlan,
    ];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.incomePlans = [
      {
        id: "p1",
        month: "2026-08",
        categoryId: "ghost",
        expected: 1000,
      } as unknown as IncomePlan,
    ];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    delete (state as unknown as Record<string, unknown>).incomePlans;
    expect(validateAppState(state).incomePlans).toEqual([]);
  });

  it("rejects missing required arrays (AC-10)", () => {
    const state = clone(validState()) as unknown as Record<string, unknown>;
    delete state.transactions;
    expect(() => validateAppState(state)).toThrow(ValidationError);
    state.transactions = "nope";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("rejects wrong field types", () => {
    const state = clone(validState());
    (state.settings as { currency: unknown }).currency = "EUR";
    expect(() => validateAppState(state)).toThrow(ValidationError);
    (state.settings as { currency: unknown }).currency = "USD";
    (state.settings as { recurringEnabled: unknown }).recurringEnabled = "yes";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("normalizes legacy settings.currencySymbol (AC-16)", () => {
    const state = clone(validState());
    const settings = state.settings as unknown as Record<string, unknown>;
    delete settings.currency;
    settings.currencySymbol = "₦";
    expect(validateAppState(state).settings.currency).toBe("NGN");
    settings.currencySymbol = "₣";
    expect(validateAppState(state).settings.currency).toBe("USD");
  });

  it("defaults missing budget priority to medium (AC-16)", () => {
    const state = clone(validState());
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.budgets = [
      { id: "b1", categoryId: expenseCategory.id, month: "2026-08", limit: 100 },
    ] as unknown as Budget[];
    expect(validateAppState(state).budgets[0].priority).toBe("medium");
    (state.budgets[0] as { priority: unknown }).priority = "urgent";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("preserves the deferred flag and tolerates its absence (AC-24)", () => {
    const state = clone(validState());
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.transactions = [
      {
        id: "t1",
        categoryId: expenseCategory.id,
        amount: 100,
        type: "expense",
        date: "2026-08-10",
        createdAt: "2026-08-10T00:00:00.000Z",
        deferred: true,
      },
    ];
    expect(validateAppState(state).transactions[0].deferred).toBe(true);
    delete (state.transactions[0] as unknown as Record<string, unknown>).deferred;
    expect(validateAppState(state).transactions[0].deferred).toBeUndefined();
  });

  it("preserves the monthlyIncome flag and requires it to be income", () => {
    const state = clone(validState());
    const incomeCategory = state.categories.find((c) => c.kind === "income")!;
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.transactions = [
      {
        id: "t1",
        categoryId: incomeCategory.id,
        amount: 100,
        type: "income",
        date: "2026-08-01",
        createdAt: "2026-08-01T00:00:00.000Z",
        monthlyIncome: true,
      },
    ];
    expect(validateAppState(state).transactions[0].monthlyIncome).toBe(true);
    delete (state.transactions[0] as unknown as Record<string, unknown>).monthlyIncome;
    expect(validateAppState(state).transactions[0].monthlyIncome).toBeUndefined();
    state.transactions[0] = {
      id: "t1",
      categoryId: expenseCategory.id,
      amount: 100,
      type: "expense",
      date: "2026-08-01",
      createdAt: "2026-08-01T00:00:00.000Z",
      monthlyIncome: true,
    };
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("rejects invalid categories", () => {
    const state = clone(validState());
    (state.categories[0] as { color: unknown }).color = "red";
    expect(() => validateAppState(state)).toThrow(ValidationError);
    (state.categories[0] as { color: unknown }).color = "#ef4444";
    (state.categories[0] as { kind: unknown }).kind = "savings";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("rejects invalid budgets", () => {
    const state = clone(validState());
    const incomeCategory = state.categories.find((c) => c.kind === "income")!;
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.budgets = [
      {
        id: "b1",
        categoryId: incomeCategory.id,
        month: "2026-08",
        limit: 1000,
        priority: "medium",
      },
    ];
    expect(() => validateAppState(state)).toThrow(ValidationError);
    state.budgets = [
      {
        id: "b1",
        categoryId: expenseCategory.id,
        month: "2026-13",
        limit: 1000,
        priority: "medium",
      },
    ];
    expect(() => validateAppState(state)).toThrow(ValidationError);
    state.budgets = [
      {
        id: "b1",
        categoryId: expenseCategory.id,
        month: "2026-08",
        limit: -1,
        priority: "medium",
      },
    ];
    expect(() => validateAppState(state)).toThrow(ValidationError);
    state.budgets = [
      {
        id: "b1",
        categoryId: expenseCategory.id,
        month: "2026-08",
        limit: 100,
        priority: "medium",
      },
    ];
    (state.budgets[0] as { priority: unknown }).priority = "urgent";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("rejects invalid transactions", () => {
    const state = clone(validState());
    const incomeCategory = state.categories.find((c) => c.kind === "income")!;
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    const base: Transaction = {
      id: "t1",
      categoryId: expenseCategory.id,
      amount: 100,
      type: "expense",
      date: "2026-08-01",
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    state.transactions = [base];
    expect(() => validateAppState(state)).not.toThrow();

    state.transactions = [{ ...base, categoryId: "unknown" }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.transactions = [{ ...base, categoryId: incomeCategory.id, type: "expense" }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.transactions = [{ ...base, amount: 0 }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.transactions = [{ ...base, date: "2026-02-31" }];
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.transactions = [{ ...base, note: "x".repeat(201) }];
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("rejects invalid recurrence rules", () => {
    const state = clone(validState());
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.recurrenceRules = [
      {
        id: "r1",
        categoryId: expenseCategory.id,
        amount: 100,
        type: "expense",
        frequency: "weekly",
        anchorDate: "2026-08-03",
        enabled: true,
        exceptions: {},
      },
    ];
    expect(() => validateAppState(state)).not.toThrow();

    (state.recurrenceRules[0] as { frequency: unknown }).frequency = "daily";
    expect(() => validateAppState(state)).toThrow(ValidationError);

    (state.recurrenceRules[0] as { frequency: unknown }).frequency = "weekly";
    (state.recurrenceRules[0] as { exceptions: unknown }).exceptions = {
      "2026-08": [42],
    };
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.recurrenceRules[0].exceptions = { "2026-08": "skipped" };
    expect(() => validateAppState(state)).not.toThrow();
  });

  it("rejects references to unknown categories (cross-field)", () => {
    const state = clone(validState());
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    const budgets: Budget[] = [
      {
        id: "b1",
        categoryId: expenseCategory.id,
        month: "2026-08",
        limit: 100,
        priority: "medium",
      },
    ];
    state.budgets = budgets;
    expect(() => validateAppState(state)).not.toThrow();
    state.budgets = [{ ...budgets[0], categoryId: "ghost" }];
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("returns a normalized clone", () => {
    const state = clone(validState());
    state.categories[0].name = "";
    expect(() => validateAppState(state)).toThrow(ValidationError);
    state.categories[0].name = "Rent";
    const result = validateAppState(state);
    expect(result).not.toBe(state);
    result.categories[0].name = "Changed";
    expect(state.categories[0].name).toBe("Rent");
  });

  it("defaults missing settings.theme to system (additive migration)", () => {
    const state = clone(validState());
    delete (state.settings as unknown as Record<string, unknown>).theme;
    expect(validateAppState(state).settings.theme).toBe("system");
  });

  it("accepts valid settings.theme values and rejects invalid ones", () => {
    for (const value of ["light", "dark", "system"] as const) {
      const state = clone(validState());
      state.settings.theme = value;
      expect(validateAppState(state).settings.theme).toBe(value);
    }
    const state = clone(validState());
    (state.settings as unknown as Record<string, unknown>).theme = "sepia";
    expect(() => validateAppState(state)).toThrow(ValidationError);
  });

  it("validates future expenses and defaults a missing array to empty", () => {
    const state = clone(validState());
    const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
    state.futureExpenses = [
      {
        id: "f1",
        categoryId: expenseCategory.id,
        amount: 500,
        title: "Netflix",
        dueDate: "2026-08-15",
        notes: "Monthly plan",
        recurring: true,
        priority: "low",
        status: "upcoming",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    expect(() => validateAppState(state)).not.toThrow();
    expect(validateAppState(state).futureExpenses[0].title).toBe("Netflix");
    expect(validateAppState(state).futureExpenses[0].status).toBe("upcoming");

    state.futureExpenses[0] = {
      ...state.futureExpenses[0],
      status: "paid",
    };
    expect(validateAppState(state).futureExpenses[0].status).toBe("paid");

    state.futureExpenses[0] = { ...state.futureExpenses[0], status: "later" } as never;
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.futureExpenses[0] = { ...state.futureExpenses[0], categoryId: "ghost" };
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.futureExpenses[0] = { ...state.futureExpenses[0], title: "" };
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.futureExpenses[0] = { ...state.futureExpenses[0], amount: 0 };
    expect(() => validateAppState(state)).toThrow(ValidationError);

    state.futureExpenses[0] = { ...state.futureExpenses[0], dueDate: "15-08-2026" };
    expect(() => validateAppState(state)).toThrow(ValidationError);

    delete (state as unknown as Record<string, unknown>).futureExpenses;
    expect(validateAppState(state).futureExpenses).toEqual([]);
  });
});
