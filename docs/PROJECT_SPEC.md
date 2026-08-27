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
- Bank/account aggregation. The Planner's "Import Statement" flow (2026-08-14)
  ingests CSV/Excel/PDF files **fully client-side** into plain transactions —
  it is an import convenience, not account linking or ongoing aggregation.
  Automatic/continuous sync with external banks stays out of scope.
  Password-protected PDFs (2026-08-17) are unlocked locally by the built-in
  PDF engine — the password is held in memory only, never persisted, logged
  or sent anywhere, and the PDF never leaves the device.
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
- On a first run the shell is replaced entirely by the onboarding flow (FR-01a).
- Routes: `/` (Planner — the primary screen), `/todo`, `/history`, `/reports`,
  `/settings`.
- Navigation labels: **Planner**, **To-Do**, **History**, **Reports**, **Settings**.
  Budget planning lives inside the Planner; `/history` is a chronological ledger of
  completed income/expense records.

### FR-01a — First-run onboarding

- A new install starts with `settings.firstRunDone === false` and sees a full-window
  onboarding flow INSTEAD of the shell: no sidebar, no nav, no header. Only the custom
  title bar (so the window stays draggable) and the toast host remain mounted.
- Three value-pitch screens (Next / Back / "Skip introduction"; the last reads
  "Get started"), then a REQUIRED guided setup: at least one income source above zero,
  then at least two budgets with a limit above zero.
- Guided setup writes through the app's ordinary actions — `setIncomePlan`,
  `addCategory`, `addBudget` — never an onboarding-only path.
- `firstRunDone` is set to true only on "Finish setup". Step position persists
  separately (`onboarding:step`) so closing the app mid-flow resumes in place.
- Existing installs carry `firstRunDone: true` and are never re-onboarded.
- Full specification: `13_ONBOARDING_FLOW.md`.

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
- Budget status band: ONE card below the Summary KPI cards carrying the whole budget
  status — the health-score ring (`budgetHealth`), a derived "At risk"/"Good" pill, the
  over-limit flag (every over-limit category with its overage, from `overBudgetCategories`),
  the funding flag, and a "Review budgets" action that opens Budget Allocation. It replaced
  the separate alert banner, Needs Funding card and Budget Health card. Funding counts come
  from ONE shared selector (`fundingNeeds` in `lib/funding.ts`) that every funding surface
  consumes (status band, header status, insights). A category counts as needing funding when
  it has no budget for the month (or a limit of 0) OR when its unpaid upcoming expenses for
  the month exceed its budget limit (Missing = Target − Allocated > 0). The band is not
  rendered when no categories are configured.
- Budgets section (`#budget-allocation`): the ONE place the month's categories are listed
  with progress — a fixed-width donut card (segments + top-5 legend) beside the flexible
  category list (priority, limit, spent, remaining, progress, over-limit badge + overflow
  tick + danger tint, and three distinct row actions — edit budget (pencil, limit +
  priority, on EVERY row), allocate funds (arrows/exchange), delete) plus the
  "New budget" form; a funding bar
  shows how much of the allocatable income (received, not remaining cash) is committed,
  with a true percentage (no fake 100 %) and an "Over allocated" state when limits exceed
  income. The Planner no longer carries a separate expense-breakdown list.
- The on-demand allocation drawer (FR-11) and the budget health gauge (FR-14). There is no
  permanent "Allocate remaining" section on the page.
- Insights & recommendations (FR-13); the expense breakdown chart (FR-15) now lives on
  Reports only.
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

### FR-11 — Expense allocation sliders (on-demand drawer)

