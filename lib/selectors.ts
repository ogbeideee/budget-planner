import { monthKeyFromIso, monthOffset } from "./date";
import type {
  Budget,
  ID,
  IncomePlan,
  Month,
  RolloverRecord,
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

/** The carryover recorded for one category in one month, or null. */
export function findRollover(
  rollovers: RolloverRecord[],
  categoryId: ID,
  month: Month,
): RolloverRecord | null {
  return (
    rollovers.find(
      (record) => record.categoryId === categoryId && record.month === month,
    ) ?? null
  );
}

/** How much rolled INTO `month` for one category. 0 when nothing did. */
export function rolledOverInto(
  rollovers: RolloverRecord[],
  categoryId: ID,
  month: Month,
): number {
  return findRollover(rollovers, categoryId, month)?.amount ?? 0;
}

/**
 * A budget's spendable limit for its month: the base limit plus whatever was
 * recorded as rolling into that month.
 *
 * Reads only the persisted record and never recomputes, so a past month keeps
 * the limit it actually had even if the cap default changes or the source
 * month's transactions are edited later.
 */
export function effectiveLimit(
  budget: Budget,
  rollovers: RolloverRecord[] = [],
): number {
  return budget.limit + rolledOverInto(rollovers, budget.categoryId, budget.month);
}

export interface BudgetProgress {
  /** Spendable limit: `baseLimit` plus `rolledOver`. Every existing consumer
   *  reads this, so enabling rollover widens the limit everywhere at once. */
  limit: number;
  /** The limit the user set for this month, before any carryover. */
  baseLimit: number;
  /** Carried in from last month; 0 unless the category opted into rollover. */
  rolledOver: number;
  spent: number;
  remaining: number;
  progress: number;
  over: boolean;
}

/**
 * Progress against a budget's spendable limit.
 *
 * `rollovers` is optional and defaults to none: called without it — as every
 * pre-rollover call site does — `limit` is exactly `budget.limit` and
 * `rolledOver` is 0, so categories that never opted in behave identically.
 */
export function budgetProgress(
  budget: Budget,
  transactions: Transaction[],
  rollovers: RolloverRecord[] = [],
): BudgetProgress {
  const value = spent(transactions, budget.categoryId, budget.month);
  const rolledOver = rolledOverInto(rollovers, budget.categoryId, budget.month);
  const limit = budget.limit + rolledOver;
  const progress = limit > 0 ? Math.min(1, value / limit) : 0;
  return {
    limit,
    baseLimit: budget.limit,
    rolledOver,
    spent: value,
    remaining: limit - value,
    progress,
    over: value > limit,
  };
}

export function isDeeplyOverBudget(progress: BudgetProgress): boolean {
  return progress.spent * 5 > progress.limit * 6;
}

export interface OverBudgetEntry {
  budget: Budget;
  spent: number;
  /** The limit actually breached — base plus any carryover. */
  limit: number;
}

export function overBudgetCategories(
  budgets: Budget[],
  transactions: Transaction[],
  month: Month,
  rollovers: RolloverRecord[] = [],
): OverBudgetEntry[] {
  return budgets
    .filter((budget) => budget.month === month)
    .map((budget) => ({
      budget,
      spent: spent(transactions, budget.categoryId, budget.month),
      limit: effectiveLimit(budget, rollovers),
    }))
    .filter((entry) => entry.spent > entry.limit);
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
  rollovers: RolloverRecord[] = [],
): number {
  let health = 100;
  for (const budget of budgets) {
    if (budget.month !== month || budget.limit <= 0) continue;
    // Scored against the spendable limit: a category still inside its
    // carried-over funds has not overspent and must not be penalised.
    const limit = effectiveLimit(budget, rollovers);
    const value = spent(transactions, budget.categoryId, month);
    if (value > limit) {
      health -= Math.min(30, Math.floor((100 * (value - limit)) / limit));
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
  transactions: Transaction[],
  plans: IncomePlan[],
  months: Month[],
): IncomeTrendPoint[] {
  return months.map((month) => ({
    month,
    expected: expectedIncomeForMonth(plans, month),
    received: receivedForMonth(transactions, plans, month),
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
  pct: number;
}

/**
 * `rollovers` defaults to none for backward compatibility. Passing it makes
 * each month weigh the limit that month ACTUALLY had, carryover included,
 * rather than recomputing history from today's settings.
 */
export function budgetUtilizationSeries(
  budgets: Budget[],
  transactions: Transaction[],
  months: Month[],
  rollovers: RolloverRecord[] = [],
): BudgetUtilizationPoint[] {
  return months.flatMap((month) => {
    const monthBudgets = budgets.filter(
      (budget) => budget.month === month && budget.limit > 0,
    );
    if (monthBudgets.length === 0) return [];
    const limit = monthBudgets.reduce(
      (sum, budget) => sum + effectiveLimit(budget, rollovers),
      0,
    );
    const spentTotal = monthBudgets.reduce(
      (sum, budget) => sum + spent(transactions, budget.categoryId, month),
      0,
    );
    return [
      {
        month,
        limit,
        spentTotal,
        pct: Math.round((100 * spentTotal) / limit),
      },
    ];
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
