"use client";

import { useMemo } from "react";
import { useOverridableValue } from "@/hooks/useOverridableValue";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MetricCard } from "@/components/ui/MetricCard";
import { RepeatIcon, TargetIcon, WalletIcon } from "@/components/ui/icons";
import { categoryDisplay } from "@/lib/categoryRegistry";
import { currentMonthKey } from "@/lib/date";
import {
  PAYOFF_STRATEGIES,
  comparePayoff,
  formatApr,
  formatPayoffDuration,
  type PayoffDebtInput,
  type PayoffPlan,
} from "@/lib/debtPayoff";
import { monthFinance } from "@/lib/finance";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import { useAppStore } from "@/store/useAppStore";
import type { Currency, Debt } from "@/lib/types";
import { DebtStrategyCard } from "./DebtStrategyCard";

export function DebtPayoffView() {
  const debts = useAppStore((s) => s.state.debts);
  const categories = useAppStore((s) => s.state.categories);
  const transactions = useAppStore((s) => s.state.transactions);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const strategy = useAppStore((s) => s.state.settings.debtStrategy);
  const setDebtStrategy = useAppStore((s) => s.setDebtStrategy);

  const month = currentMonthKey();
  // The Planner's "Remaining" figure — what is left of this month's received
  // income after spending. Used only as the STARTING suggestion: the input
  // below is the user's to change, and is never re-locked to this number.
  const suggested = useMemo(
    () => monthFinance(transactions, incomePlans, month).remaining,
    [transactions, incomePlans, month],
  );

  // Tracks the suggestion until the user types, then keeps whatever they
  // entered — including an empty string. A lazy `useState` initializer would
  // pin the field to the suggestion as it stood on first render and never
  // follow income arriving or spending changing it afterwards.
  const [extraInput, setExtraInput, resetExtra] = useOverridableValue(
    suggested > 0 ? minorToInput(suggested) : "",
  );
  const parsedExtra = toMinorUnits(extraInput);
  const extraValid = extraInput.trim() === "" || isMinorUnitsValid(parsedExtra);
  const extra = extraValid && parsedExtra > 0 ? parsedExtra : 0;

  const inputs = useMemo<PayoffDebtInput[]>(
    () =>
      debts
        .filter((debt) => debt.balance > 0)
        .map((debt) => ({
          id: debt.id,
          balance: debt.balance,
          aprBps: debt.aprBps,
          minimumPayment: debt.minimumPayment,
        })),
    [debts],
  );

  const comparison = useMemo(
    () => comparePayoff(inputs, extra),
    [inputs, extra],
  );

  const byId = useMemo(
    () => new Map(debts.map((debt) => [debt.id, debt])),
    [debts],
  );
  const nameFor = (debtId: string) => {
    const debt = byId.get(debtId);
    const category = categories.find((c) => c.id === debt?.categoryId);
    return categoryDisplay(category, "Debt").name;
  };

  const totalBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimum = debts
    .filter((debt) => debt.balance > 0)
    .reduce((sum, debt) => sum + debt.minimumPayment, 0);

  if (debts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          icon={<WalletIcon className="h-6 w-6" />}
          title="No debts tracked yet"
          description="Turn on “Track as debt” when editing a category to add its balance, interest rate and minimum payment. Two or more lets you compare payoff strategies."
          action={
            <Link
              href="/settings"
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
            >
              Manage categories
            </Link>
          }
        />
      </div>
    );
  }

  const active = comparison.mode !== "none";
  const activePlan: PayoffPlan =
    strategy === "snowball" ? comparison.snowball : comparison.avalanche;

  return (
    <div className="flex flex-col gap-8">
      <Header />

      <section aria-label="Debt overview" className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            compact
            ariaLabel="Total debt balance"
            label="Total owed"
            icon={<WalletIcon className="h-5 w-5" />}
            value={formatMoney(totalBalance, currency)}
            support={`${debts.length} ${debts.length === 1 ? "debt" : "debts"} tracked`}
          />
          <MetricCard
            compact
            ariaLabel="Total minimum payments"
            label="Minimums"
            icon={<RepeatIcon className="h-5 w-5" />}
            value={formatMoney(totalMinimum, currency)}
            support="Due every month"
          />
          <MetricCard
            compact
            ariaLabel="Monthly payoff budget"
            label="Monthly total"
            icon={<TargetIcon className="h-5 w-5" />}
            value={formatMoney(totalMinimum + extra, currency)}
            support={
              extra > 0
                ? `Minimums + ${formatMoney(extra, currency)} extra`
                : "Minimums only"
            }
          />
        </div>
      </section>

      <section aria-label="Debts" className="flex flex-col gap-3">
        <SectionHeading>Your debts</SectionHeading>
        <Card>
          <ul className="flex flex-col divide-y divide-border/60">
            {[...debts]
              .sort((a, b) => b.balance - a.balance)
              .map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  name={nameFor(debt.id)}
                  currency={currency}
                />
              ))}
          </ul>
        </Card>
      </section>

      <section aria-label="Extra payment" className="flex flex-col gap-3">
        <SectionHeading>Extra toward payoff</SectionHeading>
        <Card>
          <div className="flex flex-col gap-3">
            <label
              htmlFor="extra-payment"
              className="text-sm font-semibold text-ink"
            >
              Extra per month, on top of the minimums
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="extra-payment"
                inputMode="decimal"
                placeholder="0.00"
                value={extraInput}
                onChange={(event) => setExtraInput(event.target.value)}
                aria-invalid={!extraValid}
                className="h-11 w-40 rounded-xl border border-border/80 bg-surface px-3.5 text-sm tabular-nums text-ink transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {suggested > 0 && parsedExtra !== suggested && (
                <button
                  type="button"
                  onClick={resetExtra}
                  className="h-9 rounded-lg border border-border px-3 text-sm font-semibold text-muted transition-colors hover:border-brand-500/50 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none"
                >
                  Use this month&rsquo;s remaining (
                  {formatMoney(suggested, currency)})
                </button>
              )}
            </div>
            {!extraValid ? (
              <p className="text-sm text-danger">
                Enter a valid amount with up to 2 decimals.
              </p>
            ) : (
              <p className="text-xs text-muted">
                {suggested > 0
                  ? "Starts from this month’s remaining income — change it to whatever you can actually commit."
                  : "Anything you can add here shortens the payoff and cuts the interest."}
              </p>
            )}
          </div>
        </Card>
      </section>

      {active && (
        <section aria-label="Payoff projection" className="flex flex-col gap-3">
          <SectionHeading>
            {comparison.mode === "compare" ? "Compare strategies" : "Projection"}
          </SectionHeading>

          {comparison.mode === "compare" ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {PAYOFF_STRATEGIES.map((option) => (
                  <DebtStrategyCard
                    key={option.value}
                    option={option}
                    plan={
                      option.value === "snowball"
                        ? comparison.snowball
                        : comparison.avalanche
                    }
                    currency={currency}
                    nameFor={nameFor}
                    selected={strategy === option.value}
                    recommended={comparison.best === option.value}
                    onSelect={() => setDebtStrategy(option.value)}
                  />
                ))}
              </div>
              <Card>
                <p className="text-sm text-muted">
                  {comparison.best === null
                    ? "Both strategies clear these debts at the same cost and on the same date — the order simply doesn’t change the outcome here."
                    : `${comparison.best === "avalanche" ? "Avalanche" : "Snowball"} costs ${formatMoney(comparison.interestSaved, currency)} less in interest${
                        comparison.monthsDifference === 0
                          ? " and finishes on the same date."
                          : `, and finishes ${Math.abs(comparison.monthsDifference)} ${Math.abs(comparison.monthsDifference) === 1 ? "month" : "months"} ${comparison.monthsDifference > 0 ? "sooner" : "later"}.`
                      }`}
                </p>
              </Card>
            </>
          ) : (
            // One debt: the two strategies are identical by definition, so a
            // side-by-side comparison would just be the same numbers twice.
            <SingleProjection
              plan={activePlan}
              currency={currency}
              nameFor={nameFor}
            />
          )}
        </section>
      )}

      {!active && (
        <Card>
          <p className="text-sm text-muted">
            Every tracked debt is already cleared. Nothing left to project.
          </p>
        </Card>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-ink">Debt payoff</h1>
      <p className="text-sm text-muted">
        Deterministic projections from your balances, rates and payments — no
        estimates, and the same numbers every time.
      </p>
    </header>
  );
}

