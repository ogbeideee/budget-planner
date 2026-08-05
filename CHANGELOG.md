# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] — Reports anti-busy pass

### Design
- Chart cards switch to the calm quiet treatment (canvas wash, hairline border, no shadow)
  so charts stop competing with each other; only the Financial snapshot tiles stay raised,
  on a softened app-wide `--shadow-card`.
- Breathing room: page gap `gap-6`→`gap-8`; every section is a `flex flex-col gap-6`
  layer; chart grids `gap-4`→`gap-6` (snapshot `gap-5`).
- Section titles are larger (`SectionHeading` `text-xs`→`text-sm`).
- Every chart carries a concise subtitle — "Last 6 months" for window charts (Income vs
  expenses, Income trend, Monthly spending trend, Savings, Budget utilization, Top
  categories), "This month" for month-scoped ones (Expected vs actual, Income sources), and
  "By category" for the Spending-this-month card.

### Code refactors
- `ChartCard` renders with the quiet `Card` variant; `ReportsInsights` quietened to match.
- New shared `categoryColor()` + `CATEGORY_COLOR_FALLBACK` in `lib/accents.ts`, used by
  Planner `ExpenseBreakdown` and Reports `TopCategoriesChart`, so every category-colored
  chart matches the Planner palette.

## [Unreleased] — Timeline polish

### Design
- Rows light up with a stronger `hover:bg-canvas` fill and date groups gain breathing room
  via an 8px spacer row between them.
- The **Today** group is highlighted with a subtle brand accent: a tinted header band, a
  colored label and a small brand dot.
- Running group totals (Today ₦…, Last week ₦…) are now prominent — `text-sm font-bold`
  ink amounts (brand-colored for Today).
- Row action icon buttons were reduced to the compact `sm` size; income rows render an
  invisible fixed-width placeholder in the "Move to next month" slot so Edit and Delete stay
  perfectly aligned across every row.

### Code refactors
- `TransactionRow` row actions switch to `size="sm"`; `TransactionList` group headers get
  the Today accent, prominent totals and inter-group spacer rows.

## [Unreleased] — Expense breakdown v2

### Design
- Percentage now sits in a cleaner right-aligned column beside each progress bar (amount on
  top, percentage underneath, tabular numerals); the longest bar is capped at 80% of the track
  while shorter bars keep the same proportions.
