# Budget Planner — Delivery Roadmap

Project: client-side personal budget planner.
Stack: Next.js 16.2.12 (App Router) · React 19.2.4 · TypeScript 5 · Tailwind CSS 4 · ESLint 9 · Zustand 5 (`persist`) · Recharts 3 (route-split, `/reports` only) · Vitest 4 + Testing Library.
Persistence: browser `localStorage` (no backend). See `ARCHITECTURE.md`.

Every phase produces one Markdown document in `docs/`. Documents are written so a software
engineer can implement them without further clarification.

## Phase Index

| Phase | Name | Deliverable document | Exit criteria |
|-------|------|---------------------|---------------|
| 1 | Requirements & Data Specification | `PROJECT_SPEC.md` | Requirements, data model, and acceptance criteria approved; no open questions about scope |
| 2 | System Architecture | `ARCHITECTURE.md` | Folder structure, state model, and data flow specified; engineer can scaffold all files |
| 3 | UI/UX Design Specification | `UI_UX_SPEC.md` | Design tokens, page specs, component inventory, and a11y requirements specified |
| 4 | Implementation & Testing | `PHASE-04-IMPLEMENTATION.md` | Build order, verification commands, and test matrix defined; `npm run lint` and `npx tsc --noEmit` pass |

## Delivery rules

1. Each phase ends with a review of its document before the next phase begins.
2. Changes to scope after a phase is approved must be recorded in `ROADMAP.md` under
   "Change log" and the affected phase document updated.
3. A phase is complete only when its exit criteria are met (see table above).

## Current state (2026-08-05)

### Status

- All four phases are delivered. The app is feature-complete per `PROJECT_SPEC.md`
  (incl. FR-18 income planning) and is in stabilization: QA passes only, no feature work.
- Verification gates — all green at the latest commit:
  `npx tsc --noEmit` · `npm run lint` · `npm run test` (324 tests / 34 files) ·
  `npm run build` (all 6 routes statically prerendered).
- State schema **version 3**: `validateAppState` (`lib/validate.ts`) accepts 1–3 and
  migrates; `CURRENT_STORAGE_VERSION = 3` (`lib/storage.ts`).

### Architecture & folder structure

Client-only Next.js App Router app; all logic is `"use client"`; no backend, no API routes,
no server state. Single zustand store (`store/useAppStore.ts`) with `persist` middleware;
derived math lives in pure selectors (`lib/selectors.ts`, `lib/finance.ts`).

```
app/
  layout.tsx                # fonts, <html lang="en">, <AppShell>
  page.tsx                  # /  Planner (primary workspace)
  todo/page.tsx             # /todo    actionable recommendations
  history/page.tsx          # /history chronological ledger (timeline)
  reports/page.tsx          # /reports analytical charts + CSV export
  settings/page.tsx         # /settings categories, currency, theme, recurring rules, backups, import/export
  upcoming/page.tsx         # /upcoming future expenses + funding urgency
  error.tsx                 # fatal error boundary -> RecoveryPanel
  globals.css               # Tailwind entry + @theme design tokens
components/
  shell/    AppShell, Sidebar, BottomNav, Header, PageHeader, nav
  ui/       Button, Card, Input, Select, Modal, Drawer, ConfirmDialog, Disclosure,
            EmptyState, Toast(+Host), MonthPicker, Slider, ProgressBar, SectionHeading,
            PageSkeleton, AnimatedNumber, IconPicker, IconValue, icons
  planner/  PlannerView, SummaryCards, MonthlyStats, Hero, OverBudgetAlert,
            NeedsFundingSection, BudgetList, BudgetForm, BudgetRow, PriorityBadge,
            AllocationPanel, BudgetHealthCard, QuickAddExpense, DeferredSection,
            InsightsPanel, ExpenseBreakdown, TodayRecommendations, BudgetSuggestions, IncomeModal
  history/  HistoryView, TransactionList
  txn/      TransactionForm, TransactionRow, TransactionFilters, RecurrenceForm
  upcoming/ UpcomingView, FutureExpenseForm
  reports/  ReportsView, ChartCard, chartStyles, IncomeExpenseChart, SpendingTrendChart,
            SavingsChart, BudgetUtilizationChart, TopCategoriesChart, ExpectedVsActualChart,
            IncomeSourceChart, IncomeTrendChart, ReportsInsights
  todo/     TodoView          insights/ InsightList
  settings/ SettingsView, CategoryManager, CategoryEditModal, BackupsManager, iconLibrary
  theme/    ThemeToggle       recovery/ RecoveryPanel
  charts/   BarChart           # custom animated CSS chart (Planner)
lib/                          # pure, test-covered (17 test files)
  types.ts date.ts money.ts finance.ts selectors.ts allocation.ts
  insights.ts todo.ts predictions.ts recommendations.ts reportTrends.ts monthStats.ts
  budgetHealth.ts accents.ts timeline.ts upcoming.ts recurrence.ts categorize.ts
  seed.ts validate.ts storage.ts theme.ts scrollLock.ts ids.ts
store/
  useAppStore.ts              # state + actions, persist middleware
  useToastStore.ts            # transient toast queue (not persisted)
hooks/
  useMonth, useToast, useTheme, usePlannerStatus, useRecurring,
  useAnimatedNumber, useChartColors, useReducedMotion
public/                       # favicon.ico only
tests: components/*.test.tsx · lib/__tests__/ · store/__tests__/
```

