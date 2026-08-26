import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { currentMonthKey } from "@/lib/date";
import {
  FIRST_STEP,
  SETUP_STEP,
  loadOnboardingStep,
  saveOnboardingStep,
} from "@/lib/onboarding";
import { resetStorageBackendCache } from "@/lib/storageAdapter";
import { useAppStore } from "@/store/useAppStore";
import { useOnboarding } from "@/store/useOnboarding";
import { OnboardingFlow } from "./OnboardingFlow";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  resetStorageBackendCache();
  useAppStore.setState({ state: createInitialState() });
  useOnboarding.setState({ step: FIRST_STEP, ready: true });
});

const MONTH = currentMonthKey();

function nextButton() {
  return screen.getByRole("button", { name: "Next" });
}

describe("pitch screens", () => {
  it("advances, offers Back only after the first, and ends on Get started", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await user.click(nextButton());
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    await user.click(nextButton());

    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("shows a step indicator marking the current screen", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    const steps = () => screen.getByRole("list", { name: /Step \d of \d/ });
    expect(steps().getAttribute("aria-label")).toBe("Step 1 of 3");
    await user.click(nextButton());
    expect(steps().getAttribute("aria-label")).toBe("Step 2 of 3");
  });

  it("persists position so a reopened app resumes on the same screen", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.click(nextButton());
    expect(loadOnboardingStep()).toBe("pitch-track");
  });

  it("Skip jumps past the pitch into setup, which has no skip of its own", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.click(screen.getByRole("button", { name: "Skip introduction" }));

    expect(loadOnboardingStep()).toBe(SETUP_STEP);
    expect(screen.queryByRole("button", { name: /Skip/ })).toBeNull();
    // Skipping the pitch must not finish onboarding.
    expect(useAppStore.getState().state.settings.firstRunDone).toBe(false);
  });

  it("carries no premium or import messaging", () => {
    const { container } = render(<OnboardingFlow />);
    const text = container.textContent ?? "";
    for (const banned of ["Import", "Premium", "Pro", "Upgrade", "free trial"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("guided setup: income step", () => {
  beforeEach(() => {
    useOnboarding.setState({ step: "setup-income", ready: true });
  });

  it("blocks Continue until a non-zero source exists, with inline validation", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /at least one income source/i,
    );
    // Inline, not a dialog, and it did not advance.
    expect(loadOnboardingStep()).not.toBe("setup-budgets");
  });

  it("writes through the app's real income action, not an onboarding path", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.type(screen.getByLabelText("Source"), "Salary");
    await user.type(screen.getByLabelText("Expected amount"), "4000");
    await user.click(screen.getByRole("button", { name: /Add source/ }));

    // Same shape the Planner's Add Income modal produces via setIncomePlan.
    const plans = useAppStore.getState().state.incomePlans;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      month: MONTH,
      name: "Salary",
      expectedAmount: 400000,
      receivedAmount: 0,
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(loadOnboardingStep()).toBe("setup-budgets");
  });

  it("supports more than one source", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.type(screen.getByLabelText("Source"), "Salary");
    await user.type(screen.getByLabelText("Expected amount"), "4000");
    await user.click(screen.getByRole("button", { name: /Add source/ }));

    await user.type(screen.getByLabelText("Source"), "Forex");
    await user.type(screen.getByLabelText("Expected amount"), "1000");
    await user.click(screen.getByRole("button", { name: /Add another/ }));

    expect(useAppStore.getState().state.incomePlans).toHaveLength(2);
  });
});

describe("guided setup: budgets step", () => {
  beforeEach(() => {
    useOnboarding.setState({ step: "setup-budgets", ready: true });
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        incomePlans: [
          {
            id: "p1",
            month: MONTH,
            name: "Salary",
            icon: "💰",
            expectedAmount: 500000,
            receivedAmount: 0,
          },
        ],
      },
    });
  });

  async function addSuggested(user: ReturnType<typeof userEvent.setup>, name: string, amount: string) {
    await user.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
    await user.type(
      screen.getByLabelText(`Monthly limit for ${name}`),
      amount,
    );
  }

  it("blocks Finish under two funded categories, with inline validation", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await addSuggested(user, "Groceries", "1000");
    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/at least 2 categories/i);
    expect(useAppStore.getState().state.settings.firstRunDone).toBe(false);
  });

  it("commits through addCategory/addBudget and completes onboarding", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await addSuggested(user, "Groceries", "1000");
    await addSuggested(user, "Transport", "500");
    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    const state = useAppStore.getState().state;
    const budgets = state.budgets.filter((b) => b.month === MONTH);
    expect(budgets).toHaveLength(2);
    expect(budgets.map((b) => b.limit).sort((a, b) => a - b)).toEqual([
      50000, 100000,
    ]);
    // Reused the seeded Groceries category rather than duplicating the name.
    const groceries = state.categories.filter(
      (c) => c.name.toLowerCase() === "groceries",
    );
    expect(groceries).toHaveLength(1);

    expect(state.settings.firstRunDone).toBe(true);
    expect(loadOnboardingStep()).toBe(FIRST_STEP); // cleared
  });

  it("shows a running allocated-of-income total", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await addSuggested(user, "Groceries", "1000");
    expect(screen.getByText(/\$1,000\.00 of \$5,000\.00 allocated/)).toBeInTheDocument();
  });

  it("accepts a fully custom category with its own icon and limit", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await addSuggested(user, "Groceries", "1000");
    await user.click(
      screen.getByRole("button", { name: /Add a different category/ }),
    );
    await user.type(screen.getByLabelText("Category"), "Childcare");
    await user.type(screen.getByLabelText("Monthly limit"), "750");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    const state = useAppStore.getState().state;
    const childcare = state.categories.find((c) => c.name === "Childcare");
    expect(childcare).toBeTruthy();
    expect(
      state.budgets.some(
        (b) => b.categoryId === childcare!.id && b.limit === 75000,
      ),
    ).toBe(true);
  });

  it("can go back to the income step", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(loadOnboardingStep()).toBe("setup-income");
  });
});

describe("resuming", () => {
  it("picks up on the persisted step", () => {
    saveOnboardingStep("setup-budgets");
    useOnboarding.setState({ step: loadOnboardingStep(), ready: true });
    render(<OnboardingFlow />);

    expect(
      screen.getByRole("button", { name: "Finish setup" }),
    ).toBeInTheDocument();
  });
});
