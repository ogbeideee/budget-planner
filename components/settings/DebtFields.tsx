"use client";

import { Switch } from "@/components/ui/Switch";
import { BPS_PER_PERCENT, formatApr } from "@/lib/debtPayoff";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

/**
 * The debt draft the category form holds while editing. Amounts are strings
 * here because they are raw input; they become minor units on save.
 */
export interface DebtDraft {
  tracked: boolean;
  balance: string;
  /** Whole/decimal percent as typed, e.g. "12.5". Empty means 0%. */
  aprPercent: string;
  minimumPayment: string;
}

export const EMPTY_DEBT_DRAFT: DebtDraft = {
  tracked: false,
  balance: "",
  aprPercent: "",
  minimumPayment: "",
};

/** Percent as typed -> integer basis points. Blank/garbage reads as 0%. */
export function percentToBps(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * BPS_PER_PERCENT);
}

/** Integer basis points -> the string the input shows. 0% stays blank-free. */
export function bpsToPercentInput(aprBps: number): string {
  if (aprBps === 0) return "0";
  return String(aprBps / BPS_PER_PERCENT);
}

const FIELD =
  "h-11 w-full rounded-xl border border-border/80 bg-surface px-3.5 text-sm text-ink tabular-nums transition-colors placeholder:text-muted/50 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export interface DebtFieldsProps {
  draft: DebtDraft;
  onChange: (next: DebtDraft) => void;
  currency: Currency;
  /** Parsed values, so the caller's validation and this preview agree. */
  preview: { balance: number; aprBps: number; minimumPayment: number };
  error?: string | null;
}

/**
 * "Track as debt" plus the fields it reveals.
 *
 * Available for ANY category, expense or income — an informal loan may well
 * sit against a category the user thinks of either way, and gatekeeping it by
 * kind would be a guess about their bookkeeping.
 *
 * The fields are deliberately separate from the budget limit: they describe an
 * obligation that outlives a month, and they are saved to a linked `Debt`
 * record rather than overloading `Budget.limit`.
 */
export function DebtFields({
  draft,
  onChange,
  currency,
  preview,
  error,
}: DebtFieldsProps) {
  const set = (patch: Partial<DebtDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-canvas p-3.5">
      <div className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">
            Track as debt
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Adds this category to the debt payoff planner, with its own balance
            and interest rate. It does not change how you budget or spend here.
          </span>
        </span>
        <Switch
          checked={draft.tracked}
          onChange={(tracked) => set({ tracked })}
          label="Track as debt"
        />
      </div>

      {draft.tracked && (
        <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
          <div>
            <label
              htmlFor="debt-balance"
              className="mb-2 block text-sm font-semibold text-ink"
            >
              Current balance
            </label>
            <input
              id="debt-balance"
              inputMode="decimal"
              placeholder="0.00"
              value={draft.balance}
              onChange={(event) => set({ balance: event.target.value })}
              className={FIELD}
            />
            {preview.balance > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                {formatMoney(preview.balance, currency)} outstanding
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="debt-apr"
                className="mb-2 block text-sm font-semibold text-ink"
              >
                Interest rate{" "}
                <span className="font-normal text-muted">(yearly)</span>
              </label>
              <div className="relative">
                <input
                  id="debt-apr"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft.aprPercent}
                  onChange={(event) => set({ aprPercent: event.target.value })}
                  className={`${FIELD} pr-8`}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted"
                >
                  %
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {preview.aprBps === 0
                  ? "Interest-free — fine for an informal or family loan."
                  : `${formatApr(preview.aprBps)} a year`}
              </p>
            </div>

            <div>
              <label
                htmlFor="debt-minimum"
                className="mb-2 block text-sm font-semibold text-ink"
              >
                Minimum monthly payment
              </label>
              <input
                id="debt-minimum"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.minimumPayment}
                onChange={(event) =>
                  set({ minimumPayment: event.target.value })
                }
                className={FIELD}
              />
              {preview.minimumPayment > 0 && (
                <p className="mt-1.5 text-xs text-muted">
                  {formatMoney(preview.minimumPayment, currency)} a month
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