### Feature inventory

| Area | Current state |
|------|---------------|
| Income system | Standalone month-scoped `IncomePlan` `{id, month, name, icon, expectedAmount, receivedAmount}`; `IncomeModal` edits per source with live Difference status; icons via `IconPicker` (favourites/recents + vector set); `lib/finance.ts` `monthFinance()` is the single source of truth — Received = `max(ledger income, Σ plan.received)`, Net, Remaining, Projected, savings rate. Reports income charts (sources, expected vs actual, trend) use plan data |
| Budget planner | `/` workspace: summary cards, month stats, needs-funding (obligation-driven `fundingGaps` list with Fund button + focus/scroll), allocated budget list (priority, over-budget pills), allocation sliders (sub-unit step fix), budget health score, quick add expense, deferred expenses, insights, expense breakdown, recommendations, monthly income |
| To-Do | `/todo` aggregates actionable items (`lib/todo.ts`, same predicates as insights), capped at 5 |
| Timeline | `/history` chronological ledger: grouped buckets (Today/Yesterday/Last week/Earlier/Upcoming), search, type/category filters, URL-persisted sort (`&sort=`), pagination 25/page, deferred chip, move-to-next-month |
| Upcoming & recurring | `/upcoming` groups by Overdue/Today/Tomorrow/This week/Next week/Later; recurring rules generate month instances (`useRecurring`), exceptions tracked; funding urgency (critical/soon/low); future-expense forms with category suggestions |
| Reports | 6-month window ending at the selected month; 9 Recharts charts + insights card; exact tooltips, compact ticks, reduced-motion, empty states, responsive (`ResponsiveContainer width="100%"`); CSV export (decimal amounts + Currency column) |
| Settings | Theme (light/dark/system, OS-scheme listener), currency (USD/NGN formatting-only), category manager (add/edit/delete with validation, emoji-only icons, delete-reason toasts), recurring rules, backups manager, JSON import/export |
| Error handling | Fatal error boundary detects `CorruptedStateError` and renders `RecoveryPanel` (scan browser, restore from backup, import file, or start fresh); everything else gets a generic retry page |

### Persistence layer

- `localStorage` keys: `budget-planner:state` (main state, envelope `{state, version}`),
  `budget-planner:categorization` (learned mapping), `budget-planner:backup:*` (snapshots),
  `disclosure:*` / `settings:cats:*` (UI prefs), `settings:favourite-icons` / `settings:recent-icons`.
- Writes go through the zustand `persist` middleware; `lib/storage.ts` exposes
  `saveAppState`/`setWritesEnabled` for tests and guards every write against
  quota/security exceptions.
- **Migrations** (`lib/validate.ts`): v1 backfills income categories and converts tagged
  `monthlyIncome` transactions into category-bound plans; v2 rewrites those into standalone
  `IncomePlan` entries; legacy field normalization always runs; version > 3 rejected.
  Legacy and corrupt payloads are auto-snapshotted (`auto-vN`, `auto-corrupt`) before any
  parse/migration, so nothing is ever destroyed.
