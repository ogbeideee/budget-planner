"use client";

import { useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import type { FutureExpense } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

/**
 * The ONE "mark a planned expense paid" path: record the real expense
 * transaction dated on the due date and flag the FutureExpense paid. Both
 * the Upcoming screen and the Planner's month plan (FR-27) go through this
 * hook, so the two surfaces can never drift apart in what "paid" means.
 */
export function useMarkExpensePaid() {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateFutureExpense = useAppStore((s) => s.updateFutureExpense);
  const { success } = useToast();

  return useCallback(
    (expense: FutureExpense) => {
      addTransaction({
        categoryId: expense.categoryId,
        amount: expense.amount,
        type: "expense",
        date: expense.dueDate,
        note: expense.notes ?? expense.title,
      });
      updateFutureExpense(expense.id, { status: "paid" });
      success("Paid — added to your timeline and budget.");
    },
    [addTransaction, updateFutureExpense, success],
  );
}
