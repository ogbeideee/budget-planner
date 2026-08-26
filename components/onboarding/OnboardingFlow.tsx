"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { GridIcon, TargetIcon, TrendingUpIcon } from "@/components/ui/icons";
import { PITCH_STEPS, SETUP_STEP, type PitchStep } from "@/lib/onboarding";
import { useOnboarding } from "@/store/useOnboarding";
import { SetupBudgetsStep } from "./SetupBudgetsStep";
import { SetupIncomeStep } from "./SetupIncomeStep";

interface Pitch {
  step: PitchStep;
  icon: ReactNode;
  headline: string;
  body: string;
}

/**
 * Three screens, each one thing this app actually does. Deliberately free-tier
 * only — no statement import, no tiers, no upgrade prompts anywhere in
 * onboarding (see 13_ONBOARDING_FLOW.md).
 */
const PITCHES: Pitch[] = [
  {
    step: "pitch-plan",
    icon: <TargetIcon className="h-7 w-7" />,
    headline: "Plan the month before you spend it",
    body: "Give each category a limit for the month. The planner keeps a running total of what is committed and what is still free to allocate.",
  },
  {
    step: "pitch-track",
    icon: <GridIcon className="h-7 w-7" />,
    headline: "See where the money actually goes",
    body: "Every expense lands in a category, so a budget going over shows up while you can still do something about it — not at month end.",
  },
  {
    step: "pitch-compare",
    icon: <TrendingUpIcon className="h-7 w-7" />,
    headline: "Watch it change month to month",
    body: "Once you have a couple of months recorded, reports compare them so you can see what is improving and what needs attention.",
  },
];

/** Shared full-window frame: no sidebar, no nav, clear of the title bar. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    // `pt-11` clears the 44px custom title bar so nothing renders under the
    // window controls; the bar itself stays mounted by AppShell.
    <div className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-canvas pt-11">
      {children}
    </div>
  );
}

export function OnboardingFlow() {
  const step = useOnboarding((s) => s.step);
  const goTo = useOnboarding((s) => s.goTo);

  if (step === "setup-income") {
    return (
      <OnboardingShell>
        <SetupIncomeStep onContinue={() => goTo("setup-budgets")} />
      </OnboardingShell>
    );
  }
  if (step === "setup-budgets") {
    return (
      <OnboardingShell>
        <SetupBudgetsStep onBack={() => goTo("setup-income")} />
      </OnboardingShell>
    );
  }

  const index = PITCH_STEPS.indexOf(step as PitchStep);
  const pitch = PITCHES[index] ?? PITCHES[0];
  const isLast = index === PITCHES.length - 1;

  return (
    <OnboardingShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <section aria-labelledby="onboarding-pitch-heading">
          <span
            aria-hidden="true"
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            {pitch.icon}
          </span>

          <h1
            id="onboarding-pitch-heading"
            className="text-page-title font-bold tracking-tight text-ink"
          >
            {pitch.headline}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-description font-medium leading-relaxed text-muted">
            {pitch.body}
          </p>

          {/* No stepper primitive exists in the library yet, so this is the
              smallest thing that reads as one, built from existing tokens. */}
          <ol
            aria-label={`Step ${index + 1} of ${PITCHES.length}`}
            className="mt-8 flex items-center justify-center gap-2"
          >
            {PITCHES.map((entry, i) => (
              <li
                key={entry.step}
                aria-current={i === index ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all duration-default ease-premium ${
                  i === index ? "w-6 bg-brand-500" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </ol>

          <div className="mt-8 flex items-center justify-center gap-2">
            {index > 0 && (
              <Button
                variant="secondary"
                onClick={() => goTo(PITCH_STEPS[index - 1])}
              >
                Back
              </Button>
            )}
            <Button
              onClick={() => goTo(isLast ? SETUP_STEP : PITCH_STEPS[index + 1])}
            >
              {isLast ? "Get started" : "Next"}
            </Button>
          </div>

          {/* Skip applies to the PITCH screens only — it lands on guided setup,
              which is required and has no skip of its own. */}
          <button
            type="button"
            onClick={() => goTo(SETUP_STEP)}
            className="mt-6 rounded-md px-2 py-1 text-caption font-semibold text-muted underline-offset-4 transition-colors duration-150 ease-premium hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/40 focus:outline-none"
          >
            Skip introduction
          </button>
        </section>
      </div>
    </OnboardingShell>
  );
}