- Hovering a row reveals a tooltip with Category, Amount, Percentage, Budget limit (or "Not
  budgeted") and Spent — categories with a budget show a "X of Y" readout that turns red when
  over budget.
- More than five categories collapse to five behind a "Show N more categories" button
  (replacing the plain-text "N more categories when expanded" footer); clicking it reveals the
  rest with an animated entrance. In the Planner's collapsed preview the button expands the
  panel.

### Code refactors
- `BarChart` gains optional `budget` / `spent` / `overBudget` item fields, a capped 80% bar
  width, per-row hover tooltips and an `animateFrom` prop for animated row entrances;
  `ExpenseBreakdown` owns the collapse-after-five state and an optional `onExpand` hook.

## [Unreleased] — Refinement pass · income planning & insight reports

### Income by source
- Income is now planned per category instead of a single monthly figure: each income category (Salary, Business, Freelancing, Forex, Bonus, Rental Income) tracks Expected, Received, and Difference.
- New `Expected income` modal on the planner lists every income source with its received amount and a live "+X to collect / −X over received" delta; per-source expected inputs validate amounts, prefill saved values, and clear on empty save.
- Planner income card shows expected income with a received/difference hint; the Net summary modal now breaks out Received income, Expected income, Difference, Expenses, and Net.
- State schema advanced to version 2 with an `incomePlans` collection; version 1 states migrate automatically — the old tagged monthly-income transaction converts into an income plan, and missing standard income categories are backfilled.

### Reports as an insight page
- Reports rebuilt into a structured dashboard: Financial snapshot (Net / Income / Expenses / Savings rate), Income (expected vs actual, income sources, income trend), Spending & savings (income vs expenses, spending trend, savings, top categories), Budget health, Insights, Predictions, and Spending this month.
- New charts: Expected vs actual (grouped bars), Income sources (horizontal ranked bars with category colors), and Income trend (expected dashed vs received line over six months).
- Predictions card (current month): day count, average daily spend, projected month-end spending, and projected savings, all pace-based.
- Trends card: biggest spending increase/decrease between months, savings movement, highest-cost category, and over-budget alerts.
- Export menu with PDF (via print dialog), CSV (downloads the six-month window), and Print; print CSS hides nav/headers and keeps cards intact on paper.
- Charts fall back to informative placeholders when there isn't enough history; a banner calls out when fewer than two months of data exist.

### Upcoming expenses
- Bug fix: editing an upcoming expense now preloads every field and updates the existing expense instead of opening a blank form (and the old flow could create duplicates).
- Per-row overflow menu: Mark as paid (creates the expense transaction on its due date, marks it paid, and updates the planner), Reschedule (new due date), Skip month / Postpone (moves to next month), Edit, and Delete with confirmation.
- Empty state now explains the flow and links to planning.

### Allocation drawer
- "Allocate remaining" opens in a new right-side Drawer (max 420px, full-width on mobile, internally scrollable) instead of a modal; backdrop click and Escape both close it, with focus trapped inside while open.
- Allocation cards show icon tile, current allocation, spent, and remaining, an animated slider with a "Projected limit" readout after moving, the available pool, and Clear / Reset / Apply actions.

### Polish
- Planner header simplified to "August 2026 Budget", the current weekday/date, and one projected month-end balance line.
- Better empty states across Recurring, Upcoming, Reports, History, and Budgets.
- Shell chrome (sidebar, header, bottom nav) excluded from print output.

### Code refactors
- `Drawer` component added; `Card`/`Disclosure` variants (`quiet`, `brand`) from the earlier pass now used consistently; new icons: CalendarClock, Forward, Print, Download, FileText, TrendDown.
- New libs: `lib/predictions.ts` (monthly pace projections) and `lib/reportTrends.ts` (trend deltas, highest category, history depth); selectors gain income-plan breakdowns and income trend series.
- `MonthlyIncomeModal` replaced by `IncomeModal`; `setMonthlyIncome` replaced by `setIncomePlan` in the store; deleting an income category used by plans is guarded.

## [Unreleased] — Settings · consumer polish

### Design
- Settings page rebuilt as a scannable dashboard: a sticky, chip-style anchor nav (General / Appearance / Budget / Categories / Recurring / Data / About) scrolls along under the mobile header, and every section is reachable by hash link with proper scroll offsets.
- Theme selector upgraded to a card-style radio group: each option (Light / Dark / System) is a selectable card with an icon tile, label, and circular check indicator; the compact pill toggle remains for the header and sidebar.
- Category manager refined: income/expense groups collapse independently (state persists per device), instant search filters across categories, rows carry icon tiles tinted with the category color, premium income/expense pills, usage subtitles ("N transactions · N budgets" or "Unused"), and a hover-only overflow menu (Edit / Delete) that dismisses on outside click or Escape. Deleting is still guarded for in-use categories.
- Recurring transactions list polished: category color chips, frequency + start-date meta, a proper empty state with a "Create a rule" CTA, and Edit / Delete actions that appear on hover; the auto-generate setting is now a real accessible switch.
- Budget, Data, and About sections recede as quiet panels; About gains a brand tile with a local-storage note, and General / Appearance sit side by side on desktop.

### UX
- Rule rows expose the same premium affordances as categories: inline icons for Edit and Delete, tabular numerals for amounts, and a confirm dialog before deleting a rule.
- Reset flow unchanged but now reachable from the Data section with its own quiet panel and typed RESET confirmation.

### Motion
- Category overflow menus animate in with a new `menu-in` keyframe (fade + rise + settle) on the premium easing.

### Code refactors
- `ThemeToggle` gains a `variant` prop (`compact` | `cards`); `Card` gains an `id` prop for anchor navigation; `MoreHorizontalIcon` added to the icon set.
- `CategoryManager` fully rewritten: inline edit/add forms (icon, color, name, kind), instant search, collapse persistence, and menu state scoped per open menu.

## [Unreleased] — Presentation pass · de-templating

### Design
- Planner KPI row rebuilt from a uniform 4-card grid into an asymmetric editorial composition: a dominant "Remaining" hero card (2×2 on desktop) with a brand gradient wash, larger 4xl value, and a live "committed of allocatable" funding bar; Income and Expenses shrink to compact cards; Net anchors the bottom-right as a wide card.
- Reports KPI strip de-striped: Income and Expenses are two compact cards, and Net becomes a wide hero bar with the Savings rate inline behind a hairline divider.
- Settings no longer reads as four identical stacked cards: General is a quiet panel (hairline + canvas tint) with a two-column currency/theme split, Categories and Recurring sit side by side (3/5 + 2/5), and Data is a quiet panel at the bottom. A duplicate leftover General card was removed.
- Upcoming page: the repeated per-group cards merged into one continuous list with in-band group headers showing each group's total; "Paid" recedes into a quiet inset panel with strikethrough rows, read as an archive.
- Planner section rhythm differentiated: Budgets is the anchor panel (brand-tinted border, larger radius), Expense breakdown recedes to a quiet hairline panel, the rest stay standard — strong / standard / quiet hierarchy instead of identical chrome everywhere.
- Insight rows are now tone-tinted (danger/warn/success/neutral washes) so urgency is legible at a glance.

### Code refactors
- `Disclosure` and `SummaryCard` gain a `className` escape hatch so section chrome can vary per role.

## [Unreleased] — 1.0 product polish sprint

### Design
- Header cleanup: the greeting, floating month-picker row, and "Edit income" button are gone; the header is now the month name + year in 3xl/4xl, one status line ("₦21,000 remaining this month" / "short this month" / "Set your monthly income…"), and the month picker right-aligned.
- Dark mode overhaul: new dark palette (`ink #e3e6ec`, `muted #8f97a3`, `surface #17191e`, `canvas #0e1013`, `border #262b33`, income/expense softened to `#3fa98a` / `#e0778a`), dark shadows rebuilt with an inset top highlight for a premium "lit edge", and `--color-overlay` now defined in dark. Hardcoded red/amber over-budget row tints replaced with semantic `bg-danger/10` / `bg-warn/10`.
- Premium sliders: new `slider-premium` styling (thin 8px track, gradient fill driven by a `--slider-fill` custom property, branded thumb that scales and rings on hover/focus).
- Allocate remaining rebuilt as per-category cards: icon chip, current limit, live amount readout, filled slider, "% of remaining" + Clear affordance, and a "left to allocate / unallocated" footer that updates as you drag.
- Theme selector buttons gained custom hover tooltips (CSS-only, `role="tooltip"`, on hover and keyboard focus).
- Settings regrouped as General → Categories → Recurring transactions → Data; categories now live in a dedicated CategoryManager that shows per-category usage counts ("3 transactions · 2 budgets") and disables Delete for in-use categories.

### UX
- Intelligent recommendations: new insights — "Budget almost exhausted" (≥80% spent), "Spending is up this month" (category vs last month), "recurring bills due this week", "N categories need funding" (≥3), and "No issues detected this month" when everything is steady; the old "Next month starts on a Friday" filler is gone.
- Needs funding: rows are urgency-sorted and badged (Critical ≤3 days / Due soon ≤14 days / Low priority) with an attention-only preview showing just Critical + Due soon plus a "View all N categories" button.
- Expense breakdown: single consistent scale — the biggest category always renders full-width, hidden categories don't distort the chart; a footer totals "N more categories when expanded" plus the real Total, and empty states now carry a helpful tip.
- Timeline: the filter bar (month, type, category, sort, search, New record) is sticky under the header; on mobile, row actions collapse behind an expanding chevron row (Edit / Move / Delete).
- Reports: KPI strip is exactly Income / Expenses / Net / Savings rate; "Things to know" now includes recurring-due warnings; reports page reads as a proper dashboard.
- Upcoming: groups are now Overdue / Today / Tomorrow / This week / Next week / Later — weekday names merged into "This week" (grouping lib + tests updated).
- Empty states: Budget list gets a "Create a budget" CTA, timeline gets illustration + contextual CTA (Clear filters / New record), all states consistently use the 64px illustration tiles.
- Duplicate loan/debt accent removed from `lib/accents.ts`.

### Motion
- Button transitions consolidated onto one `transition-all` base so shadow, border, color, opacity and the press scale animate with the premium curve.

## [Unreleased] — Progressive disclosure pass

### Design
- Planner re-architected around progressive disclosure: the page opens with the header, summary cards, recommendations, and a Needs funding summary; everything else — Month at a glance, Budgets, Quick add, Deferred expenses, and Expense breakdown — collapses behind accessible headers that expand on click.
- Collapsed previews surface the essentials: Month at a glance shows Largest expense / Savings rate / Projected remaining; Expense breakdown shows the top 5 categories; Needs funding lists the first 3 categories with a "View all" button; Recommendations collapses to the top insight; the timeline previews the most recent 5 records; upcoming previews the next 3 expenses.
- Section headers are now interactive rows: title + chevron on the left, contextual action on the right ("New budget", "View in Timeline"); panel chrome (surface + shadow) preserved so cards still read as cards.

### Motion
- Every panel animates height + content fade in 220ms with the premium easing; chevrons rotate with the same curve; all motion collapses under `prefers-reduced-motion`.

### Accessibility
- Disclosure headers are real buttons with `aria-expanded` / `aria-controls`; content regions expose `role="region"` with a labelled name; keyboard-only users get the same expand/collapse flow, and the budgets panel auto-expands when arriving via the over-budget alert's "Review" link (`?focus=over`).

### Code refactors
- New `components/ui/Disclosure.tsx`: hydration-safe, SSR-friendly open state synced through `useSyncExternalStore`, per-panel + per-month localStorage persistence (`disclosure:<id>`), optional collapsed preview and right-side action slots, imperative `expand()` handle.
- `InsightList` gains a `limit` prop; `MonthlyStats` and `ExpenseBreakdown` gain `bare`/preview variants; `NeedsFundingSection` gains truncation (`limit` + `onExpand`); BudgetList's native `<details>` accordion replaced with the shared Disclosure.

## [Unreleased] — Premium craft pass · header, color & motion

### Design
- Brand palette remapped from sky-blue to a Linear-inspired violet-indigo family (`--color-brand-500: #5e6ad2`); every surface, focus ring, active state and chart follows via tokens, so the whole app reads calmer and less blue. Category and semantic colors (positive/warning/danger/information) untouched.
- Structured hero header replaces the floating layout: greeting eyebrow ("Good morning, Archer"), dominant `{Month} Budget` title (3xl → 4xl), large tabular amount with a "remaining / short this month" caption, and the month selector integrated into the header block with aligned breathing room.
- One primary action per header: subtle "Edit income" ghost when income is set, a primary "Set income" button when it isn't.
- KPI cards refined: 40px rounded icon tiles with larger glyphs, dominant 28px values, smaller 11px subtitles, per-card colored border on hover (income/expense/brand), soft hover lift and deeper shadow with premium easing; arrow still fades in on hover/focus.
- Page rhythm opened up: planner sections now breathe at `gap-10`; the floating month picker row is gone.

### UX
- Microcopy humanized: Deferred empty state now reads "Nothing has been pushed into this month" with "Moved into this month:" totals; reports empties rewritten ("Set budgets on the Planner and you'll see how each one holds up.").

### Motion
- New `--ease-premium` token (`cubic-bezier(0.22, 1, 0.36, 1)`) applied across buttons, cards, month picker, theme toggle, body theme switch, and every 150–220ms entry animation (dialogs, toasts, list-in, page-in).

### Accessibility
- All new interactions keep focus-visible rings and `motion-reduce` guards; reduced-motion media query still collapses every animation.

### Code refactors
- `Button` gains a `size` prop (`sm` | `md`), replacing fragile `min-h-*` className overrides that Tailwind's CSS ordering silently defeated; four call sites migrated (Hero, BudgetSuggestions, FutureExpenseForm).
- `useChartColors` SSR fallback synced to the new brand value (runtime colors already read `--color-brand-500`).

## [Unreleased] — UI polish pass

### Design
- Category accent remap with richer palette: Transport → yellow, Housing → blue, Utilities → amber, Health → red, Shopping → orange, Entertainment → purple, Food → green; new **Subscriptions** (cyan) and **Loan** (violet) groups; extended keyword matching (parking, real estate, bill, dentist, amazon, netflix, spotify, prime, disney, apple, software, cloud, loan, debt, interest, borrow, credit card, installment); loan group matches before transport so "credit card" stays violet.
- Editorial typography layer: new `SectionHeading` micro-label (`text-xs` uppercase, `0.12em` tracking) used across Today's Recommendations, Needs Funding, and Reports "Things to know"; planner hero redesigned with greeting eyebrow, tense-aware headline ("You're spending ahead of your income." / "Here's {month} budget."), and a large tabular amount.
- Card fatigue reduced: Today's Recommendations and Needs Funding are now borderless sections; budget-over-limit suggestions moved into an inline amber banner; summary-card chevron fades in on hover/focus instead of always showing.
- Custom line-art SVG empty-state illustrations (calendar, chart, list, target, clock, wallet) via the new `illustration` prop on `EmptyState`, replacing icon chips in 7 call sites.
- Reports page restructured: compact KPI strip (income, expenses, net, savings rate) in one hairline surface; "Income vs expenses" promoted to the full-width primary chart (300px); spending trend, savings, utilization, and top categories in a balanced two-column grid; "Spending this month" breakdown and "Things to know" insights card close the page.
- Chart polish: rounded 6px bars, taller primary chart, soft gradient fill under the spending-trend area, standardized 12px axis ticks and 12px-radius tooltips, inline income/expense legend.
- Timeline table: editorial column headers, tighter 4px row padding, hairline group rows with tabular totals, softer canvas hover for rows.

### UX
- Planner now speaks conversationally: empty state asks "Ready to plan {month}?" and an on-track state reassures "You're on track this month — nothing needs your attention right now."
- Button hierarchy rebalanced: "New budget" demoted to secondary, per-row actions ("Fund", "Adjust") use ghost; primary buttons reserved for page-level actions.
- Budget suggestions clarify what happens next: "raise the limit to X to cover what you've spent", optional trim line, and an overage-coverage note ("Your remaining income covers these overages.").
- Needs Funding rows show "No budget set yet" when a category has no limit, keeping the budget form one tap away.
- Microcopy pass across reports, timeline, upcoming, planner, and settings empties and dialogs.

### Performance
- Report charts lazy-loaded via `next/dynamic` with `ssr: false` and pulse skeletons, keeping the reports route static while cutting initial JS.

### Accessibility
- Reduced-motion respected in every chart animation (`useReducedMotion`), fade-in arrow, and list-in rows.
- Chart `role="img"` with descriptive `aria-label`s retained on all five report charts.

### Code refactors
- Shared `InsightList` extracted from duplicated row markup; reused by the planner and reports.
- `chartStyles.ts` centralizes tooltip and tick styles across all recharts surfaces.
- Deleted redundant surfaces: `InsightsPanel`, `SnapshotCards`, `Table`, `PagePlaceholder`; unused icon imports cleaned up.
- `accents.test.ts` updated to the new palette and group precedence.
