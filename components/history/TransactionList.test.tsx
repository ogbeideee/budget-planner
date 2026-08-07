import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  dateToIso,
  monthKeyFromIso,
  todayIso,
} from "@/lib/date";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { TransactionList } from "./TransactionList";

const params = vi.hoisted(() => new URLSearchParams());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/history",
  useSearchParams: () => params,
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), prefetch: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
  params.delete("month");
  params.set("month", monthKeyFromIso(todayIso()));
  replaceMock.mockClear();
});

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateToIso(date);
}

function secondDateInMonth(): string {
  const today = todayIso();
  const yesterday = isoDaysFromNow(-1);
  if (monthKeyFromIso(yesterday) === monthKeyFromIso(today)) return yesterday;
  return isoDaysFromNow(1);
}

function seedTwoGroups() {
  const state = useAppStore.getState().state;
  const now = new Date().toISOString();
  const rows = [
    { name: "Rent", amount: 5000, date: todayIso(), note: "Rent today" },
    {
      name: "Groceries",
      amount: 3000,
      date: secondDateInMonth(),
      note: "Groceries other day",
    },
  ];
  useAppStore.setState({
    state: {
      ...state,
      transactions: rows.map((row, index) => ({
        id: `t${index}`,
        type: "expense" as const,
        categoryId: state.categories.find((c) => c.name === row.name)!.id,
        amount: row.amount,
        date: row.date,
        note: row.note,
        createdAt: now,
      })),
    },
  });
}

describe("TransactionList timeline polish", () => {
  it("highlights the Today group with a subtle brand accent and a prominent total", () => {
    seedTwoGroups();
    render(<TransactionList />);

    const todayHeader = screen.getByText("Today").closest("h2")!;
    expect(todayHeader.className).toContain("sticky top-16");
    expect(todayHeader.className).toContain("lg:top-0");
    expect(todayHeader.className).toContain("text-brand-600");
    expect(
      todayHeader.querySelector('span[aria-hidden="true"]'),
    ).not.toBeNull();

    const todayTotal = within(todayHeader).getByText("$50.00 spent");
    expect(todayTotal.className).toContain("font-bold");
    expect(todayTotal.className).toContain("text-brand-600");

    const otherTotal = within(
      screen.getByText("$30.00 spent").closest("h2")!,
    ).getByText("$30.00 spent");
    expect(otherTotal.className).toContain("font-bold");
    expect(otherTotal.className).toContain("text-ink");
  });

  it("renders transactions as activity cards that lift on hover", () => {
    seedTwoGroups();
    render(<TransactionList />);

    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.className).toContain("rounded-lg");
      expect(card.className).toContain("shadow-card");
      expect(card.className).toContain("hover:shadow-card-hover");
      expect(card.className).toContain("hover:-translate-y-0.5");
    }
  });

  it("keeps the filter bar in flow and pins group headings below the app header", () => {
    seedTwoGroups();
    render(<TransactionList />);

    const bar = screen.getByRole("button", { name: "New record" }).closest("div")!;
    expect(bar.className).not.toContain("sticky");

    const heading = screen.getByText("Today").closest("h2")!;
    expect(heading.className).toContain("sticky top-16");
    expect(heading.className).toContain("lg:top-0");
  });

  it("wraps long unbroken notes instead of widening the feed", () => {
    const state = useAppStore.getState().state;
    const note = "x".repeat(200);
    useAppStore.setState({
      state: {
        ...state,
        transactions: [
          {
            id: "long-note",
            type: "expense" as const,
            categoryId: state.categories[0].id,
            amount: 100,
            date: todayIso(),
            note,
            createdAt: new Date().toISOString(),
          },
          ...state.transactions,
        ],
      },
    });
    render(<TransactionList />);

    const noteElements = screen.getAllByText(note);
    expect(noteElements.some((el) => el.className.includes("break-words"))).toBe(
      true,
    );
    expect(
      noteElements.some((el) => el.className.includes("line-clamp-1")),
    ).toBe(true);
  });

  it("expands a transaction into a details panel with labeled actions", async () => {
    seedTwoGroups();
    const user = userEvent.setup();
    render(<TransactionList />);

    await user.click(
      screen.getAllByRole("button", {
        name: "Expand transaction details",
      })[0],
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Move to next month" }),
    ).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getAllByText("Rent today").length).toBeGreaterThan(0);
  });

  it("shows an encouraging empty state with a primary CTA", () => {
    render(<TransactionList />);

    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add your first transaction" }),
    ).toBeInTheDocument();
  });
});
