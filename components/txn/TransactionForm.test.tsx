import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { totals } from "@/lib/selectors";
import { useAppStore } from "@/store/useAppStore";
import { TransactionForm } from "./TransactionForm";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

function expenseCategoryId(): string {
  return useAppStore
    .getState()
    .state.categories.find((category) => category.kind === "expense")!.id;
}

describe("TransactionForm (AC-04, AC-05)", () => {
  it("adds an expense and updates totals immediately", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.selectOptions(
      screen.getByLabelText("Category"),
      expenseCategoryId(),
    );
    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(1250);
    expect(state.transactions[0].type).toBe("expense");
    expect(totals(state.transactions, "2026-08").expenses).toBe(1250);
  });

  it("edits a transaction and updates totals (AC-05)", async () => {
    const user = userEvent.setup();
    const categoryId = expenseCategoryId();
    useAppStore.getState().addTransaction({
      categoryId,
      amount: 500,
      type: "expense",
      date: "2026-08-10",
    });
    const transaction = useAppStore.getState().state.transactions[0];

    render(
      <TransactionForm open onClose={() => {}} transaction={transaction} />,
    );
    const amount = screen.getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "30.00");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const { state } = useAppStore.getState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(3000);
    expect(totals(state.transactions, "2026-08").expenses).toBe(3000);
  });

  it("rejects an invalid amount without adding anything", async () => {
    const user = userEvent.setup();
    render(<TransactionForm open onClose={() => {}} />);
    await user.type(screen.getByLabelText("Amount"), "abc");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(useAppStore.getState().state.transactions).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount");
  });
});
