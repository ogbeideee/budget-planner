# Budget Planner Desktop
# Planner Screen Specification v2.0

This document completely defines the Planner screen.

It overrides any previous Planner layout.

Do not invent layouts.

Follow this specification exactly.

--------------------------------------------------
PAGE GOAL
--------------------------------------------------

The Planner is the application's flagship screen.

It should communicate:

• Financial confidence
• Clarity
• Calmness
• Control

When the user opens the application, this page should immediately answer:

How am I doing?

What needs attention?

What should I do next?

--------------------------------------------------
PAGE ORDER
--------------------------------------------------

The Planner MUST follow this order.

Page Header

↓

Month At A Glance (hero card)

↓

Recommendation Card

↓

Summary KPI Cards

↓

Budget Status Band (single card; hidden when no categories exist)

↓

Recurring payments (FR-25 quick-add suggestions; card exists only when a detected pattern projects into the viewed month — hidden otherwise)

↓

Budgets (donut + category list; the only category-progress section)

↓

Recent Activity

No additional sections should interrupt this flow.

--------------------------------------------------
PAGE HEADER
--------------------------------------------------

Title

Planner

Description

A short, encouraging sentence.

Example:

"Everything you need to stay on top of your finances this month."

Primary actions (right)

+ Add Expense (primary)

+ Add Income (secondary)

+ Import Statement (secondary, outlined, upload icon) — opens the Import
  Bank Statement modal: a 4-stage wizard (Upload → Processing → Review →
  Import). Drop or browse a CSV/Excel/PDF bank statement; transactions are
  detected client-side, categorized (editable per row), and only written to
  the ledger after confirmation. Import is ONE action for the whole
  reviewed, non-excluded batch: per-row checkbox selection and the bulk
  "Assign category…" bar are an optional convenience, never a gate, and a
  row without any category is skipped — flagged inline, never imported
  blank.

Month Selector

Never crowd the header.

-------------------------------------------------
PAGE HERO

-------------------------------------------------

It sits directly below the page header.

It replaces the old "Month at a glance" card.

It carries the soft teal/blue decorative treatment (see VISUAL LANGUAGE),
clipped inside the card (`overflow-hidden`). The card is a SINGLE content
column with a decorative layer on the right — there is no second column of
stat tiles.

CONDENSED SPACING (matched to the redesign reference)

Card padding: `px-6 py-5` (24/20px), `sm:px-7` (28px), `lg:px-8` (32px).
Vertical padding stays 20px at every width — the card's height is driven
entirely by the content column, since the illustration is absolutely
positioned.

The blocks do NOT share a uniform gap; each carries the reference's own
rhythm, top to bottom:

  date line          —
  greeting           mt-1.5   (6px)
  projected sentence mt-2.5   (10px)
  stat row           mt-3.5   (14px)
  progress block     mt-3.5   (14px)   label -> bar gap-1.5 (6px)
  action buttons     mt-4     (16px)   button gap-2 (8px)

Reference card height ~294px; this card renders ~254px in the same viewport
— deliberately tighter, because it carries one extra line (see below).

TYPOGRAPHY (app type-scale tokens, proportions from the reference)

  date line   `text-caption font-semibold text-muted`     12px / 600
  greeting    `text-kpi-tertiary font-bold text-ink`      20px / 700
  sentence    `text-description font-medium text-muted`   14px / 500
  stat row    `text-description font-medium text-muted`   14px / 500
  bar labels  `text-caption font-medium text-muted`       12px / 500

The reference sets the greeting at weight 800; this card uses `font-bold`
(700), the heaviest weight in the app's type system.

Content

Current date ("Thursday, August 13" — today when viewing the current month,
else the 1st of the viewed month).

Time-aware greeting: "Good afternoon, Archer 👋" (morning <12, afternoon <18,
evening otherwise; the name comes from the saved display name).

One projected-balance sentence, driven by `monthFinance()`:

• No expected income set → "Set your expected income to start planning this
  month."
• Projected remaining ≥ 0 → "You're on track to finish the month with a
  projected $X remaining."
