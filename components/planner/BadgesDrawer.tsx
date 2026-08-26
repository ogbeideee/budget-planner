"use client";

import { Drawer } from "@/components/ui/Drawer";
import { IconValue } from "@/components/ui/IconValue";
import { formatStreak, type BadgeProgress } from "@/lib/streak";

export interface BadgesDrawerProps {
  open: boolean;
  onClose: () => void;
  badges: BadgeProgress[];
  currentStreak: number;
  longestStreak: number;
}

/**
 * Earned and locked badges together.
 *
 * Locked badges are greyed rather than hidden: the point of the set is having
 * something visible to work toward, and a list that only fills in after the
 * fact gives a new user nothing to see. Every row is rendered from a
 * `BadgeDefinition` — there is no per-badge markup or conditional here, so a
 * new badge is a new data entry in `lib/streak.ts` and nothing else.
 */
export function BadgesDrawer({
  open,
  onClose,
  badges,
  currentStreak,
  longestStreak,
}: BadgesDrawerProps) {
  const earnedCount = badges.filter((row) => row.earned).length;

  return (
    <Drawer open={open} onClose={onClose} title="Streak & badges">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-canvas px-4 py-3">
          <p className="text-sm font-semibold text-ink">
            {currentStreak > 0
              ? formatStreak(currentStreak)
              : "No streak running"}
          </p>
          <p className="text-xs text-muted">
            {currentStreak > 0
              ? "Consecutive finished months inside your total budget."
              : "Finish a month inside your total budget to start one."}
            {longestStreak > currentStreak &&
              ` Your best so far is ${longestStreak}.`}
          </p>
        </div>

        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">
          {earnedCount} of {badges.length} earned
        </p>

        <ul className="flex flex-col gap-2.5">
          {badges.map((row) => (
            <li
              key={row.badge.id}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                row.earned
                  ? "border-brand-500/30 bg-brand-500/[0.06]"
                  : "border-border/70 bg-canvas"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                  row.earned ? "bg-brand-500/10" : "bg-border/40 grayscale opacity-50"
                }`}
              >
                <IconValue value={row.badge.icon} className="h-5 w-5 text-xl" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`truncate text-sm font-semibold ${
                      row.earned ? "text-ink" : "text-muted"
                    }`}
                  >
                    {row.badge.name}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                      row.earned
                        ? "bg-brand-500/15 text-brand-600 dark:text-brand-400"
                        : "bg-border/50 text-muted"
                    }`}
                  >
                    {row.earned ? "Earned" : "Locked"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {row.badge.description}
                </p>

                {!row.earned && (
                  <div className="mt-2">
                    <p className="text-caption tabular-nums text-muted">
                      {row.requirement} · {row.current} of {row.target}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={row.target}
                      aria-valuenow={row.current}
                      aria-label={`${row.badge.name} progress`}
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border/70"
                    >
                      <div
                        className="h-full rounded-full bg-brand-500/60"
                        style={{
                          width: `${Math.round((row.current / row.target) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Deliberate: badges are recognition only. There is no perk, unlock or
            reward logic anywhere — see `BadgeDefinition.reward` in
            lib/streak.ts for the field held open for that later. */}
        <p className="text-xs text-muted">
          Badges are a bit of recognition for staying on plan. They don&rsquo;t
          unlock anything.
        </p>
      </div>
    </Drawer>
  );
}
