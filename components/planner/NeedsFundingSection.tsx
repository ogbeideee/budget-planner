"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fundingGaps } from "@/lib/selectors";
import type { FundingGap } from "@/lib/selectors";
import { fundingUrgency } from "@/lib/upcoming";
import { formatMoney } from "@/lib/money";
import type { Category, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { BudgetForm } from "./BudgetForm";

const URGENCY_BADGE: Record<
  "critical" | "soon" | "low",
  { label: string; className: string }
> = {
  critical: { label: "Critical", className: "text-danger" },
  soon: { label: "Due soon", className: "text-warn" },
  low: { label: "Low priority", className: "text-muted" },
};

function progressTone(ratio: number): "brand" | "warn" | "danger" {
  if (ratio >= 0.7) return "brand";
  if (ratio >= 0.4) return "warn";
  return "danger";
}

export function NeedsFundingSection({
  month,
  attentionOnly = false,
  onExpand,
}: {
  month: Month;
  attentionOnly?: boolean;
  onExpand?: () => void;
}) {
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const currency = useAppStore((s) => s.state.settings.currency);
  const [fundingCategory, setFundingCategory] = useState<Category | null>(null);

  const gaps = useMemo(
    () => fundingGaps(budgets, categories, futureExpenses, month),
    [budgets, categories, futureExpenses, month],
  );

  const visible = attentionOnly ? gaps.slice(0, 3) : gaps;
  const hidden = gaps.length - visible.length;

  if (attentionOnly && visible.length === 0) return null;

  const fmt = (value: number) => formatMoney(value, currency);

  const fund = (gap: FundingGap) => {
    const existing = budgets.find(
      (budget) =>
        budget.month === month && budget.categoryId === gap.category.id,
    );
    if (existing) {
      window.dispatchEvent(
        new CustomEvent("planner:focus-budget", {
          detail: { budgetId: existing.id },
        }),
      );
      return;
    }
    setFundingCategory(gap.category);
  };

  const handleFormClose = () => {
    const category = fundingCategory;
    setFundingCategory(null);
    if (!category) return;
    const created = useAppStore
      .getState()
      .state.budgets.find(
        (budget) => budget.month === month && budget.categoryId === category.id,
      );
    if (created) {
      window.dispatchEvent(
        new CustomEvent("planner:focus-budget", {
          detail: { budgetId: created.id },
        }),
      );
    }
  };

  return (
    <>
      <section className="flex flex-col gap-3">
        {gaps.length === 0 ? (
          <div className="flex animate-[list-in_200ms_var(--ease-premium)] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-income/10 text-income"
            >
              <CheckIcon className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold tracking-tight text-ink">
                Everything is funded
              </p>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
                Your budget already covers every upcoming expense this month.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end">
              <span className="rounded-full bg-warn/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-warn">
                {gaps.length}{" "}
                {gaps.length === 1 ? "category" : "categories"} needing funding
              </span>
            </div>
            <ul className="flex flex-col gap-1 rounded-xl bg-canvas px-2 py-1.5">
              {visible.map((gap) => {
                const urgency = fundingUrgency(
                  futureExpenses,
                  gap.category.id,
                );
                const badge = URGENCY_BADGE[urgency];
                const ratio =
                  gap.target > 0 ? gap.allocated / gap.target : 0;
                return (
                  <li
                    key={gap.category.id}
                    className="rounded-md px-2 py-2 transition-colors hover:bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                        style={{
                          backgroundColor: `${gap.category.color}1f`,
                        }}
                      >
                        {gap.category.icon}
                      </span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium text-ink">
                          {gap.category.name}
                        </p>
                        <p
                          className={`text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<PlusIcon className="h-4 w-4" />}
                        onClick={() => fund(gap)}
                      >
                        Fund
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3 sm:gap-2">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-muted">Allocated</span>
                        <span className="font-semibold tabular-nums text-ink">
                          {fmt(gap.allocated)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-muted">Needed</span>
                        <span className="font-semibold tabular-nums text-ink">
                          {fmt(gap.target)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-muted">Missing</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            gap.missing > 0 ? "text-danger" : "text-muted"
                          }`}
                        >
                          {fmt(gap.missing)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar
                        value={ratio}
                        tone={progressTone(ratio)}
                        className="h-1.5"
                      />
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">
                        {Math.round(ratio * 100)}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {hidden > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronDownIcon className="h-3.5 w-3.5" />}
                onClick={onExpand}
                className="self-start"
              >
                View all {gaps.length} categories
              </Button>
            )}
          </>
        )}
      </section>

      <BudgetForm
        key={fundingCategory?.id ?? "none"}
        open={fundingCategory !== null}
        onClose={handleFormClose}
        month={month}
        presetCategoryId={fundingCategory?.id}
        presetLimit={
          fundingCategory
            ? gaps.find((gap) => gap.category.id === fundingCategory.id)
                ?.missing
            : undefined
        }
      />
    </>
  );
}