• Projected remaining < 0 → "Planned expenses outpace income — you'd be short
  by $X at month-end."

NOTE: the reference folds the remaining amount into the greeting headline
("Good morning, Archer — ₦42,350 left this month") and has no separate
sentence. This card keeps them apart because the greeting text and the
projected-balance copy are separate, tested behaviours.

STAT ROW (icons)

One flex row, `gap-x-5 gap-y-1.5`, two entries, each an icon + label with a
6px gap:

  `CalendarIcon`   `h-3.5 w-3.5` (14px) `text-brand-500` — "N days remaining"
  `TrendingUpIcon` `h-3.5 w-3.5` (14px) `text-brand-500` — the daily line:
     "$X / day available" (projected ÷ days left) when on track, "Short by $X
     this month" when projected is negative, "$X available today" on the last
     day, "Month complete" for past months.

The icons replace the old teal dot + "•" separator; the dot was a hardcoded
`bg-[#0EA5A4]` and is gone — icon colour now comes from the brand token, so
both themes follow the accent.

PROGRESS BLOCK

Label row directly above the bar (`gap-1.5`, 6px): percentage left
("77% of expected income received", or "Set expected income to begin"),
received / expected right, both `text-caption ... tabular-nums`, aligned
`justify-between`. Bar is the shared `ProgressBar` with `thin` (6px, fully
rounded pill; the reference is 7px), success tone at ≥100%, brand otherwise,
full content width.

ILLUSTRATION (right)

Bounded, never dominant: an absolutely positioned layer pinned
`inset-y-0 right-0`, `w-[38%] max-w-[340px]`, `overflow-hidden`, `lg:block`
only. Inside it the existing curve artwork renders at `opacity-70`; the
concentric discs and radial glow are held at 0.02–0.04 alpha so the two thin
line-graph strokes are what actually read, matching the reference's restraint.
The artwork itself is unchanged — only its box, scale and opacity.
No additional hero section precedes it.

--------------------------------------------------
RECOMMENDATION CARD
--------------------------------------------------

Appears immediately below the page hero.

Only one recommendation is expanded.

Others collapse.

Height

Approximately 120px collapsed

Auto height expanded.

Background depends on recommendation type.

Example

Green

Healthy month.

Amber

Needs attention.

Red

Critical.

Layout

Large icon

↓

Headline

↓

Description

↓

CTA

The CTA must be obvious.

--------------------------------------------------
SUMMARY KPI GRID
--------------------------------------------------

Exactly four cards.

Equal width.

Equal height.

180px.

Cards

Expected Income

Remaining

Budgeted

Savings Rate

Each card contains

Pastel icon (top-left)

Label (directly below the icon)

Primary value

Supporting text

Comparison row (pinned to the bottom of the card)

Hover

Card lifts slightly.

Compact vertical hierarchy (icon → label → value → supporting text →
comparison row); primary value uses the kpi-secondary scale (slightly
smaller than the hero scale) and cards are top-aligned with the comparison
rows aligned near the bottom via `mt-auto`.

Expected Income

Label "Expected Income" below the green arrow icon; Edit action pinned
top-right. Value = expected amount. Supporting text = "% received" (or
"All expected received"). Comparison row (green/good): "↑ ₦25,000 from
last month".

Remaining

Label "Remaining" below the green target icon. Value = remaining amount
(`max(0, Net)`). Supporting text = "% of allocatable income" when budgets
exist (progress bar kept). Comparison row (red/bad): "↓ ₦17,500 from
last week".

Budgeted

Label "Budgeted" below the blue wallet icon, with a small info icon
beside the label. Value = committed amount. Supporting text = "% of
allocatable income" when budgets exist (no "N budgets" text). Comparison
row (green/good): "↓ ₦12,300 from last week".

Savings Rate

Label "Savings Rate" below the purple trend icon. Value = savings rate
as a number with a "%" suffix. Supporting text = "₦X remaining" (or
overspend / empty-state copy). Comparison row (red/bad): "↓ 2% from last
month".

Comparison rows are reference copy, not derived from data.

