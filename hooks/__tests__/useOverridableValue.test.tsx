import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createInitialState } from "@/lib/seed";
import { STORAGE_KEY } from "@/lib/storage";
import { resetStorageBackendCache } from "@/lib/storageAdapter";
import { createAppStore } from "@/store/useAppStore";
import { useOverridableValue } from "../useOverridableValue";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  resetStorageBackendCache();
});

/**
 * The architectural fact the whole convention rests on. If persistence ever
 * becomes asynchronous, this test fails FIRST and loudly — and every lazy
 * initializer reading the store becomes suspect at that moment.
 */
describe("persisted state is hydrated before React renders", () => {
  it("createAppStore() returns persisted data on its very first read", () => {
    const seeded = {
      ...createInitialState(),
      categories: [
        {
          id: "c1",
          name: "Marker",
          icon: "🛒",
          color: "#ef4444",
          kind: "expense" as const,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: seeded, version: 8 }),
    );

    const store = createAppStore();

    // No await, no act, no tick: hydration completed inside create().
    expect(store.getState().state.categories[0].name).toBe("Marker");
  });
});

function Probe({ derived }: { derived: string }) {
  const [value, setValue, reset] = useOverridableValue(derived);
  return (
    <div>
      <output>{value === "" ? "(empty)" : value}</output>
      <button type="button" onClick={() => setValue("typed")}>
        set
      </button>
      <button type="button" onClick={() => setValue("")}>
        clear
      </button>
      <button type="button" onClick={reset}>
        reset
      </button>
    </div>
  );
}

/** Re-renders `Probe` with a changing derived value, as real data would. */
function Host() {
  const [derived, setDerived] = useState("first");
  return (
    <div>
      <Probe derived={derived} />
      <button type="button" onClick={() => setDerived("second")}>
        change derived
      </button>
    </div>
  );
}

describe("useOverridableValue", () => {
  it("follows the derived value while untouched", async () => {
    const user = userEvent.setup();
    render(<Host />);

    expect(screen.getByRole("status")).toHaveTextContent("first");

    // This is the regression: a lazy useState initializer would still say
    // "first" here, forever.
    await user.click(screen.getByRole("button", { name: "change derived" }));
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });

  it("stops following once the user sets a value", async () => {
    const user = userEvent.setup();
    render(<Host />);

    await user.click(screen.getByRole("button", { name: "set" }));
    expect(screen.getByRole("status")).toHaveTextContent("typed");

    await user.click(screen.getByRole("button", { name: "change derived" }));
    expect(screen.getByRole("status")).toHaveTextContent("typed");
  });

  it("treats a falsy override as a real choice, not as untouched", async () => {
    const user = userEvent.setup();
    render(<Host />);

    await user.click(screen.getByRole("button", { name: "clear" }));
    expect(screen.getByRole("status")).toHaveTextContent("(empty)");

    // The boxing matters: an unboxed `T | null` would snap back to "second".
    await user.click(screen.getByRole("button", { name: "change derived" }));
    expect(screen.getByRole("status")).toHaveTextContent("(empty)");
  });

  it("reset() hands control back to the derived value", async () => {
    const user = userEvent.setup();
    render(<Host />);

    await user.click(screen.getByRole("button", { name: "set" }));
    await user.click(screen.getByRole("button", { name: "change derived" }));
    expect(screen.getByRole("status")).toHaveTextContent("typed");

    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });

  it("keeps a stable setter identity across renders", async () => {
    const seen = new Set<unknown>();
    function Identity({ derived }: { derived: string }) {
      const [, setValue] = useOverridableValue(derived);
      seen.add(setValue);
      return <output>{derived}</output>;
    }
    const { rerender } = render(<Identity derived="a" />);
    rerender(<Identity derived="b" />);
    rerender(<Identity derived="c" />);
    expect(seen.size).toBe(1);
    expect(vi.isMockFunction(() => {})).toBe(false);
  });
});
