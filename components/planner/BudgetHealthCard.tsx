"use client";

import { useMemo } from "react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Card } from "@/components/ui/Card";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { budgetHealth, healthTier, overBudgetCategories } from "@/lib/selectors";
import { fundingNeeds } from "@/lib/funding";
import { monthFinance } from "@/lib/finance";
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
  healthy: "bg-success-surface text-success-text",
  watch: "bg-upcoming-surface text-warn-text",
  risk: "bg-expense-surface text-danger-text",
};

export function BudgetHealthCard({ month }: { month: Month }) {
  const transactions = useAppStore((s) => s.state.transactions);
  const budgets = useAppStore((s) => s.state.budgets);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);

  const health = useMemo(
    () => budgetHealth(budgets, transactions, month, incomePlans),
    [budgets, transactions, month, incomePlans],
  );
  const overCount = useMemo(
    () => overBudgetCategories(budgets, transactions, month).length,
    [budgets, transactions, month],
  );
  const unfundedCount = useMemo(
    () => fundingNeeds(budgets, categories, futureExpenses, month).length,
    [budgets, categories, futureExpenses, month],
  );
  const net = useMemo(
    () => monthFinance(transactions, incomePlans, month).net,
    [transactions, incomePlans, month],
  );
  const tier = healthTier(health);
  const animatedHealth = useAnimatedNumber(health);

  const insights = [
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
    <Card
      title="Budget Health"
      subtitle={TIER_DESCRIPTION[tier]}
      action={
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${TIER_BADGE[tier]}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              tier === "healthy"
                ? "bg-income"
                : tier === "watch"
                  ? "bg-warn"
                  : "bg-danger"
            }`}
          />
          {TIER_LABEL[tier]}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-center py-2">
          <CircularProgress
            value={animatedHealth / 100}
            tone={TIER_TONE[tier]}
            size={148}
            strokeWidth={12}
          >
            <AnimatedNumber
              value={animatedHealth}
              className="text-kpi-micro font-bold leading-none tracking-[-0.02em] tabular-nums text-ink"
            />
            <span className="mt-1 text-caption font-medium text-muted">
              out of 100
            </span>
          </CircularProgress>
        </div>
        <ul className="flex flex-col">
          {insights.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors duration-150 ease-premium hover:bg-sidebar-hover"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-ink">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.ok
                      ? "bg-success-surface text-income"
                      : "bg-expense-surface text-danger"
                  }`}
                >
                  {item.ok ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <XIcon className="h-4 w-4" />
                  )}
                </span>
                {item.label}
              </span>
              <span
                className={`text-caption font-semibold ${
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
