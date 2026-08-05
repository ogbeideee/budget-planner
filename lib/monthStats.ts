import { isoToDate, monthOffset } from "./date";
import { monthFinance } from "./finance";
import type { Budget, Category, FutureExpense, IncomePlan, Month, Transaction } from "./types";

export interface MonthStat {
  label: string;
  value: string;
  caption?: string;
}

export interface MonthStatsData {
  largestExpense: { amount: number; label: string; categoryId: string | null } | null;
  mostFunded: { categoryName: string; limit: number } | null;
  upcomingPayment: FutureExpense | null;
  savingsRate: number | null;
  vsLastMonth: { delta: number; lastNet: number; thisNet: number } | null;
  projectedRemaining: number | null;
}

export function monthStats(input: {
  month: Month;
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  futureExpenses: FutureExpense[];
  incomePlans?: IncomePlan[];
}): MonthStatsData {
  const {
    month,
    transactions,
    budgets,
    categories,
    futureExpenses,
    incomePlans = [],
  } = input;

  const monthTransactions = transactions.filter((transaction) =>
    transaction.date.startsWith(month),
  );

  let largestExpense: MonthStatsData["largestExpense"] = null;
  for (const transaction of monthTransactions) {
    if (transaction.type !== "expense") continue;
    if (!largestExpense || transaction.amount > largestExpense.amount) {
      const category = categories.find((c) => c.id === transaction.categoryId);
      largestExpense = {
        amount: transaction.amount,
        label:
          transaction.note?.trim() ??
          category?.name ??
          "Expense",
        categoryId: category?.id ?? null,
      };
    }
  }

  const monthBudgets = budgets.filter((budget) => budget.month === month);
  let mostFunded: MonthStatsData["mostFunded"] = null;
  for (const budget of monthBudgets) {
    if (!mostFunded || budget.limit > mostFunded.limit) {
      const category = categories.find((c) => c.id === budget.categoryId);
      mostFunded = {
        categoryName: category?.name ?? "Category",
        limit: budget.limit,
      };
    }
  }

  const upcoming = futureExpenses.filter((expense) => expense.status === "upcoming");
  let upcomingPayment: MonthStatsData["upcomingPayment"] = null;
  if (upcoming.length > 0) {
    const today = Date.now();
    upcomingPayment = upcoming.reduce((a, b) => {
      const diffA = Math.abs(isoToDate(a.dueDate).getTime() - today);
      const diffB = Math.abs(isoToDate(b.dueDate).getTime() - today);
      return diffB < diffA ? b : a;
    });
  }

  const finance = monthFinance(transactions, incomePlans, month);
  const savingsRate = finance.savingsRate;

  const lastMonth = monthOffset(month, -1);
  const lastNet = monthFinance(transactions, incomePlans, lastMonth).net;
  const vsLastMonth =
    lastNet !== 0 || finance.net !== 0
      ? { delta: finance.net - lastNet, lastNet, thisNet: finance.net }
      : null;

  const upcomingInMonth = upcoming
    .filter((expense) => expense.dueDate.startsWith(month))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const hasActivity = monthTransactions.length > 0 || upcomingInMonth > 0;
  const projectedRemaining =
    hasActivity && finance.expected > 0
      ? finance.projectedRemaining
      : null;

  return {
    largestExpense,
    mostFunded,
    upcomingPayment,
    savingsRate,
    vsLastMonth,
    projectedRemaining,
  };
}
