import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TransactionRow } from "./TransactionRow";
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

function renderRow(transaction: Transaction) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onMoveNextMonth = vi.fn();
  render(
    <table>
      <tbody>
        <TransactionRow
          transaction={transaction}
          category={category}
          currency="USD"
          onEdit={onEdit}
          onDelete={onDelete}
          onMoveNextMonth={onMoveNextMonth}
        />
      </tbody>
    </table>,
  );
  return { onEdit, onDelete, onMoveNextMonth };
}

function actionsCell(): HTMLElement {
  return screen
    .getByRole("button", { name: "Edit transaction" })
    .closest("td")!;
}

describe("TransactionRow action alignment", () => {
  it("renders compact (sm) ghost buttons for expense rows", () => {
    renderRow(makeTransaction());

    const cell = actionsCell();
    const buttons = within(cell).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.className).toContain("min-h-9");
      expect(button.className).toContain("px-3");
    }
  });

  it("keeps the delete button aligned on income rows with a placeholder slot", () => {
    renderRow(makeTransaction({ type: "income", amount: 9000 }));

    const cell = actionsCell();
    expect(
      within(cell)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Edit transaction", "Delete transaction"]);

    const placeholder = cell.querySelector('span[aria-hidden="true"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.className).toContain("w-10");

    const container = cell.querySelector("div")!;
    const children = Array.from(container.children);
    expect(children).toHaveLength(3);
    expect(children[0].tagName).toBe("BUTTON");
    expect(children[1].tagName).toBe("SPAN");
    expect(children[2].tagName).toBe("BUTTON");
  });

  it("increases hover feedback on the row", () => {
    renderRow(makeTransaction());
    const row = screen.getByText("August rent").closest("tr")!;
    expect(row.className).toContain("hover:bg-canvas");
  });
});
