import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionCard } from "./TransactionCard";
import type { Category, Transaction } from "@/lib/types";

afterEach(cleanup);

const category: Category = {
  id: "cat-1",
  name: "Rent",
  icon: "🏠",
  color: "#ef4444",
  kind: "expense",
  createdAt: "2026-08-01T00:00:00.000Z",
};

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    type: "expense",
    categoryId: category.id,
    amount: 5000,
    date: "2026-08-15",
    note: "August rent",
    createdAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function renderCard(transaction: Transaction) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onMoveNextMonth = vi.fn();
  render(
    <TransactionCard
      transaction={transaction}
      category={category}
      currency="USD"
      onEdit={onEdit}
      onDelete={onDelete}
      onMoveNextMonth={onMoveNextMonth}
    />,
  );
  return { onEdit, onDelete, onMoveNextMonth };
}

function actionsGroup(): HTMLElement {
  return screen
    .getByRole("button", { name: "Edit transaction" })
    .closest("div")!;
}

describe("TransactionCard presentation", () => {
  it("renders compact (sm) ghost buttons for expense rows", () => {
    renderCard(makeTransaction());

    const group = actionsGroup();
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.className).toContain("min-h-8");
      expect(button.className).toContain("px-0");
    }
  });

  it("keeps the delete button aligned on income rows with a placeholder slot", () => {
    renderCard(makeTransaction({ type: "income", amount: 9000 }));

    const group = actionsGroup();
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Edit transaction", "Delete transaction"]);

    const placeholder = group.querySelector('span[aria-hidden="true"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.className).toContain("w-10");

    const children = Array.from(group.children);
    expect(children).toHaveLength(3);
    expect(children[0].tagName).toBe("BUTTON");
    expect(children[1].tagName).toBe("SPAN");
    expect(children[2].tagName).toBe("BUTTON");
  });

  it("increases hover feedback on the card", () => {
    renderCard(makeTransaction());
    const card = screen.getAllByText("August rent")[0].closest(
      '[role="listitem"]',
    )!;
    expect(card.className).toContain("hover:shadow-card-hover");
    expect(card.className).toContain("hover:-translate-y-0.5");
  });

  it("shows a category pill and a status badge when deferred", () => {
    renderCard(makeTransaction({ deferred: true }));

    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Deferred")).toBeInTheDocument();
  });

  it("labels recurring transactions", () => {
    renderCard(
      makeTransaction({
        recurringRuleId: "rule-1",
        note: "Netflix",
        amount: 1500,
      }),
    );
    expect(screen.getByText("Recurring")).toBeInTheDocument();
    expect(screen.getByText("-$15.00")).toBeInTheDocument();
  });

  it("expands into a details panel with full note and labeled actions", async () => {
    const user = userEvent.setup();
    renderCard(makeTransaction({ note: "A very long explanation" }));

    await user.click(
      screen.getByRole("button", { name: "Show transaction details" }),
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Move to next month" }),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.getAllByText("A very long explanation").length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("No budget set")).toBeInTheDocument();
  });
});
