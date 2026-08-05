import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";
import { CategoryEditModal } from "./CategoryEditModal";
import type { Category } from "@/lib/types";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Groceries",
    icon: "🛒",
    color: "#22c55e",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function seedStore() {
  window.localStorage.clear();
  useToastStore.setState({ toasts: [] });
  const state = createInitialState();
  state.categories = [makeCategory()];
  useAppStore.setState({ state });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  seedStore();
});

describe("CategoryEditModal", () => {
  it("seeds the draft from the category exactly once on open", () => {
    const onClose = vi.fn();
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Groceries");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps the name input DOM node while typing", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CategoryEditModal category={makeCategory()} onClose={vi.fn()} />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "ies");
    expect(screen.getByLabelText("Name")).toBe(nameInput);
    expect(container.querySelector("form")).toBeNull();
  });

  it("does not write to the global store while typing or picking", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Name"), " and more");
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const dialogs = screen.getAllByRole("dialog");
    const picker = dialogs[dialogs.length - 1];
    await user.click(within(picker).getByRole("option", { name: "Apple" }));

    expect(useAppStore.getState().state.categories[0]).toMatchObject({
      name: "Groceries",
      icon: "🛒",
      color: "#22c55e",
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the icon picker search input and grid container while typing in search", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CategoryEditModal category={makeCategory()} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const dialogs = screen.getAllByRole("dialog");
    const picker = dialogs[dialogs.length - 1];
    const search = within(picker).getByRole("combobox");
    const optionsTree = picker.querySelector("#icon-picker-options");
    expect(optionsTree).toBeTruthy();
    const scrollContainer = picker.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeTruthy();

    await user.type(search, "gro");

    const pickerAfter = screen.getAllByRole("dialog")[1];
    expect(within(pickerAfter).getByRole("combobox")).toBe(search);
    expect(pickerAfter.querySelector("#icon-picker-options")).toBe(optionsTree);
    expect(pickerAfter.querySelector(".overflow-y-auto")).toBe(scrollContainer);
    expect(screen.getAllByRole("dialog").length).toBe(2);
    expect(container.querySelector("form")).toBeNull();
  });

  it("does not log uncontrolled/controlled warnings while editing", async () => {
    const user = userEvent.setup();
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      warnings.push(args.map(String).join(" "));
    });

    render(
      <CategoryEditModal category={makeCategory()} onClose={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Name"), "x");
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const picker = screen.getAllByRole("dialog")[1];
    await user.type(within(picker).getByRole("combobox"), "gro");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(warnings.filter((w) => /uncontrolled/i.test(w))).toEqual([]);
    spy.mockRestore();
  });

  it("saves the draft with updateCategory exactly once and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const updateSpy = vi.spyOn(useAppStore.getState(), "updateCategory");

    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Supermarket");
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const picker = screen.getAllByRole("dialog")[1];
    await user.click(within(picker).getByRole("option", { name: "Apple" }));
    await user.selectOptions(screen.getByLabelText("Color"), "#ef4444");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith("cat-1", {
      name: "Supermarket",
      icon: expect.any(String),
      color: "#ef4444",
    });
    expect(useAppStore.getState().state.categories[0].name).toBe("Supermarket");
    expect(onClose).toHaveBeenCalledTimes(1);
    updateSpy.mockRestore();
  });

  it("cancel does not touch the store", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Name"), "changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useAppStore.getState().state.categories[0]).toMatchObject({
      name: "Groceries",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty name without updating the store", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(useAppStore.getState().state.categories[0].name).toBe("Groceries");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      useToastStore.getState().toasts.some((t) => t.tone === "error"),
    ).toBe(true);
  });

  it("rejects a cleared icon without updating the store", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const picker = screen.getAllByRole("dialog")[1];
    await user.click(within(picker).getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(useAppStore.getState().state.categories[0]).toMatchObject({
      name: "Groceries",
      icon: "🛒",
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      useToastStore.getState().toasts.some((t) => t.tone === "error"),
    ).toBe(true);
  });

  it("rejects renaming to an existing category's name", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        categories: [
          makeCategory(),
          makeCategory({ id: "cat-2", name: "Rent", icon: "🏠" }),
        ],
      },
    });
    render(
      <CategoryEditModal category={makeCategory()} onClose={onClose} />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "rent");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(useAppStore.getState().state.categories[0].name).toBe("Groceries");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      useToastStore
        .getState()
        .toasts.some(
          (t) => t.tone === "error" && t.message.includes("already exists"),
        ),
    ).toBe(true);
  });
});
