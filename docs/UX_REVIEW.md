# Professional UX Review — Budget Planner 0.1.0

Review date: 2026-08-07. Method: source-level inspection of all screens, shared UI primitives, shell, and design tokens; contrast math verified against the actual token values in `app/globals.css`.

---

## HIGH

### H1 — "Mark as paid" is offered on already-paid rows and silently duplicates the transaction
- **Severity:** High
- **Reason:** In `UpcomingView.tsx` the "Paid" group (line 398-402) renders the same `FutureExpenseRow` as the upcoming groups, and its menu always includes "Mark as paid" (line 110-115). `markPaid` (line 235-246) never checks `expense.status` — it calls `addTransaction` then `updateFutureExpense`. Clicking it on a paid row re-adds the expense to the timeline and double-counts it in budgets, with a success toast ("Paid — added to your timeline and budget.") reinforcing the mistake. This is a data-integrity bug reachable in two clicks.
- **Fix:** Hide "Mark as paid" when `expense.status === "paid"` (show "Reschedule"/"Edit"/"Delete" only), or guard `markPaid` to no-op with a distinct "Already paid" message.

### H2 — White-on-brand-500 fails WCAG contrast with the amber accent (≈2.15:1)
- **Severity:** High
- **Reason:** The amber palette remaps `--color-brand-500` to `#f59e0b` (`globals.css:108`, dark mode `:164`), luminance ≈0.44. `text-white` on it yields ≈2.15:1 — below the 3:1 non-text minimum. Used for the sidebar logo badge (`Sidebar.tsx:52`), the active theme button (`ThemeToggle.tsx:105`), its white check icon (`:78`), and the "Skip to content" link (`AppShell.tsx:30`, text — needs 4.5:1). Fails in both themes for the amber accent.
- **Fix:** Use a dark text/icon (`brand-900`) on amber-500 fills, or darken amber-500 (≈`#d97706`) so white reaches ≥3:1. Audit the other accents (teal ≈3.0:1 passes; blue/indigo pass).

---

## MEDIUM

### M1 — Due date — the core datum of "Upcoming" — is invisible below 768px
- **Severity:** Medium
- **Reason:** `UpcomingView.tsx:86` renders the due date `hidden md:block` and the priority badge `hidden sm:block` (line 83). At 400–700px a row shows only icon, title, category and amount — the user cannot see *when* anything is due without opening the reschedule dialog. The collapsed preview above does show dates, so the same data appears in one place and not the other.
- **Fix:** Wrap the date under the title (always visible) instead of hiding it.

### M2 — Root loading skeleton is dashboard-shaped on every route
- **Severity:** Medium
- **Reason:** `app/loading.tsx:3-4` is the root boundary and renders `PageSkeleton` (4 KPI cards + chart + 2 cards, `PageSkeleton.tsx:8-17`) during navigation to Settings, Reports, To-Do, Upcoming, History — none of which have a KPI grid. The placeholder contradicts the destination's shape. The skeleton is also `aria-hidden` with no "Loading…" announcement.
- **Fix:** Per-route `loading.tsx` with variants (list/table/settings), or accept a `variant` prop on PageSkeleton; add a visually-hidden loading label.

### M3 — "Move to next month" is one-click with no confirm or undo; delete next to it is confirmed
- **Severity:** Medium
- **Reason:** `TransactionList.tsx:117-121` moves without any confirm — only a toast — while delete right beside it requires `ConfirmDialog` (line 292-306). Moving permanently re-budgets the amount and removes it from the month's totals; the icon affordance (`TransactionCard.tsx:118-126`) gives no hint of consequence.
- **Fix:** Add an undo toast ("Moved to X — Undo") or a lightweight confirm when the transaction feeds the current month's budgets.

### M4 — Over-budget banner and quick-add form are dead code — never rendered
- **Severity:** Medium
- **Reason:** Repo-wide grep finds only definitions: `OverBudgetAlert.tsx:11` and `QuickAddExpense.tsx:16`. The over-budget warning never appears on the planner despite being designed, and the quick-add form duplicates the already-wired TransactionForm modal.
- **Fix:** Wire `OverBudgetAlert` into the planner (complements TodayRecommendations); either surface QuickAddExpense or delete it.

