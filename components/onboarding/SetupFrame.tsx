"use client";

import type { ReactNode } from "react";
import { SETUP_STEPS } from "@/lib/onboarding";

/**
 * Shared chrome for the guided-setup steps: heading, the same step indicator
 * the pitch screens use, the step body, and a pinned footer. Deliberately has
 * NO skip affordance — guided setup is required.
 */
export function SetupFrame({
  stepIndex,
  title,
  description,
  children,
  footer,
}: {
  stepIndex: number;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <header className="text-center">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
          Step {stepIndex + 1} of {SETUP_STEPS.length}
        </p>
        <h1 className="mt-2 text-page-title font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-description font-medium leading-relaxed text-muted">
          {description}
        </p>
        <ol
          aria-label={`Setup step ${stepIndex + 1} of ${SETUP_STEPS.length}`}
          className="mt-6 flex items-center justify-center gap-2"
        >
          {SETUP_STEPS.map((step, i) => (
            <li
              key={step}
              aria-current={i === stepIndex ? "step" : undefined}
              className={`h-1.5 rounded-full transition-all duration-default ease-premium ${
                i === stepIndex ? "w-6 bg-brand-500" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </ol>
      </header>

      <div className="mt-8 flex flex-col gap-4">{children}</div>

      <div className="mt-8">{footer}</div>
    </div>
  );
}
