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

async function expandTimeline() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Timeline/ }));
}

describe("TransactionList timeline polish", () => {
  it("highlights the Today group with a subtle brand accent and a prominent total", async () => {
    seedTwoGroups();
    const { container } = render(<TransactionList />);
    await expandTimeline();

    const todayHeader = screen.getByText("Today").closest("th")!;
    expect(todayHeader.className).toContain("bg-brand-500/10");
    expect(todayHeader.className).toContain("text-brand-600");
    expect(
      todayHeader.querySelector('span[aria-hidden="true"]'),
    ).not.toBeNull();

    const todayTotal = within(todayHeader).getByText("$50.00");
    expect(todayTotal.className).toContain("font-bold");
    expect(todayTotal.className).toContain("text-brand-600");

    const otherTotal = within(
      screen.getByText("$30.00").closest("th")!,
    ).getByText("$30.00");
    expect(otherTotal.className).toContain("font-bold");
    expect(otherTotal.className).toContain("text-ink");

    expect(container.querySelectorAll('tr[aria-hidden="true"]').length).toBe(1);
  });

  it("increases hover feedback on transaction rows", async () => {
    seedTwoGroups();
    render(<TransactionList />);
    await expandTimeline();

    const row = screen.getByText("Rent today").closest("tr")!;
    expect(row.className).toContain("hover:bg-canvas");
  });

  it("keeps the filter bar in flow and pins table headers below the app header", async () => {
    seedTwoGroups();
    const { container } = render(<TransactionList />);
    await expandTimeline();

    const bar = screen.getByRole("button", { name: "New record" }).closest("div")!;
    expect(bar.className).not.toContain("sticky");

    const headerCells = container.querySelectorAll('th[scope="col"]');
    expect(headerCells.length).toBe(5);
    headerCells.forEach((cell) => {
      expect(cell.className).toContain("sticky top-16");
      expect(cell.className).toContain("lg:top-0");
    });
  });

  it("wraps long unbroken notes instead of widening the table", async () => {
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
    await expandTimeline();

    const cell = screen.getByText(note);
    expect(cell.className).toContain("break-words");
  });
});