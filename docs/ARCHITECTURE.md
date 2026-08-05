# Budget Planner — System Architecture (Phase 2)

Status: Draft · Owner: Phase 2 · Deliverable of: `ROADMAP.md` Phase 2
Baseline requirements: `PROJECT_SPEC.md` (Phase 1).

> The project uses Next.js 16.2.12, which has breaking changes vs. older Next.js.
> Before writing any app code, read the relevant guide in `node_modules/next/dist/docs/`
> (e.g. `01-app/01-getting-started`, `01-app/03-api-reference`) and heed deprecation notes.
> In particular verify current conventions for: async `params`/`searchParams`, client/server
> component boundaries, `use client` directives, and metadata APIs.

## 1. Stack decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Framework | Next.js 16.2.12, App Router | Project default; routing + SSR-free static shell |
| UI | React 19.2.4 with `"use client"` components | All app logic is client-side |
| Styling | Tailwind CSS 4 (`@theme` tokens in `app/globals.css`) | Zero-config, token-based design system per `UI_UX_SPEC.md` |
| State | Zustand (`zustand` v5, `persist` middleware) | Minimal boilerplate, `localStorage` persistence, selector-based subscriptions |
| ID | `crypto.randomUUID()` | Available in all target browsers |
| Charts | Recharts (`recharts` v3) for analytical charts on `/reports`; pure CSS/SVG animated components (CSS width transitions) for the Planner's `BarChart` | Recharts approved by product owner (ROADMAP change log 2026-08-01); bundle is route-split — only the Reports page loads it. Planner keeps the lightweight custom chart (FR-15) |
| Dates | Native `Date` + fixed `"YYYY-MM"` / `"YYYY-MM-DD"` helpers in `lib/date.ts` | No dependency; all parsing/formatting centralized |
| Testing | `vitest` + `@testing-library/react` | See `PHASE-04-IMPLEMENTATION.md` §4 |

## 2. Module layout

```
app/
  layout.tsx                 # root layout: fonts, <html lang="en">, <AppShell>
  page.tsx                   # /  Planner (primary screen, client page)
  todo/page.tsx              # /todo  (actionable recommendations, FR-17)
  history/page.tsx           # /history  (chronological ledger)
  reports/page.tsx           # /reports
  settings/page.tsx          # /settings
  globals.css                # Tailwind entry + @theme design tokens
  error.tsx                  # fatal error boundary (invalid persisted state)
components/
  shell/  AppShell.tsx, Sidebar.tsx, BottomNav.tsx, Header.tsx
  ui/     Button.tsx, Card.tsx, Input.tsx, Select.tsx, Modal.tsx,
          ConfirmDialog.tsx, EmptyState.tsx, Spinner.tsx, Badge.tsx,
          ProgressBar.tsx, Toast.tsx, Table.tsx, MonthPicker.tsx,
          Slider.tsx, ToastHost.tsx
  planner/ PlannerView.tsx, SummaryCards.tsx, OverBudgetAlert.tsx,
           BudgetHealthCard.tsx, NeedsFundingSection.tsx,
           BudgetList.tsx, BudgetForm.tsx,
           BudgetRow.tsx, PriorityBadge.tsx, AllocationPanel.tsx,
           QuickAddExpense.tsx, DeferredSection.tsx,
           InsightsPanel.tsx, ExpenseBreakdown.tsx
  history/ HistoryView.tsx, TransactionList.tsx
  reports/ ReportsView.tsx, SnapshotCards.tsx, ChartCard.tsx,
           IncomeExpenseChart.tsx, SpendingTrendChart.tsx,
           SavingsChart.tsx, BudgetUtilizationChart.tsx,
           TopCategoriesChart.tsx
  todo/    TodoView.tsx
  txn/     TransactionForm.tsx, TransactionRow.tsx,
           RecurrenceForm.tsx, TransactionFilters.tsx
  charts/ BarChart.tsx            # custom animated CSS chart (Planner, FR-15)
lib/
  types.ts                   # interfaces from PROJECT_SPEC §6.1 (+ Priority, Currency)
  date.ts                    # monthKey(), datesInMonth(), clampDay(), todayIso(), nextMonthDate()
  money.ts                   # formatMoney(minor, currency), toMinorUnits(input, currency?)
  recurrence.ts              # generateInstances(rule, month), recordException(rule, month, id)
  selectors.ts               # spent(), earned(), totals(), budgetProgress(), spendingByCategory(),
                             # budgetHealth(), needsFunding(), deferredExpenses(), sortTransactions(),
                             # windowMonths(), monthlySeries(), budgetUtilizationSeries(),
                             # spendingByCategoryInMonths(), incomePlan selectors, receivedForMonth() (pure)
  finance.ts                 # monthFinance(transactions, incomePlans, month) + financeSeries() —
                             # the single source of truth for Received / Expected / Expenses /
                             # Net / Remaining / Projected remaining / Savings rate (pure)
  allocation.ts              # clampAllocation(), totalAllocated() (pure, FR-11)
  insights.ts                # insightsFor(...) -> Insight[] (pure, FR-13)
  todo.ts                    # todoFor(state, month) -> TodoItem[] (pure, FR-17)
  seed.ts                    # DEFAULT_CATEGORIES, createInitialState()
  validate.ts                # validateAppState(json) -> AppState | throws (+ v1 migration)
  storage.ts                 # load/save wrapper for localStorage key
store/
  useAppStore.ts             # Zustand store (state + actions), persist middleware
  useToastStore.ts           # transient toast queue (not persisted)
hooks/
  useMonth.ts                # shared month selection state (URL param)
  useRecurring.ts            # effect that materializes recurring instances
  useToast.ts                # success()/error() wrappers over useToastStore
```

