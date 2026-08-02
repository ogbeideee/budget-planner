import type { ID } from "./types";

export type Allocations = Record<ID, number>;

export function totalAllocated(allocations: Allocations): number {
  return Object.values(allocations).reduce((sum, value) => sum + value, 0);
}

export function clampAllocation(
  next: number,
  remaining: number,
  otherTotal: number,
): number {
  const max = Math.max(0, remaining - otherTotal);
  return Math.min(Math.max(0, Math.floor(next)), max);
}
