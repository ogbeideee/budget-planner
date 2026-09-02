import { dateToIso, daysBetween, isoToDate, todayIso } from "./date";
import type { FutureExpense, ID } from "./types";

export interface UpcomingGroup {
  key: string;
  label: string;
  items: FutureExpense[];
}

export const GROUP_LABELS = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This week",
  "Next week",
  "Later",
];

function dayDiff(iso: string, today: string): number {
  return daysBetween(today, iso);
}

function weekStartKey(iso: string): string {
  const date = isoToDate(iso);
  const offset = (date.getDay() + 6) % 7;
  return dateToIso(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset),
  );
}

export function groupLabel(dueDate: string, today: string): string {
  const diff = dayDiff(dueDate, today);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 6 && weekStartKey(dueDate) === weekStartKey(today)) {
    return "This week";
  }
  if (diff <= 13) return "Next week";
  return "Later";
}

export function groupFutureExpenses(
  expenses: readonly FutureExpense[],
  today: string = todayIso(),
): UpcomingGroup[] {
  const buckets = new Map<string, FutureExpense[]>();
  const upcoming = [...expenses]
    .filter((expense) => expense.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const expense of upcoming) {
    const label = groupLabel(expense.dueDate, today);
    const list = buckets.get(label);
    if (list) {
      list.push(expense);
    } else {
      buckets.set(label, [expense]);
    }
  }
  return GROUP_LABELS.filter((label) => buckets.has(label)).map((label) => ({
    key: label,
    label,
    items: buckets.get(label)!,
  }));
}

export function sortedPaidExpenses(
  expenses: readonly FutureExpense[],
): FutureExpense[] {
  return expenses
    .filter((expense) => expense.status === "paid")
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

/** Relative countdown label for a due date, e.g. "in 3 days" · "due today". */
export function daysUntilLabel(
  dueDate: string,
  today: string = todayIso(),
): string {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) {
    return `${-diff} day${-diff === 1 ? "" : "s"} overdue`;
  }
  if (diff === 0) return "due today";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

export type FundingUrgency = "critical" | "soon" | "low";

export function fundingUrgency(
  futureExpenses: readonly FutureExpense[],
  categoryId: ID,
  today: string = todayIso(),
): FundingUrgency {
  let nearest: number | null = null;
  for (const expense of futureExpenses) {
    if (expense.status !== "upcoming" || expense.categoryId !== categoryId) {
      continue;
    }
    const diff = dayDiff(expense.dueDate, today);
    if (nearest === null || diff < nearest) nearest = diff;
  }
  if (nearest === null) return "low";
  if (nearest <= 3) return "critical";
  if (nearest <= 14) return "soon";
  return "low";
}

export type UpcomingFilter = "all" | "month" | "later";

export interface UpcomingSummary {
  /** Sum of all non-paid upcoming expenses. */
  total: number;
  count: number;
  /** The soonest upcoming expense, or null when nothing is planned. */
  next: FutureExpense | null;
  /** Sum of upcoming expenses due inside the current calendar month. */
  thisMonthTotal: number;
  thisMonthCount: number;
  /** Count of non-paid recurring upcoming expenses. */
  recurringCount: number;
}

export function upcomingSummary(
  expenses: readonly FutureExpense[],
  today: string = todayIso(),
): UpcomingSummary {
  const upcoming = expenses.filter((expense) => expense.status !== "paid");
  const month = today.slice(0, 7);
  let total = 0;
  let thisMonthTotal = 0;
  let thisMonthCount = 0;
  let recurringCount = 0;
  for (const expense of upcoming) {
    total += expense.amount;
    if (expense.recurring) recurringCount += 1;
    if (expense.dueDate.startsWith(month)) {
      thisMonthTotal += expense.amount;
      thisMonthCount += 1;
    }
  }
  const next =
    upcoming.length === 0
      ? null
      : upcoming.reduce((nearest, expense) =>
          expense.dueDate < nearest.dueDate ? expense : nearest,
        );
  return {
    total,
    count: upcoming.length,
    next,
    thisMonthTotal,
    thisMonthCount,
    recurringCount,
  };
}

export function filterUpcoming(
  expenses: readonly FutureExpense[],
  filter: UpcomingFilter,
  today: string = todayIso(),
): FutureExpense[] {
  const upcoming = expenses.filter((expense) => expense.status !== "paid");
  if (filter === "all") return upcoming;
  const month = today.slice(0, 7);
  if (filter === "month") {
    return upcoming.filter((expense) => expense.dueDate.startsWith(month));
  }
  return upcoming.filter((expense) => expense.dueDate.slice(0, 7) > month);
}

// ---------------------------------------------------------------------------
// FR-27 — month-scoped planning sets. A FutureExpense's month association IS
// its dueDate's "YYYY-MM" prefix (month keys sort as calendar months), so
// these helpers are the ONE definition of "belongs to this month's plan";
// the Planner's month plan and its planned-expense list both read them.
// ---------------------------------------------------------------------------

/** Every FutureExpense due in `month`, paid ones included — the month's
 *  full planning record. */
export function expensesInMonth(
  expenses: readonly FutureExpense[],
  month: string,
): FutureExpense[] {
  return expenses.filter((expense) => expense.dueDate.startsWith(month));
}

/** The month's planning set: unpaid FutureExpenses due in `month`. Paid
 *  expenses have already happened — the plan tracks what is still ahead
 *  (the same basis `monthPlan` totals and `fundingNeeds` read). */
export function plannedExpensesForMonth(
  expenses: readonly FutureExpense[],
  month: string,
): FutureExpense[] {
  return expenses.filter(
    (expense) =>
      expense.status !== "paid" && expense.dueDate.startsWith(month),
  );
}

export interface DueDateGroup {
  /** The shared due date (ISO). */
  key: string;
  items: FutureExpense[];
}

/** Group by exact due date, ascending — the month plan's day-by-day view.
 *  Unlike `groupFutureExpenses` (relative to TODAY, meaningless for a month
 *  that has not started), this is purely calendar-ordered presentation. */
export function groupExpensesByDueDate(
  expenses: readonly FutureExpense[],
): DueDateGroup[] {
  const buckets = new Map<string, FutureExpense[]>();
  for (const expense of [...expenses].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  )) {
    const list = buckets.get(expense.dueDate);
    if (list) {
      list.push(expense);
    } else {
      buckets.set(expense.dueDate, [expense]);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({ key, items }));
}
