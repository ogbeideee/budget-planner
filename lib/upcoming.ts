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
