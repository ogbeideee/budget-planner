import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { BudgetForm } from "./BudgetForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("BudgetForm remount detection", () => {
  it("keeps the same DOM nodes while typing in the limit field", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BudgetForm open onClose={() => {}} month="2026-08" />,
    );

    const limit = screen.getByLabelText("Limit");
    const categorySelect = screen.getByLabelText("Category");
    const form = container.querySelector("form");
    const dialog = container.querySelector('[role="dialog"]');

    await user.type(limit, "12345");

    expect(screen.getByLabelText("Limit")).toBe(limit);
    expect(screen.getByLabelText("Category")).toBe(categorySelect);
    expect(container.querySelector("form")).toBe(form);
    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
  });

  it("keeps the same select DOM node when a category is picked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BudgetForm open onClose={() => {}} month="2026-08" />,
    );

    const categorySelect = screen.getByLabelText("Category");
    const [categoryId] = useAppStore
      .getState()
      .state.categories.filter((c) => c.kind === "expense")
      .map((c) => c.id);

    await user.selectOptions(categorySelect, categoryId);

    expect(screen.getByLabelText("Category")).toBe(categorySelect);
    expect(container.querySelector("form")).toBeTruthy();
  });

  it("does not remount the whole form when the store changes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BudgetForm open onClose={() => {}} month="2026-08" />,
    );

    const form = container.querySelector("form");
    const limit = screen.getByLabelText("Limit");
    await user.type(limit, "50");

    useAppStore.getState().addTransaction({
      categoryId: useAppStore
        .getState()
        .state.categories.find((c) => c.kind === "expense")!.id,
      amount: 100,
      type: "expense",
      date: "2026-08-10",
    });

    expect(container.querySelector("form")).toBe(form);
    expect(screen.getByLabelText("Limit")).toBe(limit);
  });
});
