import { daysBetween, isoToDate, dateToIso, nextMonthDate } from "./date";
import type { CategoryKind, ID, Transaction } from "./types";

/**
 * Recurring-pattern detection (FR-25) — pure, deterministic, no AI/network.
 *
 * Everything here is DERIVED from the ledger on every read and persisted
 * nowhere (same asymmetry as the streak in lib/streak.ts): a pattern must
 * follow edits to past months instead of freezing at whatever was detected
 * first. Because there is nothing stored, there is also nothing to migrate,
 * export or validate — dropping this feature would touch no schema.
 *
 * Detection contract (documented for tests and callers):
 * - Transactions are grouped by category; a pattern is a contiguous run of
 *   occurrences whose consecutive day-gaps all classify as ONE cadence
 *   (weekly / biweekly / monthly / yearly) and stay within tolerance of the
 *   run's median gap. The interval is DETECTED, never assumed monthly.
 * - A run needs at least MIN_OCCURRENCES (=3) entries before it counts: two
 *   occurrences is a coincidence, not a pattern.
 * - Amounts must chain within AMOUNT_TOLERANCE (±10%) step-to-step — each
 *   occurrence against the PREVIOUS one, not the first. That lets a price
 *   drift slowly (₦10,000 → ₦10,500 → ₦11,000) without dissolving the
 *   pattern; a single huge jump breaks the run and the newer run wins the
 *   tie-break, which is how a subscription price increase takes over.
 * - The expected amount is a recency-weighted mean over the winning run, so
 *   it keeps moving toward what the user actually paid lately instead of
 *   staying locked to the first-detected amount forever.
 *
 * Known limitation (deliberate v1 scope): at most one pattern per
 * (category, cadence) is returned. Two same-cadence subscriptions that share
 * one category cannot be separated by this detector; splitting them needs
 * merchant/note clustering, which is out of scope here.
 */

/** How far an occurrence's amount may sit from the previous one (relative). */
export const AMOUNT_TOLERANCE = 0.1;
/** Occurrences required before a run qualifies as an established pattern. */
export const MIN_OCCURRENCES = 3;

export type RecurringCadence = "weekly" | "biweekly" | "monthly" | "yearly";

/** Inclusive day-gap ranges that classify a gap as a cadence. */
const CADENCE_GAPS: Record<RecurringCadence, [number, number]> = {
  weekly: [6, 8],
  biweekly: [12, 16],
  monthly: [25, 35],
  yearly: [350, 380],
};

/**
 * How far a gap may sit from its run's median gap while still belonging to
 * the run: ±2 days or ±20% of the median, whichever is larger. Monthly gaps
 * legitimately vary 28–31 days across month lengths; this covers that while
 * keeping weekly (5–9) and biweekly runs distinct.
 */
function gapFitsMedian(gap: number, medianGap: number): boolean {
  return Math.abs(gap - medianGap) <= Math.max(2, Math.round(medianGap * 0.2));
}

export interface RecurringPattern {
  /** Deterministic: `${categoryId}:${cadence}` — safe as a React key. */
  id: string;
  categoryId: ID;
  type: CategoryKind;
  cadence: RecurringCadence;
  /** Median observed day gap of the winning run (informational). */
  intervalDays: number;
  /** Recency-weighted mean amount in minor units (drifts with actuals). */
  expectedAmount: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  /** Most recent occurrence's note — the quick-add description prefill. */
  lastNote?: string;
  /** Where the next occurrence is expected (calendar-aware for monthly). */
  nextExpectedDate: string;
}

