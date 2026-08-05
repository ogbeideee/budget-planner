"use client";

import { useMemo } from "react";
import { monthFinance } from "@/lib/finance";
import { needsFunding, overBudgetCategories } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function usePlannerStatus(month: Month): string {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);

  return useMemo(() => {
    const { received: income, net } = monthFinance(
      transactions,
      incomePlans,
      month,
    );
    if (income === 0) return "Set your monthly income to start planning.";
    const unfunded = needsFunding(budgets, categories, month).length;
    if (unfunded > 0) {
      return `${unfunded} budget${unfunded === 1 ? "" : "s"} still need funding.`;
    }
    const over = overBudgetCategories(budgets, transactions, month).length;
    if (over > 0) {
      return `${over} budget${over === 1 ? "" : "s"} over limit this month.`;
    }
    if (net < 0) return "Spending more than income this month.";
    return "Everything is on track this month.";
  }, [transactions, incomePlans, budgets, categories, month]);
}
