import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ICON_GROUPS } from "@/components/settings/iconLibrary";
import { createInitialState } from "../seed";
import {
  FIRST_STEP,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_STORAGE_KEY,
  PITCH_STEPS,
  SETUP_STEP,
  SETUP_STEPS,
  SUGGESTED_BUDGETS,
  clearOnboardingStep,
  loadOnboardingStep,
  saveOnboardingStep,
} from "../onboarding";
import { resetStorageBackendCache } from "../storageAdapter";

beforeEach(() => {
  window.localStorage.clear();
  resetStorageBackendCache();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("onboarding step model", () => {
  it("splits into pitch screens then required setup steps", () => {
    expect(PITCH_STEPS.length).toBeGreaterThanOrEqual(2);
    expect(PITCH_STEPS.length).toBeLessThanOrEqual(3);
    expect(SETUP_STEPS.length).toBeGreaterThan(0);
    expect([...PITCH_STEPS, ...SETUP_STEPS]).toEqual([...ONBOARDING_STEPS]);
  });

  it("lands Skip and Get started on the first setup step", () => {
    expect(SETUP_STEP).toBe(SETUP_STEPS[0]);
    // Skip must never land past setup — setup is not skippable.
    expect(PITCH_STEPS).not.toContain(SETUP_STEP);
  });
});

describe("onboarding step persistence", () => {
  it("starts new users on the first pitch screen", () => {
    expect(loadOnboardingStep()).toBe(FIRST_STEP);
  });

  it("resumes exactly where the user left off", () => {
    saveOnboardingStep("setup-budgets");
    expect(loadOnboardingStep()).toBe("setup-budgets");
  });

  it("clears on completion so a later session starts clean", () => {
    saveOnboardingStep("setup-income");
    clearOnboardingStep();
    expect(loadOnboardingStep()).toBe(FIRST_STEP);
  });

  it("falls back to the first screen for an unrecognised value", () => {
    window.localStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, "not-a-step");
    expect(loadOnboardingStep()).toBe(FIRST_STEP);
  });

  it("maps the pre-guided-setup 'setup' placeholder onto the first setup step", () => {
    window.localStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, "setup");
    expect(loadOnboardingStep()).toBe(SETUP_STEP);
  });
});

describe("first-run flag", () => {
  it("defaults to false on a new install so onboarding shows", () => {
    expect(createInitialState().settings.firstRunDone).toBe(false);
  });
});

describe("suggested starter categories", () => {
  const libraryIcons = new Set(
    ICON_GROUPS.flatMap((group) => group.icons).map((icon) => icon.emoji),
  );

  it("offers a usable starter set", () => {
    expect(SUGGESTED_BUDGETS.length).toBeGreaterThanOrEqual(5);
    const names = SUGGESTED_BUDGETS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(SUGGESTED_BUDGETS.map((s) => [s.name, s.icon]))(
    "%s uses an icon the picker can show as selected (%s)",
    (_name, icon) => {
      // Same rule the icon migrations follow: never assign an icon that is not
      // in ICON_GROUPS, or the user cannot re-pick it.
      expect(libraryIcons.has(icon as string)).toBe(true);
    },
  );
});
