import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { validateAppState } from "@/lib/validate";
import { useAppStore } from "@/store/useAppStore";
import type { SavingsPlan } from "@/lib/types";
import { SavingsView } from "./SavingsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/savings",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function plan(overrides: Partial<SavingsPlan> = {}): SavingsPlan {
  return {
    id: "p-1",
    name: "New laptop",
    targetAmount: 1_000_000,
    startingBalance: 0,
    status: "active",
    createdAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

function seed(options: { plans?: SavingsPlan[] } = {}) {
  useAppStore.setState({
    state: {
      ...createInitialState(),
      savingsPlans: options.plans ?? [],
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  seed();
});

describe("empty state", () => {
  it("offers to create the first plan", () => {
    render(<SavingsView />);
    expect(screen.getByText("No savings plans yet")).toBeInTheDocument();
  });
});

describe("creating a plan", () => {
  it("adds a card with the entered target", async () => {
    const user = userEvent.setup();
    render(<SavingsView />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.type(screen.getByLabelText("Plan name"), "Emergency fund");
    await user.type(screen.getByLabelText("Target amount"), "500000");
    await user.click(screen.getByRole("button", { name: "Create plan" }));

    const view = validateAppState(useAppStore.getState().state);
    expect(view.savingsPlans).toHaveLength(1);
    expect(view.savingsPlans[0]).toMatchObject({
      name: "Emergency fund",
      targetAmount: 50_000_000,
      status: "active",
    });
    expect(screen.getByText("Emergency fund")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("logging a contribution", () => {
  it("updates the plan's progress through the ordinary transaction path", async () => {
    const user = userEvent.setup();
    seed({ plans: [plan({ targetAmount: 100_000 })] });
    render(<SavingsView />);

    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.type(screen.getByLabelText("Amount"), "400");
    await user.click(screen.getByRole("button", { name: "Log contribution" }));

    const view = validateAppState(useAppStore.getState().state);
    // 40,000 minor units tagged to the plan, written as an expense.
    expect(view.transactions).toHaveLength(1);
    expect(view.transactions[0]).toMatchObject({
      amount: 40_000,
      type: "expense",
      savingsPlanId: "p-1",
    });
    expect(view.savingsPlans).toHaveLength(1);

    // Progress now reads 40%.
    expect(screen.getByText("40%")).toBeInTheDocument();
    // The saved figure appears on the card and in the summary (animated, so
    // wait for it to land on its final value).
    expect(
      await screen.findAllByText("$400.00"),
    ).toHaveLength(2);
  });
});

describe("completion prompt", () => {
  it("asks what to do when a contribution reaches the target, and marks complete on request", async () => {
    const user = userEvent.setup();
    seed({ plans: [plan({ targetAmount: 100_000 })] });
    render(<SavingsView />);

    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Log contribution" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/reached its target/),
    ).toBeInTheDocument();

    // Nothing is picked silently: until the user answers, the plan is still
    // active even though the target is reached.
    expect(validateAppState(useAppStore.getState().state).savingsPlans[0].status).toBe(
      "active",
    );

    await user.click(
      within(dialog).getByRole("button", { name: /^Mark complete/ }),
    );

    expect(validateAppState(useAppStore.getState().state).savingsPlans[0].status).toBe(
      "completed",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the plan open-ended when the user chooses to keep contributing", async () => {
    const user = userEvent.setup();
    seed({ plans: [plan({ targetAmount: 100_000 })] });
    render(<SavingsView />);

    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Log contribution" }));

    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: /Keep contributing/
      }),
    );

    const stored = validateAppState(useAppStore.getState().state).savingsPlans[0];
    expect(stored.status).toBe("active");
    // The answered prompt never returns this visit.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Target reached — open-ended")).toBeInTheDocument();
  });

  it("offers 'Decide later' and does not decide anything", async () => {
    const user = userEvent.setup();
    seed({ plans: [plan({ targetAmount: 100_000 })] });
    render(<SavingsView />);

    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.type(screen.getByLabelText("Amount"), "1000");
    await user.click(screen.getByRole("button", { name: "Log contribution" }));

    await user.click(screen.getByRole("button", { name: "Decide later" }));
    const stored = validateAppState(useAppStore.getState().state).savingsPlans[0];
    expect(stored.status).toBe("active");
    expect(stored.completedAt).toBeUndefined();
  });
});
