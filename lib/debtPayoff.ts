import type { ID } from "./types";

/**
 * Debt payoff projection — pure, deterministic amortization.
 *
 * NO AI/LLM involvement and no network calls: every number here comes from
 * standard monthly amortization arithmetic, so a projection costs nothing to
 * produce, is identical on every machine, and can be unit tested against
 * hand-computed schedules. See ARCHITECTURE.md for where a narration layer
 * could sit later WITHOUT touching this engine.
 */

export type PayoffStrategy = "avalanche" | "snowball";

export const PAYOFF_STRATEGIES: ReadonlyArray<{
  value: PayoffStrategy;
  label: string;
  blurb: string;
}> = [
  {
    value: "avalanche",
    label: "Avalanche",
    blurb: "Clears the highest interest rate first — costs the least overall.",
  },
  {
    value: "snowball",
    label: "Snowball",
    blurb: "Clears the smallest balance first — quickest visible wins.",
  },
];

/**
 * Hard stop for the simulation, in months (50 years). A plan that has not
 * cleared by then is reported as `stalled` rather than looped forever: that
 * happens when the monthly budget cannot even cover accruing interest, which
 * is a real answer the user needs, not an error.
 */
export const MAX_PAYOFF_MONTHS = 600;

/** Basis points per whole percent — rates are stored as integer bps. */
export const BPS_PER_PERCENT = 100;

/** The engine's view of one debt. Storage shape is `Debt` in types.ts. */
export interface PayoffDebtInput {
  id: ID;
  /** Outstanding balance in minor units, >= 0. */
  balance: number;
  /** Annual rate in basis points (integer). 0 means interest-free. */
  aprBps: number;
  /** Contractual minimum monthly payment in minor units, >= 0. */
  minimumPayment: number;
}

export interface PayoffMilestone {
  debtId: ID;
  /** 1-based position in the payoff sequence. */
  order: number;
  /** Month index (1-based) this debt hits zero; null if it never does. */
  clearedInMonth: number | null;
  /** Interest this debt accrued before it cleared. */
  interestPaid: number;
  /** Total paid into this debt (principal + interest). */
  totalPaid: number;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  /** Months until every debt reaches zero. `MAX_PAYOFF_MONTHS` when stalled. */
  months: number;
  totalInterest: number;
  totalPaid: number;
  /** Payoff sequence, in the order debts are targeted. */
  order: PayoffMilestone[];
  /**
   * True when the monthly budget could not clear the debts within the
   * horizon — i.e. payments are not outrunning interest. The other figures
   * then describe the horizon, not a real payoff date.
   */
  stalled: boolean;
  /** Sum of minimum payments plus the extra — the constant monthly outlay. */
  monthlyBudget: number;
}

/** Monthly interest accrued on `balance` at `aprBps`, rounded to minor units. */
export function monthlyInterest(balance: number, aprBps: number): number {
  if (balance <= 0 || aprBps <= 0) return 0;
  return Math.round((balance * aprBps) / (BPS_PER_PERCENT * 100 * 12));
}

/**
 * The order debts are attacked in.
 *
 * Avalanche targets the highest rate first, which is what minimises total
 * interest. Snowball targets the smallest balance first, which clears
 * individual debts soonest.
 *
 * Tie-breaks are deliberate and total, so the same input always produces the
 * same schedule: avalanche falls back to the smaller balance then the id,
 * snowball to the higher rate then the id. A 0%-interest debt therefore sinks
 * to the bottom under avalanche (no interest to save by front-loading it) but
 * keeps its balance-based position under snowball — both correct.
 */
