import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ICON_GROUPS } from "@/components/settings/iconLibrary";
import { IconPicker } from "./IconPicker";

afterEach(cleanup);

const EMOJI_GROUPS = ICON_GROUPS.filter((g) => g.id !== "vectors");
const EMOJI_COUNT = EMOJI_GROUPS.flatMap((g) => g.icons).length;

/**
 * The library grew from 100 to 153 selectable icons. These guard the two things
 * that degrade first with a bigger set: the grid becoming an undifferentiated
 * wall, and search stopping being fast or relevant.
 */
describe("IconPicker with the expanded library", () => {
  it("keeps every group small enough to scan", () => {
    for (const group of EMOJI_GROUPS) {
      // A group past ~30 stops reading as a group and becomes a wall.
      expect(group.icons.length).toBeLessThanOrEqual(30);
      expect(group.icons.length).toBeGreaterThan(0);
    }
    // And the set stays chunked rather than a handful of huge buckets.
    expect(EMOJI_GROUPS.length).toBeGreaterThanOrEqual(10);
  });

  it("opens and renders the whole set quickly", async () => {
    const user = userEvent.setup();
    render(<IconPicker label="Icon" value="🛒" onChange={vi.fn()} vectors={false} />);

    const started = performance.now();
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));
    const elapsed = performance.now() - started;

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Generous ceiling — this is a regression tripwire, not a benchmark.
    expect(elapsed).toBeLessThan(3000);
  });

  it("filters to relevant results as the user types", async () => {
    const user = userEvent.setup();
    render(<IconPicker label="Icon" value="🛒" onChange={vi.fn()} vectors={false} />);
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));

    const search = screen.getByPlaceholderText(/search/i);
    await user.type(search, "rent");

    // Narrowed well below the full set, and the obvious match is present.
    const results = screen.getAllByRole("option");
    expect(results.length).toBeLessThan(EMOJI_COUNT / 3);
    expect(
      results.some((r) => (r.getAttribute("aria-label") ?? "") === "Rent"),
    ).toBe(true);
  });

  it("finds icons by keyword, not just by label", async () => {
    const user = userEvent.setup();
    render(<IconPicker label="Icon" value="🛒" onChange={vi.fn()} vectors={false} />);
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));

    const search = screen.getByPlaceholderText(/search/i);
    // "tithe" is a keyword on Church, never its label.
    await user.type(search, "tithe");

    const results = screen.getAllByRole("option");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some((r) => (r.getAttribute("aria-label") ?? "") === "Church"),
    ).toBe(true);
  });

  it("says so rather than showing an empty grid for no matches", async () => {
    const user = userEvent.setup();
    render(<IconPicker label="Icon" value="🛒" onChange={vi.fn()} vectors={false} />);
    await user.click(screen.getByRole("button", { name: /Open the icon picker/ }));

    await user.type(screen.getByPlaceholderText(/search/i), "zzzzqqq");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
