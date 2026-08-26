import { monthOffset } from "./date";
import { budgetUtilizationSeries } from "./selectors";
import type {
  Budget,
  EarnedBadge,
  Month,
  RolloverRecord,
  Transaction,
} from "./types";

/**
 * Savings streaks and badges (FR-21) — cosmetic recognition only.
 *
 * Pure and deterministic: no store access, no I/O. The streak is DERIVED from
 * the ledger every time rather than incremented and stored, so editing a past
 * month corrects it instead of leaving a counter that quietly disagrees with
 * the data. Only the badges a user has earned are persisted, because an
 * achievement should survive a later reset.
 */

/**
 * Whether a single month stayed within budget.
 *
 * `no-data` is a distinct outcome from `over` on purpose: a month with no
 * budgets is not a month you stayed within budget, so it must never count
 * toward a streak by having nothing to fail.
 */
export type MonthStatus = "on-track" | "over" | "no-data";

/**
 * Reuses `budgetUtilizationSeries` — the app's existing total-spent-versus-
 * total-budgeted calculation — rather than defining "on track" a second time.
 * That selector already sums effective (rollover-aware) limits and returns
 * nothing at all for a month with no budgets, which is exactly the `no-data`
 * case.
 *
 * The comparison is on the raw totals, NOT the rounded `pct`: at 100.4% the
 * percentage rounds to 100 and would wrongly read as on track.
 */
export function monthStatus(
  budgets: Budget[],
  transactions: Transaction[],
  month: Month,
  rollovers: RolloverRecord[] = [],
): MonthStatus {
  const [point] = budgetUtilizationSeries(
    budgets,
    transactions,
    [month],
    rollovers,
  );
  if (!point) return "no-data";
  return point.spentTotal <= point.limit ? "on-track" : "over";
}

/** How far back to walk before giving up, in months (25 years). */
const MAX_LOOKBACK = 300;

/** The earliest month the ledger knows about, or null when there is none. */
function earliestMonth(budgets: Budget[]): Month | null {
  let earliest: Month | null = null;
  for (const budget of budgets) {
    if (earliest === null || budget.month < earliest) earliest = budget.month;
  }
  return earliest;
}

export interface StreakStats {
  /** Consecutive completed on-track months ending with the last one. */
  current: number;
  /** The best run ever achieved — never falls when `current` resets. */
  longest: number;
  /** Total completed months that were on track, ever. */
  onTrackMonths: number;
  /** The most recent COMPLETE month; the current month is excluded. */
  lastCompleteMonth: Month;
}

/**
 * Streak statistics as of `today`'s month.
 *
 * **The month in progress never counts.** It is incomplete by definition:
 * counting it would hand a free +1 to anyone three days in who has barely
 * spent, and would show a streak as "broken" mid-month for someone who will
 * be comfortably inside their limits by the 31st. The streak therefore only
 * ever describes finished months — which is also what makes the very first
 * month a user has data behave correctly (it contributes nothing until it
 * ends).
 *
 * A `no-data` month breaks the run exactly as an over-budget month does; see
 * `MonthStatus`.
 */
export function streakStats(
  budgets: Budget[],
  transactions: Transaction[],
  today: Month,
  rollovers: RolloverRecord[] = [],
): StreakStats {
  const lastCompleteMonth = monthOffset(today, -1);
  const earliest = earliestMonth(budgets);

  const empty: StreakStats = {
    current: 0,
    longest: 0,
    onTrackMonths: 0,
    lastCompleteMonth,
  };
  if (earliest === null || earliest > lastCompleteMonth) return empty;

  let current = 0;
  let longest = 0;
  let onTrackMonths = 0;
  let run = 0;
  let counting = true;

  for (let i = 0; i < MAX_LOOKBACK; i += 1) {
    const month = monthOffset(lastCompleteMonth, -i);
    if (month < earliest) break;

    if (monthStatus(budgets, transactions, month, rollovers) === "on-track") {
      run += 1;
      onTrackMonths += 1;
      if (run > longest) longest = run;
      // The current streak is the unbroken run ending at the last complete
      // month, so it stops accumulating the moment one is missed.
      if (counting) current = run;
    } else {
      run = 0;
      counting = false;
    }
  }

  return { current, longest, onTrackMonths, lastCompleteMonth };
}

/* ------------------------------------------------------------------------ */
/* Badges                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * What a badge requires. A DESCRIPTOR, not a function: a shared evaluator
 * interprets it, so adding a badge is a new data entry rather than new
 * component code or another branch in a component.
 */
export type BadgeCriteria =
  | { kind: "first-on-track-month" }
  | { kind: "streak-months"; months: number };

