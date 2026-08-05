import {
  expectedIncomeForMonth,
  receivedForMonth,
  totals,
} from "./selectors";
import type { IncomePlan, Month, Transaction } from "./types";

/**
 * Central finance summary for a month.
 *
 * Every screen derives its money math from this module so the rules stay
 * consistent everywhere:
 *
 * - Received income = actual money currently available (see
 *   `receivedForMonth` in selectors — income plans are canonical, ledger
 *   income transactions act as a fallback floor, and the max avoids double
 *   counting after migration).
 * - Expected income = projected money not yet received (`expectedAmount`).
 * - Expenses = allocated/planned spending (expense transactions).
 * - Remaining = Received - Expenses, clamped at 0 (the allocatable balance).
 * - Net = Received - Expenses (can be negative).
 * - Projected remaining = Expected - Expenses (forward-looking balance).
 */
export interface FinanceTotals {
  received: number;
  expected: number;
  transactionIncome: number;
  expenses: number;
  net: number;
  remaining: number;
  projectedRemaining: number;
  savingsRate: number | null;
}

export function monthFinance(
  transactions: Transaction[],
  incomePlans: IncomePlan[],
  month: Month,
): FinanceTotals {
  const { income: transactionIncome, expenses } = totals(transactions, month);
  const expected = expectedIncomeForMonth(incomePlans, month);
  const received = receivedForMonth(transactions, incomePlans, month);
  const net = received - expenses;
  const remaining = Math.max(0, net);
  const projectedRemaining = expected - expenses;
  const savingsRate = received > 0 ? Math.round((net / received) * 100) : null;
  return {
    received,
    expected,
    transactionIncome,
    expenses,
    net,
    remaining,
    projectedRemaining,
    savingsRate,
  };
}

export interface FinanceSeriesPoint extends FinanceTotals {
  month: Month;
}

export function financeSeries(
  transactions: Transaction[],
  incomePlans: IncomePlan[],
  months: Month[],
): FinanceSeriesPoint[] {
  return months.map((month) => ({
    month,
    ...monthFinance(transactions, incomePlans, month),
  }));
}
