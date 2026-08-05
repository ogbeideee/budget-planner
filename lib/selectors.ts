import { monthKeyFromIso, monthOffset } from "./date";
import type {
  Budget,
  Category,
  FutureExpense,
  ID,
  IncomePlan,
  Month,
  Transaction,
} from "./types";

export interface Totals {
  income: number;
  expenses: number;
  net: number;
}

export function transactionsForMonth(
  transactions: Transaction[],
  month: Month,
): Transaction[] {
  return transactions.filter(
    (transaction) => monthKeyFromIso(transaction.date) === month,
  );
}

export function spent(
  transactions: Transaction[],
  categoryId: ID,
  month: Month,
): number {
  return transactionsForMonth(transactions, month)
    .filter(
      (transaction) =>
        transaction.type === "expense" && transaction.categoryId === categoryId,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function earned(
  transactions: Transaction[],
  categoryId: ID,
  month: Month,
): number {
  return transactionsForMonth(transactions, month)
    .filter(
      (transaction) =>
        transaction.type === "income" && transaction.categoryId === categoryId,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function totals(transactions: Transaction[], month: Month): Totals {
  const monthTransactions = transactionsForMonth(transactions, month);
  const income = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { income, expenses, net: income - expenses };
}

export interface BudgetProgress {
  limit: number;
  spent: number;
  remaining: number;
  progress: number;
  over: boolean;
}

export function budgetProgress(
  budget: Budget,
  transactions: Transaction[],
): BudgetProgress {
  const value = spent(transactions, budget.categoryId, budget.month);
  const limit = budget.limit;
  const progress = limit > 0 ? Math.min(1, value / limit) : 0;
  return {
    limit,
    spent: value,
    remaining: limit - value,
    progress,
    over: value > limit,
  };
}

export interface OverBudgetEntry {
  budget: Budget;
  spent: number;
}

export function overBudgetCategories(
  budgets: Budget[],
  transactions: Transaction[],
  month: Month,
): OverBudgetEntry[] {
  return budgets
    .filter((budget) => budget.month === month)
    .map((budget) => ({
      budget,
      spent: spent(transactions, budget.categoryId, budget.month),
    }))
    .filter((entry) => entry.spent > entry.budget.limit);
}

export type TransactionSortKey = "date" | "amount";
export type SortDirection = "asc" | "desc";

export interface TransactionSort {
  key: TransactionSortKey;
  direction: SortDirection;
}

export function sortTransactions(
  transactions: Transaction[],
  sort: TransactionSort,
): Transaction[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...transactions].sort((a, b) => {
    if (sort.key === "date") {
      if (a.date !== b.date) return (a.date < b.date ? -1 : 1) * factor;
    } else if (a.amount !== b.amount) {
      return (a.amount - b.amount) * factor;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function sortByDateDesc(transactions: Transaction[]): Transaction[] {
  return sortTransactions(transactions, { key: "date", direction: "desc" });
}

export interface CategorySpend {
  categoryId: ID;
  amount: number;
}

export function spendingByCategory(
  transactions: Transaction[],
  month: Month,
): CategorySpend[] {
  const grouped = new Map<ID, number>();
  for (const transaction of transactionsForMonth(transactions, month)) {
    if (transaction.type !== "expense") continue;
    grouped.set(
      transaction.categoryId,
      (grouped.get(transaction.categoryId) ?? 0) + transaction.amount,
    );
  }
  return [...grouped.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort(
      (a, b) =>
        b.amount - a.amount || (a.categoryId < b.categoryId ? -1 : 1),
    );
}

export function budgetHealth(
  budgets: Budget[],
  transactions: Transaction[],
  month: Month,
  incomePlans: IncomePlan[] = [],
): number {
  let health = 100;
  for (const budget of budgets) {
    if (budget.month !== month || budget.limit <= 0) continue;
    const value = spent(transactions, budget.categoryId, month);
    if (value > budget.limit) {
      health -= Math.min(
        30,
        Math.floor((100 * (value - budget.limit)) / budget.limit),
      );
    }
  }
  if (
    receivedForMonth(transactions, incomePlans, month) -
      totals(transactions, month).expenses <
    0
  ) {
    health -= 15;
  }
  return Math.max(0, Math.min(100, health));
}

export type HealthTier = "healthy" | "watch" | "risk";

export function healthTier(health: number): HealthTier {
  if (health >= 80) return "healthy";
  if (health >= 50) return "watch";
  return "risk";
}

export function deferredExpenses(
  transactions: Transaction[],
  month: Month,
): Transaction[] {
  return transactionsForMonth(transactions, month).filter(
    (transaction) =>
      transaction.type === "expense" && transaction.deferred === true,
  );
}

export function needsFunding(
  budgets: Budget[],
  categories: Category[],
  month: Month,
): Category[] {
  const budgeted = new Set(
    budgets
      .filter((budget) => budget.month === month && budget.limit > 0)
      .map((budget) => budget.categoryId),
  );
  return categories
    .filter(
      (category) => category.kind === "expense" && !budgeted.has(category.id),
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export interface FundingGap {
  category: Category;
  target: number;
  allocated: number;
  missing: number;
}

export function fundingGaps(
  budgets: Budget[],
  categories: Category[],
  futureExpenses: FutureExpense[],
  month: Month,
): FundingGap[] {
  const gaps: FundingGap[] = [];
  for (const category of categories) {
    if (category.kind !== "expense") continue;
    const target = futureExpenses
      .filter(
        (expense) =>
          expense.status === "upcoming" &&
          expense.categoryId === category.id &&
          expense.dueDate.startsWith(month),
      )
      .reduce((sum, expense) => sum + expense.amount, 0);
    if (target <= 0) continue;
    const allocated =
      budgets.find(
        (budget) => budget.month === month && budget.categoryId === category.id,
      )?.limit ?? 0;
    const missing = Math.max(target - allocated, 0);
    if (missing <= 0) continue;
    gaps.push({ category, target, allocated, missing });
  }
  return gaps.sort(
    (a, b) =>
      b.missing - a.missing ||
      a.category.name.localeCompare(b.category.name),
  );
}

export function windowMonths(month: Month, count = 6): Month[] {
  return Array.from({ length: count }, (_, index) =>
    monthOffset(month, -(count - 1 - index)),
  );
}

export function incomePlansForMonth(
  plans: IncomePlan[],
  month: Month,
): IncomePlan[] {
  return plans.filter((plan) => plan.month === month);
}

export function expectedIncomeForMonth(
  plans: IncomePlan[],
  month: Month,
): number {
  return incomePlansForMonth(plans, month).reduce(
    (sum, plan) => sum + plan.expectedAmount,
    0,
  );
}

export function receivedIncomeForMonth(
  plans: IncomePlan[],
  month: Month,
): number {
  return incomePlansForMonth(plans, month).reduce(
    (sum, plan) => sum + plan.receivedAmount,
    0,
  );
}

/**
 * Actual money currently available for the month: the sum of `receivedAmount`
 * on income plans, floored by ledger income transactions. Plans are the
 * canonical source; transactions only act as a fallback for states that
 * never migrated to plans. The max avoids double counting because the v2->v3
 * migration backfilled plan `receivedAmount` from income transactions
 * without deleting them.
 */
export function receivedForMonth(
  transactions: Transaction[],
  incomePlans: IncomePlan[],
  month: Month,
): number {
  return Math.max(
    totals(transactions, month).income,
    receivedIncomeForMonth(incomePlans, month),
  );
}

export interface IncomeBreakdownRow {
  plan: IncomePlan;
  expected: number;
  received: number;
  difference: number;
}

export function incomeBreakdownForMonth(
  plans: IncomePlan[],
  month: Month,
): IncomeBreakdownRow[] {
  return incomePlansForMonth(plans, month)
    .map((plan) => ({
      plan,
      expected: plan.expectedAmount,
      received: plan.receivedAmount,
      difference: plan.expectedAmount - plan.receivedAmount,
    }))
    .sort(
      (a, b) =>
        b.expected - a.expected ||
        b.received - a.received ||
        (a.plan.name < b.plan.name ? -1 : 1),
    );
}

export interface IncomeTrendPoint {
  month: Month;
  expected: number;
  received: number;
}

export function incomeTrendSeries(
  plans: IncomePlan[],
  months: Month[],
): IncomeTrendPoint[] {
  return months.map((month) => ({
    month,
    expected: expectedIncomeForMonth(plans, month),
    received: receivedIncomeForMonth(plans, month),
  }));
}

export interface MonthlyTotals extends Totals {
  month: Month;
}

export function monthlySeries(
  transactions: Transaction[],
  months: Month[],
): MonthlyTotals[] {
  return months.map((month) => ({ month, ...totals(transactions, month) }));
}

export interface BudgetUtilizationPoint {
  month: Month;
  limit: number;
  spentTotal: number;
}

export function budgetUtilizationSeries(
  budgets: Budget[],
  transactions: Transaction[],
  months: Month[],
): BudgetUtilizationPoint[] {
  return months.flatMap((month) => {
    const monthBudgets = budgets.filter(
      (budget) => budget.month === month && budget.limit > 0,
    );
    if (monthBudgets.length === 0) return [];
    const limit = monthBudgets.reduce((sum, budget) => sum + budget.limit, 0);
    const spentTotal = monthBudgets.reduce(
      (sum, budget) => sum + spent(transactions, budget.categoryId, month),
      0,
    );
    return [{ month, limit, spentTotal }];
  });
}

export function spendingByCategoryInMonths(
  transactions: Transaction[],
  months: Month[],
): CategorySpend[] {
  const window = new Set(months);
  const grouped = new Map<ID, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    if (!window.has(monthKeyFromIso(transaction.date))) continue;
    grouped.set(
      transaction.categoryId,
      (grouped.get(transaction.categoryId) ?? 0) + transaction.amount,
    );
  }
  return [...grouped.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort(
      (a, b) =>
        b.amount - a.amount || (a.categoryId < b.categoryId ? -1 : 1),
    );
}
