# Budget Planner — System Architecture (Phase 2)

Status: Maintained (refreshed 2026-08-05) · Owner: Project · Deliverable of: `ROADMAP.md` Phase 2
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
| ID | `createId()` in `lib/ids.ts` — `crypto.randomUUID()` with a `Date.now()`/`Math.random()` fallback | `randomUUID` requires a secure context; the fallback keeps entity creation safe in non-secure contexts (e.g. a packaged desktop shell over `file://`/custom protocol) |
| Charts | Recharts (`recharts` v3) for analytical charts on `/reports`; pure CSS/SVG animated components (CSS width transitions) for the Planner's `BarChart` | Recharts approved by product owner (ROADMAP change log 2026-08-01); bundle is route-split — only the Reports page loads it. Planner keeps the lightweight custom chart (FR-15) |
| Dates | Native `Date` + fixed `"YYYY-MM"` / `"YYYY-MM-DD"` helpers in `lib/date.ts` | No dependency; all parsing/formatting centralized |
| Testing | `vitest` + `@testing-library/react` | See `PHASE-04-IMPLEMENTATION.md` §4 |

## 2. Module layout

```
app/
  layout.tsx                 # root layout: fonts, <html lang="en">, <AppShell>
  page.tsx                   # /  Planner (primary workspace)
  todo/page.tsx              # /todo  (actionable recommendations, FR-17)
  history/page.tsx           # /history  (chronological ledger)
  reports/page.tsx           # /reports
  settings/page.tsx          # /settings
  upcoming/page.tsx          # /upcoming  (future expenses + funding urgency)
  globals.css                # Tailwind entry + @theme design tokens
  error.tsx                  # fatal error boundary -> RecoveryPanel
components/
  shell/  AppShell.tsx, Sidebar.tsx, BottomNav.tsx, Header.tsx, PageHeader.tsx, nav.ts
  ui/     Button.tsx, Card.tsx, Input.tsx, Select.tsx, Modal.tsx, Drawer.tsx,
          ConfirmDialog.tsx, Disclosure.tsx, EmptyState.tsx, Toast.tsx, ToastHost.tsx,
          MonthPicker.tsx, Slider.tsx, ProgressBar.tsx, SectionHeading.tsx,
          PageSkeleton.tsx, AnimatedNumber.tsx, IconPicker.tsx, IconValue.tsx, icons.tsx
  planner/ PlannerView.tsx, Hero.tsx, SummaryCards.tsx, MonthlyStats.tsx,
           OverBudgetAlert.tsx, NeedsFundingSection.tsx, BudgetList.tsx, BudgetForm.tsx,
           BudgetRow.tsx, PriorityBadge.tsx, BudgetHealthCard.tsx, AllocationPanel.tsx,
           QuickAddExpense.tsx, DeferredSection.tsx, InsightsPanel.tsx,
           ExpenseBreakdown.tsx, TodayRecommendations.tsx, BudgetSuggestions.tsx,
           IncomeModal.tsx
  history/ HistoryView.tsx, TransactionList.tsx
  txn/     TransactionForm.tsx, TransactionRow.tsx, TransactionFilters.tsx,
           RecurrenceForm.tsx
  upcoming/ UpcomingView.tsx, FutureExpenseForm.tsx
  reports/ ReportsView.tsx, ChartCard.tsx, chartStyles.ts, IncomeExpenseChart.tsx,
           SpendingTrendChart.tsx, SavingsChart.tsx, BudgetUtilizationChart.tsx,
           TopCategoriesChart.tsx, ExpectedVsActualChart.tsx, IncomeSourceChart.tsx,
           IncomeTrendChart.tsx, ReportsInsights.tsx
  todo/    TodoView.tsx
  insights/ InsightList.tsx
  settings/ SettingsView.tsx, CategoryManager.tsx, CategoryEditModal.tsx,
            BackupsManager.tsx, iconLibrary.ts
  theme/   ThemeToggle.tsx
  recovery/ RecoveryPanel.tsx
  charts/  BarChart.tsx            # custom animated CSS chart (Planner, FR-15)
lib/                          # pure TS, zero React imports — unit-tested (17 test files)
  types.ts                    # AppState + entity interfaces (PROJECT_SPEC §6.1)
  ids.ts                      # createId() — randomUUID + non-secure-context fallback
  date.ts                     # isMonth/isIsoDate, monthKey, parseMonth, monthOffset,
                              # todayIso, dateToIso/isoToDate, daysBetween, nextMonthDate,
                              # formatMonthLabel/Short, formatDateShort, ...
  money.ts                    # formatMoney(minor, currency), toMinorUnits(input),
                              # minorToInput(), compactMoney(), MINOR_UNITS_PER_UNIT
  finance.ts                  # monthFinance(transactions, incomePlans, month) — the single
                              # source of truth for Received/Expected/Expenses/Net/Remaining/
                              # Projected remaining/Savings rate (pure)
  selectors.ts                # spent(), totals(), budgetProgress(), isDeeplyOverBudget(),
                              # overBudgetCategories(), fundingGaps(), deferredExpenses(),
                              # spendingByCategory(), receivedForMonth(), sortTransactions(),
                              # windowMonths(), monthlySeries(), budgetUtilizationSeries(),
                              # incomePlan selectors (pure)
  allocation.ts               # clampAllocation(), totalAllocated() (pure, FR-11)
  insights.ts                 # insightsFor(...) -> Insight[] (pure, FR-13)
  todo.ts                     # todoFor(state, month) -> TodoItem[] (pure, FR-17)
  predictions.ts              # monthlyPredictions() — avg daily spend, projected month-end
  recommendations.ts          # budgetSuggestions() (FR-13)
  reportTrends.ts             # reportTrends() — 6-month window series for Reports
  monthStats.ts               # monthStats() — planner "month at a glance" metrics
  budgetHealth.ts             # budgetHealth() — score + checklist (FR-14)
  accents.ts                  # categoryColor() + CATEGORY_COLOR_FALLBACK (shared palette)
  timeline.ts                 # timelineLabel(), groupTransactionsByTime() (history buckets)
  upcoming.ts                 # groupLabel(), groupFutureExpenses(), fundingUrgency()
  recurrence.ts               # generateInstances(rule, month), recordException(rule, month, id)
  categorize.ts               # suggestCategory(), rememberMapping() (keywords + learned)
  seed.ts                     # DEFAULT_CATEGORIES, createInitialState()
  validate.ts                 # validateAppState(json) -> AppState | throws; migrations v1→v2→v3
  storage.ts                  # STORAGE_KEY, CATEGORIZATION_KEY, BACKUP_PREFIX, saveAppState(),
                              # setWritesEnabled(), parseStoredState() (legacy/corrupt auto
                              # snapshots), writeBackup(), snapshotCurrentState(),
                              # listBackupSnapshots(), scanRecoverablePayloads(),
                              # serializeExport(), parseExportPayload()
  theme.ts                    # resolveTheme(), applyTheme(), THEME_BOOTSTRAP_SCRIPT
  scrollLock.ts               # lockScroll()/unlockScroll() — shared by Modal/Drawer
store/
  useAppStore.ts              # Zustand store (state + actions), persist middleware;
                              # also exports useAppStoreErrors (hydrateError)
  useToastStore.ts            # transient toast queue (not persisted)
hooks/
  useMonth.ts                 # shared month selection state (URL param)
  useRecurring.ts             # effect that materializes recurring instances
  useToast.ts                 # success()/error() wrappers over useToastStore
  useTheme.ts                 # theme state + applyTheme; useReducedMotion.ts (a11y)
  usePlannerStatus.ts         # planner derived flags; useAnimatedNumber.ts (rAF counter)
  useChartColors.ts           # theme-aware chart palette (MutationObserver on data-theme)
public/                       # favicon.ico only (starter SVGs removed)
tests: components/*.test.tsx (colocated) · lib/__tests__/ (17 files) · store/__tests__/
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
  moveTransactionToNextMonth(id: ID): void;  // FR-12 — deferred flag + rule detach
  setIncomePlan(month: Month, id: ID | null, patch: {
    name?: string; icon?: string; expectedAmount?: number; receivedAmount?: number;
  }): boolean;                     // FR-18 — upsert ONE standalone source (null id = create)
  addBudget(input: BudgetInput): boolean;    // validates; same-month duplicate guard
  updateBudget(id: ID, patch: Partial<Pick<Budget, "categoryId" | "limit" | "priority">>): void;
  deleteBudget(id: ID): void;
  addFutureExpense(input: FutureExpenseInput): boolean;
  updateFutureExpense(id: ID, patch: Partial<FutureExpenseInput>): void;
  deleteFutureExpense(id: ID): void;
  addCategory(input: CategoryInput): boolean;   // validates name ≤ 30, non-empty icon, hex color
  renameCategory(id: ID, name: string): boolean;
  updateCategory(id: ID, patch: Partial<Pick<Category, "name" | "icon" | "color">>): boolean;
  deleteCategory(id: ID): { ok: boolean; reason?: CategoryDeleteReason };
  addRecurrenceRule(input: RecurrenceRuleInput): void;
  updateRecurrenceRule(id: ID, patch: Partial<RecurrenceRule>): void;
  deleteRecurrenceRule(id: ID): void;
  setSettings(patch: Partial<Settings>): void;
  importState(json: unknown): { ok: boolean; error?: string };  // validate + replace
  recoverFromBackup(key: string): { ok: boolean; error?: string };
  resetAll(): void;
  addGeneratedInstances(instances: Transaction[]): void;   // internal (useRecurring)
}

interface AppStoreErrors {               // store/useAppStore.ts — NOT persisted
  hydrateError: string | null;
  setHydrateError(error: string | null): void;
}

interface ToastStore {                      // store/useToastStore.ts — NOT persisted
  toasts: { id: ID; message: string; tone: "success" | "error" }[];
  push(message: string, tone?: "success" | "error"): void;  // auto-dismiss 3 s
  dismiss(id: ID): void;
}
```

