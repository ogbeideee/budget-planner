import { monthOffset } from "./date";
import { effectiveLimit, findRollover, spent } from "./selectors";
import type {
  Budget,
  Category,
  Month,
  RolloverRecord,
  Transaction,
} from "./types";

/**
 * Computing carryover. The read side — `effectiveLimit`, `rolledOverInto`,
 * `findRollover`, `budgetProgress` — lives in `selectors.ts`; this module only
 * ever imports from there, never the other way round.
 */

/**
 * Accumulated rollover is capped at this multiple of the destination month's
 * base limit, so a category's effective limit never exceeds (1 + this) x base
 * — currently 2x. Without a cap, a category that is underspent every month
 * grows a limit so far above real spending that it stops meaning anything.
 *
 * Deliberately a fixed constant rather than a user setting for now: it needs
 * no migration and no UI, and every computed carryover persists the cap that
 * was in force when it ran (`RolloverRecord.cap`), so exposing or raising this
 * later cannot silently rewrite past months.
 */
export const ROLLOVER_CAP_MULTIPLIER = 1;

/**
 * The cap on how much may carry into a month for one category.
 *
 * Basis is the destination month's base limit when a budget exists there —
 * that is the number the row shows the carryover added on top of, so it is
 * what "never more than your monthly limit again" should be measured against.
 * When the destination month has no budget yet, the closing month's base limit
 * stands in so the record is still computable.
 */
export function rolloverCap(
  sourceLimit: number,
  destinationLimit: number | null,
): number {
  const basis = destinationLimit ?? sourceLimit;
  return Math.max(0, Math.round(basis * ROLLOVER_CAP_MULTIPLIER));
}

/**
 * Unspent funds at the close of `budget.month`, measured against that month's
 * EFFECTIVE limit so carried funds that went unspent carry again — this is
 * what makes rollover compound. Never negative: an overspent month carries
 * nothing rather than shrinking the next month.
 */
export function leftoverAtMonthEnd(
  budget: Budget,
  transactions: Transaction[],
  rollovers: RolloverRecord[] = [],
): number {
  const limit = effectiveLimit(budget, rollovers);
  return Math.max(0, limit - spent(transactions, budget.categoryId, budget.month));
}

export interface RolloverInput {
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  rollovers: RolloverRecord[];
  /** The month being entered — carryover is computed from the month before. */
  month: Month;
  /** Injectable for tests; defaults to now. */
  now?: string;
}

/**
 * Close out the month before `month` and produce the carryover records for
 * every category that held a budget then.
 *
 * Idempotent by (categoryId, month): a category that already has a record for
 * `month` is skipped entirely, so running this again — on every app open, or
 * after the user edits an earlier month — never rewrites a settled month.
 *
 * A record is written even when nothing carries (overspent, or rollover
 * switched off). Sealing the transition that way is what stops a toggle
 * flipped mid-month from retroactively granting funds for a month already
 * under way; the switch takes effect at the NEXT month end, which is what
 * "evaluated once per category at the transition" means.
 */
export function computeRollovers({
  budgets,
  categories,
  transactions,
  rollovers,
  month,
  now = new Date().toISOString(),
}: RolloverInput): RolloverRecord[] {
  const fromMonth = monthOffset(month, -1);
  const enabled = new Set(
    categories.filter((category) => category.rollover === true).map((c) => c.id),
  );
  const created: RolloverRecord[] = [];

  for (const budget of budgets) {
    if (budget.month !== fromMonth) continue;
    if (findRollover(rollovers, budget.categoryId, month)) continue;

    const destination = budgets.find(
      (b) => b.categoryId === budget.categoryId && b.month === month,
    );
    const cap = rolloverCap(budget.limit, destination ? destination.limit : null);
    // Measured against the records as they stood before this run, so the
    // order budgets happen to be iterated in cannot change the result.
    const leftover = enabled.has(budget.categoryId)
      ? leftoverAtMonthEnd(budget, transactions, rollovers)
      : 0;

    created.push({
      // Deterministic, so a double-run cannot create two records for the same
      // category and month even if the guard above were ever bypassed.
      id: `ro_${budget.categoryId}_${month}`,
      categoryId: budget.categoryId,
      month,
      fromMonth,
      amount: Math.min(leftover, cap),
      leftover,
      cap,
      computedAt: now,
    });
  }

  return created;
}
