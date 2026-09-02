import { effectiveLimit, expectedIncomeForMonth } from "./selectors";
import { fundingNeeds, type FundingNeed } from "./funding";
import { plannedExpensesForMonth } from "./upcoming";
import type {
  Budget,
  Category,
  FutureExpense,
  IncomePlan,
  Month,
} from "./types";

/**
 * Upcoming-month planning summary (FR-27) — a pure COMPOSITION of the
 * existing selectors, never a second financial calculation system.
 *
 * Every number here is assembled from the same sources every other surface
 * reads:
 *
 *   expectedIncome   <- `expectedIncomeForMonth` — income plans are the
 *                       canonical planning source, exactly as `monthFinance`
 *                       uses them.
 *   allocated        <- `effectiveLimit` per budget, summed. Rollovers are
 *                       structurally excluded: this module never reads
 *                       rollover records, so a planned month's limit is
 *                       ALWAYS its base limit. A boosted number must never
 *                       be shown for a month that has not happened
 *                       (user-approved FR-27 decision).
 *   plannedExpenses  <- unpaid `FutureExpense` amounts due in the month.
 *                       The RAW planned total — kept separate from the
 *                       funding verdict below, which never double-counts
 *                       (user-approved FR-27 decision).
 *   unmetObligations <- `fundingNeeds().missing` summed over real gaps. This
 *                       is THE funding-gap logic; it is never recomputed
 *                       here, so the Planner, the health checklist, the
 *                       header status and this card can never disagree.
 *
 * `totalCommitments` = allocated + unmetObligations — the money the month
 * needs: everything budgeted PLUS the part of planned spending no budget
 * covers yet, with a budgeted obligation counted ONCE through its budget.
 * `projectedRemaining` = expectedIncome − totalCommitments is the
 * forward-looking answer `monthFinance` cannot give for an unstarted month
 * (its own `projectedRemaining` only subtracts expense transactions that
 * already exist, which for a future month is none).
 */
export type MonthPlanStatus = "no-income" | "underfunded" | "funded";

export interface MonthPlan {
  month: Month;
  /** Sum of `expectedAmount` over the month's income plans. */
  expectedIncome: number;
  /** Sum of `effectiveLimit` over the month's budgets (base limits for a
   *  future month — see above). */
  allocated: number;
  /** Sum of unpaid FutureExpense amounts due in the month. */
  plannedExpenses: number;
  /** Planned spending no budget covers yet: Σ `fundingNeeds().missing`. */
  unmetObligations: number;
  /** `allocated + unmetObligations` — the month's total money requirement. */
  totalCommitments: number;
  /** `expectedIncome − totalCommitments`; negative ⇒ underfunded. */
  projectedRemaining: number;
  /** The real funding gaps (missing > 0), biggest gap first. */
  gaps: FundingNeed[];
  /** `no-income` until an income plan exists — a plan of zero cannot be
   *  called "funded" just because nothing is committed yet. */
  status: MonthPlanStatus;
}

export function monthPlan(input: {
  month: Month;
  budgets: Budget[];
  categories: Category[];
  futureExpenses: FutureExpense[];
  incomePlans: IncomePlan[];
}): MonthPlan {
  const { month, budgets, categories, futureExpenses, incomePlans } = input;

  const expectedIncome = expectedIncomeForMonth(incomePlans, month);

  // No rollover records on purpose — see the allocated note above. Passing
  // the store's records would let a future month inherit a boost that was
  // never computed for it.
  const needs = fundingNeeds(budgets, categories, futureExpenses, month);
  const gaps = needs.filter((need) => need.missing > 0);
  const unmetObligations = gaps.reduce((sum, need) => sum + need.missing, 0);

  const allocated = budgets
    .filter((budget) => budget.month === month)
    .reduce((sum, budget) => sum + effectiveLimit(budget), 0);

  const plannedExpenses = plannedExpensesForMonth(futureExpenses, month)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const totalCommitments = allocated + unmetObligations;
  const projectedRemaining = expectedIncome - totalCommitments;

  const status: MonthPlanStatus =
    expectedIncome <= 0
      ? "no-income"
      : projectedRemaining < 0
        ? "underfunded"
        : "funded";

  return {
    month,
    expectedIncome,
    allocated,
    plannedExpenses,
    unmetObligations,
    totalCommitments,
    projectedRemaining,
    gaps,
    status,
  };
}
