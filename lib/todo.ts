import type { InsightTone } from "./insights";
import { monthFinance } from "./finance";
import { formatMoney } from "./money";
import { budgetProgress, deferredExpenses, spendingByCategory } from "./selectors";
import type { AppState, ID, Month } from "./types";

export interface TodoItem {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  href: string;
}

const PLANNER_HREF = "/";

export function todoFor(
  state: Pick<
    AppState,
    "budgets" | "transactions" | "categories" | "settings" | "incomePlans"
  >,
  month: Month,
): TodoItem[] {
  const { budgets, transactions, categories, settings, incomePlans } = state;
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  const monthTransactions = transactions.filter((transaction) =>
    transaction.date.startsWith(month),
  );
  const { net } = monthFinance(transactions, incomePlans, month);
  const fmt = (minor: number) => formatMoney(minor, settings.currency);
  const categoryName = (id: ID) =>
    categories.find((category) => category.id === id)?.name ?? "Category";
  const list: TodoItem[] = [];

  if (monthTransactions.length === 0 && monthBudgets.length === 0) {
    return [
      {
        id: "no-data",
        tone: "neutral",
        title: "No data for this month",
        detail: "Add income, expenses, or budgets to see actions.",
        href: PLANNER_HREF,
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
      detail: `${categoryName(highOver.categoryId)} is over by ${fmt(spent - highOver.limit)} this month.`,
      href: PLANNER_HREF,
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
      detail: `${categoryName(over120.categoryId)} is at ${fmt(spent)} against a limit of ${fmt(over120.limit)}.`,
      href: PLANNER_HREF,
    });
  }

  if (net < 0) {
    list.push({
      id: "net-negative",
      tone: "warn",
      title: "Spending exceeds income",
      detail: `Expenses are ${fmt(-net)} above income this month.`,
      href: PLANNER_HREF,
    });
  }

  const deferred = deferredExpenses(transactions, month);
  if (deferred.length > 0) {
    list.push({
      id: "deferred",
      tone: "warn",
      title: "Deferred expenses",
      detail: `${deferred.length} deferred expense${deferred.length === 1 ? "" : "s"} (${fmt(
        deferred.reduce((sum, transaction) => sum + transaction.amount, 0),
      )}) were moved into this month.`,
      href: PLANNER_HREF,
    });
  }

  if (net > 0 && monthBudgets.length === 0) {
    list.push({
      id: "unallocated",
      tone: "neutral",
      title: "Unallocated funds",
      detail: `${fmt(net)} is unallocated — create a budget on the Planner.`,
      href: PLANNER_HREF,
    });
  }

  const unbudgeted = spendingByCategory(transactions, month).find(
    (spend) =>
      !monthBudgets.some((budget) => budget.categoryId === spend.categoryId),
  );
  if (unbudgeted) {
    list.push({
      id: "no-budget",
      tone: "neutral",
      title: "No budget for a spending category",
      detail: `${categoryName(unbudgeted.categoryId)} spent ${fmt(unbudgeted.amount)} with no budget this month.`,
      href: PLANNER_HREF,
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
      detail: `${categoryName(highOnTrack.categoryId)} is at ${Math.floor(progress * 100)}% of its budget.`,
      href: PLANNER_HREF,
    });
  }

  return list.slice(0, 5);
}
