"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";
import type { BudgetProgress } from "@/lib/selectors";
import type { Budget, Category, Currency } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

export interface BudgetRowProps {
  budget: Budget;
  category?: Category;
  progress: BudgetProgress;
  currency: Currency;
  onEdit: () => void;
  onDelete: () => void;
}

export const BudgetRow = memo(function BudgetRow({
  budget,
  category,
  progress,
  currency,
  onEdit,
  onDelete,
}: BudgetRowProps) {
  const pct = budget.limit > 0 ? Math.round(progress.progress * 100) : 0;
  const stateClass = progress.over
    ? progress.spent * 5 > budget.limit * 6
      ? "bg-red-50 dark:bg-red-950/60"
      : "bg-amber-50 dark:bg-amber-950/60"
    : "";
  const name = category?.name ?? "Category";

  return (
    <tr className={stateClass}>
      <td className="px-3 py-3">
        <span className="flex items-center gap-2 font-medium text-ink">
          <span aria-hidden="true">{category?.icon}</span>
          {name}
        </span>
      </td>
      <td className="px-3 py-3">
        <PriorityBadge priority={budget.priority} />
      </td>
      <td className="px-3 py-3 tabular-nums">{formatMoney(budget.limit, currency)}</td>
      <td className="px-3 py-3 tabular-nums">{formatMoney(progress.spent, currency)}</td>
      <td
        className={`px-3 py-3 tabular-nums ${
          progress.remaining < 0 ? "font-semibold text-danger" : ""
        }`}
      >
        {formatMoney(progress.remaining, currency)}
      </td>
      <td className="px-3 py-3">
        <span className={`tabular-nums ${pct > 100 ? "font-semibold text-danger" : "text-muted"}`}>
          {pct}%
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            icon="✎"
            aria-label={`Edit budget for ${name}`}
            onClick={onEdit}
          />
          <Button
            variant="ghost"
            icon="🗑"
            aria-label={`Delete budget for ${name}`}
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
});