export function cadenceForGap(gap: number): RecurringCadence | null {
  for (const cadence of Object.keys(CADENCE_GAPS) as RecurringCadence[]) {
    const [min, max] = CADENCE_GAPS[cadence];
    if (gap >= min && gap <= max) return cadence;
  }
  return null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Recency-weighted mean over amounts ordered OLDEST → NEWEST. Linear weights
 * (oldest counts once … newest counts N times): a value formula, not state —
 * recomputing after every new entry moves the expectation toward recent
 * actuals, which IS the drift requirement. Rounded to whole minor units.
 */
export function weightedExpectedAmount(amountsOldestFirst: number[]): number {
  if (amountsOldestFirst.length === 0) return 0;
  let weightSum = 0;
  let total = 0;
  for (let index = 0; index < amountsOldestFirst.length; index += 1) {
    const weight = index + 1;
    weightSum += weight;
    total += amountsOldestFirst[index] * weight;
  }
  return Math.round(total / weightSum);
}

/** Every consecutive pair must chain within the amount tolerance. */
function amountsChain(occurrences: Transaction[]): boolean {
  for (let i = 1; i < occurrences.length; i += 1) {
    const previous = occurrences[i - 1].amount;
    const current = occurrences[i].amount;
    if (Math.abs(current - previous) > previous * AMOUNT_TOLERANCE) {
      return false;
    }
  }
  return true;
}

interface Run {
  occurrences: Transaction[];
  gaps: number[];
  cadence: RecurringCadence;
}

/**
 * Splits one category's date-sorted series into maximal contiguous runs that
 * share one cadence. Runs shorter than MIN_OCCURRENCES or with a broken
 * amount chain are dropped here.
 */
function runsFromSeries(series: Transaction[]): Run[] {
  const runs: Run[] = [];
  let current: Transaction[] = [];
  let gaps: number[] = [];
  let cadence: RecurringCadence | null = null;

  const flush = () => {
    if (
      current.length >= MIN_OCCURRENCES &&
      cadence !== null &&
      amountsChain(current)
    ) {
      runs.push({ occurrences: [...current], gaps: [...gaps], cadence });
    }
    current = [];
    gaps = [];
    cadence = null;
  };

  for (const transaction of series) {
    if (current.length === 0) {
      current = [transaction];
      continue;
    }
    const previous = current[current.length - 1];
    const gap = daysBetween(previous.date, transaction.date);
    const gapCadence = cadenceForGap(gap);
    if (gapCadence === null) {
      // This pair belongs to no known cadence — no run can extend THROUGH
      // it. Close the run; the current entry starts a fresh one.
      flush();
      current = [transaction];
      continue;
    }
    if (cadence === null) {
      cadence = gapCadence;
      gaps = [gap];
      current.push(transaction);
      continue;
    }
    if (gapCadence !== cadence || !gapFitsMedian(gap, median(gaps))) {
      flush();
      current = [transaction];
      continue;
    }
    gaps.push(gap);
    current.push(transaction);
  }
  flush();
  return runs;
}

/** Calendar-aware projection used for every pattern's next expected date. */
export function addCadence(
  iso: string,
  cadence: RecurringCadence,
  intervalDays: number,
): string {
  if (cadence === "monthly") {
    // Preserve the day-of-month anchor rather than adding ~30 raw days,
    // which would walk a "1st of the month" payment off its date.
    return nextMonthDate(iso);
  }
  const date = isoToDate(iso);
  date.setDate(date.getDate() + intervalDays);
  return dateToIso(date);
}

function buildPattern(run: Run, categoryId: ID): RecurringPattern {
  const occurrences = run.occurrences;
  const last = occurrences[occurrences.length - 1];
  const first = occurrences[0];
  const intervalDays = median(run.gaps);
  return {
    id: `${categoryId}:${run.cadence}`,
    categoryId,
    type: last.type,
    cadence: run.cadence,
    intervalDays,
    expectedAmount: weightedExpectedAmount(
      occurrences.map((occurrence) => occurrence.amount),
    ),
    occurrences: occurrences.length,
    firstDate: first.date,
    lastDate: last.date,
    lastNote: last.note ?? undefined,
    nextExpectedDate: addCadence(last.date, run.cadence, intervalDays),
  };
}

/**
 * Detects recurring patterns across the whole ledger. Pure: same input, same
 * output, byte for byte.
 */
export function detectRecurringPatterns(
  transactions: Transaction[],
): RecurringPattern[] {
  // Instances materialized from an explicit recurrence rule already have an
  // owner the user configured deliberately — suggesting them again would
  // invite duplicates, so they never feed detection.
  const candidates = transactions.filter(
    (transaction) =>
      transaction.amount > 0 && transaction.recurringRuleId === undefined,
  );

  const byCategory = new Map<ID, Transaction[]>();
  for (const transaction of candidates) {
    const series = byCategory.get(transaction.categoryId);
    if (series) series.push(transaction);
    else byCategory.set(transaction.categoryId, [transaction]);
  }

  const best = new Map<string, RecurringPattern>();
  for (const [categoryId, series] of byCategory) {
    series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const run of runsFromSeries(series)) {
      const pattern = buildPattern(run, categoryId);
      const incumbent = best.get(pattern.id);
      // Tie-break: the MOST RECENT run owns the id. When spending drifted so
      // far that a new run formed (e.g. a price change), the newer run —
      // not the longer historical one — carries the expected amount going
      // forward. Equal recency falls back to more occurrences.
      if (
        incumbent === undefined ||
        pattern.lastDate > incumbent.lastDate ||
        (pattern.lastDate === incumbent.lastDate &&
          pattern.occurrences > incumbent.occurrences)
      ) {
        best.set(pattern.id, pattern);
      }
    }
  }
  return [...best.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * A pattern is "due" when its projected date sits within GRACE_DAYS before
 * through AHEAD_DAYS after today. Overdue patterns inside the grace window
 * still count as due: if the user has not logged it yet, suggesting it is
 * exactly the point.
 */
export function isPatternDue(
  pattern: RecurringPattern,
  todayIso: string,
  graceDays = 3,
  aheadDays = 7,
): boolean {
  const from = addDaysIso(todayIso, -graceDays);
  const to = addDaysIso(todayIso, aheadDays);
  return pattern.nextExpectedDate >= from && pattern.nextExpectedDate <= to;
}

/** Patterns whose next expected date falls within [fromIso, toIso], sorted. */
export function patternsDueBetween(
  patterns: RecurringPattern[],
  fromIso: string,
  toIso: string,
): RecurringPattern[] {
  return patterns
    .filter(
      (pattern) =>
        pattern.nextExpectedDate >= fromIso &&
        pattern.nextExpectedDate <= toIso,
    )
    .sort((a, b) => (a.nextExpectedDate < b.nextExpectedDate ? -1 : 1));
}

/**
 * Surfaces a detected pattern for one reviewed transaction at import time
 * (FR-25 reuse — NO second recurring detector). Patterns are per
 * (category, cadence) — the detector's documented v1 scope — so a row
 * "matches" when its pre-filled category owns a pattern and its amount sits
 * within the same AMOUNT_TOLERANCE the detector accepts. Ties break to the
 * nearest expected amount, then the most occurrences, then the id.
 * Pure and deterministic.
 */
export function findRecurringMatch(
  patterns: readonly RecurringPattern[],
  input: { categoryId: ID; amount: number },
): RecurringPattern | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  let best: RecurringPattern | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const pattern of patterns) {
    if (pattern.categoryId !== input.categoryId) continue;
    if (pattern.expectedAmount <= 0) continue;
    const diff = Math.abs(input.amount - pattern.expectedAmount) / pattern.expectedAmount;
    if (diff > AMOUNT_TOLERANCE) continue;
    if (
      diff < bestDiff ||
      (diff === bestDiff &&
        best !== null &&
        (pattern.occurrences > best.occurrences ||
          (pattern.occurrences === best.occurrences && pattern.id < best.id)))
    ) {
      best = pattern;
      bestDiff = diff;
    }
  }
  return best;
}

/** ISO date arithmetic helper (local time; no timezone surprises). */
export function addDaysIso(iso: string, days: number): string {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToIso(date);
}
