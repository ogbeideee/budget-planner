# Budget Planner Desktop
# Onboarding Flow Specification

This document completely defines the first-run experience.

A new user never reaches the Planner dashboard until this flow is finished.

--------------------------------------------------
FLOW GOAL
--------------------------------------------------

Two jobs, in order:

1. Say what this app is for, in three screens, without a wall of text.
2. Collect the minimum data the Planner needs to be worth looking at —
   expected income and at least two funded budgets.

The dashboard is meaningless with no income and no budgets. Guided setup
exists so nobody's first view is an empty state.

--------------------------------------------------
SCOPE — FREE TIER ONLY
--------------------------------------------------

Onboarding never mentions Import Statement, paid tiers, premium features or
upgrades. Upgrade messaging belongs elsewhere in the app, later. A test
(`OnboardingFlow.test.tsx`) asserts the rendered copy contains none of
"Import", "Premium", "Pro", "Upgrade" or "free trial".

--------------------------------------------------
STEP ORDER
--------------------------------------------------

    pitch-plan  ->  pitch-track  ->  pitch-compare  ->  setup-income  ->  setup-budgets  ->  Planner
       |               |                |                  |                  |
       +--- Skip introduction ----------+----------------->|                  |
                                                     (no skip past here)

`ONBOARDING_STEPS` in `lib/onboarding.ts` is the single ordered list. `PITCH_STEPS`
and `SETUP_STEPS` are derived from it by prefix, so adding a step in one place
updates the indicator, the skip target and the tests together.

--------------------------------------------------
LAYOUT
--------------------------------------------------

Full window. `AppShell` returns the onboarding tree INSTEAD of the normal
shell — no sidebar, no header, no bottom nav, no name-setup modal.

What stays mounted:

• `TitleBar` — the window must remain draggable and closable throughout.
• `ToastHost` — so store-level feedback still surfaces.

The flow container is `fixed inset-0 z-30 ... pt-11`. The `pt-11` (44px) clears
the custom title bar so no onboarding content renders under the window
controls. Content is centred in a `max-w-xl` (pitch) / `max-w-2xl` (setup)
column and scrolls within the container on short viewports.

--------------------------------------------------
PITCH SCREENS
--------------------------------------------------

Three screens. Each: an icon tile, a headline, one supporting paragraph, the
step indicator, the buttons, and the skip link.

  1. "Plan the month before you spend it"
     Give each category a limit for the month. The planner keeps a running
     total of what is committed and what is still free to allocate.
     Icon: target.

  2. "See where the money actually goes"
     Every expense lands in a category, so a budget going over shows up while
     you can still do something about it — not at month end.
     Icon: grid.

  3. "Watch it change month to month"
     Once you have a couple of months recorded, reports compare them so you
     can see what is improving and what needs attention.
     Icon: trending up.

Controls

  Screen 1     [ Next ]                    Skip introduction
  Screen 2     [ Back ] [ Next ]           Skip introduction
  Screen 3     [ Back ] [ Get started ]    Skip introduction

"Get started" and "Skip introduction" both land on `setup-income`.

STEP INDICATOR

An `<ol>` of pills: the active one is `w-6 bg-brand-500`, the rest are
`w-1.5 bg-border`. `aria-label` reads "Step N of 3" and the active item carries
`aria-current="step"`. There is no stepper primitive in
`05_COMPONENT_LIBRARY.md` yet — this is the smallest thing that reads as one,
built from existing tokens. If a stepper is ever added to the library, this and
`SetupFrame` should both adopt it.

--------------------------------------------------
GUIDED SETUP — NOT SKIPPABLE
--------------------------------------------------

Both setup steps use `SetupFrame` (heading, "Step N of 2", the same indicator,
body, pinned footer). `SetupFrame` renders NO skip affordance.

