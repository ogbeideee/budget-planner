# Budget Planner Desktop
# Reports Screen Specification v2.0

This document completely defines the Reports screen.

Reports should not feel like an admin dashboard.

Reports should feel like a premium financial intelligence platform.

Imagine the experience of opening your investment portfolio or personal finance summary.

The screen should answer:

• Where did my money go?
• Am I improving?
• What trends should I notice?
• What should I change next month?

--------------------------------------------------
PAGE STRUCTURE
--------------------------------------------------

Reports

↓

Monthly Overview

↓

Financial Insights

↓

Spending Breakdown  (Income vs Expenses, then Category Analysis)

↓

Savings Trend

↓

Spending Trend

↓

Cash Flow

↓

Forecast

↓

Recommendations

↓

Detailed Breakdowns

--------------------------------------------------
ONE CATEGORY BREAKDOWN
--------------------------------------------------

The page used to state "which category spent how much" in FIVE places. It now
states it in TWO:

1. **Category Analysis** — the single category-breakdown visualization
   (donut + ranked numeric list). It lives inside the Spending Breakdown
   section, directly under Income vs Expenses, FULL WIDTH — halving it to sit
   beside the income chart makes its donut centre label overlap the ring.
2. **Recommendations** — kept because its cards are actionable (Review budget),
   not merely informational.

Removed, and why:

• "Spending by category" card (`ExpenseBreakdown`) — a top-5 bar list of the
  same data, one section above Category Analysis. Component deleted; it had no
  other consumer once the Planner stopped rendering it.
• "Top categories" chart (`TopCategoriesChart`) — a sixth restatement, at the
  bottom under Detailed Breakdowns. Component deleted.
• Financial Insights' "biggest cost" chip — it restated, verbatim, the headline
  card immediately above it. The headline card itself is untouched, and the
  over-budget chips stay (the headline gives only a count, never the figures).

Note: Category Analysis is capped at its top 6 categories (`TOP_COUNT`), so
"no artificial cap" is not the reason it survived — it survived because it is
the only one carrying BOTH a chart and a numeric breakdown.

--------------------------------------------------
INCOME: EXPECTED VS RECEIVED  (Detailed Breakdowns)
--------------------------------------------------

ONE card with a two-option view toggle, replacing the former "Expected vs
actual" and "Income trend" cards — they compared the same two numbers
(planned income vs what landed) on different axes.

Position: the grid slot "Expected vs actual" held, beside Income sources. The
full-width "Income trend" row below it is gone; nothing fills that space —
Budget utilization simply moves up, and there is no awkward gap.

Toggle (card header, trailing edge): pill buttons with `aria-pressed` and a
brand tint on the active one — the same control the Settings section nav uses.
Labels: **By source** / **Over time**.

  By source (DEFAULT)   grouped bars per income source for the selected month,
                        each labelled with its icon + name; subtitle
                        "This month, by source". Default because the page opens
                        on the current month, and a six-month trend built from a
                        single month is a flat line for five of them — the same
                        problem Budget utilization has.

  Over time             expected vs received month totals across the 6-month
                        window as two lines (Expected dashed on the border
                        token, Received solid on the income colour); subtitle
                        "Last 6 months".

Legend: rendered once, above the chart, identical in both views — Expected on
the border token, Received on the income colour — so switching never reads as a
different component. Each view keeps its own empty state, and the toggle stays
reachable in both so the other view is always one click away.

Income sources (composition of income, not a comparison) is a SEPARATE card and
is untouched by this merge.

--------------------------------------------------
MINIMUM-HISTORY THRESHOLD
--------------------------------------------------

MIN_TREND_MONTHS = 2 (`components/reports/ReportsView.tsx`).

"Enough history" is measured ONCE, by the shared
`monthsWithTransactions(transactions, months)` helper (`lib/reportTrends.ts`) —
the count of distinct months in the 6-month window that carry transactions.
That single `historyDepth` value drives BOTH the "one month so far" banner and
the chart gating below, so the two can never disagree.

Below the threshold:

• The banner stays — "You're looking at data from just one month so far. Add N
  more month(s) to unlock trend comparisons." It is the explicit signal for why
  a chart is missing and is never hidden.
• **Budget utilization is omitted entirely** — no placeholder, no empty state,
  no reserved space. It is removed from the layout.

At or above the threshold it renders exactly as designed; nothing about the
chart itself changed.

WHY ONLY BUDGET UTILIZATION

Every months-based chart on this page was checked. The difference is whether
its series zero-fills the window or drops empty months:

  Chart                          Series              1 month of data
  ---------------------------------------------------------------------------
  Budget utilization             flatMap, drops      ONE bar spanning the card
                                 months with no      — no axis context, reads
                                 budgets             as broken.  GATED.
  Monthly spending trend         monthlySeries       6 points, zeros for empty
  Savings over time              financeSeries       6 points, zeros for empty
  Income vs expenses             financeSeries       6 points, zeros for empty
  Cash flow                      financeSeries       6 points, zeros for empty
  Income: expected vs received   incomeTrendSeries   6 points, zeros for empty
    ("Over time" view)

The zero-filling charts render a flat line/bars at zero for the months with no
data, which reads correctly as "nothing here yet" and keeps the axis for scale.
They are deliberately NOT gated. Only `budgetUtilizationSeries` drops months
(`months.flatMap(...)` returning `[]` where a month has no budgets), which is
what collapses it to a single context-free block.

KNOWN EDGE CASE

The gate counts months with TRANSACTIONS, while the chart drops months without
BUDGETS. A user with two months of transactions but budgets in only one would
pass the gate and still see a single bar. This is deliberate — the brief asked
for the existing shared threshold rather than a second, possibly divergent
check — but it is the one hole left in the gating.

