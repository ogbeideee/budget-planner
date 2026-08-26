import { describe, expect, it } from "vitest";
import {
  MAX_PAYOFF_MONTHS,
  comparePayoff,
  formatApr,
  formatPayoffDuration,
  monthlyInterest,
  payoffOrder,
  projectPayoff,
  type PayoffDebtInput,
} from "../debtPayoff";

/** Minor units: 100000 reads as $1,000.00. Rates are integer basis points. */
const debt = (
  id: string,
  balance: number,
  aprBps: number,
  minimumPayment: number,
): PayoffDebtInput => ({ id, balance, aprBps, minimumPayment });

describe("monthly interest", () => {
  it("is the annual rate split over twelve months", () => {
    // $1,000 at 12% APR -> 1% a month -> $10.00
    expect(monthlyInterest(100000, 1200)).toBe(1000);
  });

  it("is zero for an interest-free debt", () => {
    expect(monthlyInterest(500000, 0)).toBe(0);
  });

  it("is zero once a balance is cleared", () => {
    expect(monthlyInterest(0, 2400)).toBe(0);
  });
});

describe("a single debt", () => {
  const one = [debt("d1", 100000, 1200, 10000)];

  it("clears against a hand-checked schedule", () => {
    // $1,000 at 12% APR, $100/mo, no extra.
    // m1: +10.00 int -> 1010.00, pay 100 -> 910.00
    // m2: +9.10  -> 919.10, pay 100 -> 819.10
    // Runs 11 months and ends with a part payment.
    const plan = projectPayoff(one, 0, "avalanche");
    expect(plan.months).toBe(11);
    expect(plan.stalled).toBe(false);
    expect(plan.order).toHaveLength(1);
    expect(plan.order[0]).toMatchObject({ debtId: "d1", order: 1, clearedInMonth: 11 });
    // Principal is repaid exactly once, plus whatever interest accrued.
    expect(plan.totalPaid).toBe(100000 + plan.totalInterest);
  });

  it("clears faster and cheaper with extra applied", () => {
    const base = projectPayoff(one, 0, "avalanche");
    const boosted = projectPayoff(one, 20000, "avalanche");
    expect(boosted.months).toBeLessThan(base.months);
    expect(boosted.totalInterest).toBeLessThan(base.totalInterest);
  });

  it("reports mode 'single' so the UI skips a meaningless comparison", () => {
    const comparison = comparePayoff(one, 5000);
    expect(comparison.mode).toBe("single");
    // The two strategies are necessarily identical with one debt...
    expect(comparison.avalanche.months).toBe(comparison.snowball.months);
    expect(comparison.avalanche.totalInterest).toBe(comparison.snowball.totalInterest);
    // ...so there is nothing to recommend.
    expect(comparison.best).toBeNull();
    expect(comparison.interestSaved).toBe(0);
  });

  it("reports mode 'none' when nothing is owed", () => {
    expect(comparePayoff([], 5000).mode).toBe("none");
    expect(comparePayoff([debt("d1", 0, 1200, 10000)], 5000).mode).toBe("none");
  });
});

describe("different interest rates: avalanche targets the dearest", () => {
  // The dearest debt is also the LARGEST, which is what makes the two
  // strategies genuinely disagree: snowball defers exactly the debt avalanche
  // attacks first. (With equal balances the tie-break collapses snowball onto
  // avalanche's order — covered separately below.)
  const debts = [
    debt("cheap", 120000, 500, 4000),
    debt("dear", 400000, 2400, 9000),
    debt("mid", 250000, 1200, 6000),
  ];

  it("orders by rate, highest first", () => {
    expect(payoffOrder(debts, "avalanche").map((d) => d.id)).toEqual([
      "dear",
      "mid",
      "cheap",
    ]);
  });

  it("snowball takes the opposite order here, smallest balance first", () => {
    expect(payoffOrder(debts, "snowball").map((d) => d.id)).toEqual([
      "cheap",
      "mid",
      "dear",
    ]);
  });

  it("clears the dearest debt first in the simulation", () => {
    const plan = projectPayoff(debts, 30000, "avalanche");
    expect(plan.order[0].debtId).toBe("dear");
    const cleared = [...plan.order].sort(
      (a, b) => (a.clearedInMonth ?? 0) - (b.clearedInMonth ?? 0),
    );
    expect(cleared[0].debtId).toBe("dear");
  });

  it("costs less in total interest than snowball on the same inputs", () => {
    const comparison = comparePayoff(debts, 30000);
    expect(comparison.mode).toBe("compare");
    expect(comparison.avalanche.totalInterest).toBeLessThan(
      comparison.snowball.totalInterest,
    );
    expect(comparison.best).toBe("avalanche");
    expect(comparison.interestSaved).toBeGreaterThan(0);
  });
});