### M5 — Same concept, three labels: "Moved" / "Deferred" / "Transfers"
- **Severity:** Medium
- **Reason:** The `deferred` flag is labeled "Moved" in RecentActivity (`RecentActivity.tsx:97`), "Deferred" on the timeline card (`TransactionCard.tsx:72,176`), and its monthly sum is called "Transfers" (`HistoryView.tsx:141`). Inconsistent money vocabulary undermines trust — the user cannot tell if these are the same thing.
- **Fix:** Pick one term ("Deferred") across all three surfaces, including the summary chip.

### M6 — "Remaining" is presented three times in the first viewport of the planner
- **Severity:** Medium
- **Reason:** Hero projects month-end remaining (`Hero.tsx:51`), SummaryCards has a "Remaining" card (`SummaryCards.tsx:119`), and MonthlyStats repeats the same metric as its third column (`MonthlyStats.tsx:54`) — the two sections render back-to-back (`PlannerView.tsx:55-56`). The same number says the same thing three times before any unique data appears.
- **Fix:** Drop the duplicated column from "Month at a glance" (keep Income/Expenses + transaction count) or merge the sections.

### M7 — Category spend is charted twice on Reports
- **Severity:** Medium
- **Reason:** "Category analysis" (`ReportsView.tsx:283-285`) and "Spending this month" (`ReportsView.tsx:358-360` via ExpenseBreakdown) both render `spendingByCategory` for the same month as ranked lists; "Top categories" adds a third view of the same ranking. Redundant in a single scroll.
- **Fix:** Keep the pie/rank analysis; remove the duplicate "Spending this month" card (or vice versa).

### M8 — All-paid state renders an empty "Upcoming" group with a "$0.00" total
- **Severity:** Medium
- **Reason:** `isEmpty` (UpcomingView.tsx:321) only fires when neither upcoming nor paid items exist. With only paid items, the "Upcoming" Disclosure renders an empty bordered container whose group header reads "$0.00" with zero rows — looks broken rather than empty.
- **Fix:** Omit the "Upcoming" group (or its total) when `groups.length === 0` and show a short "Nothing upcoming" line.

### M9 — Active nav text with amber accent ≈3.0:1 — fails AA
- **Severity:** Medium
- **Reason:** `--color-sidebar-active: #ecfdf5` (globals.css:234) is a fixed teal-mint tint that ignores the accent; with amber, active text `brand-600` `#d97706` on it ≈3.0:1 — below 4.5:1 for the 14px semibold labels (`Sidebar.tsx:26`, `BottomNav.tsx:24`). Teal/blue/indigo accents pass.
- **Fix:** Derive the active tint per accent, or darken amber `brand-600` for text-on-tint use.

### M10 — `text-muted` on canvas is 4.48:1 — marginally below AA
- **Severity:** Medium
- **Reason:** `--color-muted: #64748b` on `--color-canvas: #f7f8fc` (globals.css:210,213) ≈4.48:1, used for real body copy: page descriptions (`PageHeader.tsx:17`, `Header.tsx:21`), sidebar section labels (`Sidebar.tsx:63`), version line (`:83`). On white `surface` it passes (4.76:1), so only canvas-sitting text is affected.
- **Fix:** Darken muted to ≈`#5c687d` (≥4.6:1 on canvas) or lighten canvas slightly.

---

## LOW

### L1 — To-Do empty state is plain text, not the app's EmptyState pattern
- **Severity:** Low — **Reason:** every other list uses the illustrated `EmptyState`; TodoView renders a 14px centered line (`TodoView.tsx:54-57`) that reads as unfinished UI. **Fix:** Use `<EmptyState title="All clear" …>`.

### L2 — Transaction note is displayed twice when a card is expanded
- **Severity:** Low — **Reason:** note appears line-clamped under the title (`TransactionCard.tsx:85-89`) and repeated verbatim in the expanded body (`:188-192`). **Fix:** remove the expanded duplicate.

