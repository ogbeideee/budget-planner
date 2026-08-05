import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";
import { CategoryManager } from "./CategoryManager";

function seedStore() {
  window.localStorage.clear();
  useToastStore.setState({ toasts: [] });
  const state = createInitialState();
  state.categories = state.categories.filter((c) => c.kind === "expense");
  useAppStore.setState({ state });
}

afterEach(cleanup);

beforeEach(() => {
  seedStore();
});

function errorToasts(): string[] {
  return useToastStore
    .getState()
    .toasts.filter((toast) => toast.tone === "error")
    .map((toast) => toast.message);
}

describe("CategoryManager", () => {
  it("blocks deleting a category used by transactions with an error toast", async () => {
    const user = userEvent.setup();
    const category = useAppStore.getState().state.categories[0];
    useAppStore.setState({
      state: {
        ...useAppStore.getState().state,
        transactions: [
          {
            id: "t-1",
            categoryId: category.id,
            amount: 100,
            type: "expense",
            date: "2026-08-01",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
    });

    render(<CategoryManager />);

    await user.click(screen.getByRole("button", { name: `Delete ${category.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(errorToasts().some((message) => message.includes("used by transactions"))).toBe(true);
    expect(
      useAppStore
        .getState()
        .state.categories.some((c) => c.id === category.id),
    ).toBe(true);
  });

  it("rejects adding a duplicate name with an error toast", async () => {
    const user = userEvent.setup();
    const existing = useAppStore.getState().state.categories[0];
    const count = useAppStore.getState().state.categories.length;

    render(<CategoryManager />);

    await user.type(screen.getByPlaceholderText("e.g., Groceries"), existing.name);
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);

    expect(
      errorToasts().some((message) => message.includes("already exists")),
    ).toBe(true);
    expect(useAppStore.getState().state.categories).toHaveLength(count);
  });

  it("rejects adding a category with a cleared icon", async () => {
    const user = userEvent.setup();
    const count = useAppStore.getState().state.categories.length;

    render(<CategoryManager />);

    await user.type(screen.getByPlaceholderText("e.g., Groceries"), "Snacks");
    const pickerButtons = screen.getAllByRole("button", {
      name: /Open the icon picker/,
    });
    await user.click(pickerButtons[0]);
    const picker = screen.getAllByRole("dialog").at(-1)!;
    await user.click(within(picker).getByRole("button", { name: "Clear" }));
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);

    expect(errorToasts().some((message) => message.includes("icon is required"))).toBe(true);
    expect(useAppStore.getState().state.categories).toHaveLength(count);
  });

  it("keeps the list and filter input mounted while typing", async () => {
    const user = userEvent.setup();
    render(<CategoryManager />);

    const filter = screen.getAllByPlaceholderText("Filter categories...")[0];
    await user.type(filter, "rent");
    expect(screen.getAllByPlaceholderText("Filter categories...")[0]).toBe(filter);
  });
});
