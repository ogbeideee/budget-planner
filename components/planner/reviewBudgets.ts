// The single "Review budgets" destination for the Planner. Both entry points —
// the hero's "Review Budget" button and the status band's "Review budgets"
// button — go here, so they can never drift apart.
//
// Verified 2026-08-21: both CTAs resolve to the same destination (this href
// plus this scroll target); no divergence, nothing to reconcile. Keep it that
// way — route a new "review budgets" affordance through these two exports
// rather than re-deriving the destination at the call site.
//
// `href` keeps router semantics (middle-click / open in a new tab) while the
// scroll handler is what actually works in the static-export Electron build,
// where App Router client navigation is a no-op. Both converge on the same
// Budget Allocation section.
export const REVIEW_BUDGETS_HREF = "/?focus=over";

export function scrollToBudgetAllocation(): void {
  document
    .getElementById("budget-allocation")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
