import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DISPLAY_NAME_STORAGE_KEY } from "@/lib/displayName";
import { useDisplayName } from "@/store/useDisplayName";
import { NameSetupModal } from "./NameSetupModal";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  useDisplayName.setState({ name: null, ready: true });
});

function renderModal() {
  const user = userEvent.setup();
  render(<NameSetupModal />);
  return { user };
}

describe("NameSetupModal", () => {
  it("renders the welcome copy with a disabled Continue button", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "What should we call you?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tell us your name so we can make your Budget Planner/),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("keeps Continue disabled for empty or whitespace-only input", async () => {
    const { user } = renderModal();
    const input = screen.getByPlaceholderText("Enter your name");

    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("enables Continue once a name is typed", async () => {
    const { user } = renderModal();

    await user.type(screen.getByPlaceholderText("Enter your name"), "Daniel");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("submits the trimmed name with Enter and closes", async () => {
    const { user } = renderModal();

    await user.type(
      screen.getByPlaceholderText("Enter your name"),
      "  Daniel  ",
    );
    await user.keyboard("{Enter}");

    expect(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)).toBe("Daniel");
    expect(useDisplayName.getState().name).toBe("Daniel");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the trimmed name via Continue", async () => {
    const { user } = renderModal();

    await user.type(screen.getByPlaceholderText("Enter your name"), "Daniel");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)).toBe("Daniel");
    expect(useDisplayName.getState().name).toBe("Daniel");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open when a name is already saved", () => {
    useDisplayName.setState({ name: "Daniel", ready: true });
    renderModal();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed until the store is ready (SSR-safe gate)", () => {
    useDisplayName.setState({ name: null, ready: false });
    renderModal();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});