# Budget Planner Desktop
# Debt Payoff Screen Specification v1.0

This document completely defines the Debt payoff screen (FR-20).

The screen answers four questions and nothing else:

• What do I owe, and to whom?
• How much can I actually put toward it each month?
• When am I debt-free?
• Which order should I pay them in?

Every number on this screen is deterministic arithmetic. Nothing here is
estimated, sampled, modelled or generated. The same inputs always produce the
same schedule, on every machine, at no per-use cost.

--------------------------------------------------
PLACEMENT
--------------------------------------------------

Route: `/debt`
Nav: sidebar, under the **Analytics** section, after Reports.

Analytics is the right home rather than Planning: this screen answers "where is
this heading", like Reports and Timeline, instead of "what am I doing with this
month's money", like Planner, To-Do and Upcoming. It is also a projection over
many months, so it does not belong to the month picker that governs Planning.

The bottom bar (mobile) carries it too, labelled **Debt** — `NavItem.shortLabel`
exists for exactly this, because a seventh cell is ~50px wide and "Debt payoff"
cannot fit. `BottomNav` derives its column count from `NAV_ITEMS.length`, so
adding a destination can no longer silently overflow the bar into a second row.

--------------------------------------------------
PAGE STRUCTURE
--------------------------------------------------

Debt payoff (title + one-line explanation of determinism)

↓

Overview       — three metric cards: Total owed / Minimums / Monthly total

↓

Your debts     — one row per tracked debt

↓

Extra toward payoff  — the single editable input

↓

Comparison  OR  Projection   (depends on how many debts are tracked)

--------------------------------------------------
EMPTY STATE
--------------------------------------------------

With no debts tracked, the screen shows ONLY the header and an empty state:
"No debts tracked yet", explaining that the switch lives on the category edit
form, with a "Manage categories" link to `/settings`.

It must NOT render an empty comparison, a zeroed projection, or example data.

--------------------------------------------------
OVERVIEW CARDS
--------------------------------------------------

    [Total owed]        [Minimums]           [Monthly total]
    Sum of balances     Sum of minimums      Minimums + extra
    "N debts tracked"   "Due every month"    "Minimums + $X extra"
                                             or "Minimums only"

"Minimums" sums only debts with a balance above zero — a cleared debt no longer
demands a payment, and including it would overstate the committed outlay.

--------------------------------------------------
YOUR DEBTS
--------------------------------------------------

One row per debt, sorted by balance descending (largest first):

    [Name]                          [progress]        [balance]
    [rate · minimum]                "N% paid off"

• Name comes from the category registry (`categoryDisplay`) — never
  `category.name` directly, and never a locally capitalized copy.
• A 0% debt reads **"Interest-free"**, not "0% a year". The latter is
  technically true and reads like a data-entry error.
• The progress bar renders ONLY when `startingBalance > balance`. A debt that
  has never been paid down shows no bar rather than an empty one at 0%.

--------------------------------------------------
EXTRA TOWARD PAYOFF
--------------------------------------------------

A single amount input: "Extra per month, on top of the minimums".

It is SEEDED from the Planner's "Remaining" figure — `monthFinance().remaining`,
the same selector the Planner's Remaining card uses — and is then entirely the
user's. It is never re-locked to that number.

Implementation note, and the reason this is not `useState(() => suggested)`:
the initializer runs on the hydration render, before the persisted store has
reached the component, so it would capture 0 and never update. The input value
is therefore DERIVED — `extraDraft ?? suggestion`, where `extraDraft` starts
`null` for "untouched". The moment the user types, their value wins, including
an empty string.

A "Use this month's remaining ($X)" button appears whenever the field differs
from the suggestion, so the default is recoverable after editing.

Invalid input (more than 2 decimals) shows an inline error and the projection
falls back to zero extra — it never disappears or throws.

--------------------------------------------------
COMPARISON vs SINGLE PROJECTION
--------------------------------------------------

**2 or more debts → side-by-side comparison.**
Two cards, Avalanche and Snowball, each showing:

    [Strategy name] [Costs least?]              [Use this / Active plan]
    [one-line description of the strategy]

    Debt-free in            Interest paid
    [1 yr 4 mo]             [$412.36]

    Payoff order
    1  [Debt name]                       [1 yr]
    2  [Debt name]                       [1 yr 2 mo]

Below the pair, one line stating the actual difference in interest and months.

**Fewer than 2 debts → ONE projection.** With a single debt there is no
ordering decision to make, so the two strategies are identical by definition.
Rendering two columns of the same numbers would imply a choice that does not
exist. Instead: a sentence saying so, plus "Debt-free in" and "Interest paid",
and an invitation to add a second debt.

**All debts cleared →** neither; a single line saying there is nothing left to
project.

--------------------------------------------------
THE "COSTS LEAST" BADGE
--------------------------------------------------

Shown on whichever strategy accrues less total interest — and on NEITHER when
they tie. Ties are real and common, not an edge case to paper over:

• Equal interest rates make avalanche's tie-break fall through to balance,
  which is snowball's primary key — the orders converge.
• With exactly two debts and no extra payment, every cent is committed to
  minimums; the only money that ever moves is a freed minimum, and once one
  debt clears there is only one place for it to go.

In both cases the summary line says the strategies come out the same, rather
than crowning an arbitrary winner.

--------------------------------------------------
ACTIVE PLAN
--------------------------------------------------

"Use this" / "Active plan" writes `settings.debtStrategy`.

This is a DISPLAY preference and nothing more. It selects which projection is
surfaced prominently; it triggers no payment, schedules nothing, and moves no
money — this app has no payment rails and makes no claim to.

--------------------------------------------------
STALLED PLANS
--------------------------------------------------

When payments cannot outrun the interest, the plan is marked `stalled` and
"Debt-free in" reads **"Not on this budget"** with a warning line explaining
that raising the extra payment or the minimum is what changes it.

Inventing a payoff date that will never arrive would be the worse answer.

--------------------------------------------------
ACCESSIBILITY
--------------------------------------------------

• Each payoff order list carries `aria-label="{Strategy} payoff order"`.
  Unlabelled, the page presents two ordered lists that both announce only as
  "list".
• The strategy selector is a `button` with `aria-pressed`, not a checkbox.
• Every metric card passes `ariaLabel`.
• The extra-payment input sets `aria-invalid` when the amount is malformed.

--------------------------------------------------
WHAT THIS SCREEN DOES NOT DO
--------------------------------------------------

• No AI, no LLM, no network call, no per-use cost. See ARCHITECTURE.md §3.4
  for where a narration layer could be added later WITHOUT touching the
  calculation engine.
• No payment automation, reminders, or bank connections.
• No change to budgeting for categories that are not flagged as debt. A
  category with no linked `Debt` record behaves exactly as it always has.
