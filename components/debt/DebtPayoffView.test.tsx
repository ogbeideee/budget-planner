import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { currentMonthKey } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import { validateAppState } from "@/lib/validate";
import { useAppStore } from "@/store/useAppStore";
import type { Category, Debt } from "@/lib/types";
import { DebtPayoffView } from "./DebtPayoffView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/debt",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function category(id: string, name: string): Category {
  return {
    id,
    name,
    icon: "💸",
    color: "#ef4444",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function debt(
  id: string,
  categoryId: string,
  balance: number,
  aprBps: number,
  minimumPayment: number,
): Debt {
  return {
    id,
    categoryId,
    balance,
    startingBalance: balance,
    aprBps,
    minimumPayment,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const CARD = category("c-card", "Credit card");
const LOAN = category("c-loan", "Car loan");
const FAMILY = category("c-family", "Family loan");

function seed(categories: Category[], debts: Debt[]) {
  useAppStore.setState({
    state: { ...createInitialState(), categories, debts },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  seed([], []);
});

describe("with nothing tracked", () => {
  it("explains how to start instead of rendering an empty comparison", () => {
    render(<DebtPayoffView />);
    expect(screen.getByText("No debts tracked yet")).toBeInTheDocument();
    expect(screen.queryByText("Avalanche")).toBeNull();
    expect(screen.queryByText("Snowball")).toBeNull();
  });
});

describe("with a single debt", () => {
  beforeEach(() => {
    seed([CARD], [debt("d1", CARD.id, 100000, 1200, 10000)]);
  });

  it("shows one projection, not two identical columns", () => {
    render(<DebtPayoffView />);

    expect(
      screen.getByText(/there is no ordering decision to make/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Debt-free in")).toBeInTheDocument();
    expect(screen.getByText("Interest paid")).toBeInTheDocument();
    // No strategy cards at all.
    expect(screen.queryByRole("button", { name: /Use this/ })).toBeNull();
  });

  it("still lists the debt with its rate and minimum", () => {
    render(<DebtPayoffView />);
    // Named in the debt list and again under the projection.
    expect(screen.getAllByText("Credit card").length).toBeGreaterThan(0);
    expect(screen.getByText(/12% a year/)).toBeInTheDocument();
  });
});

describe("with two or more debts", () => {
  beforeEach(() => {
    seed(
      [CARD, LOAN],
      [
        debt("d1", CARD.id, 400000, 2400, 9000),
        debt("d2", LOAN.id, 120000, 500, 4000),
      ],
    );
  });

  it("compares both strategies side by side", () => {
    render(<DebtPayoffView />);
    expect(screen.getByText("Avalanche")).toBeInTheDocument();
    expect(screen.getByText("Snowball")).toBeInTheDocument();
    expect(screen.queryByText(/no ordering decision/i)).toBeNull();
  });

  it("orders avalanche by rate and snowball by balance", () => {
    render(<DebtPayoffView />);

    const firstIn = (label: string) =>
      within(screen.getByRole("list", { name: label })).getAllByRole(
        "listitem",
      )[0].textContent ?? "";

    expect(firstIn("Avalanche payoff order")).toContain("Credit card"); // 24%
    expect(firstIn("Snowball payoff order")).toContain("Car loan"); // smallest
  });

  it("lets the user pick which projection is their active plan", async () => {
    const user = userEvent.setup();
    render(<DebtPayoffView />);

    // Avalanche is the default active plan.
    expect(screen.getByRole("button", { name: /Active plan/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use this" }));
    expect(useAppStore.getState().state.settings.debtStrategy).toBe("snowball");
  });

  it("says the strategies tie when nothing extra is being paid", () => {
    // With two debts and no extra, every cent is committed to minimums, so the
    // only money that ever moves is a freed minimum — and with one debt left
    // it has nowhere else to go. The plans genuinely converge, and the page
    // must say so rather than crowning an arbitrary winner.
    render(<DebtPayoffView />);
    expect(screen.getByText(/same cost and on the same date/i)).toBeInTheDocument();
    expect(screen.queryByText("Costs least")).toBeNull();
  });

  it("names the cheaper strategy once there is extra to direct", async () => {
    const user = userEvent.setup();
    // A third debt gives the freed payments somewhere to go, so order matters.
    seed(
      [CARD, LOAN, FAMILY],
      [
        debt("d1", CARD.id, 400000, 2400, 9000),
        debt("d2", LOAN.id, 120000, 500, 4000),
        debt("d3", FAMILY.id, 260000, 1400, 6000),
      ],
    );
    render(<DebtPayoffView />);

    const input = screen.getByLabelText(/Extra per month/);
    await user.clear(input);
    await user.type(input, "300");

    expect(screen.getByText("Costs least")).toBeInTheDocument();
    expect(screen.getByText(/less in interest/i)).toBeInTheDocument();
  });

  it("recalculates when the extra payment changes", async () => {
    const user = userEvent.setup();
    render(<DebtPayoffView />);

    const input = screen.getByLabelText(/Extra per month/);
    await user.clear(input);
    await user.type(input, "500");

    // Monthly total = minimums (130.00) + extra (500.00)
    expect(screen.getByText("$630.00")).toBeInTheDocument();
  });

  it("rejects a malformed extra payment without crashing the projection", async () => {
    const user = userEvent.setup();
    render(<DebtPayoffView />);

    const input = screen.getByLabelText(/Extra per month/);
    await user.clear(input);
    await user.type(input, "12.345");

    expect(screen.getByText(/valid amount with up to 2 decimals/i)).toBeInTheDocument();
    // The comparison is still on screen, computed with no extra.
    expect(screen.getByText("Avalanche")).toBeInTheDocument();
  });
});

describe("the extra-payment default tracks live data (regression)", () => {
  const withIncome = (received: number) => {
    const s = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...s,
        incomePlans: [
          {
            id: "p1",
            month: currentMonthKey(),
            name: "Salary",
            icon: "💰",
            expectedAmount: received,
            receivedAmount: received,
          },
        ],
      },
    });
  };

  it("picks up income that arrives AFTER the first render", async () => {
    seed([CARD], [debt("d1", CARD.id, 400000, 2400, 9000)]);
    render(<DebtPayoffView />);
    // Mounted with no income, so nothing to suggest.
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("");

    await act(async () => {
      withIncome(30000);
    });

    // A lazy useState initializer would still be "" here — that is the bug.
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("300");
  });

  it("keeps the user's own amount once they type, even as income changes", async () => {
    const user = userEvent.setup();
    seed([CARD], [debt("d1", CARD.id, 400000, 2400, 9000)]);
    withIncome(30000);
    render(<DebtPayoffView />);

    const input = screen.getByLabelText(/Extra per month/);
    await user.clear(input);
    await user.type(input, "50");
    expect(input).toHaveValue("50");

    await act(async () => {
      withIncome(90000);
    });
    // Their figure stands — the suggestion does not overwrite it.
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("50");
  });

  it("treats a cleared field as a real choice, not as untouched", async () => {
    const user = userEvent.setup();
    seed([CARD], [debt("d1", CARD.id, 400000, 2400, 9000)]);
    withIncome(30000);
    render(<DebtPayoffView />);

    await user.clear(screen.getByLabelText(/Extra per month/));
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("");

    await act(async () => {
      withIncome(90000);
    });
    // Still empty: clearing is an override, not a reset.
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("");
  });

  it("the suggestion button hands control back to the live figure", async () => {
    const user = userEvent.setup();
    seed([CARD], [debt("d1", CARD.id, 400000, 2400, 9000)]);
    withIncome(30000);
    render(<DebtPayoffView />);

    const input = screen.getByLabelText(/Extra per month/);
    await user.clear(input);
    await user.type(input, "50");

    await user.click(screen.getByRole("button", { name: /Use this month/ }));
    expect(screen.getByLabelText(/Extra per month/)).toHaveValue("300");
  });
});

describe("interest-free debts", () => {
  it("labels a 0% debt as interest-free rather than '0% a year'", () => {
    seed(
      [FAMILY, CARD],
      [
        debt("d1", FAMILY.id, 150000, 0, 5000),
        debt("d2", CARD.id, 200000, 2400, 6000),
      ],
    );
    render(<DebtPayoffView />);
    expect(screen.getByText(/Interest-free/)).toBeInTheDocument();
  });
});

describe("the debt data model", () => {
  it("migrates a v7 state forward, flagging no category as debt", () => {
    const v7 = {
      ...createInitialState(),
      version: 7,
      categories: [CARD],
      debts: undefined,
    };
    const migrated = validateAppState(v7);
    expect(migrated.version).toBe(11);
    expect(migrated.debts).toEqual([]);
    expect(migrated.settings.debtStrategy).toBe("avalanche");
  });

  it("drops a debt whose category was deleted", () => {
    const state = {
      ...createInitialState(),
      version: 8,
      categories: [CARD],
      debts: [debt("d1", "gone", 100000, 1200, 5000)],
    };
    expect(validateAppState(state).debts).toEqual([]);
  });

  it("keeps only one debt per category", () => {
    const state = {
      ...createInitialState(),
      version: 8,
      categories: [CARD],
      debts: [
        debt("d1", CARD.id, 100000, 1200, 5000),
        debt("d2", CARD.id, 999999, 100, 1),
      ],
    };
    const result = validateAppState(state).debts;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("d1");
  });

  it("rejects a negative balance rather than silently coercing it", () => {
    const state = {
      ...createInitialState(),
      version: 8,
      categories: [CARD],
      debts: [{ ...debt("d1", CARD.id, 0, 0, 0), balance: -500 }],
    };
    expect(() => validateAppState(state)).toThrow(/debt.balance/);
  });

  it("setCategoryDebt creates, updates and removes one record", () => {
    seed([CARD], []);
    const store = useAppStore.getState();

    store.setCategoryDebt(CARD.id, {
      balance: 250000,
      aprBps: 1850,
      minimumPayment: 7500,
    });
    let debts = useAppStore.getState().state.debts;
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({
      categoryId: CARD.id,
      balance: 250000,
      startingBalance: 250000,
      aprBps: 1850,
    });
    const firstId = debts[0].id;

    // Paying it down keeps the original starting balance for progress.
    useAppStore.getState().setCategoryDebt(CARD.id, {
      balance: 100000,
      aprBps: 1850,
      minimumPayment: 7500,
    });
    debts = useAppStore.getState().state.debts;
    expect(debts).toHaveLength(1);
    expect(debts[0].id).toBe(firstId);
    expect(debts[0].balance).toBe(100000);
    expect(debts[0].startingBalance).toBe(250000);

    useAppStore.getState().setCategoryDebt(CARD.id, null);
    expect(useAppStore.getState().state.debts).toEqual([]);
  });

  it("deleting a category takes its debt record with it", () => {
    seed([CARD], [debt("d1", CARD.id, 100000, 1200, 5000)]);
    expect(useAppStore.getState().deleteCategory(CARD.id).ok).toBe(true);
    expect(useAppStore.getState().state.debts).toEqual([]);
  });

  it("leaves categories that are not debts completely untouched", () => {
    const plain = category("c-food", "Groceries");
    seed([plain, CARD], [debt("d1", CARD.id, 100000, 1200, 5000)]);

    const before = useAppStore
      .getState()
      .state.categories.find((c) => c.id === plain.id);
    useAppStore.getState().setCategoryDebt(CARD.id, {
      balance: 50000,
      aprBps: 0,
      minimumPayment: 1000,
    });
    const after = useAppStore
      .getState()
      .state.categories.find((c) => c.id === plain.id);

    expect(after).toEqual(before);
    expect(
      useAppStore.getState().state.debts.some((d) => d.categoryId === plain.id),
    ).toBe(false);
  });
});