Rules:

- `lib/*` is pure and has zero React imports → unit-testable with `vitest`.
- `store/*` depends only on `lib/*` and `zustand`.
- `components/*` depend on `store` + `lib` + `components/ui` only. No `lib` function may
  import a component.
- Pages are thin composition layers; all behavior lives in components + store actions.

## 3. State management

### 3.1 Store shape (Zustand)

```ts
interface AppStore {
  state: AppState;                          // persists via persist middleware
  // actions (all immutable updates via set())
  addTransaction(input: TransactionInput): void;
  updateTransaction(id: ID, patch: Partial<TransactionInput>): void;
  deleteTransaction(id: ID): void;
  addBudget(input: BudgetInput): void;
  updateBudget(id: ID, patch: Partial<Pick<Budget, "limit" | "priority">>): void;
  deleteBudget(id: ID): void;
  addTransaction(input: TransactionInput): void;
  updateTransaction(id: ID, patch: Partial<TransactionInput>): void;
  deleteTransaction(id: ID): void;
  moveTransactionToNextMonth(id: ID): void;  // FR-12
  addCategory(input: CategoryInput): void;
  renameCategory(id: ID, name: string): void;
  updateCategory(id: ID, patch: Partial<Pick<Category, "name" | "icon" | "color">>): void;
  deleteCategory(id: ID): void;
  addRecurrenceRule(input: RecurrenceRuleInput): void;
  updateRecurrenceRule(id: ID, patch: Partial<RecurrenceRule>): void;
  deleteRecurrenceRule(id: ID): void;
  setSettings(patch: Partial<Settings>): void;
  setIncomePlan(month: Month, id: ID | null, patch: {
    name?: string; icon?: string; expectedAmount?: number; receivedAmount?: number;
  }): boolean;                     // FR-18 — upsert one standalone source (null id = create)
  importState(json: unknown): void;         // validate + replace
  resetAll(): void;
}

interface ToastStore {                      // store/useToastStore.ts — NOT persisted
  toasts: { id: ID; message: string; tone: "success" | "error" }[];
  push(message: string, tone?: "success" | "error"): void;  // auto-dismiss 3 s
  dismiss(id: ID): void;
}
```

- Persistence: `persist(state, { name: "budget-planner:state", version: 3 })` from
  `zustand/middleware`. `migrate`/`onRehydrateStorage` handle version mismatch → throw to
  trigger `app/error.tsx`. `validateAppState` accepts versions 1–3 and normalizes on load:
  v1 backfills income categories + converts tagged monthly-income transactions into plans;
  v2 rewrites category-bound plans into standalone `IncomePlan` entries (name/icon from the
  category, `receivedAmount` backfilled from income transactions); legacy fields
  (`currencySymbol` → currency, missing budget `priority` → `"medium"`) are normalized
  (AC-16).
- All actions are synchronous, pure updates on an immutable `AppState` copy. Derived values
  are computed in selectors, never stored.
