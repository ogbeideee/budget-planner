"use client";

import { create } from "zustand";
import {
  FIRST_STEP,
  saveOnboardingStep,
  type OnboardingStep,
} from "@/lib/onboarding";

interface OnboardingState {
  // Starts at the first step with `ready: false` on BOTH server and client, so
  // the first render matches the server HTML; AppShell seeds the persisted
  // position at mount. Without this gate the flow would render in the server
  // HTML and then disappear on hydration for a returning user.
  step: OnboardingStep;
  ready: boolean;
  /** Moves the flow and persists the new position in one call. */
  goTo: (step: OnboardingStep) => void;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  step: FIRST_STEP,
  ready: false,
  goTo: (step) => {
    saveOnboardingStep(step);
    set({ step });
  },
}));