describe("different balances, equal interest: the strategies converge", () => {
  const debts = [
    debt("big", 500000, 1200, 10000),
    debt("small", 100000, 1200, 5000),
    debt("mid", 250000, 1200, 7500),
  ];

  it("snowball orders by balance, smallest first", () => {
    expect(payoffOrder(debts, "snowball").map((d) => d.id)).toEqual([
      "small",
      "mid",
      "big",
    ]);
  });

  it("avalanche falls back to the smaller balance when rates tie", () => {
    // With nothing to choose on rate, avalanche's tie-break makes it agree
    // with snowball — so both plans must come out identical.
    expect(payoffOrder(debts, "avalanche").map((d) => d.id)).toEqual([
      "small",
      "mid",
      "big",
    ]);
  });

  it("produces the same months and interest either way", () => {
    const comparison = comparePayoff(debts, 25000);
    expect(comparison.avalanche.months).toBe(comparison.snowball.months);
    expect(comparison.avalanche.totalInterest).toBe(
      comparison.snowball.totalInterest,
    );
    // Identical outcomes mean neither strategy is "best".
    expect(comparison.best).toBeNull();
    expect(comparison.interestSaved).toBe(0);
    expect(comparison.monthsDifference).toBe(0);
  });
});

describe("a 0%-interest debt mixed with interest-bearing ones", () => {
  // An interest-free family loan alongside two rate-bearing debts.
  const debts = [
    debt("family", 150000, 0, 5000),
    debt("card", 200000, 2400, 6000),
    debt("loan", 400000, 900, 10000),
  ];

  it("avalanche deprioritises it — there is no interest to front-load", () => {
    expect(payoffOrder(debts, "avalanche").map((d) => d.id)).toEqual([
      "card",
      "loan",
      "family",
    ]);
  });

  it("snowball still ranks it by balance size", () => {
    expect(payoffOrder(debts, "snowball").map((d) => d.id)).toEqual([
      "family",
      "card",
      "loan",
    ]);
  });

  it("never charges interest on the interest-free debt", () => {
    for (const strategy of ["avalanche", "snowball"] as const) {
      const plan = projectPayoff(debts, 20000, strategy);
      const family = plan.order.find((row) => row.debtId === "family")!;
      expect(family.interestPaid).toBe(0);
      // It is repaid exactly, with nothing added on top.
      expect(family.totalPaid).toBe(150000);
    }
  });

  it("still clears every debt under both strategies", () => {
    for (const strategy of ["avalanche", "snowball"] as const) {
      const plan = projectPayoff(debts, 20000, strategy);
      expect(plan.stalled).toBe(false);
      expect(plan.order.every((row) => row.clearedInMonth !== null)).toBe(true);
    }
  });

  it("makes avalanche the cheaper plan here", () => {
    const comparison = comparePayoff(debts, 20000);
    expect(comparison.best).toBe("avalanche");
    expect(comparison.avalanche.totalInterest).toBeLessThan(
      comparison.snowball.totalInterest,
    );
  });
});

