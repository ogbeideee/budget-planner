"use client";

import { ForwardIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

export interface RolloverBadgeProps {
  /** Amount carried into this month. Renders nothing at or below zero. */
  amount: number;
  currency: Currency;
  /**
   * The category's chip classes from `categoryDisplay()`. Passing the
   * registry's own treatment is what keeps this badge the same colour as the
   * category's icon chip on the same row, instead of inventing a palette.
   */
  chip: string;
  /** Base limit, so the badge can spell out the sum rather than a bare total. */
  baseLimit: number;
}

/**
 * Marks a limit that was boosted by carried-over funds.
 *
 * Requirement: a rollover-boosted row must never just show a bigger number.
 * The visible badge says how much arrived, and the title/aria text spells out
 * the whole sum ("40,000 + 8,500 rolled over = 48,500") so the origin of the
 * larger limit is explicit to both sighted and assistive users.
 */
export function RolloverBadge({
  amount,
  currency,
  chip,
  baseLimit,
}: RolloverBadgeProps) {
  if (amount <= 0) return null;
  const sum = `${formatMoney(baseLimit, currency)} + ${formatMoney(
    amount,
    currency,
  )} rolled over = ${formatMoney(baseLimit + amount, currency)}`;
  return (
    <span
      title={sum}
      aria-label={sum}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-caption font-semibold tabular-nums ${chip}`}
    >
      <ForwardIcon className="h-3 w-3 shrink-0" />
      <span>+{formatMoney(amount, currency)}</span>
    </span>
  );
}
