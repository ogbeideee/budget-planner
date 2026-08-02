"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
        title="Needs Funding"
        action={
          unfunded.length > 0 && (
            <span className="text-sm font-semibold tabular-nums text-muted">
              {unfunded.length}{" "}
              {unfunded.length === 1 ? "category needs" : "categories need"}{" "}
              funding
            </span>
          )
        }
      >
        {unfunded.length === 0 ? (
          <p className="py-8 text-center text-sm text-income">
            ✓ Everything is funded — nice.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {unfunded.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-canvas"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-base"
                >
                  {category.icon}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {category.name}
                </p>
                <Button
                  variant="secondary"
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
