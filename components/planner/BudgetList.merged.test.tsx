import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, IncomePlan, Transaction } from "@/lib/types";
import { BudgetList } from "./BudgetList";
import { PlannerView } from "./PlannerView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

const MONTH = "2026-08";

function categoryId(name: string): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.name === name)!.id;
}

/** Budgets for the given [category, limit] pairs, plus income to allocate. */
function seed(
  entries: Array<[name: string, limit: number]>,
  spends: Array<[name: string, amount: number]> = [],
  income = 1000000,
) {
  const state = useAppStore.getState().state;
  const budgets: Budget[] = entries.map(([name, limit], index) => ({
    id: `budget-${index}`,
    categoryId: categoryId(name),
    month: MONTH,
    limit,
    priority: "medium",
  }));
  const transactions: Transaction[] = spends.map(([name, amount], index) => ({
    id: `txn-${index}`,
    type: "expense",
    categoryId: categoryId(name),
    amount,
    date: `${MONTH}-05`,
    createdAt: new Date().toISOString(),
  }));
  const incomePlan: IncomePlan = {
    id: "plan-1",
    month: MONTH,
    name: "Salary",
    icon: "💰",
    expectedAmount: income,
    receivedAmount: income,
  };
  useAppStore.setState({
    state: { ...state, budgets, transactions, incomePlans: [incomePlan] },
  });
}

describe("Budgets section header", () => {
  it("names the section Budgets with a dynamic category count", () => {
    seed([
      ["Rent", 100000],
      ["Groceries", 50000],
      ["Transport", 20000],
    ]);
    render(<BudgetList month={MONTH} />);

    const heading = screen.getByRole("heading", { name: /Budgets/ });
    expect(heading.textContent).toBe("Budgets· 3 categories");
  });

  it("uses the singular for one category", () => {
    seed([["Rent", 100000]]);
    render(<BudgetList month={MONTH} />);

    expect(
      screen.getByRole("heading", { name: /Budgets/ }).textContent,
    ).toBe("Budgets· 1 category");
  });
});

