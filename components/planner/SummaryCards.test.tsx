import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { SummaryCards } from "./SummaryCards";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("SummaryCards monthly income", () => {
  it("shows Set Monthly Income when the month has no income", () => {
    render(<SummaryCards month="2026-08" />);
    const incomeButton = screen.getByRole("button", {
      name: /Set Monthly Income/,
    });
    expect(incomeButton).toBeInTheDocument();
    expect(within(incomeButton).getByText("$0.00")).toBeInTheDocument();
  });

  it("opens the Monthly Income modal from the income card", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);
    await user.click(screen.getByRole("button", { name: /Set Monthly Income/ }));
    expect(
      within(screen.getByRole("dialog")).getByText("Monthly Income"),
    ).toBeInTheDocument();
  });

  it("saving updates the store, the card, and the other summary values", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(screen.getByRole("button", { name: /Set Monthly Income/ }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Amount"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const { state } = useAppStore.getState();
    const income = state.transactions.find((t) => t.monthlyIncome === true);
    expect(income).toMatchObject({ amount: 250000, type: "income" });

    const incomeButton = screen.getByRole("button", { name: /Income/ });
    expect(within(incomeButton).getByText("$2,500.00")).toBeInTheDocument();

    const netCard = screen.getByText("Net").closest("section")!;
    expect(within(netCard).getByText("$2,500.00")).toBeInTheDocument();
    const remainingCard = screen.getByText("Remaining").closest("section")!;
    expect(within(remainingCard).getByText("$2,500.00")).toBeInTheDocument();
  });

  it("pre-fills the modal with the saved amount when reopened", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(screen.getByRole("button", { name: /Set Monthly Income/ }));
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Amount"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await user.click(screen.getByRole("button", { name: /Income/ }));
    dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Amount") as HTMLInputElement).value,
    ).toBe("2500");
  });
});
