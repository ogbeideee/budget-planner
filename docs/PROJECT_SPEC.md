# Budget Planner — Project Specification (Phase 1)

Status: Draft · Owner: Phase 1 · Deliverable of: `ROADMAP.md` Phase 1

## 1. Overview

A client-side personal budget planner that lets a user:

- define monthly budgets per category,
- prioritize expense categories (`high` / `medium` / `low`),
- record income and expense transactions,
- see at a glance whether each category is under/over budget,
- allocate remaining monthly funds across categories with sliders,
- defer an expense to the next month,
- see a budget health score, insights and recommendations,
- act on a To-Do list of recommended actions,
- view monthly and category reports,
- export/import data as JSON for backup and portability.

The **Planner** (the app's primary screen) is built around monthly planning; the History
ledger, Reports, and Settings exist to support it — not the other way around. The app runs
entirely in the browser. No authentication, no backend, no network dependency at runtime.
All data lives in `localStorage` under a single namespaced key. Amounts display in USD
(`$`) or NGN (`₦`) — formatting only, never converted (FR-16).

## 2. Goals

1. Zero-friction data entry (add a transaction in ≤ 3 interactions from the Planner's
   quick-add).
2. Accurate per-category budget progress with visual indicators.
3. Full data portability via JSON export/import.
4. Offline-first: every feature works without a network connection.
5. Mobile-usable responsive layout; desktop-first with a sidebar.

## 3. Non-goals

- Multi-user accounts, syncing, or a server API.
- Bank/account aggregation or CSV ingestion.
- Currency conversion or exchange rates (NGN/USD are display-only; amounts are never converted or re-denominated).
- Native mobile packaging (web app only).

## 4. Personas

| Persona | Needs |
|---------|-------|
| Single budgeter (primary) | Quick logging, monthly overview, overspend warnings |
| Household manager | Multiple budgets, category-level reporting |

## 5. Functional Requirements

Identifiers `FR-01 …` are referenced by acceptance criteria in §7 and by the test matrix in
`PHASE-04-IMPLEMENTATION.md`.

### FR-01 — App shell & navigation

- App renders a responsive shell: sidebar navigation on `≥ 1024px`, bottom tab bar on
  `< 1024px`.
- Routes: `/` (Planner — the primary screen), `/todo`, `/history`, `/reports`,
  `/settings`.
- Navigation labels: **Planner**, **To-Do**, **History**, **Reports**, **Settings**.
  Budget planning lives inside the Planner; `/history` is a chronological ledger of
  completed income/expense records.

### FR-02 — Categories

- Categories are managed (create, rename, delete) in `/settings`.
- Deleting a category that has transactions or is used by a budget is blocked with a
  confirmation dialog explaining the impact.
- 6 default categories are seeded on first run (see §6.5).
- Each category has: `id`, `name`, `icon` (emoji), `color` (hex), `kind` (`income` | `expense`).

### FR-03 — Budgets

- A budget belongs to a category (expense kinds only) and has `month` (`YYYY-MM`) and `limit`
  (number ≥ 0).
- At most one budget per category per month.
- Budget management (form, list, priority, allocation, health) lives on the Planner page
  (`/`); there is no separate budgets page.
- Monthly budget list shows: category, limit, spent, remaining, and progress %.
- Overspend state: spent > limit → budget row is visually marked and the Planner shows an
  alert.

### FR-04 — History (transaction ledger)

- Record income and expense transactions: amount, category, date, optional note.
- Edit and delete existing transactions.
- History lists all completed records as a chronological ledger, sorted by date descending,
  paginated (25/page).
- Filter by: month, category, type (income/expense), free-text search on note.

### FR-05 — Recurring transactions

- A recurring transaction template (`RecurrenceRule`) generates instances into the transaction
  list for the current month (and previous month when applicable, see §6.6).
- Recurrence types: `weekly`, `monthly`, `yearly` (based on the template's date).
- Editing/deleting a generated instance does not change the template; it only hides/marks the
  instance for the month in which it was changed (store an `exceptions` map on the template).

### FR-06 — Planner (primary screen)

The Planner replaces the former dashboard and budgets pages. For the selected month it
shows:

- Summary cards: **Expected income** ("Set expected income" until anything is planned; once
  planned it shows the month's total with a received + remaining-to-collect hint and an Edit
  affordance — opens the Expected income modal, FR-18), **Expenses**, **Net**, and
  **Remaining** (`max(0, net)` — the allocatable balance).
- **Net/Remaining semantics (centralized in `lib/finance.ts`):** `Received = max(income
  transactions, Σ incomePlans.receivedAmount)` — income plans are the canonical source and
  the transaction floor keeps legacy/transaction-only states correct without double
  counting. `Net = Received − Expenses` (all other derived values use Received; none may
  substitute Expected or transaction income for it). `Remaining = max(0, Net)` (the
  allocatable balance, FR-11) and **Projected remaining = Expected − Expenses** (what
  remains if the full expected income arrives). Every screen derives these from
  `monthFinance`/`financeSeries` — summary cards, allocation, budgets, health gauge, hero,
  monthly stats, recommendations, insights, to-dos, reports, KPIs and charts.
- Month selector (header row).
- Needs Funding section: a checklist of the month's expense categories that have no
  budget yet (or a limit of 0). Each row has a "Fund" action that opens the budget form
  with the category preselected; funding the category removes it from the checklist.
  Empty state: everything is funded.
- Allocated section: per-category budgets with priority, limit, spent, remaining,
  progress, edit/delete, and the "New budget" form; a funding bar shows how much of the
  allocatable balance is committed.
- Allocation sliders (FR-11) and the budget health gauge (FR-14).
- Insights & recommendations (FR-13) and the expense breakdown chart (FR-15).
- Quick Add Expense: an inline form that logs an expense without leaving the Planner.
- Deferred expenses: expenses moved into this month via FR-12, with their total (FR-17).

### FR-07 — Reports

Analytical-only page (no mutation). For a 6-month window ending at the selected month
(month picker, defaults to the current month) it shows:

- Snapshot of the selected month: savings (`net`) and remaining balance (`max(0, net)`).
- Income vs expenses per month (grouped bars, 6 months).
- Monthly spending trend (total expenses per month, line/area, 6 months).
- Savings and remaining balance per month (lines, 6 months).
- Budget utilization per month (spent / total limits, 6 months; months with no budgets are
  skipped).
- Top 5 expense categories by spend across the window (horizontal bars with % of window
  total).

Charts render with **Recharts** (the one chart dependency; replaces the earlier "pure CSS"
decision — see `ROADMAP.md` change log). All charts animate (Recharts default) and disable
animation under `prefers-reduced-motion: reduce` (AC-22). Y-axis ticks are compact
(`$1.2K`); tooltips and labels show exact `formatMoney` values (AC-14). Reports reuse the
existing pure selectors; no new persisted state.

### FR-08 — Data persistence, export & import

- All state persists to `localStorage` key `budget-planner:state` on every mutation.
- Export: downloads `budget-planner-export-<YYYY-MM-DD>.json` containing schema version +
  full state.
- Import: file picker accepts a JSON export; validates schema version and shape; on invalid
  input shows an inline error and changes nothing.
- Import overwrites all existing data after a confirmation dialog.

### FR-09 — Settings

- Manage categories (see FR-02).
- Toggle recurring transactions on/off (enabled by default).
- Currency setting (`USD` default | `NGN`); display symbol derived from it (see FR-16).
- Export data, import data (FR-08).
- "Reset all data" (double-confirm).

### FR-10 — Expense prioritization

- Every budget carries `priority: "high" | "medium" | "low"` (default `"medium"`), chosen in
  the budget form and editable after creation.
- Priority is shown on budget rows (badge) and in the Planner budget table; the budget
  list sorts by priority (high → medium → low) within a month.
- Priority drives insights (FR-13); it never affects money math.

### FR-11 — Expense allocation sliders

- On the Planner for the selected month, when `net(month) > 0` and the month has at least one
  budget, an "Allocate remaining" panel shows one slider per expense budget.
- Each slider ranges `0 … remaining` in integer minor units, where
  `remaining = max(0, net(month))`. The sum of all slider values never exceeds `remaining`:
  raising a slider clamps it to `remaining − sum(other sliders)`.
- The panel shows each allocation as money, its share of `remaining` as a percentage, and a
  running "Unallocated" total.
- "Apply allocations" raises each budget's limit by its slider value (one `updateBudget` call
  per budget; limits only ever increase) and confirms with a toast; panel state resets.
- "Reset" clears all sliders without touching budgets.
- Allocation values are transient UI state — never persisted until applied.

### FR-12 — Move expense to next month

- Expense transactions expose a "Move to next month" action (transaction list rows).
- Store action `moveTransactionToNextMonth(id)` moves the transaction's `date` to the same
  day-of-month in the following month, clamped to the target month length
  (e.g. `2026-01-31` → `2026-02-28`).
- If the transaction was generated by a recurring rule: the rule records the instance id in
  `rule.exceptions[oldMonth]` (so regeneration skips it, AC-07 mechanics) and the transaction
  is detached from the rule (`recurringRuleId` and `edited` unset) — it becomes a normal
  transaction.
- The moved transaction is marked `deferred: true` and appears in the destination month's
  Planner "Deferred expenses" section (FR-17).
- Income transactions are unaffected (action not offered).
- All derived values (month totals, progress, health) update immediately; a toast confirms.

### FR-13 — Insights & recommendations

- Pure function `insightsFor(...)` in `lib/insights.ts` returns a deterministic, ordered list
  of recommendations for a month; rendered in the Planner "Insights" panel.
- Rules, evaluated in this order (each yields at most one card; list capped at 5):
  1. First `high`-priority budget with `spent > limit` → danger card, action → Planner.
  2. Any budget with `spent > 1.2 × limit` (integer comparison: `5 × spent > 6 × limit`) →
     danger card, action → Planner.
  3. `net(month) < 0` → warn card "Spending exceeds income by $X".
  4. `net(month) > 0` and no budgets for the month → neutral card "Unallocated $X — create a
     budget", action → Planner.
  5. Top-spending expense category with no budget this month → neutral card, action → Planner.
  6. First `high`-priority budget with `limit > 0` and `2 × spent ≤ limit` → success card
     "On track".
- A month with no transactions and no budgets yields a single neutral card "No data for this
  month". Card tones map to the semantic color system (`danger` | `warn` | `success` | `neutral`).

### FR-14 — Budget health

- `budgetHealth(month)` returns an integer `0–100`: start at `100`; for each budget with
  `limit > 0` and `spent > limit`, subtract `min(30, floor(100 × (spent − limit) / limit))`;
  if `net(month) < 0`, subtract `15`; clamp to `[0, 100]`.
- Tiers: `≥ 80` healthy (green), `50–79` watch (amber), `< 50` at risk (red).
- Shown as a gauge on the Planner's budget health card.

### FR-15 — Animated charts

- `components/charts/BarChart.tsx`: pure CSS horizontal bars (no chart library). Bar widths
  transition ≤ 150 ms ease-out; mount animation is a two-pass `requestAnimationFrame`
  (`width 0 → target`) so bars grow into place.
- Planner "Expense breakdown" panel: per-category spending for the month, ranked
  descending, bar fill in the category color, amount + % beside each bar in a right-aligned
  column, longest bar capped at 80% of the track with proportions preserved, hover tooltip
  (Category, Amount, Percentage, Budget limit, Spent), and a >5-category collapse behind a
  "Show N more categories" button with an animated entrance (AC-22).
- `ProgressBar` uses the same width transition.
- All animation disabled under `prefers-reduced-motion: reduce`; bars are read via
  `role="img"` + `aria-label` with exact values.

### FR-16 — Currency support (NGN & USD)

- `Settings.currency: "USD" | "NGN"` (default `"USD"`); symbol derived: USD `$`, NGN `₦`.
- `formatMoney(minor, currency)` renders symbol + thousands grouping + exactly 2 decimals
  (e.g. `$1,250.50`, `₦1,250.50`) using integer string manipulation only — no floating point,
  no `Intl` currency conversion.
- `toMinorUnits(input, currency)` accepts input with or without either symbol.
- No conversion and no exchange rates; amounts are never re-denominated (see §3).

### FR-17 — To-Do page & deferred expenses

- `/todo` aggregates the month's actionable recommendations into one prioritized list:
  over-budget categories, spending exceeding income, unallocated funds, spending
  categories without a budget, and deferred expenses waiting in the month.
- Items derive deterministically from current state via a pure function
  `todoFor(state, month)` in `lib/todo.ts` (same rule set and order as FR-13, plus a
  deferred-expenses item); each item links to the page that resolves it (Planner `/`, or
  History `/history`).
- Moving an expense to the next month (FR-12) marks it `deferred` (a persisted flag on
  the transaction). The destination month's Planner shows a "Deferred expenses" section
  listing deferred items with their total; History shows them as ordinary records with a
  small "Deferred" indicator.
- A month with no deferred expenses shows the section in a neutral empty state.

### FR-18 — Income planning (expected vs received)

- Expected income is a standalone, month-scoped collection of sources — **not** derived from
  income categories. Each entry carries its own `id`, editable `name`, `icon`, `expectedAmount`
  and `receivedAmount` (both integer minor units, `>= 0`).
- The Planner's Expected income card opens a modal listing the month's sources. For each
  source the user can edit the name, pick an icon (see UI_UX_SPEC §4 `IconPicker`), and type
  either amount. A live **Difference** row shows the per-source status: "Not set yet",
  "Expected X · Y received · Z to collect", "Collected in full", or "Exceeded by Z".
- Sources are added inline ("Add income source") and removed per-row; deleting a source's
  amounts while both are blank removes its plan. Saving one source never touches another
  month's or source's data.
- `setIncomePlan(month, id | null, patch)` in the store upserts a single source (create when
  `id` is `null`, otherwise merge onto the entry with that `id`); entries are independent, so
  editing one source cannot wipe others (regression covered by a store test).
- Income categories still exist for transactions (History, reports, KPI income) but no longer
  control the planning list; deleting an income category is no longer blocked by income plans.
- On load, version-2 states migrate automatically: each category-bound plan becomes a
  standalone entry named/iconed after its category, `expectedAmount` from the old `expected`,
  and `receivedAmount` backfilled from that category's income transactions in that month.

## 6. Data Model

All values are plain JSON-serializable objects. Money is stored as integer minor units
(e.g., cents) to avoid floating point errors. Amounts in the UI are rendered from minor units.

### 6.1 TypeScript interfaces (source of truth)

```ts
type ID = string; // crypto.randomUUID()
type Month = string; // "YYYY-MM"
type CategoryKind = "income" | "expense";
type Priority = "high" | "medium" | "low"; // budget priority, default "medium"
type Currency = "USD" | "NGN";             // display currency, default "USD"

interface Category {
  id: ID;
  name: string;
  icon: string;        // single emoji
  color: string;       // hex, e.g. "#0ea5e9"
  kind: CategoryKind;
  createdAt: string;   // ISO 8601
}

interface Budget {
  id: ID;
  categoryId: ID;
  month: Month;        // "YYYY-MM"
  limit: number;       // minor units, >= 0
  priority: Priority;  // "high" | "medium" | "low", default "medium" (FR-10)
}

type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

interface RecurrenceRule {
  id: ID;
  categoryId: ID;
  amount: number;          // minor units, > 0
  type: "income" | "expense";
  frequency: RecurrenceFrequency;
  anchorDate: string;      // ISO date; day-of-month / day-of-week source
  note?: string;
  enabled: boolean;
  exceptions: Record<Month, ID[] | "skipped">; // month -> ids of generated txn that were edited/deleted
}

interface IncomePlan {     // FR-18 — standalone expected-income source
  id: ID;
  month: Month;            // "YYYY-MM"
  name: string;            // user-editable source name, non-blank
  icon: string;            // emoji char OR a "Line icons" key, e.g. "wallet" (see iconLibrary)
  expectedAmount: number;  // minor units, >= 0 (expected from this source)
  receivedAmount: number;  // minor units, >= 0 (actually collected from this source)
}

interface Transaction {
  id: ID;
  categoryId: ID;
  amount: number;          // minor units, > 0
  type: "income" | "expense";
  date: string;            // ISO date "YYYY-MM-DD"
  note?: string;
  createdAt: string;       // ISO 8601
  recurringRuleId?: ID;    // set when generated by a recurrence rule
  edited?: boolean;        // true when a generated instance was edited by the user
  deferred?: boolean;      // true when moved to the next month via FR-12 (FR-17)
}

interface Settings {
  currency: Currency;            // "USD" | "NGN"; default "USD" (FR-16)
  recurringEnabled: boolean;     // default true
  firstRunDone: boolean;         // seeded with default categories
}

interface AppState {
  version: 3;
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  recurrenceRules: RecurrenceRule[];
  incomePlans: IncomePlan[];   // FR-18
  settings: Settings;
}
```

Migration (additive): version-1 states get standard income categories backfilled and tagged
`monthlyIncome` transactions converted into category-bound plans, which the version-2→3 step
then rewrites as standalone `IncomePlan` entries (name/icon from the category,
`receivedAmount` backfilled from the category's income transactions that month). `validateAppState`
accepts versions 1–3 and normalizes legacy shapes defensively (e.g. `currencySymbol === "₦"`
→ `NGN`; missing budget `priority` → `"medium"`; AC-16).

### 6.2 Invariants

- `Transaction.type` must match the type of its `Category`; a transaction referencing a
  deleted category is not possible (delete is blocked, see FR-02).
- `Budget.limit >= 0`; `Transaction.amount > 0`; `Budget.priority` is `"high" | "medium" | "low"`.
- `Settings.currency` is `"USD" | "NGN"`; amounts are never converted between currencies.
- `deferred` may only be set on expense transactions, and only by
  `moveTransactionToNextMonth` (FR-12/FR-17).
- `month` values are always zero-padded `YYYY-MM`.
- `crypto.randomUUID()` is the only ID source.
- `IncomePlan.expectedAmount` / `IncomePlan.receivedAmount` are non-negative integers; the
  name is non-blank. Plans are standalone — a source's amounts are independent of income
  transactions (FR-18).

### 6.3 Derived values (computed, never stored)

- `spent(categoryId, month)` = sum of expense transactions in that month.
- `earned(categoryId, month)` = sum of income transactions in that month.
- `expectedIncomeForMonth(month)` = Σ `incomePlans.expectedAmount` for the month.
- `receivedIncomeForMonth(month)` = Σ `incomePlans.receivedAmount` for the month.
- `totalIncome(month)`, `totalExpenses(month)`, `net(month) = income - expenses`.
- `budgetRemaining(budget) = budget.limit - spent(budget.categoryId, budget.month)`.
- `progress(budget) = min(1, spent / limit)` when `limit > 0`, else `0`.
- `remaining(month) = net(month)` (negative when over-spending; the allocation UI uses
  `max(0, net)`).
- `spendingByCategory(month)` = expense amounts per category, ranked descending, with
  display-only `pct = floor(100 × amount / totalExpenses)` (percentages are display values,
  never used in money math).
- `budgetHealth(month)` — integer `0–100` per FR-14.
- `deferredExpenses(month)` — expense transactions dated in `month` with `deferred: true`.
- `todoFor(state, month)` — actionable item list per FR-17.

### 6.4 Storage

- Key: `budget-planner:state`; value: `JSON.stringify(AppState)`.
- Written after every mutation (debounced ≤ 100 ms via a state-subscription hook).
- On load: parse + validate against `version === 1`; on mismatch, render error state
  `app/error.tsx` with instructions to re-import a valid export.

### 6.5 Default seed (first run)

```
Rent            🏠 #ef4444 expense
Groceries       🛒 #f97316 expense
Transport       🚌 #eab308 expense
Utilities       💡 #22c55e expense
Entertainment   🎬 #8b5cf6 expense
Salary          💰 #0ea5e9 income
```

### 6.6 Recurrence generation rules

- Generation is a pure function `generateInstances(rule, month): Transaction[]` defined in
  `lib/recurrence.ts`; it is called when reading transaction data for a month, and results are
  materialized (written) into `state.transactions` once per month per rule.
- Weekly: instances occur on the weekday of `anchorDate`; all such dates within `month`.
- Monthly: the day-of-month of `anchorDate` within `month` (clamped to month length).
- Yearly: the month/day of `anchorDate`; if that month equals `month`, one instance.
- Generated instances are created once (idempotent by checking for an existing instance with
  the same `recurringRuleId` + `date`); afterwards they behave like normal transactions.
- `rule.exceptions[month]` lists generated instance ids that were edited or deleted in that
  month. Edited instances keep `edited: true` and their edits win over regeneration; deleted
  instances are excluded when regenerating a month.

## 7. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | First visit seeds 6 default categories; `firstRunDone` becomes true |
| AC-02 | Creating a budget for (category, month) that already has one shows an inline validation error |
| AC-03 | A budget at 100–120 % of limit shows amber state; > 120 % shows red state; both appear on the Planner alert banner |
| AC-04 | Adding a transaction updates Planner totals and category progress without a page reload |
| AC-05 | Editing a transaction updates all derived values; deleting removes its contribution |
| AC-06 | A recurring weekly rule with anchor date 2026-08-03 (Monday) yields 5 instances in August 2026 (3, 10, 17, 24, 31) |
| AC-07 | Editing a generated instance marks it `edited` and regeneration does not overwrite the edit |
| AC-08 | Reloading the page restores all data from `localStorage` |
| AC-09 | Export writes a JSON file with `version: 1`; importing that file reproduces identical state |
| AC-10 | Importing a file with `version !== 1` or a missing required array shows an inline error and mutates nothing |
| AC-11 | Deleting a category in use shows a confirmation dialog and is blocked; empty categories delete immediately |
| AC-12 | `net` for a month equals income − expenses to the minor unit for 100 random transactions generated in a unit test |
| AC-13 | Transaction list is sorted date-descending and paginates at 25 rows/page |
| AC-14 | No transaction amount in the UI ever shows more than 2 decimal places |
| AC-15 | All interactive elements are keyboard-operable and have accessible names (see `UI_UX_SPEC.md` §8) |
| AC-16 | A state exported before FR-10/FR-16 (with `settings.currencySymbol` and budgets lacking `priority`) imports successfully and normalizes: `₦` → `NGN`, any other → `USD`; `priority` defaults to `medium` |
| AC-17 | `moveTransactionToNextMonth` moves an expense's date into the next month (day clamped: `2026-01-31` → `2026-02-28`), updates month totals immediately, and for a recurring-generated instance records the id in `rule.exceptions[oldMonth]` and detaches it (regeneration does not recreate it in the old month) |
| AC-18 | Allocation sliders: sum never exceeds remaining; applying raises each budget limit by its allocation and persists; reset clears slider state without changing budgets |
| AC-19 | Budget health: income 100000, expenses 50000, one budget limit 40000 with spent 50000 → `100 − min(30, ⌊100×10000/40000⌋=25) = 75` (net ≥ 0 adds no penalty) |
| AC-20 | Setting currency to NGN renders amounts as `₦1,250.50`; USD renders `$1,250.50`; `toMinorUnits` accepts both symbols; amounts are never converted |
| AC-21 | A month with an over-budget high-priority category and positive unallocated net yields at least two deterministic insight cards in the FR-13 order |
| AC-22 | Chart and progress bars animate (width transition ≤ 150 ms) and are disabled under `prefers-reduced-motion: reduce`; each chart exposes `role="img"` with an `aria-label` containing exact values |
| AC-23 | The To-Do page lists only actions implied by current state (over-budget category, spending exceeding income, unallocated funds, spending category without a budget, deferred expenses) and each item links to the page that resolves it |
| AC-24 | Moving an expense to the next month (FR-12) marks it `deferred`; the destination month's Planner "Deferred expenses" section lists it with the correct total, and History still shows the record (with a "Deferred" indicator) |
| AC-25 | The Planner's Needs Funding checklist lists exactly the month's expense categories with no budget or a limit of 0 (income categories and funded categories excluded); funding a category via the checklist opens the budget form with that category preselected, and once a budget exists with a limit > 0 the category leaves the checklist |

## 8. Non-functional Requirements

| NFR | Target |
|-----|--------|
| Performance | Initial render < 1 s on a mid-range device; interactions update < 100 ms; lists ≤ 1000 rows render without virtualization |
| Offline | No runtime network requests; app works with network disabled |
| Accessibility | WCAG 2.1 AA: contrast, focus order, aria labels, reduced-motion support |
| Browser support | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| Data safety | Every mutation is persisted before the UI reports success |
