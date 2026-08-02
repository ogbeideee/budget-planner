"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { budgetHealth, healthTier, overBudgetCategories } from "@/lib/selectors";
import type { HealthTier } from "@/lib/selectors";
import type { Month } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const TIER_TONE: Record<HealthTier, "brand" | "warn" | "danger"> = {
  healthy: "brand",
  watch: "warn",
  risk: "danger",
};

const TIER_LABEL: Record<HealthTier, string> = {
  healthy: "Healthy",
  watch: "Watch",
  risk: "At risk",
};

const TIER_TEXT: Record<HealthTier, string> = {
  healthy: "text-income",
  watch: "text-warn",
  risk: "text-danger",
};

export function BudgetHealthCard({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);

  const health = useMemo(
    () => budgetHealth(budgets, transactions, month),
    [budgets, transactions, month],
  );
  const overCount = useMemo(
    () => overBudgetCategories(budgets, transactions, month).length,
    [budgets, transactions, month],
  );
  const tier = healthTier(health);

  return (
    <Card title="Budget health">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-3xl font-bold tabular-nums text-ink">{health}</p>
          <span className={`text-sm font-semibold ${TIER_TEXT[tier]}`}>
            {TIER_LABEL[tier]}
          </span>
        </div>
        <ProgressBar value={health / 100} tone={TIER_TONE[tier]} />
        <p className="text-sm text-muted">
          {overCount === 0
            ? "No budgets over limit this month."
            : `${overCount} budget${overCount === 1 ? "" : "s"} over limit this month.`}
        </p>
      </div>
    </Card>
  );
}
