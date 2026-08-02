import {
  clampDay,
  dateToIso,
  datesInMonthByWeekday,
  monthKey,
  parseMonth,
  weekdayOfIso,
} from "./date";
import type { ID, Month, RecurrenceRule, Transaction } from "./types";

export function generatedInstanceId(ruleId: ID, date: string): ID {
  return `${ruleId}:${date}`;
}

function buildInstance(rule: RecurrenceRule, date: Date): Transaction {
  const iso = dateToIso(date);
  return {
    id: generatedInstanceId(rule.id, iso),
    categoryId: rule.categoryId,
    amount: rule.amount,
    type: rule.type,
    date: iso,
    note: rule.note,
    createdAt: new Date().toISOString(),
    recurringRuleId: rule.id,
  };
}

export function generateInstances(rule: RecurrenceRule, month: Month): Transaction[] {
  if (!rule.enabled) return [];
  const exceptions = rule.exceptions[month];
  const skipDate = (date: string): boolean => {
    if (exceptions === "skipped") return true;
    if (Array.isArray(exceptions)) {
      return exceptions.includes(generatedInstanceId(rule.id, date));
    }
    return false;
  };

  const { year, monthIndex } = parseMonth(month);
  let dates: Date[] = [];

  if (rule.frequency === "weekly") {
    dates = datesInMonthByWeekday(month, weekdayOfIso(rule.anchorDate));
  } else if (rule.frequency === "monthly") {
    const day = clampDay(year, monthIndex, new Date(rule.anchorDate).getDate());
    dates = [new Date(year, monthIndex, day)];
  } else {
    const anchor = new Date(rule.anchorDate);
    if (monthKey(anchor.getFullYear(), anchor.getMonth()) === month) {
      const day = clampDay(year, monthIndex, anchor.getDate());
      dates = [new Date(year, monthIndex, day)];
    }
  }

  return dates
    .filter((date) => !skipDate(dateToIso(date)))
    .map((date) => buildInstance(rule, date));
}

export function hasGeneratedInstance(
  transactions: Transaction[],
  ruleId: ID,
  date: string,
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.recurringRuleId === ruleId && transaction.date === date,
  );
}

export function recordException(
  rule: RecurrenceRule,
  month: Month,
  id: ID,
): RecurrenceRule {
  const current = rule.exceptions[month];
  let next: ID[] | "skipped";
  if (current === "skipped") {
    next = [id];
  } else if (current && !current.includes(id)) {
    next = [...current, id];
  } else if (current) {
    next = current;
  } else {
    next = [id];
  }
  return { ...rule, exceptions: { ...rule.exceptions, [month]: next } };
}
