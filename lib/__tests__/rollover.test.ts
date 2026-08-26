import { describe, expect, it } from "vitest";
import {
  ROLLOVER_CAP_MULTIPLIER,
  computeRollovers,
  leftoverAtMonthEnd,
  rolloverCap,
} from "../rollover";
import { budgetProgress, effectiveLimit } from "../selectors";
import type {
  Budget,
  Category,
  RolloverRecord,
  Transaction,
} from "../types";

const JAN = "2026-01";
const FEB = "2026-02";
const MAR = "2026-03";
const APR = "2026-04";

/** Amounts are minor units throughout the app; 1000_00 reads as $1,000. */
const LIMIT = 100000;

function category(id: string, rollover: boolean): Category {
  return {
    id,
    name: id,
    icon: "🛒",
    color: "#f97316",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(rollover ? { rollover: true } : {}),
  };
}

function budget(categoryId: string, month: string, limit = LIMIT): Budget {
  return { id: `b-${categoryId}-${month}`, categoryId, month, limit, priority: "medium" };
}

function expense(categoryId: string, month: string, amount: number): Transaction {
  return {
    id: `t-${categoryId}-${month}-${amount}`,
    categoryId,
    amount,
    type: "expense",
    date: `${month}-10`,
    createdAt: "2026-01-10T00:00:00.000Z",
  };
}

/** One category, budgeted every month in `months`, spending `spend[month]`. */
function scenario(rollover: boolean, months: string[], spend: Record<string, number>) {
  return {
    categories: [category("c1", rollover)],
    budgets: months.map((month) => budget("c1", month)),
    transactions: Object.entries(spend)
      .filter(([, amount]) => amount > 0)
      .map(([month, amount]) => expense("c1", month, amount)),
  };
}

describe("rollover enabled and underspent", () => {
  it("carries the unspent balance into the next month", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: 40000,
    });

    const created = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
      now: "2026-02-01T00:00:00.000Z",
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      categoryId: "c1",
      month: FEB,
      fromMonth: JAN,
      amount: 60000,
      leftover: 60000,
    });
  });

  it("raises February's spendable limit by exactly that much", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: 40000,
    });
    const rollovers = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });

    const feb = budgets.find((b) => b.month === FEB)!;
    expect(effectiveLimit(feb, rollovers)).toBe(LIMIT + 60000);

    const progress = budgetProgress(feb, transactions, rollovers);
    expect(progress.baseLimit).toBe(LIMIT);
    expect(progress.rolledOver).toBe(60000);
    expect(progress.limit).toBe(160000);
  });
});

describe("rollover enabled and overspent", () => {
  it("carries nothing, and never a negative balance", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: LIMIT + 55000, // blew through the limit
    });

    const created = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });

    expect(created).toHaveLength(1);
    expect(created[0].amount).toBe(0);
    expect(created[0].leftover).toBe(0);
  });

  it("leaves February starting at its full base limit", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: LIMIT * 3,
    });
    const rollovers = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });

    const feb = budgets.find((b) => b.month === FEB)!;
    // The overspend does NOT compound into a shrunken February.
    expect(effectiveLimit(feb, rollovers)).toBe(LIMIT);
    expect(leftoverAtMonthEnd(feb, transactions, rollovers)).toBe(LIMIT);
  });
});

describe("rollover disabled", () => {
  it("carries nothing however much went unspent", () => {
    const { categories, budgets, transactions } = scenario(false, [JAN, FEB], {
      [JAN]: 10000, // 90,000 unspent, and none of it should move
    });

    const created = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });

    expect(created).toHaveLength(1);
    expect(created[0].amount).toBe(0);
  });

  it("is byte-identical to pre-rollover behaviour at every read site", () => {
    const { budgets, transactions } = scenario(false, [JAN, FEB], { [JAN]: 10000 });
    const feb = budgets.find((b) => b.month === FEB)!;

    // Same result whether the read is given records or not.
    const withRecords = budgetProgress(feb, transactions, []);
    const withoutRecords = budgetProgress(feb, transactions);
    expect(withRecords).toEqual(withoutRecords);
    expect(withoutRecords.limit).toBe(feb.limit);
    expect(withoutRecords.rolledOver).toBe(0);
    expect(effectiveLimit(feb)).toBe(feb.limit);
  });
});

describe("the accumulation cap", () => {
  it("caps a carryover at one extra month's limit", () => {
    // Nothing spent in January, so the raw leftover is a full limit...
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {});
    const created = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });

    expect(created[0].leftover).toBe(LIMIT);
    expect(created[0].amount).toBe(LIMIT * ROLLOVER_CAP_MULTIPLIER);
    expect(created[0].cap).toBe(LIMIT);
  });

  it("measures the cap against the destination month's base limit", () => {
    const categories = [category("c1", true)];
    // February's limit was raised to 200,000 — the cap follows it.
    const budgets = [budget("c1", JAN, LIMIT), budget("c1", FEB, 200000)];
    expect(rolloverCap(LIMIT, 200000)).toBe(200000);

    const created = computeRollovers({
      budgets,
      categories,
      transactions: [],
      rollovers: [],
      month: FEB,
    });
    // January only ever had 100,000 to leave behind, so the cap is not binding.
    expect(created[0].cap).toBe(200000);
    expect(created[0].amount).toBe(LIMIT);
  });

  it("falls back to the closing month's limit when the new month has no budget", () => {
    expect(rolloverCap(LIMIT, null)).toBe(LIMIT);
  });

  it("records the cap that was in force, so history stays explainable", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {});
    const [record] = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });
    expect(record.cap).toBe(LIMIT);
    // Capped: leftover exceeded what was allowed through.
    expect(record.leftover).toBeGreaterThanOrEqual(record.amount);
  });
});

