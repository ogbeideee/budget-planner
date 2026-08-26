"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { ArrowRightIcon, InfoIcon, SparklesIcon } from "@/components/ui/icons";
import { monthFinance } from "@/lib/finance";
import { fundingNeeds } from "@/lib/funding";
import { formatMoney } from "@/lib/money";
import { budgetHealth, overBudgetCategories } from "@/lib/selectors";
import { evaluateBadges, formatStreak, streakStats } from "@/lib/streak";
import type { Month } from "@/lib/types";
import { categoryLabel } from "@/lib/categoryDisplay";
import { useAppStore } from "@/store/useAppStore";
import { REVIEW_BUDGETS_HREF, scrollToBudgetAllocation } from "./reviewBudgets";
import { BadgesDrawer } from "./BadgesDrawer";

// TODO: placeholder copy. The codebase has no written explanation of what
// `budgetHealth()` (lib/selectors.ts) scores — refine this sentence once the
// real definition is settled, and keep it in sync with the formula.
const HEALTH_TOOLTIP =
  "Reflects how many budgets are within limit, funded, and covered by income";

/** Score at or above which the health pill reads "Good" instead of "At risk". */
const GOOD_SCORE = 60;

interface StatusFlag {
  id: string;
  tone: "danger" | "ok";
  text: string;
  /** Rendered in place of the tone dot when present. */
  icon?: ReactNode;
  /** Turns the row into a button — used by the streak flag to open badges. */
  onClick?: () => void;
  /** Accessible name for the button form. */
  actionLabel?: string;
}

