import { daysBetween } from "./date";
import type { ID, SavingsPlan, Transaction } from "./types";

/**
 * Savings-plan progress (FR-28) — pure, deterministic arithmetic.
 *
 * Like `lib/debtPayoff.ts`: no React, no store, no I/O. Every number comes
 * from summing the tagged ledger rows, so a projection costs nothing, is
 * byte-identical on every machine, and the same plan shows the same progress
 * everywhere it is rendered.
 */

/** Average days per month (365.25 / 12) — used ONLY to convert the calendar
 *  distance to a deadline into a monthly pace, never to move money. */
const DAYS_PER_MONTH = 30.4375;

/** All ledger rows tagged as contributions to one plan, oldest last. */
export function contributionsForPlan(
  transactions: Transaction[],
  planId: ID,
): Transaction[] {
  return transactions
    .filter((transaction) => transaction.savingsPlanId === planId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Total contributed out of the ledger for one plan (excludes the starting
 *  balance, which is display data, not ledger rows). */
export function contributedForPlan(
  transactions: Transaction[],
  plan: SavingsPlan,
): number {
  return contributionsForPlan(transactions, plan.id).reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
}

export interface SavingsPlanProgress {
  /** Everything held toward the target: starting balance + contributions. */
  saved: number;
  /** Ledger contributions only. */
  contributed: number;
  target: number;
  /** How much is still needed; 0 once the target is reached. */
  remaining: number;
  /** Percent of target reached, rounded — may exceed 100 when a plan is kept
   *  open past its target. Compare `complete`, never `pct >= 100`. */
  pct: number;
  /** True when the target is reached (`saved >= target` for a positive
   *  target). A target of 0 is never "complete" — nothing was asked for. */
  complete: boolean;
}

export function planProgress(
  plan: SavingsPlan,
  transactions: Transaction[],
): SavingsPlanProgress {
  const contributed = contributedForPlan(transactions, plan);
  const saved = plan.startingBalance + contributed;
  const remaining = Math.max(0, plan.targetAmount - saved);
  return {
    saved,
    contributed,
    target: plan.targetAmount,
    remaining,
    pct:
      plan.targetAmount > 0
        ? Math.round((100 * saved) / plan.targetAmount)
        : 0,
    complete: plan.targetAmount > 0 && saved >= plan.targetAmount,
  };
}

export type SavingsPaceStatus = "on-track" | "behind" | "complete";

export interface SavingsPace {
  status: SavingsPaceStatus;
  /** Average actually contributed per month since the plan was created.
   *  A plan younger than a month is judged on one month's pace. */
  currentPerMonth: number;
  /** Months of calendar time left before the target date. */
  monthsRemaining: number;
  /** What must be contributed per month to reach the target by its date.
   *  Null only for a complete plan — nothing more is required. */
  requiredPerMonth: number | null;
}

/**
 * Pace check against an optional target date. Returns null when the plan has
 * NO target date — there is no deadline to be on or behind, and the UI must
 * render plain progress instead of a schedule verdict.
 *
 * `today` is a parameter, not `new Date()`: the engine stays deterministic
 * and testable, and callers pass the real clock.
 */
export function savingsPace(
  plan: SavingsPlan,
  transactions: Transaction[],
  today: string,
): SavingsPace | null {
  if (!plan.targetDate) return null;
  const progress = planProgress(plan, transactions);
  const currentPerMonth = averageMonthlyPace(plan, transactions, today);
  if (progress.complete) {
    return {
      status: "complete",
      currentPerMonth,
      monthsRemaining: Math.max(0, daysBetween(today, plan.targetDate) / DAYS_PER_MONTH),
      requiredPerMonth: null,
    };
  }
  const monthsRemaining = daysBetween(today, plan.targetDate) / DAYS_PER_MONTH;
  if (monthsRemaining <= 0) {
    // The deadline has passed with the target unmet: everything still missing
    // is due now, and the plan is behind however much has been going in.
    return {
      status: "behind",
      currentPerMonth,
      monthsRemaining: 0,
      requiredPerMonth: progress.remaining,
    };
  }
  const requiredPerMonth = progress.remaining / monthsRemaining;
  return {
    status: currentPerMonth >= requiredPerMonth ? "on-track" : "behind",
    currentPerMonth,
    monthsRemaining,
    requiredPerMonth,
  };
}

function averageMonthlyPace(
  plan: SavingsPlan,
  transactions: Transaction[],
  today: string,
): number {
  // `createdAt` is a full timestamp; the calendar distance only needs its
  // date part.
  const createdDate = plan.createdAt.slice(0, 10);
  const elapsedDays = Math.max(0, daysBetween(createdDate, today));
  // A plan younger than a month is judged on one month's pace — dividing by
  // two days would call a first contribution a huge run rate.
  const elapsedMonths = Math.max(1, elapsedDays / DAYS_PER_MONTH);
  return contributedForPlan(transactions, plan) / elapsedMonths;
}