- **Import/export**: JSON export (`serializeExport`/`parseExportPayload`, validated on
  import), CSV export on `/reports`, restore from any valid state payload.
- **Backup/restore**: manual snapshots, automatic legacy/corrupt snapshots, `BackupsManager`
  (list/restore/delete with metadata), `scanRecoverablePayloads` for the recovery screen.

### Known issues & technical debt

1. `writesEnabled` is a hidden module-level flag in `lib/storage.ts` — disabled when
   hydration fails, re-enabled only by import/restore/reset. Intended behavior, but it is
   process-global and can surprise a second store instance in the same session.
2. `lib/scrollLock.ts` keeps a module `lockCount` with no failsafe — if modal cleanup is
   skipped by an error-boundary path, body scroll stays locked for the session.
3. Toast auto-dismiss timers in `useToastStore` are untracked — dismissing a toast early
   leaves a harmless no-op timer (the duplicate component-side timer was removed in the
   production audit).
4. No CI pipeline and no E2E tests — verification is local gates + 324 unit/integration tests.
5. `vitest.config.ts` uses ESM syntax in a CJS-loaded file (Vite 7 will require `.mjs`
   or `"type": "module"`).
6. A few migration tests cast `as unknown as AppState` when constructing legacy payloads.
   (Note: `docs/ARCHITECTURE.md` was refreshed on 2026-08-05 to match the current codebase —
   the earlier stale-component/ID/signature inaccuracies are resolved.)

### Production readiness

Health score **92/100** (audit of 2026-08-05): all gates green, zero TODO/FIXME/debugger,
324 tests, defensive persistence (validation + migration + auto-backups + recovery UI),
clean memory hygiene, a11y foundations (focus traps, aria-live toasts, reduced motion,
skip link), and consistent tokens. Ready for desktop packaging; the only decision still
open is the packaging shape (see next section).

### Planned: Electron migration (next)

Not started — no packaging files exist yet. Recommended approach from the production audit:

1. Add `output: "export"` to `next.config.ts` (all 6 routes already prerender as static
   content) and ship the exported folder — or run `next start` behind the Electron window.
2. `createId()` (`lib/ids.ts`) already provides the non-secure-context fallback, so
   `file://`/custom-protocol shells cannot crash entity creation.
3. `localStorage` works under Electron/WebView2; pin a stable origin (e.g. `app://` or
   `file://`) so data and auto-backups persist under the OS user profile.
4. Geist fonts are fetched once at build time — the build machine needs network; runtime
   is fully offline. Set `NEXT_TELEMETRY_DISABLED=1` in packaging builds.
5. Smoke test the packaged app (boot → create transaction/budget/income plan → reload →
   verify persistence and migration backup) before release.

### Future roadmap (candidates, not committed)

- CI pipeline (lint/typecheck/test/build on push) + Playwright E2E smoke — recommended
  before or with the Electron release.
- Multi-device sync / backend — the largest scope change; explicitly out of the current
  client-side design.
- Move to IndexedDB behind the storage interface if datasets approach ~50k records
  (current localStorage quota ≈ tens of thousands of transactions, far beyond personal use).

## Change log

