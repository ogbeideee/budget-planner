import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnimatedMoney, AnimatedNumber } from "./AnimatedNumber";

afterEach(cleanup);

// Regression: these two render every animated amount in the app. Tabular
// figures must come from the primitive, not from each call site remembering
// the class — an audit of the running app found 11 of 35 currency elements
// rendering with proportional digits because callers had forgotten it.
describe("number primitives carry tabular figures", () => {
  it("AnimatedMoney sets tabular-nums without a className", () => {
    render(<AnimatedMoney value={150000} currency="USD" />);
    const el = screen.getByText(/\$/);
    expect(el.className).toContain("tabular-nums");
  });

  it("AnimatedMoney keeps tabular-nums alongside caller classes", () => {
    render(
      <AnimatedMoney value={150000} currency="USD" className="text-income" />,
    );
    const el = screen.getByText(/\$/);
    expect(el.className).toContain("tabular-nums");
    expect(el.className).toContain("text-income");
  });

  it("AnimatedNumber sets tabular-nums without a className", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    expect(container.querySelector("span")!.className).toContain("tabular-nums");
  });

  it("does not leave a stray leading space when no className is given", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    expect(container.querySelector("span")!.className).toBe("tabular-nums");
  });
});
