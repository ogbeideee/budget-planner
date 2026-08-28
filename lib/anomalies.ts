import { todayIso } from "./date";
import type { ID, Transaction } from "./types";

/**
 * Anomaly flagging (FR-25) — pure, deterministic, informational only.
 *
 * Given a candidate NEW entry, asks one question: is this amount far enough
 * above the category's recent average to be worth a soft "typo?" note? The
 * answer never blocks a save — the caller renders it inline and the user
 * dismisses and proceeds. Nothing here writes, warns or validates.
 *
 * Documented defaults (deliberate choices, not derivation errors):
 * - WINDOW: the last ANOMALY_WINDOW_MONTHS (6) months of EXPENSE entries in
 *   the category, up to and including today. Older entries say nothing about
 *   "your usual" current spending; future-dated entries are excluded so a
 *   pre-logged obligation can't normalize an outlier.
 * - MINIMUM: at least ANOMALY_MIN_PRIOR_ENTRIES (3) prior entries are needed
 *   before anything can be flagged. Insufficient data must never produce a
 *   false-positive nudge — a brand-new category flags nothing.
 * - THRESHOLD: the candidate must exceed the average by more than
 *   ANOMALY_RATIO_THRESHOLD (=2×). A strict "notably HIGHER" check on
 *   purpose: low amounts are normal life (a cheap month in a category is not
 *   a typo), while 10×'ing a rent payment absolutely is. Exactly 2× does not
 *   flag — the ratio must clear it.
 */

/** How many months back the average looks. */
export const ANOMALY_WINDOW_MONTHS = 6;
/** Prior entries required before a category has a meaningful average. */
export const ANOMALY_MIN_PRIOR_ENTRIES = 3;
/** The candidate must exceed the average by MORE than this ratio to flag. */
export const ANOMALY_RATIO_THRESHOLD = 2;

export interface AnomalyEntryInput {
  categoryId: ID;
  /** Minor units; only positive amounts are ever checked. */
  amount: number;
}

export interface AnomalyVerdict {
  flagged: boolean;
  /** Expense entries found for the category inside the window. */
  priorCount: number;
  /** Mean prior amount in minor units, or null with no usable priors. */
  averageAmount: number | null;
  /** candidate / average, rounded to 2dp; null when no average exists. */
  ratio: number | null;
}

export interface AnomalyOptions {
  /** Today as an ISO date; defaults to the real clock (tests pass one). */
  today?: string;
  windowMonths?: number;
  minPriorEntries?: number;
  ratioThreshold?: number;
}

/**
 * Inclusive window start for `today`: the same day-of-month `windowMonths`
 * months back, clamped into that month's length so "Mar 31 minus 6 months"
 * lands on Sep 30 rather than rolling over into October.
 */
function windowStartIso(today: string, windowMonths: number): string {
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const day = Number(today.slice(8, 10));
  const start = new Date(year, monthIndex - windowMonths, day);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

interface WindowStats {
  priorCount: number;
  sum: number;
}

function windowExpenses(
  transactions: Transaction[],
  categoryId: ID,
  today: string,
  windowMonths: number,
): WindowStats {
  const startIso = windowStartIso(today, windowMonths);
  let sum = 0;
  let priorCount = 0;
  for (const transaction of transactions) {
    if (transaction.categoryId !== categoryId) continue;
    if (transaction.type !== "expense") continue;
    // Future-dated entries are not history; older-than-window entries are
    // not "recent". Both ends inclusive where they meet today.
    if (transaction.date < startIso || transaction.date > today) continue;
    sum += transaction.amount;
    priorCount += 1;
  }
  return { priorCount, sum };
}

/**
 * Mean minor-unit amount of the category's expense entries dated within the
 * trailing window. Null when there are none.
 */
export function categoryRecentAverage(
  transactions: Transaction[],
  categoryId: ID,
  options: AnomalyOptions = {},
): number | null {
  const today = options.today ?? todayIso();
  const stats = windowExpenses(
    transactions,
    categoryId,
    today,
    options.windowMonths ?? ANOMALY_WINDOW_MONTHS,
  );
  return stats.priorCount === 0
    ? null
    : Math.round(stats.sum / stats.priorCount);
}

/**
 * Whether a candidate entry should get the soft anomaly note. The candidate
 * is NOT part of `transactions` yet (callers check before saving), so no
 * exclusion logic is needed here — pass exactly the history that exists.
 */
export function checkAnomaly(
  transactions: Transaction[],
  entry: AnomalyEntryInput,
  options: AnomalyOptions = {},
): AnomalyVerdict {
  const ratioThreshold = options.ratioThreshold ?? ANOMALY_RATIO_THRESHOLD;
  const minPriorEntries =
    options.minPriorEntries ?? ANOMALY_MIN_PRIOR_ENTRIES;

  if (!(entry.amount > 0)) {
    return { flagged: false, priorCount: 0, averageAmount: null, ratio: null };
  }

  const today = options.today ?? todayIso();
  const windowMonths = options.windowMonths ?? ANOMALY_WINDOW_MONTHS;
  const { priorCount, sum } = windowExpenses(
    transactions,
    entry.categoryId,
    today,
    windowMonths,
  );

  if (priorCount < minPriorEntries) {
    return { flagged: false, priorCount, averageAmount: null, ratio: null };
  }
  const averageAmount = Math.round(sum / priorCount);
  const ratio = Math.round((entry.amount / averageAmount) * 100) / 100;
  const flagged = entry.amount > averageAmount * ratioThreshold;
  return { flagged, priorCount, averageAmount, ratio };
}
