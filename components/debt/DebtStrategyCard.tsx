"use client";

import { Card } from "@/components/ui/Card";
import { CheckIcon } from "@/components/ui/icons";
import {
  formatPayoffDuration,
  type PayoffPlan,
  type PayoffStrategy,
} from "@/lib/debtPayoff";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

export interface DebtStrategyCardProps {
  option: { value: PayoffStrategy; label: string; blurb: string };
  plan: PayoffPlan;
  currency: Currency;
  nameFor: (debtId: string) => string;
  /** The user's active plan — a display preference, nothing is automated. */
  selected: boolean;
  /** True on whichever strategy costs less interest. */
  recommended: boolean;
  onSelect: () => void;
}

/**
 * One strategy's projection: headline months and interest, then the payoff
 * order with the month each debt clears.
 */
export function DebtStrategyCard({
  option,
  plan,
  currency,
  nameFor,
  selected,
  recommended,
  onSelect,
}: DebtStrategyCardProps) {
  return (
    <Card
      className={
        selected ? "ring-2 ring-inset ring-brand-500/60" : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">{option.label}</h3>
              {recommended && (
                <span className="shrink-0 rounded-full bg-brand-500/10 px-2 py-0.5 text-caption font-semibold text-brand-600 dark:text-brand-400">
                  Costs least
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">{option.blurb}</p>
          </div>
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none ${
              selected
                ? "bg-brand-600 text-white"
                : "border border-border text-muted hover:border-brand-500/50 hover:text-ink"
            }`}
          >
            {selected && <CheckIcon className="h-4 w-4 shrink-0" />}
            {selected ? "Active plan" : "Use this"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-y border-border/60 py-3">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">
              Debt-free in
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">
              {formatPayoffDuration(plan.months, plan.stalled)}
            </p>
          </div>
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">
              Interest paid
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">
              {formatMoney(plan.totalInterest, currency)}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-muted">
            Payoff order
          </p>
          {/* Labelled because the page renders two of these lists; unlabelled
              they both announce only as "list" to a screen reader. */}
          <ol
            aria-label={`${option.label} payoff order`}
            className="flex flex-col gap-1.5"
          >
            {plan.order.map((milestone) => (
              <li
                key={milestone.debtId}
                className="flex items-center gap-2.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-caption font-bold tabular-nums text-muted"
                >
                  {milestone.order}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {nameFor(milestone.debtId)}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {milestone.clearedInMonth === null
                    ? "—"
                    : formatPayoffDuration(milestone.clearedInMonth)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {plan.stalled && (
          <p className="text-sm text-warn">
            These payments don&rsquo;t outrun the interest, so the balances
            never clear at this amount.
          </p>
        )}
      </div>
    </Card>
  );
}
