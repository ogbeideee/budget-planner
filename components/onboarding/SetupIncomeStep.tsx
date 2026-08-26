"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { IconPicker } from "@/components/ui/IconPicker";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { currentMonthKey } from "@/lib/date";
import {
  formatMoney,
  isMinorUnitsValid,
  minorToInput,
  toMinorUnits,
} from "@/lib/money";
import { useAppStore } from "@/store/useAppStore";
import { SetupFrame } from "./SetupFrame";

const DEFAULT_ICON = "💰";

/**
 * Step 1 of guided setup: at least one income source with a non-zero amount.
 *
 * Saves through `setIncomePlan` — the SAME store action the Planner's
 * "Add Income" modal calls — so what is created here is ordinary income data
 * from the first moment, with no onboarding-only path to diverge later.
 */
export function SetupIncomeStep({ onContinue }: { onContinue: () => void }) {
  const month = currentMonthKey();
  const plans = useAppStore((s) => s.state.incomePlans);
  const currency = useAppStore((s) => s.state.settings.currency);
  const setIncomePlan = useAppStore((s) => s.setIncomePlan);

  const monthPlans = useMemo(
    () => plans.filter((plan) => plan.month === month),
    [plans, month],
  );

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const total = monthPlans.reduce((sum, plan) => sum + plan.expectedAmount, 0);
  const canContinue = monthPlans.some((plan) => plan.expectedAmount > 0);

  const addSource = () => {
    const trimmed = name.trim();
    const minor = toMinorUnits(amount);
    if (trimmed.length === 0) {
      setError("Give the source a name, like Salary.");
      return;
    }
    if (!isMinorUnitsValid(minor) || minor <= 0) {
      setError("Enter how much you expect from it.");
      return;
    }
    // `null` id creates a new source; the modal uses the same call.
    setIncomePlan(month, null, {
      name: trimmed,
      icon,
      expectedAmount: minor,
      receivedAmount: 0,
    });
    setName("");
    setAmount("");
    setIcon(DEFAULT_ICON);
    setError(null);
    setAttempted(false);
  };

  const removeSource = (id: string) => {
    // Zeroing the expected amount is the modal's own delete semantics.
    setIncomePlan(month, id, { expectedAmount: 0, receivedAmount: 0 });
  };

  return (
    <SetupFrame
      stepIndex={0}
      title="What are you working with this month?"
      description="Add the income you expect. You can add more than one source, and change any of it later."
      footer={
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={() => {
              if (!canContinue) {
                setAttempted(true);
                return;
              }
              onContinue();
            }}
            aria-disabled={!canContinue}
            className={canContinue ? "" : "opacity-50"}
          >
            Continue
          </Button>
          {attempted && !canContinue && (
            <p role="alert" className="text-caption font-semibold text-danger">
              Add at least one income source before continuing.
            </p>
          )}
        </div>
      }
    >
      {monthPlans.length > 0 && (
        <ul className="flex flex-col gap-2">
          {monthPlans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3"
            >
              <span aria-hidden="true" className="text-base">
                {plan.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {plan.name}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatMoney(plan.expectedAmount, currency)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${plan.name}`}
                onClick={() => removeSource(plan.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-premium hover:bg-expense/10 hover:text-expense focus-visible:ring-2 focus-visible:ring-expense/50 focus:outline-none"
              >
                <TrashIcon className="h-4 w-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-canvas/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-32">
            <IconPicker label="Icon" value={icon} onChange={setIcon} />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              label="Source"
              placeholder="Salary"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="sm:w-40">
            <Input
              label="Expected amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onBlur={() => {
                const minor = toMinorUnits(amount);
                if (isMinorUnitsValid(minor) && minor > 0) {
                  setAmount(minorToInput(minor));
                }
              }}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-caption font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={addSource}
          >
            {monthPlans.length === 0 ? "Add source" : "Add another"}
          </Button>
          {total > 0 && (
            <span className="text-caption font-medium tabular-nums text-muted">
              {formatMoney(total, currency)} expected
            </span>
          )}
        </div>
      </div>
    </SetupFrame>
  );
}
