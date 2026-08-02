# Budget Planner — Implementation & Testing Plan (Phase 4)

Status: Draft · Owner: Phase 4 · Deliverable of: `ROADMAP.md` Phase 4
Baseline: `PROJECT_SPEC.md` §6–7, `ARCHITECTURE.md`, `UI_UX_SPEC.md`.

## 1. Dependencies to add

```bash
npm install zustand
npm install recharts          # Reports charts only (product owner decision 2026-08-01)
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

`vitest.config.ts`: `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`
(`vitest.setup.ts` imports `@testing-library/jest-dom/vitest`).

## 2. Build order (each step ends green: `npx tsc --noEmit` + `npm run lint`)

| Step | Files | Verifies |
|------|-------|----------|
| 1 | `lib/types.ts` (Priority, Currency), `lib/date.ts`, `lib/money.ts` (NGN/USD), `lib/seed.ts` | Types compile; money formatting + parsing (AC-14, AC-20) |
| 2 | `lib/validate.ts` (currency/priority migration), `lib/storage.ts` | `validateAppState` rejects bad shapes (AC-10); migration (AC-16) |
| 3 | `lib/recurrence.ts` (+ `recordException`) + unit tests | AC-06, AC-07, AC-17 exception path |
| 4 | `lib/selectors.ts` (+ `spendingByCategory`, `budgetHealth`, `deferredExpenses`) + unit tests | AC-12, AC-19, AC-24 |
| 5 | `lib/allocation.ts`, `lib/insights.ts`, `lib/todo.ts` + unit tests | AC-18, AC-21, AC-23 |
| 6 | `store/useAppStore.ts` (+ `updateBudget`, `moveTransactionToNextMonth` marks `deferred`), `store/useToastStore.ts` + tests | AC-08, AC-17, AC-24 |
| 7 | `app/globals.css` tokens; `app/layout.tsx`, `app/error.tsx`; `components/shell/*`, `components/ui/*` (+ `Slider`, `ToastHost`), `hooks/useToast.ts` | Shell renders; skip link; error boundary |
| 8 | `components/txn/*` (+ move-to-next-month action) + `components/history/HistoryView.tsx` + `app/history/page.tsx` | AC-04, AC-05, AC-13, AC-17, AC-24 |
| 9 | `components/planner/*` (BudgetList, BudgetForm, BudgetRow, PriorityBadge, AllocationPanel, BudgetHealthCard, NeedsFundingSection) | AC-02, AC-03, AC-18, AC-25 |
| 10 | `components/planner/*` (PlannerView, SummaryCards, OverBudgetAlert, QuickAddExpense, DeferredSection, InsightsPanel, ExpenseBreakdown), `components/charts/BarChart.tsx` + `app/page.tsx` | Planner totals + alert + insights + health + quick add + deferred (AC-04, AC-19, AC-21, AC-22, AC-24) |
| 11 | `components/reports/*` (Recharts: income vs expenses, spending trend, savings & remaining, budget utilization, top categories) + `app/reports/page.tsx` | FR-07: 6-month window, analytical only, empty states, reduced-motion |
| 12 | `app/settings/page.tsx` + import/export + recurring UI + currency select | AC-01, AC-09, AC-11, AC-20 |
| 13 | `hooks/useMonth.ts`, `hooks/useRecurring.ts` wiring | AC-06 end-to-end |
| 14 | a11y pass (§5) + reduced-motion + responsive pass | AC-15, AC-22 |

## 3. Implementation constraints

- Before writing app code, consult `node_modules/next/dist/docs/01-app/` for current
  Next.js 16 conventions (async `params`/`searchParams`, client component usage).
- `lib/*` must not import React (enforced by lint rule or review).
- Money arithmetic only in integer minor units (`lib/money.ts`):
  - `toMinorUnits(string, currency?)` — strips either symbol, parses with up to 2 decimals.
  - `formatMoney(minor, currency)` — integer string manipulation (no floats, no `Intl`),
    thousands grouping, exactly 2 decimals (AC-14, AC-20).
- Persisted data only ever enters via `validateAppState`; export uses the same serializer.
- No new dependencies beyond §1 without updating `ARCHITECTURE.md`.

## 4. Automated tests (vitest)

Test files live next to code: `lib/__tests__/*.test.ts`, `store/__tests__/*.test.ts`.

| File | Cases (from AC) |
|------|------------------|
| `lib/date.test.ts` | monthKey padding, day clamping (Feb 31 → 28), weekday enumeration, `nextMonthDate` (Jan 31 → Feb 28) |
| `lib/money.test.ts` | parse `"12.5"` → 1250; `formatMoney(1250,"USD")` → `"$12.50"`; `formatMoney(125050,"NGN")` → `"₦1,250.50"`; rejects `"abc"`, `"1.234"`; both symbols accepted (AC-20) |
| `lib/recurrence.test.ts` | AC-06 weekly counts; monthly clamp; yearly; idempotence (AC-07 edit/delete exceptions); `recordException` appends/keeps idempotent |
| `lib/selectors.test.ts` | AC-12: 100 random transactions, `net === income − expenses` exactly; progress states; `budgetHealth` formula (AC-19); `spendingByCategory` ranking; `deferredExpenses` (AC-24); `needsFunding` (AC-25: no budget / limit 0 included, funded and income categories excluded); `sortTransactions` (date/amount × asc/desc, stable tiebreak); `monthlySeries` (per-month income/expenses/net, 6-month window, exact minor units); `budgetUtilizationSeries` (spent/limit per month, skips months without budgets); `spendingByCategoryInMonths` (windowed ranking, income excluded) |
| `lib/allocation.test.ts` | AC-18: clamp to `remaining − others`; sum ≤ remaining; integer results |
| `lib/insights.test.ts` | AC-21: rule order deterministic; cap 5; empty-month card; tones |
| `lib/todo.test.ts` | AC-23: items derive only from current state (over budget, net negative, unallocated, no-budget category, deferred); each item carries a resolving href; deterministic order; empty month |
| `lib/validate.test.ts` | AC-10: wrong version, missing arrays, wrong types → throw; AC-16: legacy `currencySymbol`/missing `priority` normalize |
| `store/useAppStore.test.ts` | AC-08: set state → new store instance (rehydrated) reads same data; AC-02 duplicate budget rejected; AC-17 `moveTransactionToNextMonth` (recurring detach + exception); AC-24 move sets `deferred: true` |
| `components/txn/TransactionForm.test.tsx` | AC-04/AC-05: add → totals change; edit → contributions change; delete → removed |
| `components/planner/NeedsFundingSection.test.tsx` | AC-25: checklist shows exactly the unfunded expense categories; income and funded categories absent; "Fund" opens the budget form with the category preselected; funding removes the category |

Run: `npm test` (must pass), `npx tsc --noEmit`, `npm run lint`.

## 5. Manual test checklist (release gate)

Run in a fresh browser profile on the built app (`npm run build && npm run start`):

1. First visit seeds 6 categories (AC-01). Reload → no re-seed. Landing page is the Planner.
2. Add budget $1000 Rent Aug 2026 on the Planner → budget table shows progress 0 %; health
   card shows 100/100 Healthy.
3. Quick-add expense Rent $500 on the Planner → summary totals update without reload (AC-04).
4. Add second Rent budget for same month → inline error (AC-02).
5. Add transactions until Rent $1050 → amber; $1300 → red + alert banner (AC-03).
6. Edit transaction $500 → $300 → totals update (AC-05); delete it → removed.
7. Recurring weekly rule anchored Monday 2026-08-03 → 5 instances in Aug 2026 (AC-06).
8. Edit one generated instance → survives reload and regeneration (AC-07).
9. Hard reload → all data intact (AC-08).
10. Export → file `budget-planner-export-YYYY-MM-DD.json`; reset data; import file → identical
    state (AC-09).
11. Import malformed JSON (edit version to 2) → inline error, data unchanged (AC-10).
12. Delete category in use → blocked with dialog; delete empty category → succeeds (AC-11).
13. 30 transactions in History → pagination shows 25 + next page, sorted desc by
    default; sort control reorders by date asc/desc and amount asc/desc, persists in
    the URL, and resets with "Clear filters" (AC-13).
14. Amounts never show > 2 decimals anywhere (AC-14).
15. Keyboard-only pass: Tab order, Esc closes modals, all buttons reachable + focus visible
    (AC-15). Run Lighthouse a11y audit → no violations.
16. `prefers-reduced-motion: reduce` → no transitions/animations.
17. Viewport 390 px: bottom nav usable, tables scroll horizontally without clipping.
18. Network disabled (DevTools offline) → app fully functional.
19. Console: zero errors/warnings during the full pass.
20. Set currency NGN → all amounts render `₦` with thousands grouping; switch to USD → `$`;
    `toMinorUnits` accepts pasted amounts with either symbol (AC-20).
21. Budgets for the month with net > 0: sliders sum ≤ remaining, "Apply allocations" raises
    limits (persisted after reload), "Reset" clears without changing limits (AC-18).
22. Move an expense to next month → gone from current month, present next month with
    "Deferred" indicator in History and listed in the destination month's Planner
    "Deferred expenses" section; toast shown; for a generated instance the recurring rule
    does not recreate it (AC-17, AC-24).
23. Over-budget high-priority category + positive unallocated net → ≥ 2 insight cards in
    FR-13 order; health gauge tier matches the FR-14 formula (AC-19, AC-21).
24. Chart/progress bars animate on load (≤ 150 ms); with `prefers-reduced-motion: reduce` no
    animation occurs; bar `aria-label`s contain exact values (AC-22).
25. To-Do page shows only items implied by current state (e.g. over budget → link to
    Planner; deferred expenses → link to Planner); empty month → "Nothing to do" (AC-23).
26. Planner Needs Funding checklist lists exactly the unfunded expense categories; funding
    one opens the budget form with the category preselected; after saving, the category
    appears in Allocated and leaves the checklist; funding bar in Allocated shows committed
    vs. remaining (AC-25).
27. Reports: pick a month → 6 charts + snapshot cover the 6-month window ending there;
    tooltips show exact money; charts animate and stop under `prefers-reduced-motion: reduce`;
    no forms/mutations on the page; resize desktop → mobile: charts reflow, no horizontal
    overflow (FR-07).

## 6. Edge cases to cover

- Amount `0.001` / `0` / negative / `"1,000"` → invalid, inline error.
- Transaction dated in a month with no budget → fine; appears in reports.
- Deleting a category that a recurrence rule references → blocked (same rule as FR-02).
- Import of an export that references unknown category ids → rejected by `validateAppState`
  (cross-field validation).
- Deferred transactions survive export/import (`deferred` is an optional additive field;
  older exports without it validate fine).
- localStorage quota exceeded (`QuotaExceededError`) → toast error, in-memory state kept.
- Two tabs open: last-writer-wins is acceptable; document as known limitation.

## 7. Definition of Done (phase exit criteria)

- [ ] Steps 1–14 complete; `npm test`, `npx tsc --noEmit`, `npm run lint` all pass.
- [ ] Manual checklist §5 all 25 items pass in a fresh profile.
- [ ] `npm run build` succeeds with no errors.
- [ ] No console errors/warnings; Lighthouse accessibility score 100.
- [ ] `ARCHITECTURE.md`/`UI_UX_SPEC.md` updated if implementation deviated.
- [ ] `ROADMAP.md` change log entry added.
