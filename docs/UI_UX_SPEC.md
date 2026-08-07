# Budget Planner — UI/UX Design Specification (Phase 5)

Status: Draft · Owner: Phase 5 · Deliverable of: `ROADMAP.md` Phase 5
Baseline: `PROJECT_SPEC.md` (Phase 1), `ARCHITECTURE.md` (Phase 2).

## 0. Design language

The app follows a **warm, minimal, desktop-tool aesthetic** (references: Linear, Arc,
Notion, Raycast, Cron). The rules that govern every screen:

1. **Warm neutral palette, not cool slate.** Page canvas is warm off-white
   `#f6f5f2`; text is warm near-black `#1a1a1e`; hairlines are `#e8e6e0`. No
   blue-gray tints anywhere.
2. **Hairlines over shadows.** Cards are flat surfaces defined by `border-border/70`
   hairlines and a barely-there `--shadow-card` (2% alpha). Nothing floats on big
   shadows except true overlays (menus, toasts, modals, tooltips).
3. **No "card soup".** Secondary content sits directly on the canvas or in the quiet
   treatment (`bg-canvas/40` + `border-border/50`). Surfaces are only raised where the
   user needs to grab something (summary cards, the Remaining card).
4. **Quiet color.** Brand/income/expense/warn accents are used sparingly — icon chips
   and dots, never background washes. Tinted fills stay at low alpha (`/0.08` icon
   chips, `/0.04–/0.05` insight rows, `/0.06` selected nav).
5. **Micro-interactions everywhere.** 150–200 ms `--ease-premium` (`cubic-bezier(0.22,
   1, 0.36, 1)`) transitions: hover lifts (`-translate-y-px` + `shadow-card-hover`),
   chevron rotation, hover-reveal row actions (`opacity-0 group-hover:opacity-100`,
   always visible under `max-sm`), scale-on-active buttons. All gated by
   `prefers-reduced-motion`.
6. **Type.** 15 px body base; 13 px `text-sm`; hero titles large with tight negative
   tracking (`tracking-[-0.03em]`); section headings are small-caps labels
   (`text-xs`, `uppercase`, `tracking-[0.08em]`, `muted/80`); table headers are plain
   `text-xs` semibold (no uppercase). Tabular figures (`tabular-nums`) for money.

## 1. Design tokens (Tailwind 4 `@theme` in `app/globals.css`)

```css
@import "tailwindcss";

@theme {
  /* color — light (dark overrides in html[data-theme="dark"]) */
  --color-brand-50..950: indigo scale;   /* primary brand: indigo */
  --color-ink: #1a1a1e;                  /* text primary (dark: #e8e8ea) */
  --color-muted: #71717a;                /* text secondary (dark: #9898a0) */
  --color-surface: #ffffff;              /* card bg (dark: #151517) */
  --color-canvas: #f6f5f2;               /* page bg, warm (dark: #0c0c0e) */
  --color-border: #e8e6e0;               /* warm hairline (dark: #26262a) */
  --color-income: #0f9d6d;               /* green (dark: #3fab83) */
  --color-expense: #e5484d;              /* red (dark: #e0778a) */
  --color-warn: #a85b0b;                 /* amber-700 (dark: #d9a441) */
  --color-danger: #e5484d;
  --color-overlay: #141417;

  /* typography */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.8125rem;                  /* 13 px — app-wide caption/table size */
  --text-base: 0.9375rem;                /* 15 px — body */
  --text-2xl: 1.5rem;                    /* chart values, predictions */
  --font-semibold: 600; --font-bold: 700;

  /* shape, elevation, motion */
  --radius-lg: 0.75rem; --radius-md: 0.5rem;
  --ease-premium: cubic-bezier(0.22, 1, 0.36, 1);
  --shadow-card: 0 1px 1px rgb(26 26 30 / 0.02);              /* near-flat */
  --shadow-card-hover: 0 2px 8px rgb(26 26 30 / 0.05), 0 12px 28px rgb(26 26 30 / 0.06);
  --shadow-pop: 0 4px 16px rgb(26 26 30 / 0.08), 0 24px 48px rgb(26 26 30 / 0.1);
}
```

