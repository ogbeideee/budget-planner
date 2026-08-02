# Budget Planner — UI/UX Design Specification (Phase 3)

Status: Draft · Owner: Phase 3 · Deliverable of: `ROADMAP.md` Phase 3
Baseline: `PROJECT_SPEC.md` (Phase 1), `ARCHITECTURE.md` (Phase 2).

## 1. Design tokens (Tailwind 4 `@theme` in `app/globals.css`)

```css
@import "tailwindcss";

@theme {
  /* color */
  --color-brand-50..950: sky scale;      /* primary brand: sky */
  --color-ink: #0f172a;                  /* text primary */
  --color-muted: #64748b;                /* text secondary */
  --color-surface: #ffffff;              /* card bg */
  --color-canvas: #f8fafc;               /* page bg */
  --color-border: #e2e8f0;
  --color-income: #16a34a;               /* green */
  --color-expense: #dc2626;              /* red */
  --color-warn: #d97706;                 /* amber-600 */
  --color-danger: #dc2626;

  /* typography */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-2xl: 1.5rem; --text-3xl: 1.875rem;
  --font-semibold: 600; --font-bold: 700;

  /* shape & elevation */
  --radius-lg: 0.75rem; --radius-md: 0.5rem;
  --shadow-card: 0 1px 3px rgb(15 23 42 / 0.08);
  --shadow-pop: 0 10px 25px rgb(15 23 42 / 0.15);
}
```

Spacing scale: 4 px grid (`space-y-4` etc.). Focus ring: `focus-visible:ring-2 ring-brand-500
ring-offset-2`. Rounded corners: cards `--radius-lg`, inputs/buttons `--radius-md`.

## 2. Layout shell

- `≥ 1024px`: fixed left sidebar (240 px) with logo, nav links, and app version; content
  area max-width 1152 px centered, padded 24 px.
- `< 1024px`: top header (logo + title) and bottom tab bar with 5 tabs: Planner, To-Do,
  History, Reports, Settings. Icons with text labels; `aria-current="page"` on active.
- Active nav item: brand background tint + brand text; inactive: `text-muted hover:bg-canvas`.
- The **Planner** is the landing page (`/`) and the primary experience; every other page
  exists to support it.
- Sticky month selector: on Planner/History/Reports, a `MonthPicker` sits in the header row
  with a ← / → chevron and "This month" shortcut. Shared state via `useMonth` hook (URL
  param `?month=YYYY-MM`, default current month).

## 3. Page specifications

### 3.1 Planner `/` (primary screen)

The Planner is the month's workspace, not a dashboard: it moves the user from "what still
needs money" → "what is allocated" → "how the month is going".

Layout (desktop): header row (title + month picker) → 4 summary cards in a row →
over-budget alert → workspace grid: **Needs Funding** checklist (2/3 width) + budget
health card (1/3 width) → **Allocated** budget table (full width, with funding bar) →
"Allocate remaining" sliders panel → grid: Quick Add Expense (1/2 width) + Deferred
expenses (1/2 width) → grid: Insights (1/2 width) + expense breakdown (1/2 width).

- Summary cards: **Income** (monthly income), **Expenses**, **Net** (green if ≥ 0, red if
  < 0), **Remaining** (`max(0, net)` — the allocatable balance; amber when expenses exceed
  income). Each card: label (sm, muted), value (2xl, bold), 8 px icon chip.
- Over-budget alert: `card bg-red-50 border-red-200` listing categories > 100 % with
  "View budgets" link (anchor to the allocated table); hidden when none.
- **Needs Funding** checklist: the month's expense categories with no budget or a limit
  of 0, sorted by name. One row per category: icon chip, name, and a "Fund" secondary
  button that opens the budget form with the category preselected. Once a budget with a
  limit > 0 is saved the row disappears (category moves to Allocated). Header shows the
  count ("3 categories need funding"). Empty state: "Everything is funded — nice." with a
  ✓ tone. Income categories never appear.