function DebtRow({
  debt,
  name,
  currency,
}: {
  debt: Debt;
  name: string;
  currency: Currency;
}) {
  const paid = Math.max(0, debt.startingBalance - debt.balance);
  const progress =
    debt.startingBalance > 0
      ? Math.min(1, paid / debt.startingBalance)
      : debt.balance === 0
        ? 1
        : 0;
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-[10rem] flex-1">
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-muted">
          {debt.aprBps === 0 ? "Interest-free" : `${formatApr(debt.aprBps)} a year`}
          {debt.minimumPayment > 0 && (
            <>
              {" · "}
              {formatMoney(debt.minimumPayment, currency)}/mo minimum
            </>
          )}
        </p>
      </div>
      {debt.startingBalance > debt.balance && (
        <div className="w-28 shrink-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-caption tabular-nums text-muted">
            {Math.round(progress * 100)}% paid off
          </p>
        </div>
      )}
      <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
        {formatMoney(debt.balance, currency)}
      </p>
    </li>
  );
}

function SingleProjection({
  plan,
  currency,
  nameFor,
}: {
  plan: PayoffPlan;
  currency: Currency;
  nameFor: (id: string) => string;
}) {
  const only = plan.order[0];
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          With one debt tracked there is no ordering decision to make, so
          avalanche and snowball are the same plan. Add a second debt to compare
          them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            compact
            ariaLabel="Months to debt free"
            label="Debt-free in"
            value={formatPayoffDuration(plan.months, plan.stalled)}
            support={only ? nameFor(only.debtId) : undefined}
          />
          <MetricCard
            compact
            ariaLabel="Total interest paid"
            label="Interest paid"
            value={formatMoney(plan.totalInterest, currency)}
            support={`${formatMoney(plan.totalPaid, currency)} paid in total`}
          />
        </div>
        {plan.stalled && (
          <p className="text-sm text-warn">
            At this monthly amount the interest grows faster than the payments,
            so the balance never clears. Raising the extra payment — or the
            minimum — is what changes this.
          </p>
        )}
      </div>
    </Card>
  );
}