- No action may write to `localStorage` directly; persistence is the middleware's job
  (debounced by the middleware's internal serializer timing).
- The toast store is intentionally separate and transient: `push()` timestamps a toast that
  `ToastHost` renders; nothing toast-related is persisted.

### 3.2 Recurring materialization

- `hooks/useRecurring.ts`: a `useEffect` keyed on `settings.recurringEnabled` runs once per
  app load and calls `generateInstances(rule, month)` for the current and previous month for
  every enabled rule, then dispatches `store.addGeneratedInstances(instances)` (internal
  action) — idempotent via `recurringRuleId + date` lookup.
- `generateInstances` is pure; unit tests cover AC-06/AC-07.

### 3.3 Allocation & move-to-next-month

- **Finance rules (single source of truth):** `lib/finance.ts` `monthFinance()` is the one
  place that defines Received / Expected / Expenses / Net / Remaining / Projected remaining /
  Savings rate. Received = `max(income transactions, Σ plan.receivedAmount)` (plans are
  canonical; transactions are a fallback floor so legacy and transaction-only states don't
  collapse; the max prevents double counting after the v2→v3 backfill). Net = Remaining
  (before clamping) = Received − Expenses; Remaining clamps at 0 (allocatable balance);
  Projected remaining = Expected − Expenses. Every screen — summary cards, allocation,
  budget lists/health, hero, monthly stats, recommendations, insights, to-dos, reports,
  KPIs and charts — derives these from `monthFinance`/`financeSeries`; no component
  reimplements the math.
- **Allocation (FR-11):** slider values are component-local state in `AllocationPanel`.
  `lib/allocation.ts` provides `clampAllocation(current, next, remaining, otherTotal)` and
  `totalAllocated(allocations)`; integer arithmetic only. Applying dispatches one
  `updateBudget(id, { limit: limit + allocation })` per budget — the only persistence path.
- **Move to next month (FR-12/FR-17):** `moveTransactionToNextMonth(id)` sets
  `date = nextMonthDate(date)` (`lib/date.ts`, day clamped) and marks the transaction
  `deferred: true` so the destination month's Planner can surface it. For a
  recurring-generated instance it also applies `recordException(rule, month, id)`
  (`lib/recurrence.ts`), which appends the id to `rule.exceptions[month]` so regeneration
  skips it, and detaches the transaction from the rule (`recurringRuleId`/`edited` unset).
- **To-Do (FR-17):** `lib/todo.ts` `todoFor(state, month)` maps the FR-13 rule set plus a
  deferred-expenses check into `TodoItem[]` (title, detail, tone, href). Pure and
  deterministic; the To-Do page renders it, the Planner renders insights separately.

## 4. Data flow

```
UI event (component)
  │  store.action(payload)          e.g. addTransaction
  ▼
Zustand store  ──set()──►  new immutable AppState
  │
  ├── persist middleware ──► localStorage "budget-planner:state" (debounced)
  │
  └── notify subscribers
        │
        ├── selectors (lib/selectors.ts) ──► derived values
        └── component re-render (selector-level subscriptions)
```

Server/client boundary: pages and the shell use `"use client"` (or render client components
only). `app/layout.tsx` stays a server component that renders `<AppShell>`; no server data
fetching occurs anywhere — remove/ignore the default `create-next-app` fetch scaffolding.

## 5. Error handling

| Layer | Behavior |
|-------|----------|
| Validation (forms) | Inline field errors from `lib/validate.ts` helpers; never throw to boundary |
| Storage parse failure | `app/error.tsx`: message "Saved data is corrupted", buttons: "Import backup" (opens `/settings?action=import`) and "Reset data" |
| Unexpected render error | `app/error.tsx` default stack with reload button |
| Import of invalid file | Inline error in import UI; state untouched (AC-10) |
| Toast | Non-blocking `Toast.tsx` for success confirmations (saved / exported / imported) |

## 6. Security notes

- No secrets, no tokens, no server code. Never log `localStorage` contents.
- File import only accepts `application/json`; content is parsed by `validateAppState`
  (schema check first: `version === 1` and required arrays — never `JSON.parse` + spread
  directly into state).
- `dangerouslySetInnerHTML` is prohibited; user notes render as plain text.

## 7. Performance

- Selector-based store subscriptions: components subscribe to slices (e.g.
  `useAppStore((s) => s.state.transactions)`) — never the whole state.
- `React.memo` on `TransactionRow`/`BudgetRow`/`InsightCard`.
- `TransactionList` paginates at 25 rows (FR-04); no virtualization dependency needed up to
  1000 rows.- Charts re-render only when their data slice changes. `InsightsPanel` memoizes
  `insightsFor(...)` on `(budgets, transactions, categories, month, currency)`.
- `AllocationPanel` keeps sliders in local state; the panel re-renders only on its own
  slider input or a store change in `budgets`/`totals`.
- Chart/progress animations are pure CSS width transitions; no JS-driven frames after the
  one-time rAF mount pass.
- Recharts is imported only by `components/reports/*`; Next.js route-splits it so other
  pages never load the chart bundle. Reports selectors stay pure and are shared with the
  Planner.

## 8. Testing strategy (mapped to implementation phase)

- Unit (`vitest`): `lib/*` — dates, money (NGN/USD formatting, AC-20), recurrence generation
  (AC-06, AC-07, `recordException`), selectors (AC-12, AC-19 `budgetHealth`,
  `deferredExpenses` AC-24), validation (AC-10, AC-16 migration), allocation (AC-18),
  insights (AC-21), todo (AC-23).
- Component (`@testing-library/react`): form validation (AC-02), budget progress states
  (AC-03), add/edit/delete transaction flow (AC-04, AC-05), persistence across remount
  (AC-08), priority badge + move-to-next-month action (AC-17, AC-24), allocation
  apply/reset (AC-18), insights cards (AC-21), todo items (AC-23).
- Manual E2E checklist: `PHASE-04-IMPLEMENTATION.md` §5.
