import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Budget, IncomePlan, Transaction } from "@/lib/types";
import { AllocationDrawer } from "./AllocationDrawer";
import type { AllocationTarget } from "./AllocationDrawer";

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

/** Budgets as [category, limit, spent]; ids are `budget-{category}`. */
function seed(
  rows: Array<[name: string, limit: number, spent: number]>,
  income = 1000000,
) {
  const state = useAppStore.getState().state;
  const budgets: Budget[] = rows.map(([name, limit]) => ({
    id: `budget-${name}`,
    categoryId: categoryId(name),
    month: MONTH,
    limit,
    priority: "medium",
  }));
  const transactions: Transaction[] = rows
    .filter(([, , spent]) => spent > 0)
    .map(([name, , spent], index) => ({
      id: `txn-${index}`,
      type: "expense",
      categoryId: categoryId(name),
      amount: spent,
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

function targetFor(name: string): AllocationTarget {
  return {
    budgetId: `budget-${name}`,
    categoryId: categoryId(name),
    categoryName: name,
  };
}

function open(name: string, onClose = vi.fn()) {
  render(
    <AllocationDrawer
      open
      month={MONTH}
      target={targetFor(name)}
      onClose={onClose}
    />,
  );
  return onClose;
}

function limitOf(name: string): number {
  return useAppStore
    .getState()
    .state.budgets.find((budget) => budget.id === `budget-${name}`)!.limit;
}

function slider(name: string): HTMLElement {
  return screen.getByRole("slider", { name });
}

describe("AllocationDrawer shell", () => {
  it("renders nothing when closed or without a target", () => {
    seed([["Rent", 100000, 0]]);
    const { container, rerender } = render(
      <AllocationDrawer
        open={false}
        month={MONTH}
        target={targetFor("Rent")}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <AllocationDrawer open month={MONTH} target={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("titles itself from the triggering category and offers a close button", () => {
    seed([["Groceries", 50000, 10000]]);
    open("Groceries");

    const drawer = screen.getByRole("dialog");
    expect(
      within(drawer).getByText("Add funds to Groceries"),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });
});

describe("AllocationDrawer hints", () => {
  it("states the real overage and limit when the target is over budget", () => {
    seed([["Rent", 100000, 150000]]);
    open("Rent");

    expect(
      screen.getByText(
        /Rent is \$500\.00 over its \$1,000\.00 limit this month\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Move money from a category with room to spare/),
    ).toBeInTheDocument();
  });

  it("shows the simpler hint when the target is not over budget", () => {
    seed([["Rent", 100000, 40000]]);
    open("Rent");

    expect(
      screen.getByText(
        "Choose how much to allocate to Rent from this month's unallocated funds.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/over its/)).toBeNull();
  });
});

describe("AllocationDrawer source rows", () => {
  it("lists only other categories with funds left, never the target itself", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
      ["Transport", 30000, 30000],
      ["Utilities", 50000, 60000],
    ]);
    open("Rent");

    expect(slider("Move from Groceries")).toHaveAttribute("max", "60000");
    // Transport is exactly spent out and Utilities is itself over — neither
    // has room to give, so neither is offered.
    expect(
      screen.queryByRole("slider", { name: "Move from Transport" }),
    ).toBeNull();
    expect(
      screen.queryByRole("slider", { name: "Move from Utilities" }),
    ).toBeNull();
    expect(screen.queryByRole("slider", { name: "Move from Rent" })).toBeNull();
  });

  it("omits the whole move-from section when nothing has funds to give", () => {
    seed([
      ["Rent", 100000, 40000],
      ["Groceries", 50000, 50000],
    ]);
    open("Rent");

    expect(screen.queryByText("Move funds from")).toBeNull();
    // Only the direct limit slider remains.
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(slider("New limit for Rent")).toBeInTheDocument();
  });

  it("starts every source slider at zero", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    open("Rent");

    expect(slider("Move from Groceries")).toHaveValue("0");
  });
});

describe("AllocationDrawer clamping", () => {
  it("caps the combined move at the target's overage and leaves sources non-negative", () => {
    // Rent is $500 over. Groceries has $600 and Transport $700 available.
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
      ["Transport", 90000, 20000],
    ]);
    open("Rent");

    fireEvent.change(slider("Move from Transport"), {
      target: { value: "70000" },
    });
    expect(slider("Move from Transport")).toHaveValue("50000");

    // The second source can only take what the first left behind: nothing.
    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "60000" },
    });
    expect(slider("Move from Groceries")).toHaveValue("0");
    expect(slider("Move from Transport")).toHaveValue("50000");
  });

  it("sums multiple sources against the shortfall without exceeding it", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 30000, 0],
      ["Transport", 90000, 20000],
    ]);
    open("Rent");

    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "30000" },
    });
    fireEvent.change(slider("Move from Transport"), {
      target: { value: "40000" },
    });

    expect(slider("Move from Groceries")).toHaveValue("30000");
    expect(slider("Move from Transport")).toHaveValue("20000");
    expect(screen.getByText("$500.00 of $500.00")).toBeInTheDocument();
  });

  it("never lets a source give more than it has available", () => {
    seed([
      ["Rent", 100000, 190000],
      ["Groceries", 80000, 20000],
    ]);
    open("Rent");

    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "90000" },
    });
    expect(slider("Move from Groceries")).toHaveValue("60000");
  });
});

