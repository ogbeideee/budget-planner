import { daysInMonth, isoToDate, monthKeyFromIso, parseMonth, todayIso } from "./date";
import { monthFinance } from "./finance";
import { transactionsForMonth } from "./selectors";
import type { IncomePlan, Month, Transaction } from "./types";

export interface MonthlyPredictions {
  daysElapsed: number;
  avgDailySpending: number | null;
  projectedSpending: number | null;
  projectedSavings: number | null;
}

export function monthlyPredictions(
  transactions: Transaction[],
  month: Month,
  incomePlans?: IncomePlan[],
): MonthlyPredictions {
  const monthTransactions = transactionsForMonth(transactions, month);
  const { year, monthIndex } = parseMonth(month);
  const today = isoToDate(todayIso());
  const isCurrent = monthKeyFromIso(todayIso()) === month;
  const daysElapsed = isCurrent
    ? Math.max(1, Math.min(daysInMonth(year, monthIndex), today.getDate()))
    : month < monthKeyFromIso(todayIso())
      ? daysInMonth(year, monthIndex)
      : 1;

  const spentSoFar = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const received = monthFinance(transactions, incomePlans ?? [], month).received;

  const totalDays = daysInMonth(year, monthIndex);
  const avgDailySpending =
    spentSoFar > 0 ? Math.round(spentSoFar / daysElapsed) : null;
  const projectedSpending =
    avgDailySpending !== null ? Math.round(avgDailySpending * totalDays) : null;
  const projectedSavings =
    projectedSpending !== null && received > 0
      ? received - projectedSpending
      : null;

  return { daysElapsed, avgDailySpending, projectedSpending, projectedSavings };
}