Spacing scale: 4 px grid (`space-y-4` etc.). Focus ring:
`focus-visible:ring-2 ring-brand-500/50 ring-offset-2`. Rounded corners: cards/inputs
`--radius-lg`; icon buttons/segmented controls `--radius-md`.

### Shared chrome rules

- **Controls** (Input, Select, MonthPicker, search fields): `h-10`, `rounded-lg`,
  `border-border/80`, focus `ring-brand-500/20`. Native `<select>` uses the
  `select-premium` chevron (hand-drawn SVG, `app/globals.css`).
- **Range sliders** (`Slider`) use the `slider-premium` classes: 6 px filled track
  (brand), 18 px bordered thumb, fill transitions via `--slider-fill`.
- **Buttons**: `min-h-10` (md) / `min-h-9` (sm), `rounded-md`, 150 ms transitions,
  `active:scale-[0.98]`. Primary: `bg-brand-600 hover:bg-brand-500 active:bg-brand-700`.
- **Tint convention**: accent chips `bg-{tone}/[0.08]` with the tone as text color;
  selected/highlight rows `bg-brand-500/[0.06]`; insight rows `/0.04–/0.05`; icon
  chips `9×9` `rounded-xl` (or `rounded-full` for status circles).
- **Section headings**: `text-xs font-semibold uppercase tracking-[0.08em]
  text-muted/80` (SectionHeading component).
- **Row actions**: hidden on `sm+`, revealed on row hover/focus (`opacity-0
  group-hover:opacity-100`), always visible on mobile (`max-sm:opacity-100`).

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

- Summary cards: **Expected income** (label "Set expected income" until planned, then
  "Expected income"; value = planned total; hint shows `Received X · +Y to collect` (or
  `−Y over received`); Edit pill; clicking opens the Expected income modal), **Expenses**,
  **Net** (green if ≥ 0, red if < 0), **Remaining** (`max(0, net)` — the allocatable
  balance; amber when expenses exceed income). Each card: label (xs, muted), value
  (26 px, bold, tabular), 9×9 rounded-xl icon chip (`/0.08` tint), hairline border, no
  accent bar; cards lift 1 px on hover (`-translate-y-px` + `shadow-card-hover`).
- **Expected income modal** (FR-18): one card per income source — icon tile, "Income name"
  text input, icon picker button, remove action; "Expected" and "Received" amount inputs
  side by side; a "Difference" row below with the live status ("Not set yet" ·
  "Expected X · Y received · Z to collect" · "Collected in full" · "Exceeded by Z").
  "Add income source" button appends a blank source; Save persists per source (clearing
  both amounts removes the source). The modal lists only planned sources — nothing is
  auto-derived from categories.
- Over-budget alert: surface panel with a hairline border, warn icon chip (`/0.08`),
  listing categories > 100 % with "View budgets" link (anchor to the allocated table);
  hidden when none.
- **Needs Funding** checklist: derived from the shared `fundingNeeds` selector — every
  month-scoped expense category with no budget or a limit of 0 appears immediately, plus
  budgeted categories whose upcoming obligations exceed their limit. Rows sorted by
  Missing desc, then name. One row per category: icon chip, name, urgency, an
  Allocated/Needed/Missing trio with a thin progress bar, and a "Fund" button that opens
  the budget form with the category preselected and the limit prefilled with the missing
  amount (no prefill when there are no obligations). Once a budget with a limit > 0 is
  saved the row disappears (category moves to Allocated); with an existing budget, Fund
  scrolls to, highlights and focuses the budget row instead. Header shows a subtle warn
  chip with the count ("5 categories needing funding"). Empty state: "Everything is
  funded" — "Every expense category has a budget this month." Income categories never
  appear. Rows are rounded, `hover:bg-canvas/60`.