--------------------------------------------------
MONTH AT A GLANCE
--------------------------------------------------

Single wide card — superseded by the PAGE HERO (greeting, projected remaining,
days-left / daily-available and income-received tiles; see PAGE HERO). The
Income / Expenses / Remaining figures remain available on the Summary KPI grid.

-------------------------------------------------
BUDGET STATUS BAND
-------------------------------------------------

ONE card, full width, directly below the Summary KPI grid. It replaces
the three widgets that previously repeated the same information: the red
"Budget needs attention" alert banner, the "Needs Funding" card and the
"Budget Health" card. There is no separate alert banner, no Needs
Funding card and no Budget Health card anywhere on this page.

Rendered only when at least one category is configured. With zero
categories the band is not rendered at all — there is no empty state for
it.

Layout

Desktop (>= 980px): one horizontal row, vertically centered, four
regions left to right —

1. Health score ring
2. Vertical divider (1px, border color, full height of the row)
3. Status flags (flex, one row per flag, takes the remaining width)
4. "Review budgets" button, anchored to the right edge

Below 980px the four regions stack vertically and the divider is hidden.

Health score ring

76x76px circular ring drawn with a conic-gradient: the score arc uses
the danger red token, the remainder uses the border color token. The
numeric score (out of 100) sits in the centre on the card surface. The
ring carries an accessible label ("Budget health score N out of 100").

To its right, two stacked lines:

- "Budget health" plus a small info icon. The icon is focusable and
  shows a tooltip on hover/focus explaining what the score is calculated
  from.
- A pill badge derived from the score — "At risk" in red below 60,
  "Good" in teal at 60 and above. Never hardcoded.

The score itself comes from the existing `budgetHealth` selector; this
band only changes how it is displayed.

Status flags

One flag row per condition; each row is a small colored dot (red or
green) followed by descriptive text.

- Over-limit flag (red dot). Rendered only when at least one category is
  over its limit: "{n} budgets over their limit — {Name} +{overage},
  {Name} +{overage}" listing EVERY over-limit category with its overage.
  The list is never silently truncated — on desktop the row wraps to a
  second line rather than dropping categories.
- Funding flag. Green dot with "Every category funded · Income covers
  expenses" only when both are true. When categories are unfunded it
  becomes a red dot with "{n} categories need funding" and the "funded"
  text is not shown. When everything is funded but income does not cover
  expenses it is a red dot with "Every category funded · Income does not
  cover expenses".
- **Streak flag (FR-21).** A sparkle icon (in place of the dot) followed
  by "{n}-month streak". The whole row is a button that opens the
  Streak & badges drawer; `aria-label` is "{n}-month streak — view
  badges". Deliberately a flag in THIS band rather than a new card: the
  band exists to consolidate status, and a streak is status.
  - Hidden entirely at 0 — "0-month streak" is clutter that says nothing.
  - EXCEPT when the user holds at least one badge, where the row stays as
    "{n} badges earned" (muted icon, `aria-label` "View badges"). It is
    the only route into the drawer, and a broken streak must not lock
    someone out of achievements they already earned.
- If no flag applies, the region collapses to a single green flag:
  "All budgets on track this month." The flags region is never rendered
  empty.

Funding counts come from the shared `fundingNeeds` selector
(`lib/funding.ts`); over-limit rows from `overBudgetCategories`; the
streak from `streakStats` (`lib/streak.ts`), which itself defers to the
existing `budgetUtilizationSeries` for what "on track" means. Counting is
over FINISHED months only — the month in progress never contributes.

Streak & badges drawer

Opened from the streak flag. Right-edge `Drawer`, title "Streak & badges".

- Header block: the current streak and one line of explanation, plus
  "Your best so far is {n}" when the longest run beats the current one.
