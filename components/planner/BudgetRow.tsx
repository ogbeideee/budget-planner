"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
  const pct =
    budget.limit > 0 ? Math.round((100 * progress.spent) / budget.limit) : 0;
  const barTone = pct > 120 ? "danger" : pct > 100 ? "warn" : "brand";
  const stateClass = progress.over
    ? progress.spent * 5 > budget.limit * 6
      ? "bg-danger/[0.06]"
      : "bg-warn/[0.06]"
    : "";
  const name = category?.name ?? "Category";

  return (
    <div
      id={rowId}
      tabIndex={-1}
      aria-label={
        progress.over
          ? `${name} is over budget by ${formatMoney(progress.remaining * -1, currency)}`
          : undefined
      }
      className={`group flex min-h-16 items-center gap-4 rounded-lg transition-colors duration-150 ease-premium hover:bg-sidebar-hover focus:outline-none ${stateClass} ${
        highlighted ? "ring-2 ring-inset ring-brand-500/60" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-base transition-transform duration-150 ease-premium group-hover:scale-[1.04] ${
          category ? categoryAccent(category.name).chip : "bg-canvas text-muted"
        }`}
      >
        {category?.icon}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-semibold text-ink">{name}</p>
          <PriorityBadge priority={budget.priority} />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar
            value={Math.min(1, progress.progress)}
            tone={barTone}
          />
          <span
            className={`w-9 shrink-0 text-right text-caption font-semibold tabular-nums ${
              pct > 120 ? "text-danger" : pct > 100 ? "text-warn" : "text-muted"
            }`}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="hidden shrink-0 text-right tabular-nums leading-tight sm:block">
        <p className="text-base font-bold text-ink">
          {formatMoney(budget.limit, currency)}
        </p>
        <p className="mt-0.5 text-caption text-muted">
          {formatMoney(progress.spent, currency)} spent ·{" "}
          <span className={progress.remaining < 0 ? "font-semibold text-danger" : ""}>
            {formatMoney(progress.remaining, currency)}
          </span>{" "}
          left
        </p>
      </div>
      <div className="flex shrink-0 justify-end gap-1 opacity-0 transition-opacity duration-150 ease-premium group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 px-0"
          icon={<PencilIcon className="h-4 w-4" />}
          aria-label={`Edit budget for ${name}`}
          onClick={onEdit}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 px-0"
          icon={<TrashIcon className="h-4 w-4" />}
          aria-label={`Delete budget for ${name}`}
          onClick={onDelete}
        />
      </div>
    </div>
  );
});
