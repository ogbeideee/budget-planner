"use client";

import { useMemo } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
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

const TIER_DESCRIPTION: Record<HealthTier, string> = {
  healthy: "Your budget is in great shape.",
  watch: "A few items need attention.",
  risk: "Several budget lines are under pressure.",
};

const TIER_BADGE: Record<HealthTier, string> = {
  healthy: "bg-income/10 text-income",
  watch: "bg-warn/10 text-warn",
  risk: "bg-danger/10 text-danger",
};

const TIER_DOT: Record<HealthTier, string> = {
  healthy: "bg-income",
  watch: "bg-warn",
  risk: "bg-danger",
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
  const animatedHealth = useAnimatedNumber(health);

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
            <AnimatedNumber
              value={health}
              className="text-4xl font-bold tracking-tight tabular-nums text-ink"
            />
            <span className="text-sm font-semibold text-muted">/100</span>
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TIER_BADGE[tier]}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[tier]}`}
            />
            {TIER_LABEL[tier]}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={animatedHealth / 100} tone={TIER_TONE[tier]} />
          <p className="text-xs text-muted">{TIER_DESCRIPTION[tier]}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {checklist.map((item) => (
            <li
              key={item.label}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
                item.ok
                  ? "border-income/20 bg-income/[0.04]"
                  : "border-danger/25 bg-danger/[0.05]"
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    item.ok ? "bg-income/15 text-income" : "bg-danger/10 text-danger"
                  }`}
                >
                  {item.ok ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <XIcon className="h-3.5 w-3.5" />
                  )}
                </span>
                {item.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.ok ? "bg-income/10 text-income" : "bg-danger/10 text-danger"
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