"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fundingNeeds } from "@/lib/funding";
import type { FundingNeed } from "@/lib/funding";
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

  const needs = useMemo(
    () => fundingNeeds(budgets, categories, futureExpenses, month),
    [budgets, categories, futureExpenses, month],
  );

  const visible = attentionOnly ? needs.slice(0, 3) : needs;
  const hidden = needs.length - visible.length;

  if (attentionOnly && visible.length === 0) return null;

  const fmt = (value: number) => formatMoney(value, currency);

  const fund = (need: FundingNeed) => {
    const existing = budgets.find(
      (budget) =>
        budget.month === month && budget.categoryId === need.category.id,
    );
    if (existing) {
      window.dispatchEvent(
        new CustomEvent("planner:focus-budget", {
          detail: { budgetId: existing.id },
        }),
      );
      return;
    }
    setFundingCategory(need.category);
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
        {needs.length === 0 ? (
          <div className="flex animate-[list-in_200ms_var(--ease-premium)] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-income/[0.08] text-income"
            >
              <CheckIcon className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold tracking-tight text-ink">
                Everything is funded
              </p>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
                Every expense category has a budget this month.
              </p>
            </div>
          </div>
        ) : (
          <>
          <div className="flex items-center justify-end">
            <span className="rounded-full border border-warn/25 bg-warn/[0.07] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-warn">
              {needs.length}{" "}
              {needs.length === 1 ? "category" : "categories"} needing funding
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {visible.map((need) => {
              const urgency = fundingUrgency(
                futureExpenses,
                need.category.id,
              );
              const badge = URGENCY_BADGE[urgency];
              const ratio =
                need.target > 0 ? need.allocated / need.target : 0;
              return (
                <li
                  key={need.category.id}
                  className="group flex h-16 items-center gap-4 rounded-lg transition-colors duration-150 ease-premium hover:bg-sidebar-hover"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base transition-transform duration-150 ease-premium group-hover:scale-[1.04]"
                    style={{
                      backgroundColor: `${need.category.color}1f`,
                    }}
                  >
                    {need.category.icon}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-base font-semibold text-ink">
                        {need.category.name}
                      </p>
                      <span className={`shrink-0 text-caption font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar
                        value={ratio}
                        tone={progressTone(ratio)}
                      />
                      <span className="w-9 shrink-0 text-right text-caption font-semibold tabular-nums text-muted">
                        {Math.round(ratio * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-0.5 text-caption leading-tight xl:flex">
                    <span className="font-medium text-muted">
                      Allocated{" "}
                      <span className="font-semibold tabular-nums text-ink">
                        {fmt(need.allocated)}
                      </span>
                    </span>
                    <span className="font-medium text-muted">
                      Needed{" "}
                      <span className="font-semibold tabular-nums text-ink">
                        {fmt(need.target)}
                      </span>
                    </span>
                    <span className="font-medium text-muted">
                      Missing{" "}
                      <span
                        className={`font-semibold tabular-nums ${
                          need.missing > 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {fmt(need.missing)}
                      </span>
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0 px-5"
                    icon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => fund(need)}
                  >
                    Fund
                  </Button>
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
                View all {needs.length} categories
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
            ? needs.find((need) => need.category.id === fundingCategory.id)
                ?.missing || undefined
            : undefined
        }
      />
    </>
  );
}