describe("when the extra payment is too small to make quick progress", () => {
  // Minimums barely clear the interest; the extra is a rounding error next to
  // the balances. This must still produce a real projection, just a long one.
  const debts = [
    debt("card", 1000000, 2400, 21000),
    debt("loan", 800000, 1800, 13000),
  ];

  it("still calculates a finite payoff, just a long one", () => {
    const plan = projectPayoff(debts, 100, "avalanche");
    expect(plan.stalled).toBe(false);
    expect(plan.months).toBeGreaterThan(24);
    expect(plan.months).toBeLessThan(MAX_PAYOFF_MONTHS);
    expect(plan.order.every((row) => row.clearedInMonth !== null)).toBe(true);
  });

  it("takes longer and costs more than a healthy extra payment", () => {
    const thin = projectPayoff(debts, 100, "avalanche");
    const healthy = projectPayoff(debts, 50000, "avalanche");
    expect(thin.months).toBeGreaterThan(healthy.months);
    expect(thin.totalInterest).toBeGreaterThan(healthy.totalInterest);
  });

  it("still ranks the strategies correctly on a thin budget", () => {
    const comparison = comparePayoff(debts, 100);
    expect(comparison.mode).toBe("compare");
    expect(comparison.avalanche.totalInterest).toBeLessThanOrEqual(
      comparison.snowball.totalInterest,
    );
  });

  it("says so plainly when payments cannot outrun the interest", () => {
    // A minimum well below the monthly interest, and no extra: this never
    // clears, and reporting a fake date would be worse than saying so.
    const hopeless = [debt("card", 1000000, 3600, 100)];
    const plan = projectPayoff(hopeless, 0, "avalanche");
    expect(plan.stalled).toBe(true);
    expect(plan.months).toBe(MAX_PAYOFF_MONTHS);
    expect(formatPayoffDuration(plan.months, plan.stalled)).toBe(
      "Not on this budget",
    );
  });
});

describe("payment mechanics", () => {
  it("holds the monthly outlay constant, rolling freed minimums onward", () => {
    const debts = [debt("a", 50000, 1200, 5000), debt("b", 300000, 1200, 10000)];
    const plan = projectPayoff(debts, 5000, "snowball");
    // sum(minimums) + extra
    expect(plan.monthlyBudget).toBe(5000 + 10000 + 5000);
  });

  it("never overpays a debt or drives a balance negative", () => {
    const debts = [debt("a", 12345, 700, 99999), debt("b", 250000, 1500, 8000)];
    const plan = projectPayoff(debts, 100000, "avalanche");
    const a = plan.order.find((row) => row.debtId === "a")!;
    // Paid its balance plus at most one month of interest — never more.
    expect(a.totalPaid).toBeLessThanOrEqual(12345 + monthlyInterest(12345, 700));
    expect(plan.order.every((row) => row.totalPaid >= 0)).toBe(true);
  });

  it("accounts for every cent: principal + interest equals what was paid", () => {
    const debts = [
      debt("a", 175000, 1450, 6000),
      debt("b", 96000, 0, 4000),
      debt("c", 420000, 2100, 12000),
    ];
    const principal = debts.reduce((sum, d) => sum + d.balance, 0);
    for (const strategy of ["avalanche", "snowball"] as const) {
      const plan = projectPayoff(debts, 15000, strategy);
      expect(plan.totalPaid).toBe(principal + plan.totalInterest);
    }
  });

  it("is deterministic — identical inputs give an identical schedule", () => {
    const debts = [debt("a", 175000, 1450, 6000), debt("b", 96000, 300, 4000)];
    expect(projectPayoff(debts, 9000, "avalanche")).toEqual(
      projectPayoff(debts, 9000, "avalanche"),
    );
  });

  it("ignores debts that are already cleared", () => {
    const debts = [debt("done", 0, 2400, 5000), debt("open", 100000, 1200, 10000)];
    const plan = projectPayoff(debts, 0, "avalanche");
    expect(plan.order).toHaveLength(1);
    expect(plan.order[0].debtId).toBe("open");
    // The cleared debt's minimum is not counted into the budget either.
    expect(plan.monthlyBudget).toBe(10000);
  });
});

describe("formatting helpers", () => {
  it("renders durations in years and months", () => {
    expect(formatPayoffDuration(7)).toBe("7 mo");
    expect(formatPayoffDuration(12)).toBe("1 yr");
    expect(formatPayoffDuration(16)).toBe("1 yr 4 mo");
    expect(formatPayoffDuration(0)).toBe("Already clear");
  });

  it("renders rates from basis points", () => {
    expect(formatApr(0)).toBe("0%");
    expect(formatApr(1200)).toBe("12%");
    expect(formatApr(1250)).toBe("12.5%");
  });
});
