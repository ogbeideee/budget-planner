import { daysBetween, todayIso } from "./date";
import type { Transaction } from "./types";

export interface TimelineGroup {
  key: string;
  label: string;
  items: Transaction[];
}

export const TIMELINE_LABELS = [
  "Upcoming",
  "Today",
  "Yesterday",
  "Last week",
  "Earlier",
];

function dayDiff(iso: string, today: string): number {
  return daysBetween(today, iso);
}

export function timelineLabel(date: string, today: string): string {
  const diff = dayDiff(date, today);
  if (diff > 0) return "Upcoming";
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff >= -7) return "Last week";
  return "Earlier";
}

export function groupTransactionsByTime(
  transactions: readonly Transaction[],
  today: string = todayIso(),
): TimelineGroup[] {
  const buckets = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const label = timelineLabel(transaction.date, today);
    const list = buckets.get(label);
    if (list) {
      list.push(transaction);
    } else {
      buckets.set(label, [transaction]);
    }
  }
  return TIMELINE_LABELS.filter((label) => buckets.has(label)).map((label) => ({
    key: label,
    label,
    items: buckets.get(label)!,
  }));
}
