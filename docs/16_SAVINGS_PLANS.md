# Budget Planner Desktop
# Savings Plans Screen Specification v1.0

This document completely defines the Savings screen (FR-28).

The screen answers three questions and nothing else:

• What am I setting money aside for, and how much does each goal need?
• How far along is each goal, and is the pace good enough to hit its date?
• What happens when a goal is reached?

Every progress figure is derived arithmetic over the ordinary ledger. Nothing
here is estimated, sampled, modelled or generated. The same ledger always
produces the same progress, on every machine, at no per-use cost.

--------------------------------------------------
PLACEMENT
--------------------------------------------------

Route: `/savings`
Nav: sidebar, under the **Analytics** section, after Debt payoff.

Analytics is the right home for the same reason Debt payoff lives there: a
savings plan is a projection over many months ("where is this heading"), not a
view of one month's money, so it does not belong to the month picker that
governs Planning.

The bottom bar (mobile) carries it too, labelled **Save** — `NavItem.shortLabel`
exists for exactly this, because a bottom cell is ~50px wide. `BottomNav`
derives its column count from `NAV_ITEMS.length`, so adding a destination can
no longer silently overflow the bar into a second row.

--------------------------------------------------
DATA MODEL (schema v11)
--------------------------------------------------

A savings plan is a STANDALONE record — not a category, not a budget, not a
debt. A budget limit is one month's allowance; a debt is money owed; a plan is
money being set aside toward a target across any number of months.

```ts
interface SavingsPlan {
  id: ID;
  name: string;              // non-blank, ≤ MAX_TITLE_LENGTH
  targetAmount: number;      // minor units, >= 0
  targetDate?: string;       // ISO date; ABSENT means open-ended
  startingBalance: number;   // minor units, >= 0; money already held at creation
  status: "active" | "completed" | "ongoing" | "archived";
  createdAt: string;         // ISO 8601
  completedAt?: string;      // stamped once the target is first acknowledged
  archivedAt?: string;
}
```

- **Contributions are ordinary transactions.** A contribution is written through
  the ONE transaction-creation path (`addTransaction`, the same seam quick-add
  uses) as an expense transaction tagged `savingsPlanId`. There is no separate
  savings write path and no separate balance store — deleting or editing the
  underlying row automatically changes the plan's progress, because progress is
  always derived.
- **Migration v10 → v11** backfills `savingsPlans: []` and nothing else. It
  creates no plan and tags no transaction. Orphan tags (a transaction tagged to
  a plan id that no longer exists) are stripped on load rather than failing it.
- **Deletion vs archiving.** A plan with no contributions deletes outright. A
  plan WITH contributions refuses deletion (`in-use-transactions`) — its rows
  are ledger history — and offers archive instead. Archived plans disappear
  from the main list and stay reachable behind "Show archived".

--------------------------------------------------
RELATIONSHIP TO OTHER FEATURES
--------------------------------------------------

- **Reports (the exclusion rule).** A tagged transaction is money moved into a
  goal, not money spent: `totals()`, `spendingByCategory()` and
  `spendingByCategoryInMonths()` skip it, so Reports' expense/income figures and
  category analysis never see it. This mirrors the reason transfers are kept
  out of spending: own-goal movement is not consumption.
- **Budgets stay inclusive (deliberate).** `spent()` — the budget-envelope
  math — does NOT skip tagged rows. A contribution drawn against a category
  consumes that category's envelope.
- **Rollover (FR-19) integration.** Because the envelope stays inclusive, a
  user whose "Savings" category has rollover enabled can allocate carried-over
  funds into a plan by simply logging the contribution against that category:
  the envelope (base + carryover) is drawn down, and at month end only the
  true remainder carries forward. No rollover record is ever written by the
  savings feature; the month transition works unchanged. The contribution form
  shows a read-only hint with the chosen rollover category's still-available
  carryover. There is no double counting: the rollover arithmetic measures
  `spent` at month close, after the contribution already reduced it.
- **Debt payoff (FR-20) and streaks (FR-21)** are untouched. `budgetUtilizationSeries`
  keeps counting envelope consumption, so streaks behave exactly as before.
- **Not income.** A contribution never increases "received" — it is
  expense-direction movement that reports then exclude.

--------------------------------------------------
PAGE STRUCTURE
--------------------------------------------------

Savings (title + one-line explanation)

↓

Overview        — two metric cards: Total saved (of targeted) / Plans (n at target)

↓

Plan cards      — one per plan, ordered active → ongoing → completed → archived

↓