| Date | Change | Affected documents |
|------|--------|--------------------|
| 2026-08-01 | Initial roadmap created | All |
| 2026-08-01 | Phase 4 foundation implemented (steps 1–6: lib, store, hooks, shell, ui components, tokens, error boundary); pages deferred to later steps. All ACs covered by automated tests to date pass (61 tests) | `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Application shell completed: 5 routes with shared page layout and placeholders, responsive sidebar/bottom nav, motion system (modal 120 ms, reduced-motion), title template, page metadata | `UI_UX_SPEC.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Scope addition approved by product owner (option 2): expense prioritization (FR-10), allocation sliders (FR-11), move-to-next-month (FR-12), insights & recommendations (FR-13), budget health (FR-14), animated charts (FR-15), NGN/USD formatting-only currency (FR-16) + AC-16..AC-22. Additive v1 migration (currencySymbol → currency; missing priority defaults). Docs updated to be the new source of truth; implementation follows | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Phase 4 scope implementation completed: lib (allocation, insights, budgetHealth, recordException, nextMonthDate, currency money helpers), store (updateBudget, moveTransactionToNextMonth, updateCategory, ToastStore), all feature components (dashboard, budgets incl. allocation panel + priority, transactions incl. list/filters/move/recurring forms, settings incl. currency/categories/data management), and all 5 pages live. Gates green: `npx tsc --noEmit`, `npm run lint`, `npm run test` (95 tests), `npm run build` | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Planner-first UX restructure approved: the Planner (`/`) becomes the primary screen (merged dashboard + budgets: summary cards, month selector, budget allocation + priority, allocation sliders, budget health, insights, charts, remaining balance, Quick Add Expense, deferred expenses); new To-Do page (`/todo`, FR-17) aggregates actionable recommendations; Transactions renamed to History (`/history`) as a chronological ledger; nav is Planner, To-Do, History, Reports, Settings. `Transaction.deferred` flag added (set by move-to-next-month, FR-12). Additive v1; no data migration. Docs updated first; implementation follows | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | History module completed: chronological ledger (add/edit/delete via reused `TransactionForm`, income/expense, categories, date, notes, search, type/category filters, month picker), user-selectable sorting (date/amount × asc/desc via `sortTransactions`, URL-persisted `&sort=`), pagination 25/page, deferred chip, toasts; everything persists to localStorage and derived values recalc immediately. All gates green (106+ tests) | `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Planner completed as the primary workspace (before Reports, per product owner): new **Needs Funding** checklist (unfunded expense categories, "Fund" opens the budget form with category preselected, AC-25 via `needsFunding` selector) and the **Allocated** section (budget table retitled, funding bar `Σ limits` vs `max(0, net)`); PlannerView restructured to the workspace flow (summary → needs funding → allocated → sliders → quick add → insights). All other Planner features verified present: monthly income card, month selector, remaining balance, budget allocation, expense priority, allocation sliders, budget health, deferred expenses, move-to-next-month, insights, recommendations, animated charts, category % breakdown, Quick Add Expense, NGN/USD formatting. Docs updated first; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | **Dependency decision (product owner):** Recharts approved for Reports charts, overriding FR-07's earlier "pure CSS, no chart library" stance. Single chart dependency; route-split so only `/reports` loads it. Planner keeps the custom animated `BarChart`. | `PROJECT_SPEC.md` (FR-07), `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-01 | Reports module completed (analytical-only): 6-month window ending at the selected month — snapshot (savings, remaining balance), income vs expenses (grouped bars), monthly spending trend, savings & remaining lines, budget utilization per month, top 5 categories across the window; Recharts with exact-value tooltips, compact axis ticks, reduced-motion support, empty states, responsive layout. New pure selectors `monthlySeries`, `budgetUtilizationSeries`, `spendingByCategoryInMonths`, `windowMonths`. Docs updated first; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md`, `PHASE-04-IMPLEMENTATION.md` |
| 2026-08-04 | **Income planning rework (FR-18):** expected income is now a standalone month-scoped collection `{id, month, name, icon, expectedAmount, receivedAmount}` — editable name, icon, and both amounts per source. Fixed the overwrite bug (the modal's per-source drafts now seed from existing plans and write per entry id; store `setIncomePlan(month, id | null, patch)` merges a single source, with a regression test). Expected income modal redesigned (name input, icon picker, Expected/Received inputs, live Difference status: to collect / collected in full / exceeded by). Icon picker upgraded: favourites, "Line icons" vector set, `IconValue` renderer; reports income charts (sources, expected vs actual, trend) now use plan data. State schema v3; v1→v2→v3 migrations in `validateAppState`. 218 tests, tsc/lint/build green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Finance math centralized + Net/Remaining bugfix (FR-06/FR-18):** Net/Remaining/Projected were computed from ad-hoc `totals()` calls — Net used transaction income only, so a month funded via income plans (received stored in plans, not transactions) showed Net/Remaining 0 and Net −Expenses. New `lib/finance.ts` `monthFinance()` is the single source of truth: Received = `max(income transactions, Σ plan.receivedAmount)`, Net = Received − Expenses, Remaining = `max(0, Net)`, Projected remaining = Expected − Expenses, savings rate from Received. All consumers migrated (SummaryCards, AllocationPanel, BudgetList, BudgetHealthCard, Hero, MonthlyStats, KpiStrip, ReportsView, IncomeExpenseChart, SavingsChart, InsightList, ReportsInsights, TodayRecommendations, TodoView, BudgetSuggestions, usePlannerStatus, selectors `receivedForMonth`/`budgetHealth`, insights/todo/recommendations/predictions/reportTrends). Focus-loss bugfix: `Modal`/`Drawer` effect re-ran on every keystroke because inline `onClose` was in its deps, stealing focus — now `onCloseRef` + `[open]` deps (regression test `Modal.test.tsx` proves the old code fails, new passes); `autoFocus` workaround removed from icon picker search. Tests 218→229; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Budget dialog form-state fix (FR-06):** "Choose a category." persisted after picking a category because `error` was only cleared at the next submit (validate-on-change was missing). Also fixed: the edit branch dropped a changed category (`updateBudget` only patched limit/priority — now accepts a validated `categoryId` with a same-month duplicate guard), and the footer submit button used a duplicated `id="budget-form"` across the three mounted `BudgetForm` instances (now a `useId`-unique form id per instance so submit can never target another dialog's form). Regression tests: 6 `BudgetForm.test.tsx` cases (error clears on selection, submission persists the id, amount error clears when valid, edit pre-selects, edit persists a category change, unique form ids) + 2 store tests. Tests 229→237 | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Nested-dialog focus isolation (Modal/Drawer) + remount audit:** the outer modal's focus trap reacted to keys pressed inside a nested dialog (IconPicker inside IncomeModal) — Escape closed both dialogs and Tab wrapping crossed dialog boundaries. Both traps now stand down when the active element is inside a nested `[role="dialog"]` (regression tests in `Modal.test.tsx` fail against the old code). Instrumented the modal chain (render/MOUNT logs + `useId`) and proved via DOM-node-identity tests (`BudgetForm.remount.test.tsx`, `IncomeModal.remount.test.tsx`) that no modal contents remount on keystrokes: BudgetForm/IncomeModal/IconPicker form, inputs, selects and scroll containers keep the same DOM nodes while typing; all temporary logs removed. Tests 237→245; gates green | `PROJECT_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Category edit modal state isolation (FR-08 settings):** replaced the shared-state edit modal in `CategoryManager` (which reused the inline add-form `newExpenseName/Icon/Color` + `newIncome*` state, rewriting parent state on every keystroke) with a standalone `CategoryEditModal` that mounts per edit session, seeds a local `Category` draft exactly once at mount (`useState(category)` — no effects, no sync), and reads/writes name/icon/color ONLY through that draft. The store is untouched until Save, which calls `updateCategory(draft)` exactly once, then closes. The IconPicker's search/query, memoized `sections`/`flat`/`offsets` and stable grid keys were audited (search input, options tree and scroll container keep DOM identity while typing) and locked in with 8 `CategoryEditModal.test.tsx` cases incl. save-once (spy), no store writes while typing, focus/node stability, and no uncontrolled/controlled warnings. Tests 245→253; gates green | `PROJECT_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Needs Funding redefined as an obligation-driven task list + planner polish:** `needsFunding` (no-budget categories) is retired from the panel in favor of `fundingGaps` (`lib/selectors.ts`): a category appears ONLY when it has unpaid upcoming expenses in the selected month whose total (Target/"Needed") exceeds its budget limit (Allocated); Missing = max(Target − Allocated, 0); rows sorted by largest Missing, showing icon, name, urgency, Allocated/Needed/Missing (Missing red when > 0), a thin colored progress bar (Allocated/Target, tone by ratio) and a Fund button. Fund: no budget → "New budget" modal preselected with the limit prefilled to the Missing amount (new `presetLimit` prop), then auto-scrolls via a `planner:focus-budget` window event; budget exists → BudgetList expands the Allocated disclosure, highlights the row (`focusedBudgetId` ring) and focuses the matching `allocation-slider-{id}` range input (id added in AllocationPanel). Empty state copy now "covers every upcoming expense this month"; `attentionOnly` preview shows the top 3 gaps. BudgetHealthCard "Every category funded" now counts `fundingGaps` (same semantics). **Budget Health hierarchy:** score enlarged to 5xl as the focus, checklist rows lightened (no pill backgrounds, smaller icons, plain status text, `gap-0.5`), progress bar thinned to `h-1` via new `ProgressBar className` prop, overall card height ~15% shorter. **Spacing polish:** PlannerView section rhythm `gap-10`→`gap-7` (−30%), BudgetList `gap-6`→`gap-5`; no card padding touched. Tests 253→267 (11 reworked panel cases, 6 `fundingGaps` selector cases, 2 BudgetList focus-budget cases); gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Month at a glance metric emphasis (MonthlyStats):** same metrics, stronger hierarchy — labels reduced (11px, medium weight, no uppercase) and numbers enlarged `text-lg`→`text-2xl`. Tiny contextual indicators added: Largest expense carries the category's colored icon badge (`monthStats.largestExpense` now exposes `categoryId`), Savings rate gets a green `ArrowUpRightIcon` when positive (red `TrendDownIcon` when negative), Projected remaining a muted `WalletIcon`. 4 new `MonthlyStats.test.tsx` cases (badge, positive/negative arrows, wallet icon). Tests 267→271; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md`, `ARCHITECTURE.md` |
| 2026-08-04 | **Expense breakdown v2:** percentage now sits in a cleaner right-aligned amount/% column beside each bar; longest bar capped at 80% of the track (proportions preserved); hover tooltips add Category/Amount/Percentage/Budget limit/Spent (unbudgeted rows say "Not budgeted", over-budget Spent turns red); more than five categories collapse to five behind a **Show N more categories** button (replacing the plain "N more categories when expanded" text) with an animated `list-in` entrance, wired to expand the Planner's collapsed preview. `BarChart` gains `budget`/`spent`/`overBudget` fields, a capped width and an `animateFrom` prop. 9 new `ExpenseBreakdown.test.tsx` cases. Tests 271→280; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md` |
| 2026-08-04 | **Timeline polish (no structural redesign):** row hover bumped to full `hover:bg-canvas`; date groups separated by an 8px spacer row; the **Today** group gets a subtle brand accent (tinted header band + colored label + small brand dot); running group totals made prominent (`text-sm font-bold text-ink`, brand-colored for Today); row action icon buttons reduced to `sm` size; income rows render an invisible fixed-width placeholder in the Move slot so the Edit/Delete icons align perfectly across income and expense rows. 3 `TransactionRow.test.tsx` cases + 2 `TransactionList.test.tsx` cases. Tests 280→285; gates green | `UI_UX_SPEC.md` |
| 2026-08-04 | **Reports anti-busy pass:** all `ChartCard`s switch to the quiet treatment (canvas wash + hairline border + no shadow) so charts stop competing; the global `--shadow-card` token is softened (light + dark); sections get `flex flex-col gap-6` inside and the page `gap-6`→`gap-8`, grid gaps `gap-4`→`gap-6`/`gap-5` (snapshot); `SectionHeading` enlarged `text-xs`→`text-sm`; every chart gained a concise subtitle — **Last 6 months** (Income vs expenses, Income trend, Monthly spending trend, Savings, Budget utilization, Top categories) / **This month** (Expected vs actual, Income sources) / **By category** ("Spending this month"); ReportsInsights quieted to match. **Category-color consistency:** new `lib/accents.ts` `categoryColor()` + `CATEGORY_COLOR_FALLBACK` shared by Planner ExpenseBreakdown and Reports Top Categories, locking every category-colored chart to the Planner palette. 13 new tests (`ReportsVisual.test.tsx` chart-subtitle matrix + quiet chrome, `SectionHeading` size, `categoryColor`). Tests 285→297; gates green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md` |
| 2026-08-05 | **Responsive QA pass (7 fixes, 320px–4K):** (1) Month picker overflowed the page at 320px — the label forced `min-w-32` and "This month" appeared alongside (~297px total vs 272px content); label now `min-w-0 truncate` and the shortcut is `hidden sm:flex`. (2) Reports header MonthPicker+Export cluster was a non-wrapping flex row (~320px) — now `flex-wrap`. (3) The last upcoming expense's row menu was fully clipped — the list container's `overflow-hidden` (for rounding) cut off the `absolute top-full` menu; container no longer clips, first group header takes `rounded-t-2xl`. (4) Category edit/delete buttons were invisible on touch — `opacity-0 group-hover` at all breakpoints; now `sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100` (matches recurring rows). (5) Income source rows unusable at 320px — fixed 144px icon picker + icon + trash left the name input ~0px (modal content 240px); row now `flex-wrap` with name `min-w-36` and picker `w-full sm:w-36`. (6) Needs-funding Allocated/Needed/Missing trio stayed 3 columns at 320px (~74px cells colliding) — now `grid-cols-1 sm:grid-cols-3`. (7) Over-budget pills spilled past the card — `truncate` never engaged (flex `min-width:auto`); pills `max-w-full` + name `min-w-0 truncate`. All charts already use `ResponsiveContainer width="100%"`; shell (sidebar/bottom nav/header) verified at 320/375/768/1024/1366/4K; perf paths verified (memoized selectors + 25/page pagination). Tests stay 325; tsc/lint/build green | `UI_UX_SPEC.md` |
| 2026-08-05 | **Production readiness audit + hardening (behavior-preserving):** reconciled `CURRENT_STORAGE_VERSION` 2→3 in `lib/storage.ts` (legacy v2 payloads now snapshot before migration); new `lib/ids.ts` `createId()` (secure-context fallback) replaces 8 raw `crypto.randomUUID()` sites and the duplicate in `validate.ts` — the only crash risk for entity creation in a packaged desktop shell; single `daysBetween` (lib/date.ts) replaces 3 duplicated `DAY_MS` midnight-diff helpers; toast auto-dismiss owned solely by `useToastStore` (duplicate timer removed from `Toast.tsx`); storage writes (persist `setItem`, `saveAppState`, backup snapshots) guarded against quota/security exceptions so boot can't be masked; dead exports removed (`loadAppState`, `removeAppState`, `readStoredTheme`, `currencySymbol`), dead components removed (`KpiStrip`, `Badge`, `Spinner`), 5 unused starter SVGs deleted; `MINOR_UNITS_PER_UNIT` + shared `MAX_*` length constants replace magic numbers; shared `isDeeplyOverBudget`; shared `CATEGORIZATION_KEY`; `toMinorUnits` dead `_currency` param dropped (31 call sites); `RecoveryPanel` defers `URL.revokeObjectURL`; `parseMonth` hoisted out of a render path in ReportsView. Tests 325→324 (dead-symbol spec removed, corrupt-snapshot spec documents v2+corrupt double snapshot); tsc/lint/build green | `ARCHITECTURE.md` |
| 2026-08-05 | **Settings QA pass (4 fixes + validation hardening):** (1) Importing a non-JSON file crashed the app — `confirmImport` ran unguarded `JSON.parse`; parsing moved inside `importState`'s try/catch (it now accepts a JSON string or parsed object) so bad files get a clean error. (2) Deleting a category used by transactions showed a false "Category deleted." success — `CategoryManager` didn't handle the store's `in-use-transactions` reason; now an error toast (matching the budgets/upcoming/rules branches). (3) Clearing the icon picker then saving a category stored an empty icon that `validateAppState` rejects — the next load threw "Saved data is corrupted" (data loss). Category add/edit now require an icon, and the store rejects empty icons/names/bad colors. (4) Category actions hardened: `addCategory`/`renameCategory`/`updateCategory` validate trimmed non-empty name ≤ `MAX_CATEGORY_NAME` (30), non-empty icon, hex color, and reject case-insensitive duplicates; all return booleans; add/edit inputs cap at 30 chars with precise errors. `validateAppState` stays lenient on name length so legacy long names never brick the store. Also: category row edit/delete buttons got accessible names ("Edit X"/"Delete X"). 15 new tests (4 CategoryManager, 2 CategoryEditModal, 9 store). Tests 310→325; tsc/lint/build green | `PROJECT_SPEC.md` |
| 2026-08-05 | **Timeline QA pass (sticky-layout fixes):** the pinned filter bar + pinned table header never aligned — the header's fixed offset (`lg:top-[4.75rem]` = 76px) couldn't match the bar's real height (69px single row; ~125px when filters wrapped on narrower desktops), leaving a 7px gap of scrolling content between them or tucking the header under the bar; on mobile the header pinned at `top-0` behind the opaque app header and the ~180px wrapped bar. The filter row is no longer sticky (no other page pins a toolbar) and the header now uses the planner's proven `sticky top-16 lg:top-0` pattern — flush below the app header on mobile, flush with the viewport on desktop. Also: long unbroken notes could widen the table past the card on desktop (wrapper only scrolls on mobile) — the note cell now wraps mid-word (`break-words`). 2 new `TransactionList.test.tsx` cases (bar in flow + header pin pattern; note wrapping). Tests 308→310; tsc/lint/build green | `UI_UX_SPEC.md` |
| 2026-08-05 | **Reports QA pass (5 calculation/display fixes):** (1) Income trend "Received" was plans-only (`incomeTrendSeries` summed `plan.receivedAmount`), so ledger-funded months plotted $0 while every other income number used `receivedForMonth` — the series now takes transactions and uses the shared `max(ledger, plans)` source. (2) Budget utilization >100% overflowed the `[0,100]` Y axis; bar geometry clamps at 100% (`barPct`) while tooltip/aria keep the true %; the pct calculation moved into `budgetUtilizationSeries` (centralized). (3) ReportsView "Expenses vs last month" caption used the net delta (`monthStats.vsLastMonth.delta` = net − lastNet), misattributing income swings to expenses — now the true expense delta via `totals`. (4) CSV export wrote raw minor-unit integers; Amount now exports currency decimals with a new Currency column. (5) Expected vs actual / Income sources empty states promised "record income" would populate them (sources come from income plans) — copy fixed. 7 new tests (incomeTrendSeries ×3, utilization over-100%, chart aria/empty-state ×2). Tests 303→308; tsc/lint/build green | `PROJECT_SPEC.md`, `UI_UX_SPEC.md` |
| 2026-08-05 | **Planner QA pass (bugfix):** allocation sliders were stuck at 0 when the remaining balance was below one whole unit — the range input used `step={100}` while `max` was smaller, so no value above 0 existed. `AllocationPanel` now adapts the step to the balance (`min(100, remaining)`): a $0.50 balance is allocatable in 50¢ increments, normal balances keep the $1 step. 6 new `AllocationPanel.test.tsx` cases (no budgets → panel hidden, zero-balance message, sub-unit step, whole-unit step, apply raises the budget limit, combined allocations clamp to the balance). Tests 297→303; tsc/lint/build green | `PROJECT_SPEC.md` |
| 2026-08-05 | **Final UI consistency polish (visual only, no redesign):** single surface radius — `Card`/`Disclosure` quiet+brand `rounded-2xl`→`rounded-xl`; single caption scale — all `text-[11px]`→`text-xs` (SummaryCards hint + Edit pill, MonthlyStats labels, AllocationPanel % pill, BackupsManager badge, BottomNav labels, ReportsView snapshot + prediction captions); single motion timing — Disclosure chevron/height `duration-[220ms]`→`duration-200`; Income trend chart empty state upgraded from a plain `<p>` to the shared `EmptyState` (all 6 report charts consistent); missing category colors now resolve via shared `categoryColor()` (replaces raw `#6b7280` fallbacks in AllocationPanel + SettingsView recurring rows); Timeline income-row placeholder `w-11`→`w-10` so Edit/Delete align pixel-perfectly with expense rows; ThemeToggle icons sized by `h-4 w-4` classes instead of 16px SVG attrs; IncomeModal inputs `h-10`→`h-11` (app-wide control height); PageSkeleton blocks `rounded-lg`→`rounded-xl` (skeleton mirrors cards). `TransactionRow.test.tsx` width assertion updated; tests stay 297; tsc/lint/build green | `UI_UX_SPEC.md` |