describe("three consecutive months", () => {
  /** Runs the month transition for each month in turn, accumulating records. */
  function runMonths(
    categories: Category[],
    budgets: Budget[],
    transactions: Transaction[],
    months: string[],
  ): RolloverRecord[] {
    let rollovers: RolloverRecord[] = [];
    for (const month of months) {
      rollovers = [
        ...rollovers,
        ...computeRollovers({ budgets, categories, transactions, rollovers, month }),
      ];
    }
    return rollovers;
  }

  it("compounds unspent funds month over month, then holds at the cap", () => {
    // Spends a quarter of the base limit each month, so each month leaves more
    // behind than the last until the cap bites.
    const { categories, budgets, transactions } = scenario(
      true,
      [JAN, FEB, MAR, APR],
      { [JAN]: 25000, [FEB]: 25000, [MAR]: 25000 },
    );

    const rollovers = runMonths(categories, budgets, transactions, [FEB, MAR, APR]);
    const amountFor = (month: string) =>
      rollovers.find((r) => r.month === month)!.amount;

    // Jan left 75,000 of its 100,000.
    expect(amountFor(FEB)).toBe(75000);
    // Feb had 175,000 spendable, spent 25,000 -> 150,000 left, capped to 100,000.
    expect(amountFor(MAR)).toBe(LIMIT);
    // Mar had 200,000 spendable, spent 25,000 -> 175,000 left, capped again.
    expect(amountFor(APR)).toBe(LIMIT);

    // The effective limit therefore plateaus at 2x base and never runs away.
    for (const month of [MAR, APR]) {
      const b = budgets.find((entry) => entry.month === month)!;
      expect(effectiveLimit(b, rollovers)).toBe(LIMIT * 2);
    }
  });

  it("carries a genuinely untouched category straight to the plateau", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB, MAR], {});
    const rollovers = runMonths(categories, budgets, transactions, [FEB, MAR]);

    for (const month of [FEB, MAR]) {
      expect(rollovers.find((r) => r.month === month)!.amount).toBe(LIMIT);
    }
  });

  it("resets to the base limit after an overspent month mid-chain", () => {
    const { categories, budgets, transactions } = scenario(
      true,
      [JAN, FEB, MAR],
      { [JAN]: 25000, [FEB]: 400000 },
    );
    const rollovers = runMonths(categories, budgets, transactions, [FEB, MAR]);

    expect(rollovers.find((r) => r.month === FEB)!.amount).toBe(75000);
    // February blew past even its boosted limit, so March starts clean.
    expect(rollovers.find((r) => r.month === MAR)!.amount).toBe(0);
    const mar = budgets.find((b) => b.month === MAR)!;
    expect(effectiveLimit(mar, rollovers)).toBe(LIMIT);
  });
});

describe("running the transition more than once", () => {
  it("is idempotent — a settled month is never recomputed", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: 40000,
    });
    const input = { budgets, categories, transactions, month: FEB };

    const first = computeRollovers({ ...input, rollovers: [] });
    const second = computeRollovers({ ...input, rollovers: first });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it("does not revise a settled month after its source data is edited", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {
      [JAN]: 40000,
    });
    const settled = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });
    expect(settled[0].amount).toBe(60000);

    // The user goes back and adds a forgotten January expense.
    const edited = [...transactions, expense("c1", JAN, 50000)];
    const rerun = computeRollovers({
      budgets,
      categories,
      transactions: edited,
      rollovers: settled,
      month: FEB,
    });

    // Known limitation, asserted deliberately: the applied carryover stands.
    expect(rerun).toHaveLength(0);
    expect(settled[0].amount).toBe(60000);
  });

  it("does not grant funds retroactively when the switch is flipped mid-month", () => {
    const { categories, budgets, transactions } = scenario(false, [JAN, FEB], {
      [JAN]: 40000,
    });
    // February opens while the category is still opted out: sealed at zero.
    const sealed = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });
    expect(sealed[0].amount).toBe(0);

    // Now the user turns rollover on, part-way through February.
    const optedIn = [category("c1", true)];
    const rerun = computeRollovers({
      budgets,
      categories: optedIn,
      transactions,
      rollovers: sealed,
      month: FEB,
    });

    // February is already under way and does not change; the switch applies
    // from the next month end.
    expect(rerun).toHaveLength(0);
    const feb = budgets.find((b) => b.month === FEB)!;
    expect(effectiveLimit(feb, sealed)).toBe(LIMIT);
  });
});

describe("historical accuracy", () => {
  it("keeps a past month's limit fixed when the cap default later changes", () => {
    const { categories, budgets, transactions } = scenario(true, [JAN, FEB], {});
    const rollovers = computeRollovers({
      budgets,
      categories,
      transactions,
      rollovers: [],
      month: FEB,
    });
    const feb = budgets.find((b) => b.month === FEB)!;
    const asItWas = effectiveLimit(feb, rollovers);

    // `effectiveLimit` reads the stored record only — it calls neither
    // `rolloverCap` nor `ROLLOVER_CAP_MULTIPLIER` — so a future change to the
    // default cannot reach back into this month.
    expect(effectiveLimit(feb, rollovers)).toBe(asItWas);
    expect(rollovers[0].cap).toBe(LIMIT);
  });

  it("skips categories that had no budget in the closing month", () => {
    const categories = [category("c1", true)];
    // Budgeted for the first time in February.
    const budgets = [budget("c1", FEB)];
    const created = computeRollovers({
      budgets,
      categories,
      transactions: [],
      rollovers: [],
      month: FEB,
    });
    expect(created).toHaveLength(0);
  });
});
