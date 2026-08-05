"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { categoryAccent } from "@/lib/accents";
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
  highlighted?: boolean;
  rowId?: string;
}

export const BudgetRow = memo(function BudgetRow({
  budget,
  category,
  progress,
  currency,
  onEdit,
  onDelete,
  highlighted = false,
  rowId,
}: BudgetRowProps) {
  const pct = budget.limit > 0 ? Math.round(progress.progress * 100) : 0;
  const stateClass = progress.over
    ? progress.spent * 5 > budget.limit * 6
      ? "bg-danger/10"
      : "bg-warn/10"
    : "";
  const name = category?.name ?? "Category";

  return (
    <tr
      id={rowId}
      tabIndex={-1}
      aria-label={
        progress.over
          ? `${name} is over budget by ${formatMoney(progress.remaining * -1, currency)}`
          : undefined
      }
      className={`${stateClass} transition hover:brightness-95 dark:hover:brightness-125 focus:outline-none ${
        highlighted ? "ring-2 ring-inset ring-brand-500/70" : ""
      }`}
    >
      <td className="px-3 py-3">
        <span className="flex items-center gap-2 font-medium text-ink">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm ${
              category ? categoryAccent(category.name).chip : "bg-canvas text-muted"
            }`}
          >
            {category?.icon}
          </span>
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
            icon={<PencilIcon className="h-4 w-4" />}
            aria-label={`Edit budget for ${name}`}
            onClick={onEdit}
          />
          <Button
            variant="ghost"
            icon={<TrashIcon className="h-4 w-4" />}
            aria-label={`Delete budget for ${name}`}
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
});
