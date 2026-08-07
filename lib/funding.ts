// Single source of truth for "Needs Funding".
//
// Every surface that talks about funding gaps — the Planner's Needs Funding
// panel, the Budget Health checklist, the header status line and the insights
// card — derives from THIS one pure selector. Nothing else recomputes funding
// on its own, so the app can never disagree with itself about what still needs
// funding.
//
// Data flow (all inputs are the current store state for the selected month):
//   budgets         -> `allocated` per category (the month's budget limit; a
//                       missing budget or a limit of 0 counts as unbudgeted)
//   futureExpenses  -> `target` per category (sum of unpaid upcoming expenses
//                       due in the selected month)
//   categories      -> the row set (expense categories only)
//   month           -> the Planner's selected month (all rows are month-scoped)
//
// A category is a funding need when EITHER:
//   - it has no budget with a positive limit for the month (AC-25 checklist:
//     a new category appears immediately, before any expense exists), or
//   - its upcoming obligations for the month exceed the allocated limit
//     (obligation gap: Missing = max(Target - Allocated, 0) > 0).
import type { Budget, Category, FutureExpense, Month } from "./types";

export interface FundingNeed {
  category: Category;
  /** Sum of unpaid upcoming expenses due in the selected month. */
  target: number;
  /** The month's budget limit for the category (0 when unbudgeted). */
  allocated: number;
  /** max(target - allocated, 0). */
  missing: number;
  /** A budget with a positive limit exists for this category and month. */
  budgeted: boolean;
}

export function fundingNeeds(
  budgets: Budget[],
  categories: Category[],
  futureExpenses: FutureExpense[],
  month: Month,
): FundingNeed[] {
  const needs: FundingNeed[] = [];
  for (const category of categories) {
    if (category.kind !== "expense") continue;
    const budget = budgets.find(
      (candidate) =>
        candidate.month === month && candidate.categoryId === category.id,
    );
    const allocated = budget?.limit ?? 0;
    const budgeted = allocated > 0;
    const target = futureExpenses
      .filter(
        (expense) =>
          expense.status === "upcoming" &&
          expense.categoryId === category.id &&
          expense.dueDate.startsWith(month),
      )
      .reduce((sum, expense) => sum + expense.amount, 0);
    const missing = Math.max(target - allocated, 0);
    if (budgeted && missing <= 0) continue;
    needs.push({ category, target, allocated, missing, budgeted });
  }
  return needs.sort(
    (a, b) =>
      b.missing - a.missing ||
      a.category.name.localeCompare(b.category.name),
  );
}