describe("AllocationDrawer limit row", () => {
  it("ranges from the current limit up to limit plus overage when over", () => {
    seed([["Rent", 100000, 150000]]);
    open("Rent");

    const input = slider("New limit for Rent");
    expect(input).toHaveAttribute("min", "100000");
    expect(input).toHaveAttribute("max", "150000");
    expect(input).toHaveValue("100000");
  });

  it("still offers headroom when the category is not over budget", () => {
    seed([["Rent", 100000, 40000]]);
    open("Rent");

    const input = slider("New limit for Rent");
    expect(input).toHaveAttribute("min", "100000");
    expect(Number(input.getAttribute("max"))).toBeGreaterThan(100000);
  });
});

describe("AllocationDrawer apply", () => {
  it("moves money from the sources into the target and closes", async () => {
    const user = userEvent.setup();
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    const onClose = open("Rent");

    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "50000" },
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(limitOf("Groceries")).toBe(30000);
    expect(limitOf("Rent")).toBe(150000);
    expect(onClose).toHaveBeenCalled();
  });

  it("raises the target's own limit when only the limit slider moved", async () => {
    const user = userEvent.setup();
    seed([["Rent", 100000, 150000]]);
    const onClose = open("Rent");

    fireEvent.change(slider("New limit for Rent"), {
      target: { value: "150000" },
    });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(limitOf("Rent")).toBe(150000);
    expect(onClose).toHaveBeenCalled();
  });

  it("is disabled until something actually changes", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    open("Rent");

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "10000" },
    });
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });
});

describe("AllocationDrawer dismissal", () => {
  it("discards changes on Cancel", async () => {
    const user = userEvent.setup();
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    const onClose = open("Rent");

    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "50000" },
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(limitOf("Groceries")).toBe(80000);
    expect(limitOf("Rent")).toBe(100000);
  });

  it("discards changes on Escape", async () => {
    const user = userEvent.setup();
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    const onClose = open("Rent");

    fireEvent.change(slider("Move from Groceries"), {
      target: { value: "50000" },
    });
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(limitOf("Groceries")).toBe(80000);
  });

  it("discards changes when the scrim is clicked", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
    ]);
    const onClose = open("Rent");

    const scrim = screen.getByRole("dialog").parentElement!;
    fireEvent.mouseDown(scrim);

    expect(onClose).toHaveBeenCalled();
    expect(limitOf("Groceries")).toBe(80000);
  });
});

describe("AllocationDrawer reusability", () => {
  it("reads a different category's live data on each open", () => {
    seed([
      ["Rent", 100000, 150000],
      ["Groceries", 80000, 20000],
      ["Transport", 40000, 90000],
    ]);
    const { rerender } = render(
      <AllocationDrawer
        open
        month={MONTH}
        target={targetFor("Rent")}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Rent is \$500\.00 over/)).toBeInTheDocument();

    rerender(
      <AllocationDrawer
        open
        month={MONTH}
        target={targetFor("Transport")}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Transport is \$500\.00 over its \$400\.00 limit/),
    ).toBeInTheDocument();
    expect(slider("New limit for Transport")).toBeInTheDocument();
  });
});
