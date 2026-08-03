import { budgetProgress, totals } from "./selectors";
import type { Budget, Category, Month, Transaction } from "./types";

export interface TrimCandidate {
  budget: Budget;
  category: Category | undefined;
  remaining: number;
}

export interface BudgetSuggestion {
  budget: Budget;
  category: Category | undefined;
  overspent: number;
  suggestedLimit: number;
  remainingIncome: number;
  coveredByRemaining: boolean;
  trim: TrimCandidate | null;
}

export function budgetSuggestions(input: {
  month: Month;
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
}): BudgetSuggestion[] {
  const { month, budgets, transactions, categories } = input;
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  const categoryOf = (id: string) =>
    categories.find((category) => category.id === id);

  const withProgress = monthBudgets.map((budget) => ({
    budget,
    progress: budgetProgress(budget, transactions),
  }));
  const over = withProgress.filter((entry) => entry.progress.over);
  if (over.length === 0) return [];

  const remainingIncome = Math.max(0, totals(transactions, month).net);

  const trimmable = withProgress
    .filter((entry) => entry.progress.remaining > 0)
    .sort((a, b) => a.progress.progress - b.progress.progress);

  return over.map(({ budget, progress }) => {
    const overspent = progress.spent - budget.limit;
    const trimEntry = trimmable.find((entry) => entry.budget.id !== budget.id);
    return {
      budget,
      category: categoryOf(budget.categoryId),
      overspent,
      suggestedLimit: progress.spent,
      remainingIncome,
      coveredByRemaining: remainingIncome >= overspent,
      trim: trimEntry
        ? {
            budget: trimEntry.budget,
            category: categoryOf(trimEntry.budget.categoryId),
            remaining: trimEntry.progress.remaining,
          }
        : null,
    };
  });
}
