import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import type { Category } from "@/lib/types";
import { CategoryModal } from "./CategoryModal";
import { bpsToPercentInput, percentToBps } from "./DebtFields";

afterEach(cleanup);

const CARD: Category = {
  id: "c-card",
  name: "Credit card",
  icon: "💳",
  color: "#ef4444",
  kind: "expense",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SALARY: Category = {
  id: "c-salary",
  name: "Salary",
  icon: "💰",
  color: "#0ea5e9",
  kind: "income",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({
    state: { ...createInitialState(), categories: [CARD, SALARY], debts: [] },
  });
});

describe("percent <-> basis points", () => {
  it("round-trips whole and fractional rates", () => {
    expect(percentToBps("12")).toBe(1200);
    expect(percentToBps("12.5")).toBe(1250);
    expect(bpsToPercentInput(1250)).toBe("12.5");
    expect(bpsToPercentInput(1200)).toBe("12");
  });

  it("treats blank and nonsense as 0%, never NaN", () => {
    expect(percentToBps("")).toBe(0);
    expect(percentToBps("   ")).toBe(0);
    expect(percentToBps("abc")).toBe(0);
    expect(percentToBps("-5")).toBe(0);
    expect(bpsToPercentInput(0)).toBe("0");
  });
});

describe("the Track as debt switch", () => {
  it("is off, and hides the debt fields, for an ordinary category", () => {
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Track as debt" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByLabelText("Current balance")).toBeNull();
  });

  it("reveals balance, rate and minimum once switched on", async () => {
    const user = userEvent.setup();
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));

    expect(screen.getByLabelText("Current balance")).toBeInTheDocument();
    expect(screen.getByLabelText(/Interest rate/)).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum monthly payment")).toBeInTheDocument();
  });

  it("is offered for an income category too", async () => {
    const user = userEvent.setup();
    render(<CategoryModal category={SALARY} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));
    expect(screen.getByLabelText("Current balance")).toBeInTheDocument();
  });

  it("saves a linked debt record rather than touching the budget", async () => {
    const user = userEvent.setup();
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));
    await user.type(screen.getByLabelText("Current balance"), "2500");
    await user.type(screen.getByLabelText(/Interest rate/), "18.5");
    await user.type(screen.getByLabelText("Minimum monthly payment"), "75");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const state = useAppStore.getState().state;
    expect(state.debts).toHaveLength(1);
    expect(state.debts[0]).toMatchObject({
      categoryId: CARD.id,
      balance: 250000,
      aprBps: 1850,
      minimumPayment: 7500,
    });
    // Purely additive: no budget was created or changed.
    expect(state.budgets).toEqual([]);
  });

  it("accepts a 0% rate for an interest-free loan", async () => {
    const user = userEvent.setup();
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));
    await user.type(screen.getByLabelText("Current balance"), "1000");
    // Rate deliberately left blank.
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(useAppStore.getState().state.debts[0]).toMatchObject({
      balance: 100000,
      aprBps: 0,
    });
  });

  it("says so when the balance is missing, and saves nothing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CategoryModal category={CARD} onClose={onClose} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Enter the current balance owed.")).toBeInTheDocument();
    expect(useAppStore.getState().state.debts).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("seeds from the existing record when reopened", () => {
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        debts: [
          {
            id: "d1",
            categoryId: CARD.id,
            balance: 250000,
            startingBalance: 400000,
            aprBps: 1850,
            minimumPayment: 7500,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    }));
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    expect(screen.getByRole("switch", { name: "Track as debt" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Current balance")).toHaveValue("2500");
    expect(screen.getByLabelText(/Interest rate/)).toHaveValue("18.5");
  });

  it("switching it off removes the record", async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        debts: [
          {
            id: "d1",
            categoryId: CARD.id,
            balance: 250000,
            startingBalance: 250000,
            aprBps: 1850,
            minimumPayment: 7500,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    }));
    render(<CategoryModal category={CARD} onClose={vi.fn()} />);

    await user.click(screen.getByRole("switch", { name: "Track as debt" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(useAppStore.getState().state.debts).toEqual([]);
    // The category itself survives untouched.
    expect(
      useAppStore.getState().state.categories.find((c) => c.id === CARD.id),
    ).toMatchObject({ name: "Credit card", icon: "💳" });
  });
});
