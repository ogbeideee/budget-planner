import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { Disclosure } from "@/components/ui/Disclosure";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ state: createInitialState() });
});

describe("Disclosure accordion regression", () => {
  it("expanded shows the body; collapsed shows only the header (no empty container)", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure id="regression:basic" title="Budget Allocation">
        <div data-testid="body-content">Body content here</div>
      </Disclosure>,
    );

    const header = screen.getByRole("button", { name: /Budget Allocation/ });
    const panel = document.getElementById("regression:basic-panel");

    expect(panel).not.toBeNull();
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("body-content")).not.toBeInTheDocument();

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("body-content")).toBeInTheDocument();

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("body-content")).not.toBeInTheDocument();
  });

  it("collapsed region contributes zero layout height (grid-template-rows 0fr)", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure id="regression:zero-height" title="Budget Allocation">
        <div data-testid="body-content">Body</div>
      </Disclosure>,
    );

    const header = screen.getByRole("button", { name: /Budget Allocation/ });
    const panel = document.getElementById("regression:zero-height-panel");
    expect(panel).not.toBeNull();

    await user.click(header);
    expect(panel!.style.gridTemplateRows).toBe("1fr");

    await user.click(header);
    expect(panel!.style.gridTemplateRows).toBe("0fr");
  });

  it("persists open state across remounts via the storage seam", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Disclosure id="regression:persist" title="Budget Allocation">
        <div data-testid="body-content">Body</div>
      </Disclosure>,
    );
    await user.click(screen.getByRole("button", { name: /Budget Allocation/ }));
    expect(screen.getByTestId("body-content")).toBeInTheDocument();

    unmount();
    render(
      <Disclosure id="regression:persist" title="Budget Allocation">
        <div data-testid="body-content">Body</div>
      </Disclosure>,
    );
    expect(screen.getByTestId("body-content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Budget Allocation/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