--------------------------------------------------
PAGE HEADER
--------------------------------------------------

Title

Reports

Description

"Understand your spending patterns and financial trends."

Right side

Month selector

Export button

Compare Month button

--------------------------------------------------
MONTHLY OVERVIEW
--------------------------------------------------

Four premium KPI cards.

Equal width.

180px height.

Cards

Total Income

Total Expenses

Net Savings

Savings Rate

Each card

Large metric

Small label

Pastel icon

Tiny trend

Small comparison

Example

▲ 14% vs last month

--------------------------------------------------
FINANCIAL INSIGHTS
--------------------------------------------------

Wide editorial card.

Contains

Large insight headline.

Supporting paragraph.

Three key observations.

Example

"You spent significantly less on transport this month while grocery expenses increased by 8%."

Feels like an AI summary without requiring AI.

--------------------------------------------------
SPENDING TREND
--------------------------------------------------

Large chart.

Minimum height

380px

Smooth animated line.

Soft gradient.

Minimal gridlines.

Hover

Large tooltip.

The chart dominates the page.

--------------------------------------------------
CATEGORY ANALYSIS
--------------------------------------------------

Two-column layout.

LEFT

Donut chart.

RIGHT

Category ranking.

Each row

Color dot

Category

Amount

Percentage

Progress bar

Hovering a row highlights the donut segment.

--------------------------------------------------
INCOME VS EXPENSES
--------------------------------------------------

Large grouped bar chart.

Income

Green

Expenses

Coral

Net

Thin teal line overlay.

Smooth animation.

--------------------------------------------------
CASH FLOW
--------------------------------------------------

Wide chart.

Illustrates

Money in

Money out

Remaining

Shows trends over time.

--------------------------------------------------
FORECAST
--------------------------------------------------

Prediction card.

Headline

Forecasted Month-End Balance

Large projected value.

Confidence badge.

Supporting explanation.

Small trend visualization.

--------------------------------------------------
RECOMMENDATIONS
--------------------------------------------------

Card list.

Each recommendation

Large icon.

Title.

Explanation.

CTA.

Examples

Reduce dining by ₦15,000.

Allocate remaining income.

Increase savings target.

Pay upcoming bills early.

Only the highest-priority recommendation is expanded.

--------------------------------------------------
CHART STYLE
--------------------------------------------------

Rounded corners.

Large padding.

Soft shadows.

Very subtle grid lines.

Hover animations.

Gradient fills.

No harsh colors.

No thick borders.

--------------------------------------------------
TOOLTIPS
--------------------------------------------------

Dark floating card.

Rounded.

Shows

Label

Value

Percentage

Additional context.

--------------------------------------------------
COLORS
--------------------------------------------------

Income

Emerald

Expenses

Coral

Savings

Teal

Forecast

Indigo

Warnings

Amber

--------------------------------------------------
EMPTY STATE
--------------------------------------------------

Illustration.

Headline.

Supporting explanation.

Primary CTA

"Start tracking expenses"

--------------------------------------------------
INTERACTIONS
--------------------------------------------------

Hovering charts

Highlights corresponding legends.

Hovering legends

Highlights chart segments.

Month changes

Animate transitions.

Cards

Lift slightly.

--------------------------------------------------
SPACING
--------------------------------------------------

Section spacing

40px

Chart spacing

32px

Card padding

28px

Generous whitespace throughout.

--------------------------------------------------
DO NOT CHANGE
--------------------------------------------------

Calculations

Selectors

Business logic

Data flow

Only presentation.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The Reports page should feel comparable to premium financial products like Monarch Money or Copilot Money.

The user should be able to understand their financial performance in under one minute.

Charts should tell a story rather than simply displaying data.

--------------------------------------------------
SECTION HEADER vs CARD TITLE
--------------------------------------------------

A single-card section names the CONCEPT in its header and what is actually
plotted in the card title. The two must never be the same string:

  Savings trend    -> "Savings over time"
  Spending trend   -> "Monthly spending trend"
  Cash flow        -> "Money in vs out"

(Cash flow previously repeated itself verbatim; the card title was reworded
rather than removed, to match the pattern the other two already set.)

Sections holding more than one card keep their header and let each card carry
its own title (Spending breakdown, Detailed breakdowns).

--------------------------------------------------
CATEGORY NAME FORMATTING
--------------------------------------------------

Category names are user data and are also the lookup key for
`categoryAccent`/`budgetRowTreatment`, so the stored value is never rewritten.
EVERY site that PRINTS a category name goes through `categoryLabel` /
`categoryLabelOr` (`lib/categoryDisplay.ts`), which capitalizes the first
character only. Sorting, lookups and form drafts keep the raw value.

`components/reports/categoryNaming.test.ts` scans component sources and fails
if any component renders `category.name` without the formatter — this bug has
recurred twice (Planner, then Category analysis) and the guard is what stops a
third.

--------------------------------------------------
RECOMMENDATIONS: WHICH CARD OPENS
--------------------------------------------------

The expanded card is DERIVED from the current items, not frozen at mount:

  1. Consider only warnings. Information and success cards never auto-open, so
     a clean month starts fully collapsed.
  2. Among warnings, open the one with the largest `impact` — the money at
     stake. Over-budget cards set it to their overage.
  3. Once the user clicks any card, their choice overrides the rule and stays.

Previously this was `items[0]` — pure list position, so whichever budget was
iterated first opened for no stated reason. It was also a lazy `useState`
initializer, which runs once: if the store hydrated after the first render the
default never applied at all and every card stayed collapsed.