### L3 — "View Full Timeline" appears twice in an empty Recent Activity card
- **Severity:** Low — **Reason:** same link in the card header action and the empty-state action, side by side (`RecentActivity.tsx:40-45` vs `:55-61`). **Fix:** keep only the empty-state action.

### L4 — Same-semantic secondary controls use three heights/radii
- **Severity:** Low — **Reason:** "View Full Timeline" link-button is `min-h-9`/36px (`RecentActivity.tsx:42,57`); the Button component is `min-h-10`/40px `rounded-md` (`Button.tsx:26`); History/Reports "Export"/"Compare month" are hand-rolled `h-10 … rounded-lg` (`HistoryView.tsx:115`, `ReportsView.tsx:171,186`) — even on the same header row. **Fix:** reuse the `Button` component everywhere.

### L5 — Error toasts vanish in 3 s with no stacking cap
- **Severity:** Low — **Reason:** `useToastStore.ts:19,26-28` uses `DISMISS_MS = 3000` for every tone including error, and ToastHost stacks without a max; errors can disappear mid-read and bursts overflow. **Fix:** persist errors (or double lifetime), cap visible toasts at 3, pause timer on hover/focus.

### L6 — Sidebar section labels are 10px
- **Severity:** Low — **Reason:** `--text-micro: 0.625rem` (globals.css:260) on nav group headers (`Sidebar.tsx:63`) is below comfortable legibility for navigation text. **Fix:** use the 12px caption token.

### L7 — KPI values are `whitespace-nowrap` with no overflow guard
- **Severity:** Low — **Reason:** MetricCard value (`MetricCard.tsx:45`) and MonthlyStats values (`MonthlyStats.tsx:81`) can bleed past card edges at 400–700px with long amounts. **Fix:** add `min-w-0`/`overflow-hidden` + ellipsis or allow wrapping.

### L8 — Page-level vertical rhythm is inconsistent (gap-6 vs gap-8)
- **Severity:** Low — **Reason:** Planner/Reports use `gap-6`, History/Upcoming/To-Do/Settings use `gap-8` for the same layout role. **Fix:** unify on one token.

### L9 — ThemeToggle uses two different ARIA models for one control
- **Severity:** Low — **Reason:** compact variant uses `role="group"` + `aria-pressed` (`ThemeToggle.tsx:32`); cards variant uses radiogroup/radio (`:89,101`). Same functionality announced differently. **Fix:** use radiogroup/radio + `aria-checked` consistently.

### L10 — Toast dismiss button lacks an explicit focus-visible ring
- **Severity:** Low — **Reason:** `Toast.tsx:30` styles hover only; every other interactive element has a ring. **Fix:** add `focus-visible:ring-2 … focus:outline-none`.

---

## Clean areas (verified, no findings)

- **Empty states:** every list/section has one (except To-Do style, L1, and the all-paid edge, M8); copy is concrete and action-oriented with tips.
- **Loading states:** all async chart sections have `ChartSkeleton` fallbacks (`ReportsView.tsx:34-67`); store reads are synchronous so no flicker elsewhere.
- **Navigation a11y:** `aria-current="page"` on both navs, visible focus-visible rings, working skip link targeting `#main`, keyboard-reachable tooltips on theme buttons.
- **Deletion safety:** ConfirmDialog used consistently for every destructive delete.
- **Theme toggle:** current state visible, labeled icon buttons.
- **Error handling:** friendly error page with retry (`error.tsx:27-32`) + corrupted-state RecoveryPanel.
- **Token discipline:** no raw hex or off-scale spacing in components; all colors route through theme tokens.
- **Responsive strategy:** coherent single `lg` breakpoint (sidebar/bottom-nav swap), `pb-24` clears the fixed nav, no horizontal overflow at 375px.

## Counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 10 |
| Low | 10 |

## Suggested fix order
1. H1 (data integrity — duplicates transactions). 2. H2 + M9 + M10 (contrast, affects all amber-accent users). 3. M1 (upcoming data loss on small windows). 4. M3 (move safety). 5. M4–M8 (dead code, duplication, terminology). 6. M2 + L1–L10 polish.
