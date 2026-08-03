"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { budgetHealth, healthTier, needsFunding, overBudgetCategories, totals } from "@/lib/selectors";
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

const TIER_BADGE: Record<HealthTier, string> = {
  healthy: "bg-income/10 text-income",
  watch: "bg-warn/10 text-warn",
  risk: "bg-danger/10 text-danger",
};

export function BudgetHealthCard({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);

  const health = useMemo(
    () => budgetHealth(budgets, transactions, month),
    [budgets, transactions, month],
  );
  const overCount = useMemo(
    () => overBudgetCategories(budgets, transactions, month).length,
    [budgets, transactions, month],
  );
  const unfundedCount = useMemo(
    () => needsFunding(budgets, categories, month).length,
    [budgets, categories, month],
  );
  const net = useMemo(() => totals(transactions, month).net, [transactions, month]);
  const tier = healthTier(health);

  const checklist = [
    {
      label: "Budgets within limits",
      ok: overCount === 0,
      status: overCount === 0 ? "On track" : `${overCount} over`,
    },
    {
      label: "Every category funded",
      ok: unfundedCount === 0,
      status:
        unfundedCount === 0 ? "On track" : `${unfundedCount} unfunded`,
    },
    {
      label: "Income covers expenses",
      ok: net >= 0,
      status: net >= 0 ? "On track" : "Shortfall",
    },
  ];

  return (
    <Card title="Budget health">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums tracking-tight text-ink">
              {health}
            </span>
            <span className="text-sm font-semibold text-muted">/100</span>
          </p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE[tier]}`}
          >
            {TIER_LABEL[tier]}
          </span>
        </div>
        <ProgressBar value={health / 100} tone={TIER_TONE[tier]} />
        <ul className="flex flex-col gap-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                {item.ok ? (
                  <CheckIcon className="h-4 w-4 shrink-0 text-income" />
                ) : (
                  <XIcon className="h-4 w-4 shrink-0 text-danger" />
                )}
                {item.label}
              </span>
              <span
                className={`text-xs font-semibold ${
                  item.ok ? "text-muted" : "text-danger"
                }`}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
