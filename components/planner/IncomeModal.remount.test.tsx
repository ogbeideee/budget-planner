import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { IncomeModal } from "./IncomeModal";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("IncomeModal + IconPicker remount detection", () => {
  it("keeps the name input DOM node while typing", async () => {
    const user = userEvent.setup();
    render(<IncomeModal month="2026-08" open onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Add income source" }));
    const nameInput = screen.getByPlaceholderText("e.g. Salary, Rent, Side gig…");
    await user.type(nameInput, "Salary");
    expect(screen.getByPlaceholderText("e.g. Salary, Rent, Side gig…")).toBe(
      nameInput,
    );
  });

  it("keeps the icon picker search input and scroll container while typing", async () => {
    const user = userEvent.setup();
    render(<IncomeModal month="2026-08" open onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Add income source" }));
    const iconButton = screen.getByRole("button", {
      name: /Open the icon picker/,
    });
    await user.click(iconButton);

    const dialogs = screen.getAllByRole("dialog");
    const picker = dialogs[dialogs.length - 1];
    const search = within(picker).getByRole("combobox");
    const scrollContainer = picker.querySelector(
      ".overflow-y-auto",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    await user.type(search, "gro");
    const dialogsAfter = screen.getAllByRole("dialog");
    const pickerAfter = dialogsAfter[dialogsAfter.length - 1];
    expect(
      within(pickerAfter).getByRole("combobox"),
    ).toBe(search);
    expect(pickerAfter.querySelector(".overflow-y-auto")).toBe(
      scrollContainer,
    );
  });

  it("does not remount the modal shell while typing in the search", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IncomeModal month="2026-08" open onClose={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Add income source" }));
    await user.click(
      screen.getByRole("button", { name: /Open the icon picker/ }),
    );
    const dialogs = screen.getAllByRole("dialog");
    const picker = dialogs[dialogs.length - 1];
    const search = within(picker).getByRole("combobox");
    const form = container.querySelector("form");
    const outerDialog = dialogs[0];

    await user.type(search, "g");

    expect(screen.getAllByRole("dialog").length).toBe(2);
    expect(screen.getAllByRole("dialog")[0]).toBe(outerDialog);
    expect(container.querySelector("form")).toBe(form);
  });
});
