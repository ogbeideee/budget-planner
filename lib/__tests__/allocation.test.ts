import { describe, expect, it } from "vitest";
import { clampAllocation, totalAllocated } from "../allocation";

describe("totalAllocated", () => {
  it("sums allocation values", () => {
    expect(totalAllocated({ a: 100, b: 250 })).toBe(350);
    expect(totalAllocated({})).toBe(0);
  });
});

describe("clampAllocation (AC-18)", () => {
  it("keeps values within [0, remaining - others]", () => {
    expect(clampAllocation(500, 1000, 0)).toBe(500);
    expect(clampAllocation(2000, 1000, 0)).toBe(1000);
    expect(clampAllocation(2000, 1000, 600)).toBe(400);
    expect(clampAllocation(-5, 1000, 0)).toBe(0);
  });

  it("never lets the sum of allocations exceed remaining", () => {
    const remaining = 3000;
    let otherTotal = totalAllocated({ b1: 1000, b2: 1000 });
    const next = clampAllocation(5000, remaining, otherTotal);
    expect(next).toBe(remaining - otherTotal);
    otherTotal += next;
    expect(otherTotal).toBeLessThanOrEqual(remaining);
  });

  it("returns integers only", () => {
    expect(Number.isInteger(clampAllocation(100.7, 1000, 0))).toBe(true);
  });
});