describe("Budgets donut legend", () => {
  it("lists at most the top five categories by budgeted amount, with shares", () => {
    seed([
      ["Rent", 100000],
      ["Groceries", 80000],
      ["Transport", 60000],
      ["Utilities", 40000],
      ["Entertainment", 20000],
    ]);
    render(<BudgetList month={MONTH} />);

    const legend = screen.getByRole("list", { name: "Budget legend" });
    const items = within(legend).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toBe("Rent33%");
    expect(items[4].textContent).toBe("Entertainment7%");
  });

  it("caps the legend at five even with more categories budgeted", () => {
    const state = useAppStore.getState().state;
    const extra = { ...state.categories[0], id: "cat-extra", name: "Extra" };
    useAppStore.setState({
      state: { ...state, categories: [...state.categories, extra] },
    });
    seed([
      ["Rent", 100000],
      ["Groceries", 80000],
      ["Transport", 60000],
      ["Utilities", 40000],
      ["Entertainment", 20000],
      ["Extra", 10000],
    ]);
    render(<BudgetList month={MONTH} />);

    const legend = screen.getByRole("list", { name: "Budget legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(5);
    expect(within(legend).queryByText("Extra")).toBeNull();
    // The category itself is still in the full list on the right.
    expect(screen.getAllByText("Extra").length).toBeGreaterThan(0);
  });
});

describe("Over-limit budget rows", () => {
  it("badges the overage and marks where the limit was crossed", () => {
    seed([["Rent", 100000]], [["Rent", 150000]]);
    render(<BudgetList month={MONTH} />);

    expect(screen.getByText("150% · $500.00 over")).toBeInTheDocument();
    // Limit sits at 100000/150000 = 66.7% of the full bar.
    const marker = screen.getAllByTestId("progress-marker")[0];
    expect(marker.getAttribute("style")).toContain("66.6");
  });

  it("does not badge or mark a category at or under its limit", () => {
    seed([["Rent", 100000]], [["Rent", 100000]]);
    render(<BudgetList month={MONTH} />);

    expect(screen.queryByText(/over$/)).toBeNull();
    expect(screen.queryAllByTestId("progress-marker")).toHaveLength(0);
  });

  it("tints the over-limit row with the danger surface token", () => {
    seed([["Rent", 100000]], [["Rent", 150000]]);
    render(<BudgetList month={MONTH} />);

    const row = document.getElementById("budget-row-budget-0")!;
    expect(row.getAttribute("style")).toContain(
      "--row-tint: var(--color-expense-surface)",
    );
  });
});

describe("Budgets empty state", () => {
  it("shows the donut card empty state and no list card with zero budgets", () => {
    seed([]);
    render(<BudgetList month={MONTH} />);

    expect(screen.getByText("No budgets set up yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create a budget" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Budget legend" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Budgets/ }).textContent,
    ).toBe("Budgets· 0 categories");
  });
});

describe("Row actions", () => {
  it("gives every row a distinct edit action and allocate action", () => {
    // An on-track category — both actions must still be there.
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    const edit = screen.getByRole("button", { name: "Edit Rent budget" });
    const allocate = screen.getByRole("button", {
      name: "Allocate funds to Rent",
    });
    expect(edit).toBeInTheDocument();
    expect(allocate).toBeInTheDocument();
    expect(edit).not.toBe(allocate);
    // Same size / touch target, and neither is the other's icon.
    expect(edit.className).toContain("h-8 w-8");
    expect(allocate.className).toContain("h-8 w-8");
    expect(edit.querySelector("svg")?.innerHTML).not.toBe(
      allocate.querySelector("svg")?.innerHTML,
    );
  });

  it("keeps both row actions keyboard reachable", async () => {
    const user = userEvent.setup();
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    const edit = screen.getByRole("button", { name: "Edit Rent budget" });
    const allocate = screen.getByRole("button", {
      name: "Allocate funds to Rent",
    });
    edit.focus();
    expect(edit).toHaveFocus();
    await user.tab();
    expect(allocate).toHaveFocus();
  });

  it("opens the limit/priority edit form from the pencil, for an on-track category", async () => {
    const user = userEvent.setup();
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    await user.click(screen.getByRole("button", { name: "Edit Rent budget" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit budget")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Priority")).toHaveValue("medium");
    expect(within(dialog).queryByText("Add funds to Rent")).toBeNull();
  });

  it("opens the limit/priority edit form for an over-limit category too", async () => {
    const user = userEvent.setup();
    seed([["Rent", 100000]], [["Rent", 150000]]);
    render(<BudgetList month={MONTH} />);

    await user.click(screen.getByRole("button", { name: "Edit Rent budget" }));

    expect(
      within(screen.getByRole("dialog")).getByLabelText("Priority"),
    ).toBeInTheDocument();
  });

  it("mounts the allocation drawer only from the allocate action", async () => {
    const user = userEvent.setup();
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Allocate remaining")).toBeNull();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "Allocate funds to Rent" }),
    );

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Add funds to Rent")).toBeInTheDocument();
  });
});

describe("Planner page composition", () => {
  it("no longer renders a standalone Expense breakdown section", () => {
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<PlannerView />);

    expect(screen.queryByText("Expense breakdown")).toBeNull();
    expect(screen.getByRole("heading", { name: /Budgets/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Recent Activity/i }),
    ).toBeInTheDocument();
  });
});

describe("Row action icon visibility (regression)", () => {
  // Two real defects shipped here at once and both were invisible to
  // class-agnostic tests:
  //   1. the group carried `opacity-0` at rest, so the icons only appeared on
  //      hover — undiscoverable on touch and for keyboard/AT users;
  //   2. the buttons used the shared `Button` at `size="sm"`, whose `px-3` is
  //      NOT overridden by a `px-0` in `className` (equal specificity, compiled
  //      CSS order wins), leaving a 24px-wide button with a 0px content box that
  //      squeezed the icon to zero width — measured in Chromium as `svg 0x12`.
  function actionGroup(): HTMLElement {
    const row = document.getElementById("budget-row-budget-0")!;
    return row.lastElementChild as HTMLElement;
  }

  it("does not hide the actions behind hover at rest", () => {
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    const cls = actionGroup().className;
    expect(cls).not.toMatch(/(^|\s|:)opacity-0(\s|$)/);
    expect(cls).not.toContain("group-hover:opacity");
  });

  it("gives each action an explicit square box the icon cannot be squeezed out of", () => {
    seed([["Rent", 100000]], [["Rent", 40000]]);
    render(<BudgetList month={MONTH} />);

    const buttons = [...actionGroup().querySelectorAll("button")];
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      // Explicit square + no horizontal padding preset to fight.
      expect(b.className).toContain("h-8 w-8");
      expect(b.className).not.toMatch(/\bpx-\d/);
      const svg = b.querySelector("svg")!;
      expect(svg).toBeTruthy();
      // shrink-0 keeps the glyph at its intrinsic size inside the flex box.
      expect(svg.getAttribute("class")).toContain("shrink-0");
      expect(svg.getAttribute("class")).toContain("h-4 w-4");
    }
  });

  it("keeps the actions visible on an over-limit row too", () => {
    seed([["Rent", 100000]], [["Rent", 150000]]);
    render(<BudgetList month={MONTH} />);

    expect(actionGroup().className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
    expect(
      screen.getByRole("button", { name: "Edit Rent budget" }),
    ).toBeInTheDocument();
  });
});