- Budget health card: score `N/100`, tier label (Healthy `≥ 80` green / Watch `50–79`
  amber / At risk `< 50` red), tier-colored gauge bar, and an over-count line ("N budgets
  over limit").
- **Allocated** table (one row per funded budget): category icon + name, priority badge,
  limit, spent, remaining, progress bar + %, edit/delete actions. Rows sorted by priority
  (high → medium → low). States: `0–100 %` brand; `100–120 %` amber; `> 120 %` red with ⚠
  icon and "Over by $X". Card header: "Allocated · MMMM YYYY" + "New budget" primary
  button, plus a funding bar ("Allocated $X of $Y allocatable", `allocatable = received`
  income, `committed = Σ limits`; the label "Remaining to allocate $Z" shows `allocatable −
  committed`; the percentage is always `committed / allocatable` — the same denominator as
  the text, never clamped; the visual bar is clamped at 100 %; when committed > allocatable
  the row flips to a warn "Over allocated" + the true percentage (e.g. 130 %) with a
  "Limits exceed the allocatable income" hint — 100 % is never faked). Empty state: "No
  budgets this month. Create your first budget to start tracking spending." (or fund one
  from Needs Funding).
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
  the action target. Tone accent: row background tint at low alpha (`/0.05` danger,
  `/0.04` warn/success, `bg-canvas` neutral) — no left border. Order is the FR-13
  deterministic order. Empty month → single neutral row "No data for this month".
- Expense breakdown: horizontal animated bars per expense category (icon, name, amount, %
  of total), bar fill = category color, ranked descending (FR-15). Amount and percentage
  form a right-aligned column beside each bar (amount on top, % underneath, tabular). The
  longest bar spans 80% of the track and shorter bars keep the same ratios. Hovering a row
  reveals a tooltip with Category, Amount, Percentage, Budget limit (or "Not budgeted"), and
  Spent — categories with a budget show a "X of Y" readout and turn red when over budget.
  More than five categories collapse to five behind a "Show N more categories" button that
  reveals the rest with an animated entrance; in the Planner's collapsed preview the button
  expands the panel. `role="img"` with values in the aria-label (AC-22).

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
  states). Deferred records show a small "Deferred" chip next to the category. Rows light up
  with a stronger `hover:bg-canvas` fill; date groups are separated by a small spacer row.
- Group headers ("Today", "Yesterday", "Last week", …) carry the group's running total as a
  prominent bold `text-ink` amount. The **Today** group gets a subtle brand accent (tinted
  band, colored label, small brand dot) so today stands out at a glance.
- Row actions (compact `sm` icon buttons, `aria-label`): edit, "Move to next month"
  (expense transactions only; income rows render an invisible fixed-width placeholder in the
  same slot so the delete icon stays perfectly aligned across every row), delete. Move →
  toast "Moved to MMMM YYYY".
- Transaction form (modal): type toggle (Income/Expense), amount, category (filtered by
  type), date (default today), note (optional, max 200 chars). Validation: amount > 0 and
  parseable, category required.
- Delete: `ConfirmDialog`; if transaction is a generated recurring instance, text explains
  "This deletes this month's copy only. The recurring rule stays."
- Empty states: no records at all → CTA "Add first record"; no matches for filters →
  "No transactions match your filters" + "Clear filters".

### 3.4 Reports `/reports`

