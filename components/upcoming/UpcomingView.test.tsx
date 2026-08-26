import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { dateToIso, todayIso } from "@/lib/date";
import type { FutureExpense } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { UpcomingView } from "./UpcomingView";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateToIso(date);
}

function seedExpenses(entries: Array<Partial<FutureExpense> & { title: string }>) {
  const { state } = useAppStore.getState();
  const expenseCategory = state.categories.find((c) => c.kind === "expense")!;
  const futureExpenses: FutureExpense[] = entries.map((entry) => ({
    id: crypto.randomUUID(),
    categoryId: expenseCategory.id,
    amount: 1999,
    dueDate: isoDaysFromNow(3),
    recurring: false,
    priority: "medium",
    status: "upcoming",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...entry,
  }));
  useAppStore.setState({ state: { ...state, futureExpenses } });
}

function timelineRows(): HTMLElement[] {
  const timeline = screen.getByRole("list", { name: "Upcoming timeline" });
  return within(timeline).getAllByRole("button", { name: /Netflix|Phone|Internet/ });
}

describe("UpcomingView", () => {
  it("shows a countdown chip beside each upcoming expense", () => {
    seedExpenses([
      { title: "Overdue bill", dueDate: isoDaysFromNow(-2) },
      { title: "Due today", dueDate: isoDaysFromNow(0) },
      { title: "Due tomorrow", dueDate: isoDaysFromNow(1) },
      { title: "Netflix", dueDate: isoDaysFromNow(3) },
    ]);
    render(<UpcomingView />);

    expect(screen.getByText("2 days overdue")).toBeInTheDocument();
    expect(screen.getByText("due today")).toBeInTheDocument();
    expect(screen.getByText("tomorrow")).toBeInTheDocument();
    expect(screen.getByText("in 3 days")).toBeInTheDocument();
  });

  it("counts the items in each date group", () => {
    seedExpenses([
      { title: "Netflix", dueDate: isoDaysFromNow(3) },
      { title: "Internet", dueDate: isoDaysFromNow(3) },
      { title: "Phone", dueDate: isoDaysFromNow(3) },
    ]);
    render(<UpcomingView />);

    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("opens the edit form when a row is clicked", async () => {
    const user = userEvent.setup();
    seedExpenses([
      { title: "Netflix", amount: 1999, dueDate: isoDaysFromNow(3) },
    ]);
    render(<UpcomingView />);

    await user.click(screen.getByRole("button", { name: /^Netflix / }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit upcoming expense")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Netflix");
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("19.99");
  });

  it("hides the countdown chip and Mark as paid on paid rows", async () => {
    const user = userEvent.setup();
    seedExpenses([
      { title: "Paid rent", status: "paid", dueDate: isoDaysFromNow(-5) },
      { title: "Live bill", dueDate: isoDaysFromNow(2) },
    ]);
    render(<UpcomingView />);

    const paidRow = screen
      .getByText("Paid rent")
      .closest("li")!;
    expect(within(paidRow).queryByText(/overdue|due today|tomorrow|in \d+ days/)).toBeNull();

    await user.click(
      within(paidRow).getByRole("button", { name: "Actions for Paid rent" }),
    );
    const paidMenu = within(paidRow).getByRole("menu");
    expect(within(paidMenu).queryByText("Mark as paid")).toBeNull();
    expect(within(paidMenu).getByText("Reschedule")).toBeInTheDocument();

    const liveRow = screen.getByText("Live bill").closest("li")!;
    await user.click(
      within(liveRow).getByRole("button", { name: "Actions for Live bill" }),
    );
    expect(
      within(screen.getByRole("menu")).getByText("Mark as paid"),
    ).toBeInTheDocument();
  });

  it("shows the clear-for-the-month empty state when everything is paid", async () => {
    const user = userEvent.setup();
    seedExpenses([
      { title: "Paid rent", status: "paid", amount: 500000, dueDate: isoDaysFromNow(-5) },
    ]);
    render(<UpcomingView />);

    expect(
      screen.getByText("You're clear for the rest of the month."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing else is scheduled.")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Add upcoming expense" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("summarizes totals, the next due expense, this month and recurring", () => {
    seedExpenses([
      { title: "Netflix", amount: 1999, dueDate: todayIso() },
      { title: "Internet", amount: 2500, dueDate: todayIso(), recurring: true },
      { title: "Phone", amount: 3000, dueDate: isoDaysFromNow(40) },
    ]);
    render(<UpcomingView />);

    const summary = screen.getByLabelText("Upcoming summary");
    within(summary).getByText("$74.99");
    within(summary).getByText("3 expenses planned");
    within(summary).getByText("$19.99");
    within(summary).getByText(/due today/);
    within(summary).getByText("$44.99");
    within(summary).getByText("2 expenses this month");
    within(summary).getByText("1");
  });

  it("filters the timeline by This month and Later", async () => {
    const user = userEvent.setup();
    seedExpenses([
      { title: "Netflix", dueDate: todayIso() },
      { title: "Phone", dueDate: isoDaysFromNow(40) },
    ]);
    render(<UpcomingView />);

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
  });

  it("toggles the sort between Soonest and Latest", async () => {
    const user = userEvent.setup();
    seedExpenses([
      { title: "Netflix", dueDate: isoDaysFromNow(1) },
      { title: "Phone", dueDate: isoDaysFromNow(10) },
    ]);
    render(<UpcomingView />);

    expect(timelineRows()[0].textContent).toContain("Netflix");

    await user.click(screen.getByRole("button", { name: "Soonest" }));
    expect(timelineRows()[0].textContent).toContain("Phone");

    await user.click(screen.getByRole("button", { name: "Latest" }));
    expect(timelineRows()[0].textContent).toContain("Netflix");
  });

  it("subtly highlights the nearest upcoming expense", () => {
    seedExpenses([
      { title: "Netflix", dueDate: isoDaysFromNow(3) },
      { title: "Phone", dueDate: isoDaysFromNow(10) },
    ]);
    render(<UpcomingView />);

    const nearestRow = screen.getByText("Netflix").closest("li")!;
    expect(nearestRow.className).toContain("bg-brand-500/[0.05]");
    const laterRow = screen.getByText("Phone").closest("li")!;
    expect(laterRow.className).not.toContain("bg-brand-500");
  });
});