Modals          — New/edit plan · Add contribution · Completion prompt

--------------------------------------------------
PLAN CARD
--------------------------------------------------

Each card shows, per plan:

- **Name and status badges** — Active / Target reached / Target reached —
  open-ended / Complete / Ongoing / Archived, plus "By {date}" when a target
  date exists.
- **Ring + bar** — `CircularProgress` (percent) beside a `ProgressBar`, both
  clamped to the target; success tone once reached, brand tone otherwise. This
  is the same visual language as budget progress.
- **Figures** — saved (starting balance + Σ tagged contributions) of target,
  and "X to go" while short. Rendered through `AnimatedMoney` (tabular figures).
- **Pace line** (see below).
- **Actions** — "Add contribution" always (any non-archived plan accepts
  contributions, past its target too); edit; delete (only when no
  contributions exist); Mark complete / Reopen; Archive / Restore.

--------------------------------------------------
PACE: ON TRACK / BEHIND SCHEDULE
--------------------------------------------------

`lib/savings.ts` — pure, deterministic, no React/store/I/O (same discipline as
`lib/debtPayoff.ts`). `today` is a parameter, never `new Date()`.

- **No target date → no verdict.** The card reads "Open-ended" and tracks
  plain progress. There is no deadline to be ahead of or behind.
- **With a target date:**
  - `currentPerMonth` = Σ contributions ÷ elapsed months since `createdAt`
    (a plan younger than a month is judged on ONE month's pace — dividing two
    days of history by two days would call a first contribution a huge run
    rate).
  - `requiredPerMonth` = remaining ÷ months to the target date.
  - `on-track` when `currentPerMonth >= requiredPerMonth`, else `behind`.
- **Deadline passed** with the target unmet → behind, with everything still
  missing due now (`monthsRemaining = 0`).
- **Target reached** → `complete`, regardless of remaining time.
- The card phrases it as "On track — averaging X/mo; Y/mo reaches the target by
  {date}" or "Behind schedule — need Y/mo to hit the target by {date}
  (currently averaging X/mo)".

--------------------------------------------------
CONTRIBUTION FLOW
--------------------------------------------------

Amount + date + "from category" (an expense category — the ledger requires a
category) + optional note (defaults to "Savings contribution — {plan}").

- The write is `addTransaction({ type: "expense", savingsPlanId, … })`.
- The category picker defaults to a category literally named "savings" when one
  exists, else the first expense category.
- Rollover hint: choosing a rollover-enabled category shows its available
  carryover for the current month and explains that contributing against it
  moves that rollover money into the plan (read-only; computed from
  `effectiveLimit − spent`, never from a rollover record).

--------------------------------------------------
COMPLETION: ASKED, NEVER ASSUMED
--------------------------------------------------

When a plan is still `active` and its progress reaches the target while
`completedAt` is unset, the screen opens the completion prompt. The condition
is DERIVED on every render — there is no "prompt shown" flag to fall out of
sync.

The prompt offers exactly four choices and nothing else:

- **Mark complete** → status `completed`. Kept on the list as finished.
- **Keep contributing (open-ended)** → stays `active`, `completedAt` stamped.
  The card shows "Target reached — open-ended" and accepts further
  contributions; the prompt never asks again.
- **Switch to ongoing maintenance** → status `ongoing` (keep-it-topped-up
  goals such as an emergency fund).
- **Archive plan** → status `archived`, hidden from the main list.

"Decide later" dismisses for the session without changing anything; the prompt
returns on the next visit. `setSavingsPlanStatus` stamps `completedAt` the
first time a plan is closed out, marked ongoing, or kept open past its target —
and never clears it, so the reached-the-target fact survives later status
changes.

--------------------------------------------------
TESTS
--------------------------------------------------

- `lib/__tests__/savings.test.ts` — progress arithmetic (starting balance,
  tagging, over-the-target, zero target), pace with and without a target date
  (on-track, behind, deadline passed, complete, determinism), report exclusion
  (`totals` skips tagged rows on BOTH sides, `spent` stays inclusive), v10 →
  v11 migration, orphan-tag stripping, unknown status rejection.
- `store/__tests__/savingsPlans.test.ts` — plan CRUD through the store,
  tagging through the ordinary `addTransaction`, status stamping, delete
  refused while tagged transactions exist, report totals excluding
  contributions.
- `components/savings/SavingsView.test.tsx` — empty state, creating a plan,
  logging a contribution updates the ring and figures through the real store,
  and the completion prompt: nothing picked silently, each choice produces its
  status, "Decide later" changes nothing.
