import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { todayIso } from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { TodoView } from "./TodoView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/todo",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

const month = todayIso().slice(0, 7);

function seedOverLimitBudget() {
  const { state } = useAppStore.getState();
  const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
  const incomeCategory = state.categories.find((c) => c.kind === "income")!;
  useAppStore.setState({
    state: {
      ...state,
      budgets: [
        {
          id: crypto.randomUUID(),
          categoryId: expenseCategory.id,
          month,
          limit: 40000,
          priority: "medium" as const,
        },
      ],
      transactions: [
        {
          id: crypto.randomUUID(),
          categoryId: expenseCategory.id,
          amount: 48700,
          type: "expense" as const,
          date: `${month}-10`,
          createdAt: `${month}-10T00:00:00.000Z`,
        },
        {
          id: crypto.randomUUID(),
          categoryId: incomeCategory.id,
          amount: 100000,
          type: "income" as const,
          date: `${month}-01`,
          createdAt: `${month}-01T00:00:00.000Z`,
        },
      ],
    },
  });
}

describe("TodoView", () => {
  it("shows the header, summary counts and the over-limit task", () => {
    seedOverLimitBudget();
    render(<TodoView />);

    expect(
      screen.getByRole("heading", { name: "To-Do" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A short list of what needs your attention this month."),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText("To-do summary");
    expect(summary.textContent).toContain("1 item needs attention");
    expect(summary.textContent).toContain("0 completed");
    expect(summary.textContent).toContain("1 high priority");

    expect(screen.getByText("Budget far over limit")).toBeInTheDocument();
    expect(screen.getByText(/against a limit of/)).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();

    const resolve = screen.getByRole("link", { name: "Resolve" });
    expect(resolve).toHaveAttribute("href", "/");
    expect(resolve.className).toContain("text-brand-600");

    const row = screen.getByText("Budget far over limit").closest("li")!;
    expect(row.className).toContain("border-danger/20");
    expect(row.className).toContain("bg-danger/[0.05]");
  });

  it("shows the all-caught-up section below the task list", () => {
    seedOverLimitBudget();
    render(<TodoView />);

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing else needs your attention this month."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Planner" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("switches between All, Needs attention and Completed", async () => {
    const user = userEvent.setup();
    seedOverLimitBudget();
    render(<TodoView />);

    const all = screen.getByRole("button", { name: "All" });
    expect(all).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(screen.getByText("Budget far over limit")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.queryByText("Budget far over limit")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing completed yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Completed tasks will appear here."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Budget far over limit")).toBeInTheDocument();
  });

  it("shows a neutral no-data item with zero summary counts for an empty month", () => {
    render(<TodoView />);

    expect(screen.getByText("No data for this month")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();

    const summary = screen.getByLabelText("To-do summary");
    expect(summary.textContent).toContain("0 items need attention");
    expect(summary.textContent).toContain("0 completed");
    expect(summary.textContent).toContain("0 high priority");
  });
});