- Allocation is NOT a permanent section on the Planner. Nothing renders until the user asks
  for it: the `AllocationDrawer` is mounted on demand by a per-category trigger (a budget
  row's arrows/exchange action — the pencil beside it opens the budget edit form instead)
  or by the "Remaining" summary card's "Allocate remaining" picker, which
  lists the month's budgets and hands one to the same shared drawer.
- The drawer is per-category and always reads live store data at open time: title
  "Add funds to {category}", a close (X) button, and a body of —
  - an over-budget hint ("{category} is {overage} over its {limit} limit this month. Move
    money from a category with room to spare, or raise the limit.") when the target is over,
    otherwise "Choose how much to allocate to {category} from this month's unallocated funds.";
  - one "move funds from" row per OTHER month budget whose `available = limit − spent > 0`,
    each with the category name, its available amount, and a slider `0 … available`
    defaulting to 0. Categories with nothing available are never offered, and the whole
    subsection is omitted (no placeholder) when no category has room;
  - a dashed-border row raising the target's own limit, slider from the current limit to
    `limit + overage` (or `limit + max(unallocated, 1 unit)` when not over).
- Sliders are independent — moving one updates only its own value display. When the target is
  over budget the sum of all moves is clamped to the overage, so the moves can bring the
  target exactly to its limit and no further; a single move is additionally clamped to its
  source's `available`, so no source can go negative.
- Footer: "Cancel" (discards) and "Apply". Escape and a scrim click behave exactly like
  Cancel. Every open remounts the body from live data, so drafts never leak between opens.
- Apply dispatches one `updateBudget(id, { limit: limit − moved })` per contributing source
  and one `updateBudget(target, { limit: newLimit + totalMoved })` for the target — the same
  single persistence path as before — then closes and confirms with a toast. The affected
  rows' spent/left/limit re-render from the store; no reload.
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
- Reports "Category analysis" card (`CategoryAnalysisChart`) is the app's ONE category
  breakdown visualization; the Planner's Budgets section covers per-category budget
  progress. The former `ExpenseBreakdown` panel and `TopCategoriesChart` were removed.
  Per-category spending, ranked
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

### FR-19 — Rollover budgets (carry unspent funds forward)

- **Opt-in per category, off by default.** `Category.rollover` is absent unless the user
  turns it on; no migration, bulk action or heuristic ever sets it, and there is no global
  equivalent. A category that never opts in behaves exactly as it did before this feature.
- The switch lives on the budget edit form (limit + priority) as "Roll over unused funds",
  and is written through `setCategoryRollover(id, boolean)`. It is stored on the **category**,
  not on the month's `Budget`: budgets are created fresh each month, so a per-budget flag
  would silently switch itself off every month and break the chain.
- **Carry rule**, evaluated once per category at the transition into a new month:
  - Underspent and enabled -> `leftover = effectiveLimit(closing month) - spent`, added on
    top of the new month's base limit. Measuring against the *effective* limit is what makes
    rollover compound: funds carried in that also go unspent carry again.
  - Over the limit -> nothing carries, regardless of the setting. The new month starts at
    its base limit only. **A negative balance is never carried forward** — overspending does
    not compound into a shrinking budget. This is a deliberate choice; see ROADMAP.
- **Cap.** Accumulated carryover is capped at `ROLLOVER_CAP_MULTIPLIER` (currently `1`) times
  the destination month's base limit, so the effective limit never exceeds 2x base. Fixed
  constant for now, not user-configurable; every record persists the `cap` that was in force,
  so exposing or changing it later cannot rewrite settled months.
- **Timing.** No backend and no scheduler: `useRollover()` runs at mount from `AppShell` and
  detects the transition by noticing the current month has no carryover records yet. That
  same check is the idempotency guard, which is why no separate "last opened month" marker
  exists — a marker could drift out of sync with the records it describes.
- **Persistence.** Each computed carryover is a `RolloverRecord` keyed by (category, month),
  written once and never recalculated. A record is written even when nothing carries
  (overspent, or opted out), which seals the transition: flipping the switch mid-month cannot
  retroactively grant funds for a month already under way — it takes effect at the next
  month end.
- **Display.** Any row showing a boosted limit must show where it came from, never a silently
  bigger number: `RolloverBadge` renders "+X" in the category's own registry chip colours,
  with the full sum ("1,000 + 600 rolled over = 1,600") as its accessible label, and the row
  prints the base + carry breakdown under the headline figure.
- **Historical accuracy.** Reads go through `effectiveLimit()` / `budgetProgress()`, which
  consult the stored record only. A past month therefore keeps the limit it actually had,
  even if the source month's transactions are edited later or the cap default changes.
- **Known limitation (deliberate, out of scope).** Editing past transactions after a rollover
  has been computed does **not** reconcile the already-applied carryover; the settled record
  stands. Retroactive recalculation is not attempted.

### FR-20 — Debt payoff planning (avalanche vs snowball)

- **Opt-in per category, off by default.** A "Track as debt" switch on the category edit
  form reveals three fields: current balance, interest rate (optional, **0% is valid and
  expected** for informal/family loans) and minimum monthly payment.
- Available for ANY category, expense or income. Gatekeeping by kind would be a guess about
  the user's bookkeeping.
- **Stored as a separate `Debt` record linked one-to-one to the category** — NOT by
  overloading `Budget.limit`. A balance, a rate and a minimum describe an obligation that
  outlives a month; a budget limit is one month's spending allowance. Overloading them would
  make "limit" mean different things for different categories.
- A category with no linked `Debt` behaves exactly as it always has. This is purely additive.
- **Screen:** `/debt`, in the sidebar's **Analytics** section (see `14_DEBT_PAYOFF_SCREEN.md`).
- **Extra payment:** one editable amount, seeded from the Planner's "Remaining" figure
  (`monthFinance().remaining`) and never re-locked to it.
- **Two strategies, standard monthly amortization:**
  - *Avalanche* — extra goes to the highest interest rate first.
  - *Snowball* — extra goes to the smallest balance first.
  - Both maintain minimums on everything else, and both hold the monthly outlay constant at
    `sum(minimums) + extra`, so a cleared debt's minimum rolls onto the next debt.
  - Each reports total months, total interest, and a per-debt payoff order with the month
    each debt clears.
- **0% debts** keep their balance-based position under snowball and sink to the bottom under
  avalanche — there is no interest to front-load. Interest accrued on them is always 0.
- **Fewer than 2 debts → NO comparison.** With one debt the strategies are identical by
  definition, so the screen shows a single projection (months, interest) instead of two
  columns of the same numbers.
- **Active plan:** `settings.debtStrategy` records which projection to surface prominently.
  A display preference only — this app moves no money and automates no payment.
- **Deterministic by design.** `lib/debtPayoff.ts` is a pure module with no AI/LLM call, no
  network access and no per-use cost, kept separate from the UI so the amortization can be
  unit tested against known schedules. See ARCHITECTURE.md §3.4.
- A plan whose payments cannot outrun the interest is reported as **stalled** rather than
  given an invented payoff date.

### FR-21 — Savings streaks and badges (cosmetic)

- **"On track" is not redefined here.** A month qualifies iff the app's existing
  total-spent-versus-total-budgeted calculation says so: `budgetUtilizationSeries`
  (lib/selectors.ts), which already sums rollover-aware effective limits. `monthStatus`
  compares `spentTotal <= limit` on the RAW totals, never the rounded `pct` — at 100.4%
  the percentage rounds to 100 and would read as on track. That selector is only READ;
  nothing about budget health changed.
- **Three outcomes, not two.** `on-track` / `over` / `no-data`. A month with no budgets is
  not a month you stayed within budget, so it can never count by having nothing to fail;
  it breaks a run exactly as an overspend does.
- **The month in progress never counts.** The streak describes finished months only.
  Counting the current month would hand a free +1 to someone three days in, and would show
  a streak as broken mid-month for someone who will be inside their limits by the 31st.
  This is also what makes a brand-new user's first month behave correctly: it contributes
  nothing until it ends.
- **The streak is derived, never stored.** `streakStats` walks back from the last complete
  month on every read, so editing a past month corrects the count instead of leaving a
  stored counter that quietly disagrees with the ledger. It reports `current`, `longest`,
  and `onTrackMonths`.
- **Display:** one more flag inside the existing Budget status band — `"{n}-month streak"`
  with a sparkle icon — NOT a new card or section. Hidden at zero, except that the row
  persists as "{n} badges earned" when the user holds any, since it is the only way into
  the badges drawer.
- **Badges are data, not code.** `BADGES` in lib/streak.ts holds `{ id, name, icon,
  description, tier, criteria, reward }`. `criteria` is a DESCRIPTOR
  (`{kind: "first-on-track-month"}` or `{kind: "streak-months", months: N}`) interpreted by
  one shared evaluator, so adding a badge is a new array entry — no new component code, no
  new conditional. Launch set is deliberately four.
- **`reward` is reserved and always `null`.** Nothing reads it and there is NO
  reward-granting logic anywhere; badges are recognition only. See ARCHITECTURE §3.5.
- **Earned badges are persisted and never revoked.** Only the fact of earning is stored
  (`id`, `earnedAt`, `value`); wording and artwork stay in the definition list, so editing
  them needs no migration. Locked badges are shown greyed with what is still required —
  never hidden, so there is something visible to work toward.

### FR-22 — Learned categorization (shared engine)

Extends the existing learned-rules system (Prompt 6A) rather than replacing it.

- **Shared entry point.** `suggestCategory(input, rules, categories)` in
  `lib/learnedRules.ts` takes plain strings — `{ description, merchant?, provider?,
  direction? }` — not a statement row, so any caller can use it. The planned
  email-alert parser must call this (or the bare-string `suggestCategoryForText`)
  rather than growing a second copy of the learning. `activeRuleFor` is a thin
  enabled-only wrapper kept for the import pipeline.
- **Exact first, then fuzzy.** All exact key matches are tried across every signal
  before any fuzzy match, because an exact key is what the user actually corrected.
  Fuzzy matching is token-overlap (Dice) at `FUZZY_MATCH_THRESHOLD = 0.82`, resolved
  per signal so a fuzzy provider hit still beats a fuzzy description hit.
- **Pre-fill, never auto-finalize.** A mapping confirmed once (`strength` 1) pre-fills
  the category but leaves the row flagged for review; only an enabled rule
  (`RULE_MIN_STRENGTH` = 2) classifies without review. Either way the import batch is
  confirmed by the user, who can override any single row first.
- **Visible provenance.** A row pre-filled from a learned mapping shows a "Learned"
  chip beside its category select, with hover text explaining it came from a past
  correction and can be changed.
- **Override wins.** A correction naming a different category rewrites the existing
  mapping and re-baselines it (strength 1, disabled) — never two conflicting entries,
  and flip-flopping never leaves a confidently-wrong rule behind.
- **Usage tracking.** `lastUsedAt` is stamped when a pre-filled row is imported
  WITHOUT being overridden, so mappings that have gone quiet can be identified.
  Nothing expires automatically.
- **Management (Settings → Learned rules):** list, enable/disable, re-target the
  category, delete one, or clear the whole set (confirmed first).
- Deterministic throughout: no AI/ML, no network, no per-use cost.
- Manual (non-import) transaction entry is unchanged; this affects the import review
  flow and the Settings panel only.

### FR-24 — Email alert parsing (partial: parsing + vault landed, transport pending)

Full detail in `15_EMAIL_PARSING.md`. Summary:

- **Desktop only, and refuses elsewhere.** Credentials go through Electron
  `safeStorage` (OS keychain). In the browser build no OS-backed secret store is
  available to a page, so the feature reports unavailable rather than degrading to
  localStorage. Inside Electron, an unavailable keychain also blocks connection —
  there is NO plaintext fallback anywhere.
- **The renderer can never read the stored secret.** The IPC surface exposes
  available / set / status / clear and deliberately no "get"; decryption happens only
  in the main process at connection time.
- **Allowlist, not inbox.** Only mail from `ALERT_SENDERS` domains is parsed, matched
  exact-host-or-subdomain (never substring — `gtbank.com.attacker.example` must fail,
  and a test asserts it). Everything else is discarded at the sender check.
- **Nothing leaves the machine.** Parsing is local string work; no network, no AI. Only
  a 400-character snippet is retained, and only for an alert that failed to parse.
- **Read-only and draft-only.** It cannot send mail, move money or write to the ledger.
- **Per-institution templates are DATA** (`ALERT_TEMPLATES`), interpreted by one shared
  evaluator. Adding a bank is a new entry plus tests — never a new parsing function.
- **Parse failures surface, never vanish**: `needs-review` keeps whatever was read,
  names the missing fields, and carries the body snippet.
- **Reuses the existing engines directly** — `suggestCategory` for categories and
  `findDuplicateCandidates` for overlaps — then emits `ImportRow`s into the same
  `planImport` confirm step as statement import.
- **IMAP with an app-specific password**, not OAuth: the codebase had no OAuth pattern
  to build from, and shipping a client secret inside a desktop binary is worse than one
  revocable app password in the OS keychain.

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
  rollover?: boolean;  // FR-19 — opt-in; absent unless the user turned it on
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

interface RolloverRecord {  // FR-19 — one category's carryover into one month
  id: ID;
  categoryId: ID;
  month: Month;             // the month the funds carried INTO
  fromMonth: Month;         // always the month before `month`
  amount: number;           // minor units, >= 0; added to that month's base limit
  leftover: number;         // uncapped unspent balance at fromMonth's close
  cap: number;              // the cap in force when this was computed
  computedAt: string;       // ISO 8601
}

interface Debt {              // FR-20 — one per category, linked by categoryId
  id: ID;
  categoryId: ID;             // exactly one Debt per category
  balance: number;            // minor units, >= 0 (outstanding)
  startingBalance: number;    // minor units, >= 0; display-only progress figure
  aprBps: number;             // annual rate in integer BASIS POINTS; 0 = interest-free
  minimumPayment: number;     // minor units, >= 0
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}

interface EarnedBadge {       // FR-21 — append-only; an achievement is never revoked
  id: string;                 // matches a BadgeDefinition.id in lib/streak.ts
  earnedAt: string;           // ISO 8601
  value: number;              // the streak value when earned; context for a future perk
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
  firstRunDone: boolean;         // false until onboarding completes (FR-01a)
  debtStrategy: "avalanche" | "snowball"; // FR-20 — display preference only
}

interface AppState {
  version: 3;
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  recurrenceRules: RecurrenceRule[];
  incomePlans: IncomePlan[];   // FR-18
  rollovers: RolloverRecord[]; // FR-19 — append-only carryover history
  debts: Debt[];               // FR-20 — one per tracked category
  badges: EarnedBadge[];       // FR-21 — append-only; the streak itself is derived
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
| AC-01 | First visit seeds the default categories and leaves `firstRunDone` FALSE, so onboarding runs; the flag becomes true only when guided setup finishes (FR-01a) |
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
| AC-25 | The Planner's funding count is derived from the shared `fundingNeeds` selector (income categories and fully funded categories excluded): every month-scoped expense category with no budget or a limit of 0 counts immediately, and budgeted categories count while their upcoming obligations exceed their limit; the Budget status band shows "{n} categories need funding" while any remain and "Every category funded · Income covers expenses" once none do (and income covers expenses), and once a budget exists with a limit > 0 the category leaves the count |
| AC-26 | Rollover is off for every existing and newly created category; enabling it on one category leaves every other category untouched, and a category with it off carries nothing forward however much went unspent (identical to pre-FR-19 behaviour) |
| AC-27 | A category with rollover on that underspent month M has `limit − spent` added on top of month M+1's base limit, capped at 1x that base limit; a category that went over its limit in M carries nothing into M+1 and never a negative balance |
| AC-28 | Three consecutive underspent months compound up to the cap and then plateau at 2x base rather than growing without bound |
| AC-29 | Running the month transition again — on any later app open, or after past transactions are edited — creates no new record for a month already settled, so an applied carryover never changes |
| AC-30 | A budget row whose limit was boosted shows the carryover explicitly (a "+X" badge in the category's registry colours plus a "base + carry" breakdown), never a silently larger number; a row with no carryover shows no rollover marking |
| AC-31 | "Track as debt" is off for every category; enabling it writes a separate `Debt` record linked by `categoryId` and creates/changes NO budget, and a category without one behaves exactly as before |
| AC-32 | With 2+ debts the screen shows avalanche and snowball side by side; with exactly 1 it shows a single projection and no comparison; with 0 it shows an empty state |
| AC-33 | Avalanche targets the highest interest rate first and snowball the smallest balance first; both maintain minimums and hold the monthly outlay at `sum(minimums) + extra`, so a cleared debt's minimum rolls onto the next |
| AC-34 | A 0%-interest debt accrues zero interest, keeps its balance-based position under snowball, and sorts last under avalanche |
| AC-35 | An extra payment too small for quick progress still yields a finite projection; only a budget that cannot outrun the interest is reported as stalled, never given an invented payoff date |
| AC-36 | The extra-payment input starts from the Planner's "Remaining" figure and is freely editable, never re-locked to it |
| AC-37 | A month counts toward the streak iff the existing total-spent-vs-total-budgeted check passes; a month with no budgets counts as `no-data` and breaks the run rather than passing by default |
| AC-38 | The streak increments across consecutive qualifying months and resets to 0 on the first failure; the month in progress is excluded, so a new user's first month reads 0 until it ends |
| AC-39 | The streak appears as a flag inside the existing Budget status band ("{n}-month streak"), not as a new card, and is hidden at 0 |
| AC-40 | Badges are evaluated from `BADGES` data by one shared evaluator; the drawer lists earned AND locked badges, locked ones greyed with their remaining requirement |
| AC-41 | A badge already held is never re-granted or duplicated on a later launch, and stays earned after a streak reset; every badge's `reward` is `null` and nothing grants perks |
| AC-42 | An exact learned-key match suggests its category; EVERY learned mapping matches its own merchant, not only the first one of each signal kind |
| AC-43 | A near-miss key at or above `FUZZY_MATCH_THRESHOLD` suggests; below it, no suggestion is made at all |
| AC-44 | Correcting a row to a different category rewrites the existing mapping (one entry, newest choice) instead of creating a conflicting second one |
| AC-45 | Deleting a mapping in Settings, or clearing them all, stops it suggesting on later imports; other mappings are unaffected |
| AC-46 | A row pre-filled from a learned mapping shows a visible "Learned" indicator and is still overridable before the batch is imported |

## 8. Non-functional Requirements

| NFR | Target |
|-----|--------|
| Performance | Initial render < 1 s on a mid-range device; interactions update < 100 ms; lists ≤ 1000 rows render without virtualization |
| Offline | No runtime network requests; app works with network disabled |
| Accessibility | WCAG 2.1 AA: contrast, focus order, aria labels, reduced-motion support |
| Browser support | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| Data safety | Every mutation is persisted before the UI reports success |