- "{earned} of {total} earned" count.
- One row per badge, EARNED AND LOCKED ALIKE — locked ones are greyed
  (`grayscale opacity-50` on the icon tile, muted text) and carry their
  requirement plus a progress bar ("Stay within budget for 6 months in a
  row · 4 of 6"). Locked badges are never hidden: the point of the set is
  having something visible to work toward.
- A closing line stating plainly that badges unlock nothing.

Every row is rendered from a `BadgeDefinition` in `lib/streak.ts`. There
is no per-badge markup or conditional anywhere in the component, so a new
badge is a new data entry and nothing else.

Action (anchored right)

Teal filled button "Review budgets →".

Takes the user to the Budgets section through the shared
helper `components/planner/reviewBudgets.ts`: `scrollIntoView` on
`#budget-allocation` (smooth, block-start) plus `href="/?focus=over"`
for router-capable contexts, where the `focus=over` flow also highlights
the over-limit rows. The hero's "Review Budget" button uses the SAME
helper — both buttons on the page go to the identical destination.

--------------------------------------------------
RECURRING PAYMENTS (FR-25)
--------------------------------------------------

ONE optional card, full width, directly below the Budget Status Band
and above Budgets — so "what is coming up" is answered before the
allocation work starts.

Rendered ONLY when at least one detected recurring pattern projects
its next occurrence inside the VIEWED planner month. With nothing due
the card does not exist at all — there is no empty state and no
placeholder; all other sections keep their exact placement.

Data comes from the pure detector (`lib/recurringPatterns.ts`):
transactions grouped per category, 3+ occurrences, amounts within ±10%
step-to-step, interval DETECTED (weekly / biweekly / monthly / yearly),
expected amount recency-weighted toward recent actuals. Nothing about
this card writes to state or stores anything.

One row per due pattern, sorted by projected date:

- Category icon + registry display name.
- A small cadence chip ("monthly", "every week", "every 2 weeks",
  "yearly").
- Support line: "Usually {amount} · next expected {date}", where amount
  goes through `formatMoney` with tabular figures. When the projected
  date falls inside the due window relative to today the date gains a
  teal "(Due soon)" emphasis.
- A compact teal button "Add". Clicking it OPENS the ordinary Add
  Expense form pre-filled with the pattern's category, expected amount,
  latest note and projected date. It never saves anything by itself —
  confirmation always happens through the form's normal submit path,
  every field editable.

No dialog, no toast, no auto-created transaction anywhere in this card.

--------------------------------------------------
BUDGETS
--------------------------------------------------

Always open (no collapse) — the section is compact. This is the ONLY
place the month's categories are listed with progress; the old separate
"Expense breakdown" section is gone from this page (the component still
serves the Reports screen). The section keeps the DOM id
`budget-allocation` — every focus/scroll flow targets it.

Header row

"Budgets" title on the left followed by the live category count in muted
text ("· N categories", singular "· 1 category"; always rendered, "· 0
categories" included), and an outlined "New budget" button pinned to the
far right.

Recommendations panel (directly below the header; only when at least one
budget is over its limit)

Very light warm/cream panel (subtle border, rounded corners).

Header text: "A few budgets are over their limits".

One row per over-limit budget (clicking a row opens the budget edit form):

Category-colored chip + name + copy:

"Name → increase limit by X or reduce spending" when the overage is
covered by remaining income.

"Name → reduce spending by X to stay within limit" when it is not.

Bottom-left: "View recommendations →" link to /reports.

Main allocation area (below the recommendations panel; two columns on
desktop, stacked on narrow screens) — the donut card has a FIXED ~300px
width and the list card takes the remaining flexible width.

Left: white donut chart card (subtle border, small rounded corners,
~24px horizontal padding, ~24px top padding, ~20px bottom padding; tall
enough for the chart plus statistics, vertically balanced). The donut
is a prominent ~180px chart in the upper-center of the card with
comfortable whitespace on both sides, preserving the category colors;
the ring is one CONTINUOUS conic-gradient — flat-edged, flush wedges
with NO gaps and NO rounded caps anywhere.

Each category contributes exactly one colour stop pair to that single
gradient, in category order, sized to its share of the total budgeted
amount; every stop starts at the exact percentage where the previous one
ended, which is what guarantees a hard edge and no background showing
through. A gradient needs at least two stops to be valid CSS, so a lone
category covering the whole ring emits its colour twice (otherwise the
browser drops the gradient and the ring paints blank).

Ring proportions: the hole is 70% of the outer diameter (`innerRatio`),
i.e. a 27px-thick ring at the Planner's 180px donut — a moderately thick
donut, not a progress ring — with the hole wide enough for the centre
text block. The hole is punched with a hard-stop radial `mask`, not an
opaque disc, so it stays transparent on any card colour in either theme.

One invisible annulus-sector `<path>` per category sits over the ring as
a hover hit area (`fill: transparent`); the active one takes a faint
white overlay so hovering a budget row or legend row still highlights its
wedge. These paths carry the colour only as `data-color`, never as a
stroke — nothing is stroked, so there are no line caps to round.

Donut colors are presentation-only: when two categories happen to share
the same stored color, each keeps its own wedge but gets a distinct
reserve hue on the chart (stored category data is never modified; the
budget list keeps the real category colors). The legend swatches below
the donut read from those same assigned colors, so they cannot drift. The centre text is tightly grouped (consistent 4px
spacing) with clear empty space between it and the ring on all sides:

"Budgeted" (13px)

committed amount (18px bold main KPI)

"of X · N%" (12px, directly underneath — the total it is measured
against and the allocated percentage on ONE line)

Legend (directly below the donut): the TOP FIVE categories by budgeted
amount only, one compact row each — color swatch (the color the donut
actually assigned that segment, reserve hues included), category name,
and that category's percentage of the total budgeted, right-aligned.
Categories beyond the fifth are deliberately NOT listed here; the full
set is in the right-hand column. Hovering a legend row highlights the
matching donut segment.

Below the donut the allocation statistics sit
lower in the card with clean, even spacing — labels left, amounts
middle, percentages bold and pinned far right, 6px progress bars
spanning almost the full card width, and a uniform 12px rhythm between
every element:

Allocated   committed   N%   (bar beneath, 12px)

Remaining   allocatable − committed   100−N%   (bar beneath, 12px)

(over-limit warn caption keeps the same styling as before)

When limits exceed the allocatable income the allocated percentage shows
the true ratio (bar clamped to 100%), remaining shows 0%, and a short
warn caption appears.

Right: compact vertical list of every budget row (dense, ~40px each, no
padding per row):

Row palette (reference): each row carries an extremely subtle pastel
category-tinted background — Transport very light warm cream/yellow,
Loan very light pink/lilac, Edi very light red/pink, Misc very light
cool gray/blue, Essentials very light pink/red, Internet very light
warm peach/orange, PalmPay very light blue (8–10% alpha pastels; never
saturated). The progress bar and percentage carry the stronger category
accent: Edi red, Internet orange, Essentials red, Transport teal, PalmPay
blue, Loan teal, Misc muted gray; over-budget rows keep the existing
warn (orange) / far-over danger (red) bar treatment. Categories outside
the reference seven fall back to their stored color tint + the theme
brand. OVER-LIMIT rows swap their category tint for the shared danger
red-tint token (`--color-expense-surface`) so they read at a glance —
row height and spacing are identical to on-track rows.

Row layout (two lines inside the fixed 40px height):

    [icon]  [Category] [Medium] [↪ +X]     [N% · X over]

            [progress bar] [percentage] [spent · left]       [budget]
                                                          [base + carry]

**Rollover-boosted rows (FR-19).** When a category carried unspent funds
into this month, the row must NEVER just show a bigger number with no
explanation of where it came from. Two markings appear together:

  - `RolloverBadge` — a small pill on the first line, immediately after
    the priority badge: a forward arrow glyph plus "+{amount}". It uses
    the category's OWN chip classes from `categoryDisplay()` (the
    registry treatment, never a bespoke palette), so it reads as the same
    category as the icon chip on that row. Its `title`/`aria-label` spells
    out the whole sum: "$1,000.00 + $600.00 rolled over = $1,600.00".
  - The headline figure on the second line becomes the EFFECTIVE limit
    (base + carry), with the breakdown "{base} + {carry}" printed beneath
    it in `text-caption text-muted` — so the arithmetic is visible, not
    implied.

Both are rendered only while `rolledOver > 0`; a row with no carryover is
pixel-identical to before FR-19. Percentages, the over-limit badge and
the limit tick mark all measure against the EFFECTIVE limit, so a row
still inside its carried funds is never painted as over budget.

Icon far left; category name and the subtle neutral Medium badge sit
closely together (6px gap). The over-limit badge ("{percent}% ·
{overage} over", danger colored) is right-aligned on that same first
line and is rendered ONLY when spent exceeds the limit — never at or
under 100%. On the line below, the thin progress bar starts at the same
left alignment as the name, the percentage sits immediately right of the
bar (8px gap), "spent · left" follows with a consistent 12px rhythm, and
the budget amount is pinned far right — consistent alignments across all
rows, nothing overlaps.

Overflow tick: on an over-limit row the bar is full (it represents
everything spent), so a short vertical tick is drawn at limit/spent of
its width — showing where the limit was crossed inside the red bar.
On-track rows draw no tick.

THREE small icon-only actions sit at the end of the row, ALWAYS VISIBLE
(not a hover-reveal — see the note below), all at the same 32x32 touch
target (h-8 w-8) with 16px glyphs, in this order:

1. Pencil — opens the budget edit form (limit + priority + the rollover
   switch, see below) for that category. Present on EVERY row regardless
   of whether the category is over, at, or under its limit. `aria-label`
   "Edit {Category} budget".
2. Arrows/exchange (`ArrowsExchangeIcon`, never the pencil glyph) —
   opens the per-category allocation drawer, passed the category's id and
   name. `aria-label` "Allocate funds to {Category}".
3. Trash — deletes the budget.

The three labels are deliberately distinct so screen-reader users can tell
the edit action from the allocate action.

These actions are NOT hover-revealed, unlike the row actions elsewhere in
the app (TransactionCard, RecentActivity, the Settings lists). They are
the only way to edit, allocate or delete a budget, so hiding them at rest
made them undiscoverable on touch and invisible to anyone not using a
mouse. Hover/focus adds emphasis (tinted background + accent color), it
does not reveal.

They are also plain `<button>` elements, NOT the shared `Button`
component: `Button`'s `sm` size hard-codes `px-3`, which a `px-0` passed
through `className` does not override (equal specificity — compiled CSS
order decides), so a 24px-wide button ended up with a 0px content box and
squeezed the icon to zero width. The icons carry `shrink-0` so they keep
their intrinsic size inside the flex row. Hovering a row highlights the corresponding donut
segment.

ALLOCATION DRAWER — there is NO permanent "Allocate remaining" section on
this page; nothing allocation-related is mounted until a trigger opens
this drawer.

Triggers: (a) a budget row's arrows/exchange action (NOT the pencil —
that opens the edit form), and (b) the "Remaining" summary
card, whose "Allocate remaining" drawer now lists the month's budgets
(name + "$X over" in danger or "$X left" in muted) and hands the chosen
one to the SAME shared component.

A right-edge Drawer (~400px, full height, dimmed scrim). Header: "Add
funds to {Category}" + close (X). Body, in order:

1. Over budget → "{Category} is $X over its $Y limit this month. Move
   money from a category with room to spare, or raise the limit."
   Not over → "Choose how much to allocate to {Category} from this
   month's unallocated funds."
2. "Move funds from" — one bordered row per OTHER budget in the month
   whose available (limit − spent) is > 0: category chip, name, "$X
   available", and a slider 0 … available starting at 0. Categories with
   nothing available are never listed, and the whole section is omitted
   (no placeholder row) when none qualify. While the target is over
   budget the section header also shows "$moved of $overage".
3. "Or raise the limit" — a dashed-border row with a slider from the
   current limit to limit + overage (or limit + the month's unallocated
   funds when the target is not over).

Sliders are independent: dragging one updates only its own value. When
the target is over budget the moves are clamped so their SUM can bring
the target exactly to its limit and no further, and each move is
additionally clamped to its own source's available — a source can never
go negative.

Footer: "Cancel" and "Apply" (disabled until something changes). Escape
and a scrim click behave exactly like Cancel. Every open remounts from
live store data, so drafts never carry between opens. Apply writes one
`updateBudget` per contributing source (limit down) plus one for the
target (limit up) and closes; the affected rows' spent/left/limit update
in place with no reload.

Rows are ordered by category list order (not priority) — the reference
order: Edi, Transport, Internet, Essentials, PalmPay, Misc, Loan.

Focus flows (focus=over, focus=create, planner:focus-budget) scroll to the
section and highlight the relevant row(s); nothing needs expanding
anymore, and no slider is targeted (there is none on the page). The
Past-months list remains below the section, unchanged.

Zero budgets: the donut card shows the empty state instead of an empty
ring — "No budgets set up yet" with a "Create a budget" CTA — and the
list card is not rendered at all (nothing below the header). The section
header, count ("· 0 categories") and "New budget" button stay.

--------------------------------------------------
RECENT ACTIVITY
--------------------------------------------------

Latest three transactions.

Each row

Icon

Title

Category

Date

Amount

Delete button (hover-reveal trash icon) → ConfirmDialog "Delete transaction" (danger) —
the row is removed and every derived figure (monthly expenses, remaining income, savings
rate, category/budget spending, budget health, reports) updates immediately.

Clicking a row opens the existing TransactionForm edit flow.

Hover highlight.

Button

View all

-------------------------------------------------
ADD EXPENSE MODAL (TransactionForm)
-------------------------------------------------

Opened by Add Expense / Add Income (header) and by clicking a Recent Activity row.

White surface, subtle full-opacity 1px cool-gray border + soft card shadow (no heavy shadow);
heading is the per-kind action (Add Expense / Add Transfer / Add Income; "Edit transaction"
when editing) with a close icon top-right; Expense / Transfer / Income tabs use a teal 2px
underline on the active tab, muted blue-gray inactive tabs, very subtle divider underneath.

Two-column fields (Amount with currency-symbol prefix + Category | Date + amount preview),
full-width Note textarea ("Add a note...", 0/200 counter bottom-right, max 200 unchanged).

Cancel + Add Expense / Add Transfer / Add Income buttons bottom-right (matching heights).

--------------------------------------------------
VISUAL LANGUAGE
--------------------------------------------------

The Planner uses a recurring soft blue/teal treatment: radial gradient glows
(rgba(14, 165, 164, …) teal and rgba(59, 130, 246, …) blue at low alpha) and
curved-line / concentric-circle SVG motifs. Gradients appear behind sections and in
large empty areas of the month-at-a-glance hero card, summary and preview cards — never behind dense
content; panels and rows stay opaque.
CARD STYLING
--------------------------------------------------

Every Planner card uses

Radius

20px

Padding

28px

Soft shadow

White background

Hover

TranslateY(-2px)

Transition

220ms

--------------------------------------------------
SPACING
--------------------------------------------------

Gap between sections

40px

Gap between cards

24px

Internal spacing

28px

The page should never feel cramped.

--------------------------------------------------
EMPTY STATES
--------------------------------------------------

If a section has no data,

show a premium empty state.

Never display

"No data."

Instead explain:

Why it is empty.

How to populate it.

Provide a CTA.

--------------------------------------------------
MICRO INTERACTIONS
--------------------------------------------------

Summary cards

Lift on hover.

Progress bars

Animate.

Charts

Animate.

Recommendation

Expand smoothly.

Buttons

Subtle elevation.

Rows

Soft highlight.

No abrupt transitions.

--------------------------------------------------
RESPONSIVENESS
--------------------------------------------------

Desktop

Two-column layout.

Laptop

Maintain two columns if possible.

Tablet

Stack columns.

Never compromise desktop spacing.

--------------------------------------------------
DO NOT CHANGE
--------------------------------------------------

Business logic

Calculations

Selectors

Storage

Routing

State management

This document defines presentation only.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The Planner should immediately feel comparable to a premium fintech application.

The user should instinctively understand:

Current financial health

Remaining money

What needs funding

Recommended next action

Without having to search the page.