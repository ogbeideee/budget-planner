# Budget Planner — Delivery Roadmap

Project: client-side personal budget planner.
Stack: Next.js 16.2.12 (App Router) · React 19.2.4 · TypeScript 5 · Tailwind CSS 4 · ESLint 9.
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
