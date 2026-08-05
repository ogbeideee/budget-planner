import { monthKeyFromIso } from "./date";
import { financeSeries } from "./finance";
import { spendingByCategory } from "./selectors";
import type { Category, IncomePlan, Month, Transaction } from "./types";

export interface TrendDelta {
  fromMonth: Month;
  toMonth: Month;
  delta: number;
}

export interface ReportTrendsData {
  monthsWithData: number;
  largestIncrease: TrendDelta | null;
  largestDecrease: TrendDelta | null;
  highestCategory: { category: Category; amount: number } | null;
  savingsDelta: TrendDelta | null;
}

export function reportTrends(input: {
  transactions: Transaction[];
  categories: Category[];
  incomePlans?: IncomePlan[];
  months: Month[];
}): ReportTrendsData {
  const { transactions, categories, incomePlans = [], months } = input;
  const series = financeSeries(transactions, incomePlans, months);

  const withData = series.filter(
    (point) => point.received > 0 || point.expenses > 0,
  );
  let largestIncrease: TrendDelta | null = null;
  let largestDecrease: TrendDelta | null = null;

  for (let index = 1; index < withData.length; index += 1) {
    const previous = withData[index - 1];
    const current = withData[index];
    const delta = current.expenses - previous.expenses;
    if (delta > 0 && (largestIncrease === null || delta > largestIncrease.delta)) {
      largestIncrease = { fromMonth: previous.month, toMonth: current.month, delta };
    }
    if (delta < 0 && (largestDecrease === null || delta < largestDecrease.delta)) {
      largestDecrease = { fromMonth: previous.month, toMonth: current.month, delta };
    }
  }

  let savingsDelta: TrendDelta | null = null;
  if (withData.length >= 2) {
    const previous = withData[withData.length - 2];
    const current = withData[withData.length - 1];
    savingsDelta = {
      fromMonth: previous.month,
      toMonth: current.month,
      delta: current.net - previous.net,
    };
  }

  const currentMonth = months[months.length - 1];
  const top = spendingByCategory(transactions, currentMonth)[0] ?? null;
  const topCategory = top
    ? categories.find((category) => category.id === top.categoryId)
    : null;

  return {
    monthsWithData: withData.length,
    largestIncrease,
    largestDecrease,
    highestCategory: top && topCategory ? { category: topCategory, amount: top.amount } : null,
    savingsDelta,
  };
}

export function monthsWithTransactions(
  transactions: Transaction[],
  months: Month[],
): number {
  const seen = new Set(months.map((month) => month));
  const present = new Set<string>();
  for (const transaction of transactions) {
    const month = monthKeyFromIso(transaction.date);
    if (seen.has(month)) present.add(month);
  }
  return present.size;
}