- Budget health card: score `N/100`, tier label (Healthy `≥ 80` green / Watch `50–79`
  amber / At risk `< 50` red), tier-colored gauge bar, and an over-count line ("N budgets
  over limit").
- **Allocated** table (one row per funded budget): category icon + name, priority badge,
  limit, spent, remaining, progress bar + %, edit/delete actions. Rows sorted by priority
  (high → medium → low). States: `0–100 %` brand; `100–120 %` amber; `> 120 %` red with ⚠
  icon and "Over by $X". Card header: "Allocated · MMMM YYYY" + "New budget" primary
  button, plus a funding bar ("$X of $Y committed", `committed = Σ limits`, `Y =
  max(0, net)`; bar clamped at 100 %, amber when committed > Y). Empty state: "No budgets
  this month. Create your first budget to start tracking spending." (or fund one from
  Needs Funding).
- **Allocate remaining** panel (below the table): shown when the selected month has ≥ 1
  budget and `net > 0`; otherwise hidden, or disabled state "Nothing left to allocate —
  expenses equal or exceed income this month." Panel header: "Allocate remaining — $X
  left". One `Slider` per budget row: category icon + name, slider `0 … remaining` (step
  100 minor units), allocated value (money), share of remaining (%). Footer: "Unallocated:
  $X" + "Apply allocations" (primary, disabled when total = 0) + "Reset" (ghost, disabled
  when total = 0). Apply → toast "Allocated $X across N budgets".
- **Quick Add Expense** card: category select (expense categories), amount input with
  live `formatMoney` preview (AC-14), date input (defaults today), note (optional, max 200
  chars), "Add expense" primary button. Success → toast; amount/note clear, category and
  date retained. Validation errors inline (amount parseable and > 0, category required).
- **Deferred expenses** card: one row per deferred expense — category icon, note or
  category name, date, amount (expense color); footer total. "View in History" link →
  `/history?month=YYYY-MM`. Empty state: "Nothing was deferred into this month."
- Insights panel: card titled "Insights"; one row per insight — tone icon (⚠ danger/warn,
  ✓ success, • neutral), bold title, muted detail, optional link button (small ghost) to
  the action target. Tone accent: 4 px left border in the tone color. Order is the FR-13
  deterministic order. Empty month → single neutral row "No data for this month".
- Expense breakdown: horizontal animated bars per expense category (icon, name, amount, %
  of total), bar fill = category color, ranked descending (FR-15). `role="img"` with
  values in the aria-label (AC-22).

### 3.2 To-Do `/todo`

- Header row: month picker.
- Single card "To do" listing the month's actionable items in deterministic order
  (danger → warn → neutral → success): over-budget categories, spending exceeding income,
  unallocated funds, spending category without a budget, deferred expenses waiting in the
  month. Each row: tone icon, bold title, muted detail, link button to the resolving page
  (Planner `/` or History `/history`).
- Empty state: "Nothing to do — you're all set for this month."
- Items derive from `todoFor(state, month)` (FR-17); tone + styling reuse the insight card
  pattern.

### 3.3 History `/history`

- Chronological ledger of completed income/expense records.
- Header: "New record" button; filter bar: month picker, type select (All/Income/
  Expense), category select (All/…), search input (matches note, case-insensitive),
  sort select (Date newest first (default) / Date oldest first / Amount high→low /
  Amount low→high).
- Filters persist to URL (`?month=&type=&category=&q=&sort=`); page param `&page=N`.
- Table: Date | Category | Note | Amount (right-aligned, colored by type) | Actions.
  Sorted date-desc, 25/page with pagination footer (Prev / "1 of N" / Next; disabled
  states). Deferred records show a small "Deferred" chip next to the category.
- Row actions (icon buttons, `aria-label`): edit, "Move to next month" (expense
  transactions only; income rows show edit/delete only), delete. Move → toast "Moved to
  MMMM YYYY".
- Transaction form (modal): type toggle (Income/Expense), amount, category (filtered by
  type), date (default today), note (optional, max 200 chars). Validation: amount > 0 and
  parseable, category required.
