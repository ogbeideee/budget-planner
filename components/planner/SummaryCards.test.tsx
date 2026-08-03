import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  it("shows Set monthly income when the month has no income", () => {
    render(<SummaryCards month="2026-08" />);
    const incomeButton = screen.getByRole("button", {
      name: /Set monthly income/,
    });
    expect(incomeButton).toBeInTheDocument();
    expect(within(incomeButton).getByText("$0.00")).toBeInTheDocument();
  });

  it("opens the Monthly income modal from the income card", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);
    await user.click(
      screen.getByRole("button", { name: /Set monthly income/ }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Monthly income"),
    ).toBeInTheDocument();
  });

  it("saving updates the store, the card, and the other summary values", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(
      screen.getByRole("button", { name: /Set monthly income/ }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Amount"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const { state } = useAppStore.getState();
    const income = state.transactions.find((t) => t.monthlyIncome === true);
    expect(income).toMatchObject({ amount: 250000, type: "income" });

    await waitFor(() => {
      const incomeButton = screen.getByRole("button", { name: /income/i });
      expect(within(incomeButton).getByText("$2,500.00")).toBeInTheDocument();
    });

    await waitFor(() => {
      const netCard = screen.getByRole("button", { name: "Net summary" });
      expect(within(netCard).getByText("$2,500.00")).toBeInTheDocument();
    });
    await waitFor(() => {
      const remainingCard = screen.getByRole("button", {
        name: "Remaining allocation",
      });
      expect(within(remainingCard).getByText("$2,500.00")).toBeInTheDocument();
    });
  });

  it("pre-fills the modal with the saved amount when reopened", async () => {
    const user = userEvent.setup();
    render(<SummaryCards month="2026-08" />);

    await user.click(
      screen.getByRole("button", { name: /Set monthly income/ }),
    );
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Amount"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await user.click(screen.getByRole("button", { name: /income/i }));
    dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Amount") as HTMLInputElement).value,
    ).toBe("2500");
  });
});
