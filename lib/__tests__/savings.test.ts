import { describe, expect, it } from "vitest";
import { validateAppState } from "@/lib/validate";
import { planProgress, savingsPace } from "@/lib/savings";
import { spent, totals } from "@/lib/selectors";
import { createInitialState } from "@/lib/seed";
import type { Category, SavingsPlan, Transaction } from "@/lib/types";

const CATEGORY: Category = {
  id: "c-savings",
  name: "savings",
  icon: "🎯",
  color: "#22c55e",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function plan(overrides: Partial<SavingsPlan> = {}): SavingsPlan {
  return {
    id: "p-1",
    name: "New laptop",
    targetAmount: 1_000_000,
    startingBalance: 0,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function contribution(
  id: string,
  planId: string,
  amount: number,
  date: string,
): Transaction {
  return {
    id,
    categoryId: CATEGORY.id,
    amount,
    type: "expense",
    date,
    createdAt: date,
    savingsPlanId: planId,
  };
}

function plainExpense(
  id: string,
  amount: number,
  date: string,
): Transaction {
  return {
    id,
    categoryId: CATEGORY.id,
    amount,
    type: "expense",
    date,
    createdAt: date,
  };
}

describe("planProgress", () => {
  it("counts the starting balance plus every tagged contribution", () => {
    const p = plan({ startingBalance: 250_000 });
    const transactions = [
      contribution("t1", "p-1", 100_000, "2026-02-01"),
      contribution("t2", "p-1", 150_000, "2026-03-01"),
      // Another plan's money, and a plain expense, must not count.
      contribution("t3", "p-other", 999_000, "2026-03-02"),
      plainExpense("t4", 50_000, "2026-03-03"),
    ];
    const progress = planProgress(p, transactions);
    expect(progress.saved).toBe(500_000);
    expect(progress.contributed).toBe(250_000);
    expect(progress.remaining).toBe(500_000);
    expect(progress.pct).toBe(50);
    expect(progress.complete).toBe(false);
  });

  it("is complete at exactly the target, and past it once over", () => {
    const p = plan();
    expect(planProgress(p, [contribution("t1", "p-1", 1_000_000, "2026-02-01")]).complete).toBe(true);
    expect(planProgress(p, [contribution("t1", "p-1", 1_200_000, "2026-02-01")]).complete).toBe(true);
    expect(planProgress(p, [contribution("t1", "p-1", 999_999, "2026-02-01")]).complete).toBe(false);
  });

  it("never reports a zero-target plan as complete", () => {
    const progress = planProgress(plan({ targetAmount: 0 }), []);
    expect(progress.complete).toBe(false);
    expect(progress.pct).toBe(0);
  });
});

describe("savingsPace", () => {
  it("returns null without a target date — no deadline, no verdict", () => {
    expect(savingsPace(plan(), [], "2026-06-01")).toBeNull();
  });

  it("is on track when the history's pace covers what the deadline needs", () => {
    // 400k contributed over ~2 months (Jan 1 -> Mar 1) = ~206k/mo.
    const p = plan({ targetDate: "2026-07-01" });
    const transactions = [contribution("t1", "p-1", 400_000, "2026-02-01")];
    const pace = savingsPace(p, transactions, "2026-03-01")!;
    expect(pace.status).toBe("on-track");
    expect(pace.currentPerMonth).toBeGreaterThan(0);
    // 600k remaining over ~4 months (Mar 1 -> Jul 1 = 122 days) = ~150k/mo.
    expect(pace.requiredPerMonth).toBeCloseTo(600_000 / (122 / 30.4375), 0);
    expect(pace.currentPerMonth).toBeGreaterThan(pace.requiredPerMonth!);
  });

  it("is behind schedule when the pace falls short", () => {
    const p = plan({ targetDate: "2026-04-01" });
    const transactions = [contribution("t1", "p-1", 50_000, "2026-02-01")];
    const pace = savingsPace(p, transactions, "2026-03-01")!;
    expect(pace.status).toBe("behind");
    expect(pace.requiredPerMonth).toBeGreaterThan(pace.currentPerMonth);
  });

  it("judges a plan younger than a month on one month's pace", () => {
    const p = plan({ targetDate: "2026-12-01" });
    const pace = savingsPace(p, [], "2026-01-05")!;
    // Nothing contributed yet: 0/mo against what the deadline needs.
    expect(pace.status).toBe("behind");
    expect(pace.currentPerMonth).toBe(0);
    expect(pace.requiredPerMonth).toBeGreaterThan(0);
  });

  it("reports behind with everything due now once the date has passed", () => {
    const p = plan({ targetDate: "2026-02-01" });
    const transactions = [contribution("t1", "p-1", 100_000, "2026-01-15")];
    const pace = savingsPace(p, transactions, "2026-03-01")!;
    expect(pace.status).toBe("behind");
    expect(pace.monthsRemaining).toBe(0);
    expect(pace.requiredPerMonth).toBe(900_000);
  });

  it("reports complete regardless of the remaining time", () => {
    const p = plan({ targetDate: "2026-12-01" });
    const transactions = [contribution("t1", "p-1", 1_000_000, "2026-02-01")];
    const pace = savingsPace(p, transactions, "2026-03-01")!;
    expect(pace.status).toBe("complete");
    expect(pace.requiredPerMonth).toBeNull();
  });

  it("is deterministic — the same inputs give the same verdict", () => {
    const p = plan({ targetDate: "2026-09-01" });
    const transactions = [contribution("t1", "p-1", 120_000, "2026-02-01")];
    const a = savingsPace(p, transactions, "2026-05-01");
    const b = savingsPace(p, transactions, "2026-05-01");
    expect(a).toEqual(b);
  });
});

describe("report exclusion", () => {
  it("keeps contributions out of expense/income totals but in the budget envelope", () => {
    const transactions = [
      plainExpense("t1", 40_000, "2026-03-10"),
      contribution("t2", "p-1", 10_000, "2026-03-11"),
    ];
    const monthTotals = totals(transactions, "2026-03");
    expect(monthTotals.expenses).toBe(40_000);
    // And on the income side a tagged row is equally invisible.
    const income: Transaction = {
      ...contribution("t3", "p-1", 5_000, "2026-03-12"),
      type: "income",
      categoryId: "c-income",
    };
    expect(totals([...transactions, income], "2026-03").income).toBe(0);
    // The envelope still consumes it: a rollover category allocating into a
    // plan sees its available funds drop.
    expect(spent(transactions, CATEGORY.id, "2026-03")).toBe(50_000);
  });

  it("leaves months without contributions exactly as they were", () => {
    const transactions = [plainExpense("t1", 40_000, "2026-03-10")];
    expect(totals(transactions, "2026-03")).toEqual({
      income: 0,
      expenses: 40_000,
      net: -40_000,
    });
  });
});

describe("validation and migration", () => {
  it("migrates a v10 state by backfilling an empty plans array only", () => {
    const v10 = { ...createInitialState(), version: 10 } as Record<string, unknown>;
    delete v10.savingsPlans;
    const migrated = validateAppState(v10);
    expect(migrated.version).toBe(11);
    expect(migrated.savingsPlans).toEqual([]);
  });

  it("round-trips a plan with contributions", () => {
    const state = {
      ...createInitialState(),
      categories: [CATEGORY],
      savingsPlans: [plan({ targetDate: "2026-12-01" })],
      transactions: [contribution("t1", "p-1", 100_000, "2026-03-01")],
    };
    const migrated = validateAppState(state);
    expect(migrated.savingsPlans).toHaveLength(1);
    expect(migrated.savingsPlans[0].name).toBe("New laptop");
    expect(migrated.transactions[0].savingsPlanId).toBe("p-1");
  });

  it("strips a contribution tag whose plan no longer exists instead of failing the load", () => {
    const state = {
      ...createInitialState(),
      categories: [CATEGORY],
      transactions: [contribution("t1", "p-gone", 100_000, "2026-03-01")],
    };
    const migrated = validateAppState(state);
    expect(migrated.transactions[0].savingsPlanId).toBeUndefined();
  });

  it("rejects an unknown status", () => {
    const state = {
      ...createInitialState(),
      savingsPlans: [plan({ status: "paused" as SavingsPlan["status"] })],
    };
    expect(() => validateAppState(state)).toThrow();
  });
});
