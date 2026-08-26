// First-run onboarding position. Mirrors `lib/displayName.ts`: a tiny local
// preference stored through the single persistence seam (SQLite on desktop,
// localStorage in the browser), deliberately NOT part of AppState — it is
// app-level navigation state, not user data, so it never needs a schema
// migration and survives an import/restore of the ledger untouched.
//
// The "have they finished onboarding" flag is separate: it lives on
// `AppState.settings.firstRunDone`, the field that already existed for exactly
// this purpose (see `13_ONBOARDING_FLOW.md`).
import { getStorageBackend } from "./storageAdapter";

export const ONBOARDING_STEP_STORAGE_KEY = "onboarding:step";

/**
 * The linear flow. `pitch-*` are this prompt's value screens; `setup` is the
 * HANDOFF POINT the guided-setup work plugs into — reaching it means the pitch
 * is done but onboarding is NOT complete (income and first budgets are
 * required before the dashboard).
 */
export const ONBOARDING_STEPS = [
  "pitch-plan",
  "pitch-track",
  "pitch-compare",
  "setup-income",
  "setup-budgets",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type PitchStep = Extract<OnboardingStep, `pitch-${string}`>;

/** The pitch screens only — what "Skip" jumps past. */
export const PITCH_STEPS = ONBOARDING_STEPS.filter((step) =>
  step.startsWith("pitch-"),
) as ReadonlyArray<PitchStep>;

/** Guided setup: required, in order, and never skippable. */
export const SETUP_STEPS = ONBOARDING_STEPS.filter((step) =>
  step.startsWith("setup-"),
) as ReadonlyArray<Extract<OnboardingStep, `setup-${string}`>>;

export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/** Where "Skip" and the final pitch screen both land. */
export const SETUP_STEP: OnboardingStep = "setup-income";

/**
 * Starter categories offered as one-tap chips in guided setup. Every icon here
 * MUST exist in `ICON_GROUPS` (asserted in `lib/__tests__/onboarding.test.ts`)
 * so a suggestion can never hand a category an icon the picker cannot show as
 * selected — the same rule the category-icon migrations follow.
 */
export const SUGGESTED_BUDGETS: ReadonlyArray<{ name: string; icon: string }> = [
  { name: "Groceries", icon: "🛒" },
  { name: "Transport", icon: "🚌" },
  { name: "Rent", icon: "🏠" },
  { name: "Essentials", icon: "🧺" },
  { name: "Internet", icon: "🌐" },
  { name: "Airtime", icon: "📶" },
  { name: "Loan", icon: "💸" },
  { name: "Savings", icon: "💰" },
];

function isStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as ReadonlyArray<string>).includes(value);
}

/**
 * Resume position. Falls back to the first pitch screen for anything
 * unrecognised (absent, corrupt, or written by a future version), so a bad
 * value can never strand a new user on a blank step.
 */
export function loadOnboardingStep(): OnboardingStep {
  try {
    const raw = getStorageBackend().getItem(ONBOARDING_STEP_STORAGE_KEY);
    if (!raw) return FIRST_STEP;
    const trimmed = raw.trim();
    // "setup" was the single placeholder step before guided setup existed.
    if (trimmed === "setup") return SETUP_STEP;
    return isStep(trimmed) ? trimmed : FIRST_STEP;
  } catch {
    return FIRST_STEP;
  }
}

export function saveOnboardingStep(step: OnboardingStep): void {
  try {
    getStorageBackend().setItem(ONBOARDING_STEP_STORAGE_KEY, step);
  } catch {
    // Persistence is a convenience here; a failed write must never block the
    // user from moving through onboarding.
  }
}

/** Called once onboarding finishes, so a resumed session starts clean. */
export function clearOnboardingStep(): void {
  try {
    getStorageBackend().removeItem(ONBOARDING_STEP_STORAGE_KEY);
  } catch {
    // Same reasoning as saveOnboardingStep.
  }
}
