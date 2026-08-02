import { formatMoney } from "./money";
import { budgetProgress, spendingByCategory, totals } from "./selectors";
import type { Budget, Category, Currency, ID, Month, Transaction } from "./types";

export type InsightTone = "danger" | "warn" | "success" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

export interface InsightsInput {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
  month: Month;
  currency: Currency;
}

function categoryName(categories: Category[], id: ID): string {
  return categories.find((category) => category.id === id)?.name ?? "Category";
}

export function insightsFor(input: InsightsInput): Insight[] {
  const { budgets, transactions, categories, month, currency } = input;
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  const monthTransactions = transactions.filter((transaction) =>
    transaction.date.startsWith(month),
  );
  const { net } = totals(transactions, month);
  const fmt = (minor: number) => formatMoney(minor, currency);
  const list: Insight[] = [];

  if (monthTransactions.length === 0 && monthBudgets.length === 0) {
    return [
      {
        id: "no-data",
        tone: "neutral",
        title: "No data for this month",
        detail: "Add income, expenses, or budgets to see insights.",
      },
    ];
  }

  const highOver = monthBudgets.find(
    (budget) =>
      budget.priority === "high" &&
      budgetProgress(budget, transactions).spent > budget.limit,
  );
  if (highOver) {
    const { spent } = budgetProgress(highOver, transactions);
    list.push({
      id: "high-over",
      tone: "danger",
      title: "High-priority budget over",
      detail: `${categoryName(categories, highOver.categoryId)} is over by ${fmt(spent - highOver.limit)} this month.`,
      action: { label: "Review budgets", href: "/" },
    });
  }

  const over120 = monthBudgets.find((budget) => {
    const { spent } = budgetProgress(budget, transactions);
    return spent * 5 > budget.limit * 6;
  });
  if (over120) {
    const { spent } = budgetProgress(over120, transactions);
    list.push({
      id: "over-120",
      tone: "danger",
      title: "Budget far over limit",
      detail: `${categoryName(categories, over120.categoryId)} is at ${fmt(spent)} against a limit of ${fmt(over120.limit)}.`,
      action: { label: "Review budgets", href: "/" },
    });
  }

  if (net < 0) {
    list.push({
      id: "net-negative",
      tone: "warn",
      title: "Spending exceeds income",
      detail: `Expenses are ${fmt(-net)} above income this month.`,
    });
  }

  if (net > 0 && monthBudgets.length === 0) {
    list.push({
      id: "unallocated",
      tone: "neutral",
      title: "Unallocated funds",
      detail: `${fmt(net)} is unallocated this month — create a budget.`,
      action: { label: "Create a budget", href: "/" },
    });
  }

  const unbudgeted = spendingByCategory(transactions, month).find(
    (spend) => !monthBudgets.some((budget) => budget.categoryId === spend.categoryId),
  );
  if (unbudgeted) {
    list.push({
      id: "no-budget",
      tone: "neutral",
      title: "No budget for a spending category",
      detail: `${categoryName(categories, unbudgeted.categoryId)} spent ${fmt(unbudgeted.amount)} with no budget this month.`,
      action: { label: "Add a budget", href: "/" },
    });
  }

  const highOnTrack = monthBudgets.find(
    (budget) =>
      budget.priority === "high" &&
      budget.limit > 0 &&
      budgetProgress(budget, transactions).spent * 2 <= budget.limit,
  );
  if (highOnTrack) {
    const { progress } = budgetProgress(highOnTrack, transactions);
    list.push({
      id: "on-track",
      tone: "success",
      title: "On track",
      detail: `${categoryName(categories, highOnTrack.categoryId)} is at ${Math.floor(progress * 100)}% of its budget.`,
    });
  }

  return list.slice(0, 5);
}
