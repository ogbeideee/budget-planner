import { todayIso, monthOffset } from "./date";
import { monthFinance } from "./finance";
import { formatMoney } from "./money";
import { budgetProgress, needsFunding, spendingByCategory } from "./selectors";
import type {
  Budget,
  Category,
  Currency,
  FutureExpense,
  ID,
  IncomePlan,
  Month,
  Transaction,
} from "./types";

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
  futureExpenses?: FutureExpense[];
  incomePlans?: IncomePlan[];
  month: Month;
  currency: Currency;
}

const DAY_MS = 86_400_000;

function categoryName(categories: Category[], id: ID): string {
  return categories.find((category) => category.id === id)?.name ?? "Category";
}

function daysUntil(dueDate: string, today: string): number {
  return Math.round(
    (new Date(dueDate).getTime() - new Date(today).getTime()) / DAY_MS,
  );
}

export function insightsFor(input: InsightsInput): Insight[] {
  const {
    budgets,
    transactions,
    categories,
    month,
    currency,
    futureExpenses = [],
    incomePlans = [],
  } = input;
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  const monthTransactions = transactions.filter((transaction) =>
    transaction.date.startsWith(month),
  );
  const { net } = monthFinance(transactions, incomePlans, month);
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

  const almostExhausted = monthBudgets.find((budget) => {
    const { spent, over } = budgetProgress(budget, transactions);
    return !over && budget.limit > 0 && spent >= budget.limit * 0.8;
  });
  if (almostExhausted) {
    const { progress } = budgetProgress(almostExhausted, transactions);
    list.push({
      id: "almost-exhausted",
      tone: "warn",
      title: "Budget almost exhausted",
      detail: `${categoryName(categories, almostExhausted.categoryId)} is at ${Math.floor(progress * 100)}% of its limit — nearly gone.`,
      action: { label: "Review budgets", href: "/" },
    });
  }

  const lastMonth = monthOffset(month, -1);
  const lastByCategory = new Map(
    spendingByCategory(transactions, lastMonth).map((spend) => [
      spend.categoryId,
      spend.amount,
    ]),
  );
  let biggestIncrease: { categoryId: ID; pct: number } | null = null;
  for (const spend of spendingByCategory(transactions, month)) {
    const previous = lastByCategory.get(spend.categoryId) ?? 0;
    if (previous <= 0 || spend.amount <= previous) continue;
    const pct = Math.round((100 * (spend.amount - previous)) / previous);
    if (pct >= 10 && (!biggestIncrease || pct > biggestIncrease.pct)) {
      biggestIncrease = { categoryId: spend.categoryId, pct };
    }
  }
  if (biggestIncrease) {
    list.push({
      id: "vs-last-month",
      tone: "warn",
      title: "Spending is up this month",
      detail: `You're spending ${biggestIncrease.pct}% more on ${categoryName(categories, biggestIncrease.categoryId)} than last month.`,
    });
  }

  const dueThisWeek = futureExpenses.filter((expense) => {
    if (expense.status !== "upcoming" || !expense.recurring) return false;
    const days = daysUntil(expense.dueDate, todayIso());
    return days >= 0 && days <= 7;
  });
  if (dueThisWeek.length > 0) {
    const totalDue = dueThisWeek.reduce((sum, expense) => sum + expense.amount, 0);
    list.push({
      id: "recurring-due",
      tone: "warn",
      title:
        dueThisWeek.length === 1
          ? "One recurring bill is due this week"
          : `${dueThisWeek.length} recurring bills are due this week`,
      detail: `${dueThisWeek
        .map((expense) => categoryName(categories, expense.categoryId))
        .join(", ")} — ${fmt(totalDue)} coming up.`,
    });
  }

  const unfunded = needsFunding(budgets, categories, month);
  if (unfunded.length >= 3) {
    list.push({
      id: "needs-funding",
      tone: "warn",
      title: `${unfunded.length} categories need funding`,
      detail: `${unfunded
        .slice(0, 3)
        .map((category) => category.name)
        .join(", ")}${unfunded.length > 3 ? " and more" : ""} have no budget yet this month.`,
      action: { label: "Fund them", href: "/" },
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

  if (list.length === 0) {
    list.push({
      id: "all-clear",
      tone: "success",
      title: "No issues detected this month",
      detail: "Budgets are holding, spending is in line, and nothing is overdue.",
    });
  }

  return list.slice(0, 5);
}