export function BudgetStatusBand({ month }: { month: Month }) {
  const budgets = useAppStore((s) => s.state.budgets);
  const transactions = useAppStore((s) => s.state.transactions);
  const categories = useAppStore((s) => s.state.categories);
  const incomePlans = useAppStore((s) => s.state.incomePlans);
  const futureExpenses = useAppStore((s) => s.state.futureExpenses);
  const rollovers = useAppStore((s) => s.state.rollovers);
  const currency = useAppStore((s) => s.state.settings.currency);

  const health = useMemo(
    () => budgetHealth(budgets, transactions, month, incomePlans, rollovers),
    [budgets, transactions, month, incomePlans, rollovers],
  );

  const overText = useMemo(() => {
    const over = overBudgetCategories(budgets, transactions, month, rollovers);
    if (over.length === 0) return null;
    const names = new Map(
      categories.map((category) => [category.id, categoryLabel(category.name)]),
    );
    // Every over-limit category is listed — the row wraps rather than truncating.
    const detail = over
      .map(
        (entry) =>
          `${names.get(entry.budget.categoryId) ?? "Category"} +${formatMoney(
            entry.spent - entry.limit,
            currency,
          )}`,
      )
      .join(", ");
    return `${over.length} ${
      over.length === 1 ? "budget over its limit" : "budgets over their limit"
    } — ${detail}`;
  }, [budgets, transactions, categories, month, currency, rollovers]);

  const unfundedCount = useMemo(
    () =>
      fundingNeeds(budgets, categories, futureExpenses, month, rollovers)
        .length,
    [budgets, categories, futureExpenses, month, rollovers],
  );

  const incomeCovers = useMemo(
    () => monthFinance(transactions, incomePlans, month).net >= 0,
    [transactions, incomePlans, month],
  );

  const hasExpenseCategories = useMemo(
    () => categories.some((category) => category.kind === "expense"),
    [categories],
  );

  const [badgesOpen, setBadgesOpen] = useState(false);
  const badgeState = useAppStore((s) => s.state.badges);
  // Derived from the ledger on every render — the streak is never stored, so
  // editing a past month corrects it rather than leaving a stale counter.
  const streak = useMemo(
    () => streakStats(budgets, transactions, month, rollovers),
    [budgets, transactions, month, rollovers],
  );
  const badges = useMemo(
    () => evaluateBadges(streak, badgeState),
    [streak, badgeState],
  );
  const currentStreak = streak.current;
  const earnedBadgeCount = badges.filter((row) => row.earned).length;

  const flags = useMemo(() => {
    const overFlag: StatusFlag | null = overText
      ? { id: "over", tone: "danger", text: overText }
      : null;

    // Nothing to fund and nothing to fund it with: stay silent rather than
    // claiming "every category funded" when there are no expense categories.
    let fundingFlag: StatusFlag | null = null;
    if (unfundedCount > 0) {
      fundingFlag = {
        id: "funding",
        tone: "danger",
        text: `${unfundedCount} ${
          unfundedCount === 1 ? "category needs" : "categories need"
        } funding`,
      };
    } else if (hasExpenseCategories) {
      fundingFlag = incomeCovers
        ? {
            id: "funding",
            tone: "ok",
            text: "Every category funded · Income covers expenses",
          }
        : {
            id: "funding",
            tone: "danger",
            text: "Every category funded · Income does not cover expenses",
          };
    }

    // Cosmetic recognition, shown as one more flag inside this band rather
    // than as another dashboard card — the band exists to consolidate status,
    // and a streak is status.
    //
    // At zero the count itself is hidden ("0-month streak" is clutter that
    // tells the user nothing), but the row still appears if they hold any
    // badge: it is the only way into the badges drawer, and letting a broken
    // streak lock people out of achievements they already earned would be
    // worse than the small amount of chrome.
    const streakFlag: StatusFlag | null =
      currentStreak > 0
        ? {
            id: "streak",
            tone: "ok",
            text: formatStreak(currentStreak),
            icon: <SparklesIcon className="h-4 w-4 shrink-0 text-brand-500" />,
            onClick: () => setBadgesOpen(true),
            actionLabel: `${formatStreak(currentStreak)} — view badges`,
          }
        : earnedBadgeCount > 0
          ? {
              id: "streak",
              tone: "ok",
              text: `${earnedBadgeCount} ${earnedBadgeCount === 1 ? "badge" : "badges"} earned`,
              icon: <SparklesIcon className="h-4 w-4 shrink-0 text-muted" />,
              onClick: () => setBadgesOpen(true),
              actionLabel: "View badges",
            }
          : null;

    const list = [overFlag, fundingFlag, streakFlag].filter(
      (flag): flag is StatusFlag => flag !== null,
    );
    if (list.length > 0) return list;
    return [
      {
        id: "on-track",
        tone: "ok",
        text: "All budgets on track this month.",
      } satisfies StatusFlag,
    ];
  }, [overText, unfundedCount, incomeCovers, hasExpenseCategories, currentStreak, earnedBadgeCount]);

  // Nothing to report on a month with no categories configured at all.
  if (categories.length === 0) return null;

  const atRisk = health < GOOD_SCORE;

  return (
    <Card className="animate-[list-in_200ms_var(--ease-premium)]">
      <div className="flex flex-col gap-5 min-[980px]:flex-row min-[980px]:items-center min-[980px]:gap-6">
        <div className="flex shrink-0 items-center gap-4">
          <div
            role="img"
            aria-label={`Budget health score ${health} out of 100`}
            className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-danger) ${health}%, var(--color-border) ${health}% 100%)`,
            }}
          >
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface text-lg font-bold tabular-nums text-ink">
              {health}
            </span>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              Budget health
              <Tooltip wrap label={HEALTH_TOOLTIP}>
                <button
                  type="button"
                  aria-label="How is budget health calculated?"
                  className="inline-flex items-center justify-center rounded-full text-muted transition-colors duration-150 ease-premium hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
                >
                  <InfoIcon className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                atRisk
                  ? "border border-danger/25 bg-danger/[0.08] text-danger"
                  : "border border-brand-500/25 bg-brand-500/[0.08] text-brand-500"
              }`}
            >
              {atRisk ? "At risk" : "Good"}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="hidden w-px self-stretch bg-border/70 min-[980px]:block"
        />

        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {flags.map((flag) => {
            const marker = flag.icon ?? (
              <span
                aria-hidden="true"
                className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${
                  flag.tone === "danger" ? "bg-danger" : "bg-income"
                }`}
              />
            );
            const label = (
              <span className="min-w-0 text-sm font-medium leading-relaxed text-ink">
                {flag.text}
              </span>
            );
            return (
              <li key={flag.id} className="flex min-w-0 items-start gap-2.5">
                {flag.onClick ? (
                  <button
                    type="button"
                    onClick={flag.onClick}
                    aria-label={flag.actionLabel ?? flag.text}
                    className="flex min-w-0 items-start gap-2.5 rounded-md text-left transition-colors duration-150 ease-premium hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus:outline-none dark:hover:text-brand-400"
                  >
                    <span className="mt-0.5 flex shrink-0">{marker}</span>
                    {label}
                  </button>
                ) : (
                  <>
                    {marker}
                    {label}
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <Link
          href={REVIEW_BUDGETS_HREF}
          onClick={scrollToBudgetAllocation}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-brand-500 px-5 text-base font-semibold text-white transition-all duration-150 ease-premium hover:bg-brand-600 hover:shadow-card active:translate-y-[1px] active:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus:outline-none motion-reduce:transition-none motion-reduce:active:translate-y-0 min-[980px]:self-auto"
        >
          Review budgets
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <BadgesDrawer
        open={badgesOpen}
        onClose={() => setBadgesOpen(false)}
        badges={badges}
        currentStreak={streak.current}
        longestStreak={streak.longest}
      />
    </Card>
  );
}