Analytical-only page: no forms, no mutations, no Quick Add — just charts and numbers.
Composed to `docs/07_REPORTS_SCREEN.md` v2.0, in section order: **Monthly overview →
Financial insights → Spending trend → Category analysis → Income vs expenses →
Cash flow → Forecast → Recommendations → Detailed breakdowns**. Month picker in the
header defaults to the current month; the header also carries a **Compare month** toggle
(per-section current-vs-previous deltas) and an **Export** menu (CSV via `exportCsv`,
PDF via the print dialog, Print). Sections render with the small-caps `SectionHeading`;
sections and grids breathe at `gap-8`/`gap-6`. Every chart is a Recharts `ChartCard` in
the quiet treatment (canvas wash, hairline border) with a concise subtitle — **"Last 6
months"** for window charts, **"This month"** for month-scoped ones. Chart styling
(shared `chartStyles.ts` + `useChartColors`, which reads live CSS variables): hairline
dashed grid, 11.5 px muted ticks, 4 px bar radii, 1.75 px line strokes, subtle brand
area gradient (0.16 → 0), tooltips as surface panels with a hairline border. Each chart
uses `ResponsiveContainer`, exact-value tooltips (`formatMoney`), and `isAnimationActive`
off under `prefers-reduced-motion: reduce`. Category-colored charts use the shared
`categoryColor()` helper so they always match the Planner's category colors.

- **Monthly overview**: four KPI tiles — **Total income**, **Total expenses**,
  **Net savings**, **Savings rate** — each with a trend chip (green ▲ / red ▼ vs the
  previous month, from `monthFinance`); with Compare month on, a four-row compare strip
  (current vs previous, per metric).
- **Financial insights**: an editorial card — a large headline (savings delta, biggest
  spending move, or top category), a supporting paragraph (top category's share of
  spending, over-budget count), and up to 3 observation tiles (largest increase /
  decrease, top category, over-budget categories); `EmptyState` when there's no data.
- **Spending trend**: the dominant chart — tall (380 px) smooth brand area of total
  expenses per month, thick rounded stroke, soft gradient, minimal gridlines.
- **Category analysis**: top-6 donut (active segment full opacity, others dimmed on
  hover) with a center total + trend pill vs the previous month, beside a ranking list —
  per row: icon chip, name, amount, share %, animated progress bar; hovering a row
  highlights the segment.
- **Income vs expenses**: grouped bars per month (income green, expenses coral) with a
  thin **Net** brand line overlaid; legend chips.
- **Cash flow**: stacked flow bars per month — expenses floor, remaining stack on top
  (radius on the top segment), and a warn-colored **shortfall** segment when expenses
  exceed income; custom dark tooltip listing money in / out / remaining.
- **Forecast** (current month only; other months show a quiet explainer card): projected
  month-end balance (income/expense colored), a confidence badge (High ≥ 20 days in,
  Medium ≥ 10, else Early estimate), a pace paragraph, and a 64 px mini sparkline of the
  last 6 months' net.
- **Recommendations**: expandable rows (warnings / info / success), first one open by
  default, actions jump to the relevant screen (e.g. "View budget").
- **Detailed breakdowns**: only when the selected month has ≥ 2 months of history (else
  a hint card) — grid of Expected vs actual, Income sources, Income trend, Savings over
  time, Budget utilization, Top 5 categories, and the "Spending this month" breakdown.
- Empty states: a chart with no data in the window shows `EmptyState` instead of an
  empty axis. All charts `role="img"` with `aria-label`s containing exact values
  (AC-22). Mobile: sections and charts stack vertically; no chart is wider than the
  viewport (ResponsiveContainer handles reflow).

### 3.5 Settings `/settings`

Desktop-style preferences window (see `09_SETTINGS_SCREEN.md` v2.0): two-column layout
on desktop — left navigation (`280px`, 48 px items, `rounded-xl`, 20 px icons, 15 px
labels; hover soft gray, selected pastel accent tint + 1 px left indicator) and the
selected panel on the right; mobile gets a horizontal chip bar. Header: "Settings" /
"Customize your budgeting experience." with no actions. Panels:

1. **Profile** — large profile card: app icon tile, app name + version pill, storage
   mode (browser / desktop + SQLite path), current month, data counts, runtime
   (Electron/Chromium or web).
2. **Appearance** — Theme cards (light/dark/system with preview tiles), **Accent color**
   circular swatches (emerald/blue/indigo/amber/slate; hover grow, white ring when
   selected; persisted as `settings:accent`, applied via `data-accent` attribute that
   re-maps the whole `--color-brand-*` ramp, light + dark), **Motion** toggle ("Reduce
   animations", persisted as `settings:animations`, applied via `data-animations="off"`
   which short-circuits every transition/animation).
