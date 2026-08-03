"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { needsFunding } from "@/lib/selectors";
import type { Category, Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { BudgetForm } from "./BudgetForm";

export function NeedsFundingSection({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const [fundingCategory, setFundingCategory] = useState<Category | null>(null);

  const unfunded = useMemo(
    () => needsFunding(budgets, categories, month),
    [budgets, categories, month],
  );

  return (
    <>
      <Card
        title="Needs funding"
        action={
          unfunded.length > 0 && (
            <span className="rounded-full bg-warn/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-warn">
              {unfunded.length}{" "}
              {unfunded.length === 1 ? "category" : "categories"}
            </span>
          )
        }
      >
        {unfunded.length === 0 ? (
          <EmptyState
            icon={<CheckIcon className="h-5 w-5" />}
            iconClass="bg-income/10 text-income"
            title="Everything is funded"
            description="Every expense category has a budget for this month. Add a new category in Settings to fund more."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {unfunded.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-canvas"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: `${category.color}1f` }}
                >
                  {category.icon}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-ink">
                    {category.name}
                  </p>
                  <p className="text-xs text-muted">No budget set yet</p>
                </div>
                <Button
                  variant="secondary"
                  icon={<PlusIcon className="h-4 w-4" />}
                  onClick={() => setFundingCategory(category)}
                >
                  Fund
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BudgetForm
        key={fundingCategory?.id ?? "none"}
        open={fundingCategory !== null}
        onClose={() => setFundingCategory(null)}
        month={month}
        presetCategoryId={fundingCategory?.id}
      />
    </>
  );
}