STEP 1 — INCOME

  Add one or more named income sources for the current month: icon (via the
  shared `IconPicker`), name, expected amount.

  Validation: "Continue" is disabled until at least one source has an expected
  amount above zero. Pressing it while disabled reveals an inline
  `role="alert"` line — "Add at least one income source before continuing."
  Never a dialog or a native alert.

  DATA REUSE: saves through `setIncomePlan(month, null, { ... })` — the exact
  store action the Planner's "Add Income" modal calls. Sources are written
  immediately, so income created here is ordinary income data from the first
  moment. Removing a source zeroes its amounts, matching the modal's own
  delete semantics.

STEP 2 — BUDGETS

  Suggested starter categories are one-tap chips from `SUGGESTED_BUDGETS`
  (`lib/onboarding.ts`): Groceries, Transport, Rent, Essentials, Internet,
  Airtime, Loan, Savings. Tapping one adds a row with an inline amount field —
  it does NOT open the full category form.

  Every suggested icon must exist in `ICON_GROUPS`, asserted per-suggestion in
  `lib/__tests__/onboarding.test.ts`. This is the same rule the category-icon
  migrations follow: never assign an icon the picker cannot show as selected.

  "Add a different category" expands an inline row for anything not suggested:
  name, icon (shared `IconPicker` with `vectors={false}`, because category
  icons print as raw text in chart axes and `<option>`s), and limit.

  Validation: "Finish setup" is disabled until at least TWO rows have a limit
  above zero. Same inline `role="alert"` treatment — "Add at least 2 categories
  with a limit above zero."

  RUNNING TOTAL: "{allocated} of {income} allocated", where income is the sum
  of step 1's sources for the month. Context only — allocating beyond income is
  allowed here and is not blocked.

  DATA REUSE: rows are local drafts until "Finish setup", then committed
  through `addCategory` and `addBudget` — the same actions the Settings
  category form and the Planner's "New budget" form use. A draft whose name
  matches an existing expense category REUSES that category rather than
  creating a duplicate (a new install already seeds several).

ON FINISH

  1. Commit each funded draft (category if needed, then budget).
  2. `setSettings({ firstRunDone: true })`.
  3. `clearOnboardingStep()`.

  `AppShell` then renders the normal shell, and the Planner shows the real
  income and budgets just created.

--------------------------------------------------
PERSISTENCE
--------------------------------------------------

TWO pieces of state, deliberately in different places.

COMPLETED FLAG — `AppState.settings.firstRunDone`

  The field already existed for exactly this purpose but was seeded `true` and
  never read. `createInitialState()` now seeds it **false**, so:

    new install          -> false -> onboarding runs
    any existing stored  -> true  -> never re-onboarded

  This is why no migration was needed and why pre-existing accounts are not
  retroactively forced through the flow (see NOT IN SCOPE).

STEP POSITION — `onboarding:step` via the storage seam

  A tiny local preference in `lib/onboarding.ts`, mirroring
  `lib/displayName.ts`: written through `getStorageBackend()` (SQLite on
  desktop, localStorage in the browser), NOT part of AppState. It never needs a
  schema migration and an import/restore of the ledger leaves it untouched.

  `loadOnboardingStep()` is defensive: absent, corrupt or unrecognised values
  all fall back to the first pitch screen, so a bad value can never strand a
  user on a blank step. The legacy `"setup"` value (written before guided setup
  was split into two steps) maps forward to `setup-income`.

INTERRUPTION SAFETY

  Every navigation persists before it renders (`useOnboarding.goTo`). Close the
  app on step 2 of guided setup and it reopens on step 2 — income already
  saved, budgets not yet committed. Nothing is half-written: income is real as
  soon as it is added, budgets are all-or-nothing at Finish.

  `useOnboarding` starts `ready: false` on BOTH server and client and is seeded
  in `AppShell`'s mount effect, exactly like `useDisplayName`. Without that gate
  onboarding would render into the server HTML and vanish on hydration for a
  returning user.

--------------------------------------------------
NOT IN SCOPE
--------------------------------------------------

• Retroactive onboarding for accounts created before this flow existed. They
  carry `firstRunDone: true` and go straight to the dashboard. Backfilling them
  is a separate decision.
• Display-name capture. `NameSetupModal` still runs on first dashboard view if
  no name is saved. Folding it into guided setup is a reasonable follow-up.
• Any premium, tier or Import Statement messaging.