- Delete: `ConfirmDialog`; if transaction is a generated recurring instance, text explains
  "This deletes this month's copy only. The recurring rule stays."
- Empty states: no records at all → CTA "Add first record"; no matches for filters →
  "No transactions match your filters" + "Clear filters".

### 3.4 Reports `/reports`

Analytical-only page: no forms, no mutations, no Quick Add — just charts and numbers.
Month picker in header defaults to the current month; every chart covers the 6-month
window ending at the selected month (5 previous months + selected). Charts render with
**Recharts** inside `ChartCard`s (Card + title + optional subtitle); each chart uses
`ResponsiveContainer` (height ≈ 260 px), `CartesianGrid` (light), X axis with short month
labels ("Aug 26"), Y axis with compact money ticks (`$1.2K`), exact-value tooltips
(`formatMoney`), and `isAnimationActive` off under `prefers-reduced-motion: reduce`.

- **Snapshot** (selected month): two stat cards — **Savings** (`net`, green when ≥ 0, red
  otherwise) and **Remaining balance** (`max(0, net)`). Compact, below the header.
- **Income vs expenses**: grouped vertical bars per month (income brand-green, expenses
  expense-red), legend.
- **Monthly spending trend**: area/line of total expenses per month, brand color, smooth
  curve.
- **Savings & remaining**: two lines per month (savings ink, remaining brand), zero line
  visible.
- **Budget utilization**: bars per month = `spent / total limits` (%); months without
  budgets are omitted; Y axis is % (0–100, at least the max).
- **Top 5 categories**: horizontal bars (vertical layout) ranked desc over the whole
  window, one row per category — icon + name, amount, % of window total; bar fill =
  category color.