export interface BadgeDefinition {
  id: string;
  name: string;
  /** An icon-library value (see components/settings/iconLibrary.ts), rendered
   *  through `IconValue` like every other icon in the app. */
  icon: string;
  description: string;
  /** Threshold this badge sits at; also its sort order within the set. */
  tier: number;
  criteria: BadgeCriteria;
  /**
   * RESERVED — always `null`, and nothing reads it.
   *
   * Held open deliberately per product direction so a later functional-perk
   * system (unlocking a feature, a cosmetic theme) can be layered on without
   * migrating badge data or rewriting the evaluator. **There is no
   * reward-granting logic anywhere in this codebase**; a badge is cosmetic
   * recognition and nothing more. Anything that changes that belongs in a new
   * module that READS this field — do not add behaviour to the evaluator.
   */
  reward: null;
}

/**
 * The launch set — deliberately short. Extending it means appending here and
 * nothing else: the view, the evaluator and the tests all read this list.
 */
export const BADGES: ReadonlyArray<BadgeDefinition> = [
  {
    id: "first-month",
    name: "First month",
    icon: "⭐",
    description: "Finished a whole month inside your total budget.",
    tier: 1,
    criteria: { kind: "first-on-track-month" },
    reward: null,
  },
  {
    id: "streak-3",
    name: "Three in a row",
    icon: "🎯",
    description: "Stayed within budget three months running.",
    tier: 3,
    criteria: { kind: "streak-months", months: 3 },
    reward: null,
  },
  {
    id: "streak-6",
    name: "Half a year",
    icon: "🔥",
    description: "Six consecutive months inside your budget.",
    tier: 6,
    criteria: { kind: "streak-months", months: 6 },
    reward: null,
  },
  {
    id: "streak-12",
    name: "Full year",
    icon: "🎉",
    description: "Twelve consecutive months inside your budget.",
    tier: 12,
    criteria: { kind: "streak-months", months: 12 },
    reward: null,
  },
];

export interface BadgeProgress {
  badge: BadgeDefinition;
  earned: boolean;
  /** When it was earned, for badges already recorded. */
  earnedAt: string | null;
  /** Progress toward `target`, clamped so it never overshoots. */
  current: number;
  target: number;
  /** Plain-language "what you still need", for the locked state. */
  requirement: string;
}

/** How much of a criteria's requirement the given stats satisfy. */
function progressFor(
  criteria: BadgeCriteria,
  stats: StreakStats,
): { current: number; target: number; requirement: string } {
  if (criteria.kind === "first-on-track-month") {
    return {
      current: Math.min(stats.onTrackMonths, 1),
      target: 1,
      requirement: "Finish one month inside your total budget",
    };
  }
  return {
    // Measured against the BEST run, not the current one, so a badge already
    // achieved cannot be taken away by a later reset.
    current: Math.min(stats.longest, criteria.months),
    target: criteria.months,
    requirement: `Stay within budget for ${criteria.months} months in a row`,
  };
}

/** True when `stats` satisfy `criteria`. The single place criteria are read. */
export function criteriaMet(
  criteria: BadgeCriteria,
  stats: StreakStats,
): boolean {
  const { current, target } = progressFor(criteria, stats);
  return current >= target;
}

/**
 * Every badge with its earned/locked state — unearned ones included, so the
 * view can show what is still to aim for rather than hiding it.
 */
export function evaluateBadges(
  stats: StreakStats,
  earned: EarnedBadge[] = [],
): BadgeProgress[] {
  const byId = new Map(earned.map((record) => [record.id, record]));
  return [...BADGES]
    .sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1))
    .map((badge) => {
      const record = byId.get(badge.id) ?? null;
      const { current, target, requirement } = progressFor(
        badge.criteria,
        stats,
      );
      return {
        badge,
        // Persisted first: an achievement stays earned even if the criteria
        // stop being met later.
        earned: record !== null || criteriaMet(badge.criteria, stats),
        earnedAt: record?.earnedAt ?? null,
        current,
        target,
        requirement,
      };
    });
}

/**
 * Badges newly earned by `stats` that are not already recorded.
 *
 * Returns ONLY the new ones — an empty array when nothing changed — so
 * re-running it every launch is free and cannot re-grant or duplicate a badge
 * the user already holds.
 */
export function newlyEarnedBadges(
  stats: StreakStats,
  earned: EarnedBadge[] = [],
  now: string = new Date().toISOString(),
): EarnedBadge[] {
  const held = new Set(earned.map((record) => record.id));
  return BADGES.filter(
    (badge) => !held.has(badge.id) && criteriaMet(badge.criteria, stats),
  ).map((badge) => ({
    id: badge.id,
    earnedAt: now,
    // The stat that earned it, kept so a future perk system has the context
    // without recomputing history.
    value: badge.criteria.kind === "streak-months" ? stats.longest : 1,
  }));
}

/** "3-month streak" / "1-month streak". Empty string at zero. */
export function formatStreak(months: number): string {
  if (months <= 0) return "";
  return `${months}-month streak`;
}
