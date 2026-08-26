"use client";

import type { CSSProperties } from "react";
import { memo } from "react";
import {
  ArrowsExchangeIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMoney } from "@/lib/money";
import type { BudgetProgress } from "@/lib/selectors";
import type { Budget, Category, Currency } from "@/lib/types";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { PriorityBadge } from "./PriorityBadge";
import { RolloverBadge } from "./RolloverBadge";

/** 32px touch target, 16px glyph, `text-muted` at rest on every row tint. */
const ACTION_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-brand-500/10 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none dark:hover:text-brand-400";

const ACTION_DANGER_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-expense/10 hover:text-expense focus-visible:ring-2 focus-visible:ring-expense/50 focus:outline-none";

export interface BudgetRowProps {
  budget: Budget;
  category?: Category;
  progress: BudgetProgress;
  currency: Currency;
  /** Opens the budget edit form (limit + priority) for this category. */
  onEdit: () => void;
  /** Opens the per-category allocation drawer. */
  onAllocate: () => void;
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
  onAllocate,
  onDelete,
  highlighted = false,
  rowId,
}: BudgetRowProps) {
  // Percentages, the over-limit marker and the headline figure all measure
  // against the EFFECTIVE limit (base + carryover) so a boosted row is not
  // reported as over budget while it still has rolled-over funds to spend.
  // `progress.limit` equals `budget.limit` whenever nothing rolled over.
  const limit = progress.limit;
  const pct = limit > 0 ? Math.round((100 * progress.spent) / limit) : 0;
  const over = progress.over;
  const farOver = over && progress.spent * 5 > limit * 6;
  const rolled = progress.rolledOver;
  const display = categoryDisplay(category, "Category");
  const name = display.name;
  const barColor = over
    ? farOver
      ? "#ef4444"
      : "#f97316"
    : display.strong;
  // Where the limit sits inside the full (over-limit) bar: the bar represents
  // everything spent, so the limit lands at limit/spent of its width.
  const limitMark =
    over && progress.spent > 0 ? (100 * limit) / progress.spent : undefined;
  const overage = over ? progress.spent - limit : 0;

  return (
    <div
      id={rowId}
      tabIndex={-1}
      aria-label={
        over
          ? `${name} is over budget by ${formatMoney(progress.remaining * -1, currency)}`
          : undefined
      }
      style={
        {
          "--row-tint": over ? "var(--color-expense-surface)" : display.tint,
        } as CSSProperties
      }
      className={`group flex min-h-[40px] items-center gap-x-3 rounded-lg bg-[var(--row-tint)] px-2.5 py-1 transition-colors duration-150 ease-premium focus:outline-none ${
        highlighted ? "ring-2 ring-inset ring-brand-500/60" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs transition-transform duration-150 ease-premium group-hover:scale-[1.04] ${
          display.chip
        }`}
      >
        {display.icon}
      </span>
      <div className="min-w-0 flex-1 leading-none">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">
            {name}
          </span>
          <span className="shrink-0">
            <PriorityBadge priority={budget.priority} />
          </span>
          <RolloverBadge
            amount={rolled}
            baseLimit={progress.baseLimit}
            currency={currency}
            chip={display.chip}
          />
          {over && (
            <span className="ml-auto shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-caption font-semibold tabular-nums text-danger">
              {pct}% · {formatMoney(overage, currency)} over
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 flex-1">
              <ProgressBar
                value={Math.min(1, progress.progress)}
                tone="brand"
                fillColor={barColor}
                markerPercent={limitMark}
                markerLabel={
                  limitMark === undefined
                    ? undefined
                    : `Limit ${formatMoney(limit, currency)}`
                }
                thin
              />
            </span>
            <span
              className="shrink-0 text-caption font-semibold tabular-nums"
              style={{ color: barColor }}
            >
              {pct}%
            </span>
          </span>
          <span className="min-w-0 truncate text-caption tabular-nums text-muted">
            {formatMoney(progress.spent, currency)} spent ·{" "}
            <span className={progress.remaining < 0 ? "font-semibold text-danger" : ""}>
              {formatMoney(progress.remaining, currency)}
            </span>{" "}
            left
          </span>
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-sm font-semibold tabular-nums text-ink">
              {formatMoney(limit, currency)}
            </span>
            {rolled > 0 && (
              <span className="block text-caption tabular-nums text-muted">
                {formatMoney(progress.baseLimit, currency)} + {formatMoney(rolled, currency)}
              </span>
            )}
          </span>
        </div>
      </div>
      {/* Icon-only actions use a plain button, matching RecentActivity and
          TransactionCard. The shared `Button` cannot be used here: its `sm`
          size hard-codes `px-3`, which a `px-0` in `className` does NOT
          override (same specificity — compiled CSS order wins), so a 24px-wide
          button had a 0px content box and squeezed the icon to zero width.

          Always visible — NOT a hover-reveal. These three are the only way to
          edit, allocate or delete a budget, so hiding them at rest left them
          undiscoverable on touch and invisible to anyone not using a mouse.
          `text-muted` clears 3:1 against every row background in this list,
          including the over-limit red tint; hover/focus adds emphasis rather
          than revealing. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`Edit ${name} budget`}
          onClick={onEdit}
          className={ACTION_BUTTON}
        >
          <PencilIcon className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          aria-label={`Allocate funds to ${name}`}
          onClick={onAllocate}
          className={ACTION_BUTTON}
        >
          <ArrowsExchangeIcon className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          aria-label={`Delete budget for ${name}`}
          onClick={onDelete}
          className={ACTION_DANGER_BUTTON}
        >
          <TrashIcon className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
});