3. **Budget Preferences** — grouped setting rows: default currency select (USD/NGN),
   auto-generate recurring transactions toggle.
4. **Categories** — two cards (Expense / Income) with search + "New" button; premium
   list rows (icon tile, name, transaction count, hover-reveal edit/delete). Create and
   edit share one modal: large icon preview tile, Type segmented control (create only),
   name field, icon picker, preset color swatches; Delete button requests the confirm
   dialog from the manager. Empty state offers a CTA.
5. **Recurring** — recurring rules card (enable toggle, edit/delete, "New recurring"
   form modal) with empty state CTA.
6. **Income Sources** — current month's income plans as responsive cards (icon, name,
   expected, received, difference with status tone) with edit/delete; "Add source"
   modal (name, icon picker, expected/received amounts, live difference row); delete
   goes through a confirm dialog; saves per source via `setIncomePlan(month, id, patch)`.
7. **Data & Backups** — premium storage card: storage location, last backup, backup
   size; action buttons (Create backup, Restore latest [desktop], Export, Import, Open
   backup folder [desktop]); embedded `BackupsManager` (snapshots + file backups);
   Danger zone with typed-`RESET` confirmation.
8. **About** — app logo tile, name/version/build, runtime details (Electron/Chromium/
   Node or web), developer, license, updates note, and desktop folder paths.

Import still honors `?action=import` (used by `app/error.tsx`).

## 4. Component inventory