- Persistence: `persist(state, { name: "budget-planner:state", version: 3 })` from
  `zustand/middleware` with a custom `storage` adapter. `getItem` runs `parseStoredState`
  (validation + migration); `setItem`/`removeItem` route through `lib/storage.ts` (writes
  disabled while the state is corrupt, exceptions swallowed). Writes are **synchronous**
  after every `set` — the persist middleware serializes immediately; there is no debounce.
- On rehydrate, `onRehydrateStorage` sets `useAppStoreErrors.hydrateError` and disables
  writes (`setWritesEnabled(false)`) when the payload is corrupt, so nothing can overwrite
  the unreadable state until the user recovers. `app/error.tsx` detects the corrupt state
  and renders `RecoveryPanel` (scan browser, restore backup, import file, or start fresh).
- `validateAppState` accepts versions 1–3 and normalizes on load: v1 backfills income
  categories + converts tagged monthly-income transactions into plans; v2 rewrites
  category-bound plans into standalone `IncomePlan` entries (name/icon from the category,
  `receivedAmount` backfilled from income transactions); legacy fields (`currencySymbol` →
  currency, missing budget `priority` → `"medium"`) are normalized (AC-16). Version > 3 is
  rejected.
- Before parsing, `parseStoredState` auto-snapshots legacy (`auto-v{n}`) and corrupt
  (`auto-corrupt`) payloads under `budget-planner:backup:*`, so the original bytes are
  never destroyed and remain restorable from `RecoveryPanel`/`BackupsManager`.