- Empty states: a chart with no data in the window shows `EmptyState` ("No data for this
  window…") instead of an empty axis. All charts `role="img"` with `aria-label`s
  containing exact values (AC-22). Mobile: snapshot cards and charts stack vertically;
  no chart is wider than the viewport (ResponsiveContainer handles reflow).

### 3.5 Settings `/settings`

Sections as cards:

1. **Categories** — list rows: icon (editable via emoji text input), name input, kind badge,
   color swatch (native `<input type="color">`), delete button. "Add category" button appends
   a row in edit mode. Delete in use → `ConfirmDialog` blocked with explanation (AC-11).
2. **Recurring transactions** — list of rules with enable toggle, edit, delete; "New recurring"
   opens form modal: type, amount, category, frequency select, anchor date, note.
3. **General** — currency select (USD / NGN); symbol preview (`$` / `₦`) shown next to it.
4. **Data** — "Export data" (download), "Import data" (file input, inline error slot), "Reset
   all data" (two-step confirm: first modal, then confirm-text dialog typing `RESET`).
5. URL param `?action=import` auto-opens the import file picker (used by `app/error.tsx`).

## 4. Component inventory

| Component | Props (required in bold) | Notes |
|-----------|--------------------------|-------|
| `Button` | **variant** (`primary`\|`secondary`\|`ghost`\|`danger`), **children**, `type`, `disabled`, `onClick`, `icon` | Primary: brand bg, white text; secondary: white bg, border; danger: red bg |
| `Card` | **children**, `title?`, `action?`, `className?` | White bg, `--radius-lg`, `--shadow-card`, title row |
| `Input` | **label**, `name`, `type`, `value`, `onChange`, `error?`, `placeholder`, `maxLength` | Label visible; error text red-sm below; `aria-describedby` wired to error id |
| `Select` | **label**, **options**, `value`, `onChange`, `error?` | Options `{value, label}` |
| `Modal` | **open**, **onClose**, **title**, **children**, `footer?` | `role="dialog" aria-modal`; focus trap; Esc closes; backdrop click closes; scroll locked |
| `ConfirmDialog` | **open**, **title**, **message**, **confirmLabel**, **onConfirm**, **onClose**, `danger?` | Renders via `Modal`; confirm button autofocus when `danger` |
| `ProgressBar` | **value** (0–1), `tone` (`brand`\|`warn`\|`danger`) | `<div role="progressbar" aria-valuenow>` |
| `Badge` | **children**, `tone` | Income/expense/neutral |
| `EmptyState` | **title**, **description**, **action?** | Centered, muted |
| `Toast` | **message**, `tone` (`success`\|`error`), `onDismiss` | Auto-dismiss 3 s, `role="status"` |
| `MonthPicker` | **value**, **onChange** | ← chevron / current / → chevron |
| `Table` | **columns**, **rows**, `emptyText?` | `<table>` with `scope="col"` headers |
| `Slider` | **label**, **value**, **min**, **max**, **step**, **onChange**, `displayValue?` | Native `<input type="range">`; 44 px touch target; `aria-valuetext` = money value |
| `ToastHost` | — | Fixed bottom-right toast stack from `useToastStore`; `aria-live="polite"` |
| `BarChart` | **items** (`{label, value, max, color, valueLabel, pct?}`), `ariaLabel?` | Pure CSS horizontal bars, animated width (FR-15), `role="img"` |

Planner/history/to-do/txn modules live under `components/planner/`,
`components/history/`, `components/todo/`, `components/txn/` — see `ARCHITECTURE.md` §2
for the full tree. Page-specific components: `PlannerView`, `QuickAddExpense`,
`DeferredSection`, `BudgetHealthCard` (planner); `HistoryView` (history); `TodoView`
(todo).

All `on*` handlers use `aria` labels on icon-only buttons (e.g. `aria-label="Delete
transaction"`).

## 5. Forms — shared rules

- Labels always visible (no placeholder-as-label).
- Errors: red text, 14 px, below field; first errored field focused on submit.
- Amount inputs: `inputMode="decimal"`; live format hint shows `formatMoney` preview below
  the field (AC-14).
- Submit disabled while invalid; `onSubmit` prevents default.
- Modal forms close only on explicit cancel/success (not on backdrop blur).

## 6. Colors & semantic states

| State | Background / accent | Text |
|-------|---------------------|------|
| Success / income | `--color-income` | white on chip; ink elsewhere |
| Expense | `--color-expense` | amounts red |
| Warn (100–120 %) | `--color-warn` | amber text + bar |
| Danger (> 120 %) | `--color-danger` | red text + bar |
| Muted | `--color-muted` | secondary text |

Contrast: body text `--color-ink` on white = ≥ 12:1; muted text on white = 4.6:1 (both ≥ AA).
Bar fill colors use 600-shade variants on white.

## 7. Motion

- Transitions ≤ 150 ms ease-out; modals fade+scale in 120 ms.
- Progress bars and chart bars: width transition ≤ 150 ms ease-out. Mount animation is a
  two-pass rAF (`width: 0` → target) so bars grow into place once, on first paint (FR-15).
- Respect `prefers-reduced-motion: reduce` — disable all non-essential animations via
  Tailwind `motion-reduce:` variants or a global media query (AC-22).
- No infinite animations, no parallax, no carousel autoplay.

## 8. Accessibility requirements (maps to AC-15)

1. Logical tab order: header/sidebar → main → footer. Main content region has `id="main"`
   with skip link ("Skip to content") in `layout.tsx`.
2. All interactive elements: visible focus ring, focusable via keyboard, `aria-label` where
   no visible text.
3. `Modal` traps focus; restores focus to trigger on close.
4. `role="alert"` on form error summary and import errors; `aria-live="polite"` on toast
   container and dashboard totals.
5. Progress bars expose `aria-valuenow`/`aria-valuemax` (100).
6. Touch targets ≥ 44 × 44 px (bottom nav items, icon buttons).
7. `lang="en"` on `<html>`; all text in English.
8. Check contrast of every text/background pair against §6 before merging.
9. Sliders are native range inputs: keyboard-operable (arrows), visible focus ring,
   `aria-valuetext` carries the formatted money value (AC-22).
10. Charts expose `role="img"` with an `aria-label` stating the exact values; individual bars
    are decorative (`aria-hidden`). Toast stack is `aria-live="polite"`. Insight cards are
    static text (no alert semantics).