| Component | Props (required in bold) | Notes |
|-----------|--------------------------|-------|
| `Button` | **variant** (`primary`\|`secondary`\|`ghost`\|`danger`), **children**, `type`, `disabled`, `onClick`, `icon` | `min-h-10` (md) / `min-h-9` (sm), `rounded-md`, 150 ms `--ease-premium`, `active:scale-[0.98]`; primary: `bg-brand-600 hover:bg-brand-500 active:bg-brand-700`; secondary: surface bg, `border-border/80`, `hover:bg-canvas/60` |
| `Card` | **children**, `title?`, `action?`, `className?`, `variant?` (`standard`\|`quiet`\|`brand`) | Standard: surface, hairline `border-border/70`, `--radius-lg`, no shadow; quiet: `bg-canvas/40` + `border-border/50`; title row `px-5 pb-2 pt-4` (no divider) |
| `Input` | **label**, `name`, `type`, `value`, `onChange`, `error?`, `placeholder`, `maxLength` | `h-10`, `rounded-lg`, `border-border/80`, focus `ring-brand-500/20`; label visible; error text red-sm below; `aria-describedby` wired to error id |
| `Select` | **label**, **options**, `value`, `onChange`, `error?` | Same chrome as Input; `select-premium` chevron; options `{value, label}` |
| `Modal` | **open**, **onClose**, **title**, **children**, `footer?` | `rounded-2xl`, overlay `bg-overlay/40 backdrop-blur-[3px]`, `dialog-in` entrance; title 17 px; footer separated by hairline; `role="dialog" aria-modal`; focus trap; Esc closes; backdrop click closes; scroll locked |
| `Drawer` | **open**, **onClose**, **title**, **children** | Right slide-in `drawer-in`; title 15 px semibold |
| `ConfirmDialog` | **open**, **title**, **message**, **confirmLabel**, **onConfirm**, **onClose**, `danger?` | Renders via `Modal`; confirm button autofocus when `danger` |
| `Disclosure` | **id**, **title**, **children**, `variant?`, `badge?`, `action?`, `preview?`, `defaultOpen?` | Panel: hairline `rounded-xl`; header `px-5 py-3.5` `hover:bg-canvas/50`, chevron rotates 180°; body `list-in` entrance; state persisted via storage adapter |
| `ProgressBar` | **value** (0–1), `tone` (`brand`\|`warn`\|`danger`) | `h-1.5` rounded track `bg-ink/[0.06]`; `<div role="progressbar" aria-valuenow>` |
| `IconPicker` | **value**, **onChange**, `label?`, `className?`, `vectors?` (default `true`) | Combobox + modal grid picker: searchable, categorised, recents + favourites (localStorage `settings:recent-icons` / `settings:favourite-icons`), emoji + "Line icons" (vector) set, full grid/arrow-key/Enter navigation, live preview tile. `vectors={false}` restricts to emoji (used for categories). |
| `IconValue` | **value**, `className?` | Renders an icon string: emoji text or the matching vector component (see `iconLibrary`); falls back to `DEFAULT_ICON` for blank values. |
| `Badge` | **children**, `tone` | Income/expense/neutral |
| `EmptyState` | **title**, **description**, `action?`, `icon?`, `illustration?` | Icon tile `12×12` `rounded-2xl` `/0.08` tint (no shadow); centered, muted |
| `Toast` | **message**, `tone` (`success`\|`error`), `onDismiss` | `rounded-lg` + `shadow-pop`, `toast-in` 150 ms; auto-dismiss 3 s, `role="status"` |
| `MonthPicker` | **value**, **onChange** | `h-10` `rounded-lg` select with chevrons; "This month" shortcut |
| `Table` | **columns**, **rows**, `emptyText?` | `<table>` with `scope="col"` headers |
| `Slider` | **label**, **value**, **min**, **max**, **step**, **onChange**, `displayValue?` | Native `<input type="range">` with `slider-premium` styling (6 px filled track, 18 px bordered thumb); `aria-valuetext` = money value |
| `ToastHost` | — | Fixed bottom-right toast stack from `useToastStore`; `aria-live="polite"` |
| `BarChart` | **items** (`{label, value, max, color, valueLabel, pct?}`), `ariaLabel?` | Pure CSS horizontal bars (`h-2`), animated width (FR-15), `role="img"` |
| `SectionHeading` | **children**, `action?` | Small-caps label: `text-xs font-semibold uppercase tracking-[0.08em] text-muted/80` |
| `PageHeader` | **title**, **description?**, `action?` | Title `text-2xl` `tracking-[-0.02em]`, items-end baseline, description muted `text-sm` |
| `Slider` / chart swatches | — | Charts use `useChartColors()` (live CSS vars) + `chartStyles.ts` (hairline tooltips, 11.5 px ticks) |

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

Tint convention (low-alpha fills): icon chips `bg-{tone}/[0.08]`; selected nav/theme
`bg-brand-500/[0.06]`; insight rows `/0.05` (danger) and `/0.04` (warn, success);
empty-state illustration tiles `/0.08`. Solid washes (e.g. `bg-red-50`) are not used.

Contrast: body text `--color-ink` on white = ≥ 12:1; muted text on white = 4.6:1 (both ≥ AA).
Bar fill colors use 600-shade variants on white.

## 7. Motion

- Transitions: 150 ms (controls, rows, buttons) / 200 ms (disclosures, list rows) on the
  shared `--ease-premium` curve (`cubic-bezier(0.22, 1, 0.36, 1)`); small distance
  transforms (≤ 8 px translate, 3 % scale).
- Entrance keyframes (defined in `app/globals.css`): `page-in` (views, 4 px rise),
  `dialog-in` (modals, 3 % scale + 4 px rise), `drawer-in` (drawer slide), `menu-in`
  (dropdown menus, 3 px drop), `toast-in` (8 px rise), `list-in` (list rows, 3 px rise,
  stagger via `animation-delay` up to 40 ms).
- Micro-interactions: interactive cards lift 1 px on hover (`shadow-card-hover`);
  chevrons rotate 180°; row actions reveal on group hover; buttons `active:scale-[0.98]`;
  slider thumbs scale to 1.15 / 1.3 on hover / drag.
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