- No component writes to `localStorage` directly; production writes flow through the
  persist middleware, and storage helpers (`saveAppState`, snapshots, backups) go through
  `lib/storage.ts`.
- The toast store is intentionally separate and transient: `push()` schedules auto-dismiss
  (3 s) and `ToastHost` renders; nothing toast-related is persisted.

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
  `lib/allocation.ts` provides `clampAllocation(next, remaining, otherTotal)` and
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
  ├── persist middleware ──► localStorage "budget-planner:state" (synchronous)
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
| Storage parse failure | `app/error.tsx` detects `CorruptedStateError` and renders `RecoveryPanel`: scan browser for recoverable payloads, restore a backup, import an export file, or start fresh. The corrupt payload was auto-snapshotted (`budget-planner:backup:auto-corrupt:*`) before failure, so nothing is destroyed |
| Unexpected render error | `app/error.tsx` generic stack with reload button |
| Import of invalid file | Inline error in import UI; state untouched (AC-10) |
| Toast | Non-blocking `Toast.tsx` for success confirmations (saved / exported / imported) |

## 6. Security notes

- No secrets, no tokens, no server code. Never log `localStorage` contents.
- File import only accepts `application/json`; content is parsed by `validateAppState`
  (schema check first: `version` between 1 and 3 and required arrays — never `JSON.parse` +
  spread directly into state).
- `dangerouslySetInnerHTML` is prohibited; user notes render as plain text.

## 7. Performance

- Selector-based store subscriptions: components subscribe to slices (e.g.
  `useAppStore((s) => s.state.transactions)`) — never the whole state.
- `React.memo` on `TransactionRow`, `BudgetRow`, `FutureExpenseRow` (upcoming), and the
  `BarChart` row component; `InsightsPanel` memoizes `insightsFor(...)` on its inputs.
- `TransactionList` paginates at 25 rows (FR-04); no virtualization dependency needed up to
  1000 rows.
- Charts re-render only when their data slice changes. Reports selectors are pure and
  shared with the Planner.
- `AllocationPanel` keeps sliders in local state; the panel re-renders only on its own
  slider input or a store change in `budgets`/`totals`.
- Chart/progress animations are pure CSS width transitions; no JS-driven frames after the
  one-time rAF mount pass.
- Recharts is imported only by `components/reports/*`; Next.js route-splits it so other
  pages never load the chart bundle.

## 8. Testing strategy (mapped to implementation phase)

- Unit (`vitest`): `lib/*` — dates, money (NGN/USD formatting, AC-20), recurrence generation
  (AC-06, AC-07, `recordException`), selectors (AC-12, AC-19 `budgetHealth`,
  `deferredExpenses` AC-24), validation (AC-10, AC-16 migration), allocation (AC-18),
  insights (AC-21), todo (AC-23), storage (migrations, corrupt snapshots, write guard).
- Component (`@testing-library/react`): form validation (AC-02), budget progress states
  (AC-03), add/edit/delete transaction flow (AC-04, AC-05), persistence across remount
  (AC-08), priority badge + move-to-next-month action (AC-17, AC-24), allocation
  apply/reset (AC-18), insights cards (AC-21), todo items (AC-23), modal focus isolation
  and node-identity/remount regression suites.
- Current totals: **324 tests / 34 files** (17 `lib/__tests__/`, 1 `store/__tests__/`,
  16 colocated component suites). Gates: `npx tsc --noEmit` · `npm run lint` ·
  `npm run test` · `npm run build`.
- Manual E2E checklist: `PHASE-04-IMPLEMENTATION.md` §5.
