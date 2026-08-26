"use client";

import { useCallback, useState } from "react";

/**
 * A value that tracks live derived data until the user overrides it.
 *
 * ## Why this exists
 *
 * Twice now a component has frozen a derived default with a lazy initializer:
 *
 *     const [openKey, setOpenKey] = useState(() => mostUrgent(items));   // Reports
 *     const [extra, setExtra] = useState(() => minorToInput(remaining)); // Debt payoff
 *
 * A `useState` initializer runs ONCE, on first render, and never again. That is
 * correct for a form draft seeded from a prop (a modal mounted per edit
 * session), but wrong whenever the default is derived from data that keeps
 * changing underneath it — the selected month, a new transaction, an edited
 * budget, income arriving. The component then shows a default computed from
 * data that is no longer current, with no way back.
 *
 * NOTE ON THE ORIGINAL DIAGNOSIS: both bugs were first attributed to the
 * persisted store not having hydrated at first render. That is NOT what
 * happens here — `lib/storageAdapter.ts` is synchronous in both the browser
 * and Electron, so zustand's persist middleware finishes hydrating inside
 * `create()` at module load, before React renders anything. A test in
 * `hooks/__tests__/useOverridableValue.test.tsx` pins that down. The real
 * failure is the one above: a default derived once from data that later moves.
 *
 * ## Use it instead of a lazy initializer whenever the default is DERIVED
 *
 *     const [extra, setExtra] = useOverridableValue(suggestedExtra);
 *
 * `extra` follows `suggestedExtra` until `setExtra` is called; after that the
 * user's value wins and stays, including a falsy one. `reset()` hands control
 * back to the derived value.
 *
 * Do NOT use it for a form draft seeded from a prop — those are meant to
 * freeze, and a keyed remount (`key={...}`) is how this codebase restarts them.
 */
export function useOverridableValue<T>(
  derived: T,
): [T, (next: T) => void, () => void] {
  // Boxed rather than stored bare, so overriding WITH a falsy value ("" for a
  // cleared input, null for "nothing expanded", 0 for a zeroed amount) is
  // distinguishable from "never overridden". Storing `T | null` directly would
  // silently snap those back to the derived value — which is exactly the bug
  // this hook exists to prevent.
  const [override, setOverride] = useState<{ value: T } | null>(null);

  const set = useCallback((next: T) => setOverride({ value: next }), []);
  const reset = useCallback(() => setOverride(null), []);

  return [override ? override.value : derived, set, reset];
}