export function payoffOrder(
  debts: PayoffDebtInput[],
  strategy: PayoffStrategy,
): PayoffDebtInput[] {
  const sorted = [...debts];
  sorted.sort((a, b) => {
    if (strategy === "avalanche") {
      if (a.aprBps !== b.aprBps) return b.aprBps - a.aprBps;
      if (a.balance !== b.balance) return a.balance - b.balance;
    } else {
      if (a.balance !== b.balance) return a.balance - b.balance;
      if (a.aprBps !== b.aprBps) return b.aprBps - a.aprBps;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted;
}

/**
 * Simulate paying `debts` off with `extraPerMonth` on top of the minimums.
 *
 * Model, applied once per month in this order:
 *   1. interest accrues on every outstanding debt;
 *   2. every outstanding debt receives its minimum payment;
 *   3. whatever is left of the monthly budget cascades down the payoff order,
 *      so the target debt absorbs the extra and any surplus rolls straight
 *      into the next debt in the same month.
 *
 * The monthly budget is held constant at `sum(minimums) + extra` for the whole
 * run. That is what produces the standard "snowball" effect in BOTH
 * strategies: when a debt clears, the minimum it used to consume is not
 * saved, it rolls onto the next debt.
 */
export function projectPayoff(
  debts: PayoffDebtInput[],
  extraPerMonth: number,
  strategy: PayoffStrategy,
): PayoffPlan {
  const active = debts.filter((debt) => debt.balance > 0);
  const monthlyBudget =
    active.reduce((sum, debt) => sum + Math.max(0, debt.minimumPayment), 0) +
    Math.max(0, extraPerMonth);

  const sequence = payoffOrder(active, strategy);
  const state = sequence.map((debt) => ({
    debt,
    balance: debt.balance,
    interestPaid: 0,
    totalPaid: 0,
    clearedInMonth: null as number | null,
  }));

  const empty: PayoffPlan = {
    strategy,
    months: 0,
    totalInterest: 0,
    totalPaid: 0,
    order: [],
    stalled: false,
    monthlyBudget: 0,
  };
  if (state.length === 0) return empty;

  let month = 0;
  let stalled = false;

  while (state.some((row) => row.balance > 0)) {
    if (month >= MAX_PAYOFF_MONTHS) {
      stalled = true;
      break;
    }
    month += 1;
    const before = state.reduce((sum, row) => sum + row.balance, 0);

    // 1. Interest accrues on everything still outstanding.
    for (const row of state) {
      if (row.balance <= 0) continue;
      const interest = monthlyInterest(row.balance, row.debt.aprBps);
      row.balance += interest;
      row.interestPaid += interest;
    }

    // 2. Minimums on every outstanding debt, never more than is owed.
    let pool = monthlyBudget;
    for (const row of state) {
      if (row.balance <= 0 || pool <= 0) continue;
      const pay = Math.min(row.debt.minimumPayment, row.balance, pool);
      if (pay <= 0) continue;
      row.balance -= pay;
      row.totalPaid += pay;
      pool -= pay;
      if (row.balance === 0 && row.clearedInMonth === null) {
        row.clearedInMonth = month;
      }
    }

    // 3. Everything left cascades down the payoff order.
    for (const row of state) {
      if (pool <= 0) break;
      if (row.balance <= 0) continue;
      const pay = Math.min(row.balance, pool);
      row.balance -= pay;
      row.totalPaid += pay;
      pool -= pay;
      if (row.balance === 0 && row.clearedInMonth === null) {
        row.clearedInMonth = month;
      }
    }

    // Nothing moved and nothing cleared: interest is outrunning the budget,
    // so no number of further months would finish. Stop and say so.
    const after = state.reduce((sum, row) => sum + row.balance, 0);
    if (after >= before && !state.some((row) => row.clearedInMonth === month)) {
      stalled = true;
      break;
    }
  }

  return {
    strategy,
    months: stalled ? MAX_PAYOFF_MONTHS : month,
    totalInterest: state.reduce((sum, row) => sum + row.interestPaid, 0),
    totalPaid: state.reduce((sum, row) => sum + row.totalPaid, 0),
    order: state.map((row, index) => ({
      debtId: row.debt.id,
      order: index + 1,
      clearedInMonth: row.clearedInMonth,
      interestPaid: row.interestPaid,
      totalPaid: row.totalPaid,
    })),
    stalled,
    monthlyBudget,
  };
}

export interface PayoffComparison {
  /**
   * "compare" once there are 2+ debts. With 0 or 1 debt the two strategies are
   * necessarily identical — there is no ordering decision to make — so the UI
   * shows ONE projection rather than two columns of the same numbers.
   */
  mode: "none" | "single" | "compare";
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
  /** The cheaper plan, or null when there is nothing to choose between. */
  best: PayoffStrategy | null;
  /** Interest avalanche saves over snowball; 0 when they tie. */
  interestSaved: number;
  /** Months snowball takes beyond avalanche; may be negative or 0. */
  monthsDifference: number;
}

/** Runs both strategies over the same inputs and reports how they differ. */
export function comparePayoff(
  debts: PayoffDebtInput[],
  extraPerMonth: number,
): PayoffComparison {
  const active = debts.filter((debt) => debt.balance > 0);
  const avalanche = projectPayoff(active, extraPerMonth, "avalanche");
  const snowball = projectPayoff(active, extraPerMonth, "snowball");
  const mode =
    active.length === 0 ? "none" : active.length === 1 ? "single" : "compare";
  return {
    mode,
    avalanche,
    snowball,
    best:
      mode !== "compare" || avalanche.totalInterest === snowball.totalInterest
        ? null
        : avalanche.totalInterest < snowball.totalInterest
          ? "avalanche"
          : "snowball",
    interestSaved: Math.abs(avalanche.totalInterest - snowball.totalInterest),
    monthsDifference: snowball.months - avalanche.months,
  };
}

/** "1 yr 4 mo" / "7 mo" / "Not on this budget" for a month count. */
export function formatPayoffDuration(months: number, stalled = false): string {
  if (stalled) return "Not on this budget";
  if (months <= 0) return "Already clear";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  if (rest === 0) return `${years} yr`;
  return `${years} yr ${rest} mo`;
}

/** "12.5%" for 1250 bps; trims a trailing ".0". */
export function formatApr(aprBps: number): string {
  const percent = aprBps / BPS_PER_PERCENT;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, "")}%`;
}
