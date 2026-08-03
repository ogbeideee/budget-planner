import { dateToIso, isoToDate, todayIso } from "./date";
import type { FutureExpense } from "./types";

export interface UpcomingGroup {
  key: string;
  label: string;
  items: FutureExpense[];
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_MS = 86_400_000;

export const GROUP_LABELS = [
  "Overdue",
  "Today",
  "Tomorrow",
  ...WEEKDAYS,
  "Next week",
  "Next month",
  "Later",
];

function dayDiff(iso: string, today: string): number {
  const due = isoToDate(iso);
  const base = isoToDate(today);
  return Math.round((due.getTime() - base.getTime()) / DAY_MS);
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
    return WEEKDAYS[isoToDate(dueDate).getDay()];
  }
  if (diff <= 13) return "Next week";
  if (diff <= 59) return "Next month";
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
