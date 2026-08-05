import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Modal } from "./Modal";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Edit">
      <input
        type="text"
        aria-label="Name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  );
}

function NestedHarness() {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(true);
  return (
    <Modal open={outerOpen} onClose={() => setOuterOpen(false)} title="Outer">
      <input aria-label="Outer field" />
      <Modal
        open={innerOpen}
        onClose={() => setInnerOpen(false)}
        title="Inner"
      >
        <input aria-label="Inner field" />
      </Modal>
    </Modal>
  );
}

describe("Modal focus retention", () => {
  it("keeps focus in the input while typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Name");
    await user.type(input, "Groceries");
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("Groceries");
  });
});

describe("Nested modal focus isolation", () => {
  it("Escape inside a nested dialog closes only the nested dialog", async () => {
    const user = userEvent.setup();
    render(<NestedHarness />);

    screen.getByLabelText("Inner field").focus();
    await user.keyboard("{Escape}");

    expect(screen.getByRole("heading", { name: "Outer" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Inner field")).not.toBeInTheDocument();
  });

  it("Tab at the last element of a nested dialog wraps inside it, not into the outer dialog", async () => {
    const user = userEvent.setup();
    render(<NestedHarness />);

    screen.getByLabelText("Inner field").focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByLabelText("Inner field"));
    expect(document.activeElement).not.toBe(
      screen.getByLabelText("Outer field"),
    );
  });
});
