<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (budget-planner)

## Session and context discipline

- **Read a range, not a file.** When a file is large and only part of it matters,
  read that part (`sed -n 'A,Bp'`, Grep with context, Read `offset`/`limit`).
  This repo has files that will eat a context window on their own: `docs/ROADMAP.md`
  (~300 KB), `CHANGELOG.md` (~200 KB), `docs/ARCHITECTURE.md` (~130 KB). Never open
  those whole — grep for the section heading and read from there.
- **Never re-read a doc already read this session** (ROADMAP, ARCHITECTURE,
  PROJECT_SPEC, this file, …) unless it changed since. Reference what is already in
  context. If unsure whether it changed, check the modification time, don't re-read.
- **Say when a task is done.** When a feature is implemented, gated (tsc/lint/test/
  build) and documented, state that plainly and add: this is a good point to `/clear`
  or `/compact` before the next unrelated task. Don't wait to be asked.
- **Call out a topic switch.** When a new prompt starts an unrelated feature area,
  open the response by saying so — e.g. "this is unrelated to the email-parsing work
  above — consider `/clear` first" — rather than silently dragging that history along.
- Generated trees are excluded from context by `.claudeignore` and enforced by
  `permissions.deny` in `.claude/settings.json`. `node_modules/**/*.md` stays readable
  on purpose — the Next.js guides above live there.

## Session handoff

At the end of any substantial task, close with a handoff note the user can paste as
the opening context of a fresh session. **Keep it under ~15 lines** — a long handoff
defeats the point. Omit any section that is empty.

```
HANDOFF — <task>
Built:    <1-3 lines: what now exists/works>
Changed:  <file paths, one line>
Open:     <what is unfinished, or "nothing">
Caveats:  <anything a fresh session would get wrong>
```

State confidence the way the rest of the project does: **verified** (checked against
real data — a real bank statement, a real email body) vs **representative** (built
against a constructed example and therefore probably wrong). See ARCHITECTURE §4.1a
and docs/15_EMAIL_PARSING.md.

## Maintaining this file

- **Two strikes.** Add a standing note the SECOND time the user corrects the same
  thing, not the first — first occurrences are usually one-offs, and a file of
  one-offs stops being read.
- **Under ~200 lines.** If something must go in and there is no room, remove
  something stale first. Rationale and history belong in `docs/`; this file holds
  rules and invariants only.
- **Flag, don't silently keep.** When you open this file for any edit, scan for notes
  that are no longer true or whose purpose is no longer clear, and surface them to the
  user for removal. Never delete a rule you merely don't understand.
- Never record a number here that changes on every commit (test counts, file counts).

## Verification gates (must all pass before finishing a task)
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Tests: `npm run test` (vitest; 1 env-gated skip is expected — the runner prints
  the current counts, so do not hard-code them here)
- Build: `npm run build`

On Windows PowerShell, invoke via `cmd /c "..."`; do NOT use `&&` or `cd` inside commands.

## State model (current: schema version 10)
- `AppState.version` is `10`; stored under `budget-planner:state` with `CURRENT_STORAGE_VERSION = 10`.
  Bumping the schema means bumping BOTH — they are separate constants in separate files
  (lib/types.ts + lib/seed.ts, and lib/storage.ts); missing the second one silently
  mis-snapshots every save as "legacy".
- `validateAppState` (lib/validate.ts) accepts versions 1–10 and migrates each forward;
  legacy field normalization always runs. Two rules hold across every migration: a
  backfill opts NOBODY in (rollover, debt and badges all backfill empty), and an icon fix
  matches the lowercase name AND the specific wrong icon, so an icon the user has since
  changed is never stomped (both icon passes share `applyIconFixes`). Per-version detail:
  ARCHITECTURE.md. If you change the schema, bump the version everywhere and add a
  migration.
- **Rollover budgets (FR-19) are opt-in per CATEGORY and read-only history.**
  `Category.rollover?: boolean` is the opt-in — on the category, not the per-month
  `Budget` (budgets are recreated monthly, so a per-budget flag would switch itself off).
  Only `setCategoryRollover` writes it; OFF is stored as absent, never `false`.
  `AppState.rollovers` is append-only: one record per (category, month), written ONCE at
  the month transition and NEVER recalculated — that is what keeps a past month's limit
  equal to what it actually was. Read through `effectiveLimit` / `rolledOverInto` /
  `budgetProgress` (lib/selectors.ts); produce ONLY through `computeRollovers`
  (lib/rollover.ts imports selectors.ts, never the reverse). Every rollover-aware
  selector takes `rollovers` as an OPTIONAL last argument defaulting to `[]` — keep it
  that way so pre-FR-19 call sites stay unchanged. The transition runs from
  `hooks/useRollover.ts` at AppShell mount and detects a new month by the ABSENCE of
  records for it — do not add a "last opened month" marker. Never show a boosted limit
  as a bare bigger number: use `RolloverBadge` + the base + carry breakdown.
- **Category display goes through ONE registry: `lib/categoryRegistry.ts`.** Any
  component rendering a category's name, icon or colour calls `categoryDisplay()`
  (or `findCategoryDisplay()`) and applies only presentational overrides on top.
  Never read `category.icon` directly, and never call `categoryColor` /
  `categoryAccent` / `budgetRowTreatment` from a component — those are registry
  internals now. `categoryRegistry.test.tsx` scans component sources and fails on
  any bypass. New user-created categories need no registration; the registry derives
  from the stored record.
- **Category names are display-formatted, never rewritten.** Names are user data AND the
  lookup key for `categoryAccent`/`budgetRowTreatment`. Print them through
  `categoryLabel` / `categoryLabelOr` (lib/categoryDisplay.ts), which capitalizes only the
  first letter — a category stored as "internet" reads "Internet" everywhere. Never
  capitalize at the store or in a migration.
- **Persistence goes through ONE seam: `lib/storageAdapter.ts`.** Never call
  `window.localStorage` from app code (except the intentional fallbacks in
  `lib/theme.ts` bootstrap and the adapter's browser backend). In Electron it routes
  through the preload bridge into SQLite in the main process (`electron/db.cjs`, kv
  table at `<userData>/budget-planner.sqlite3`); the renderer must never touch SQLite
  directly. `better-sqlite3` is Electron-ABI only — never import it in code loaded by
  vitest. `npm run db:check` verifies the native module.
- **Desktop features also go through IPC** — `lib/desktop.ts` types the whole bridge
  (`storage`, `dialog`, `fs`, `shell`, `notify`, `paths`, `backups`, `menu`); renderer
  helpers in `lib/desktopFeatures.ts`, wired once from `AppShell` via
  `lib/desktopBootstrap.ts`. Never call `dialog`/`shell`/`fs` from the renderer
  directly; never write outside `<userData>` except through the save dialog (main
  enforces absolute paths + `.json`-only + 16 MB cap); keep every feature a no-op when
  `isDesktop()` is false. Backups: `electron/backups.cjs` (atomic, deduped, newest 30).
  Native menu: `electron/menu.cjs`, sending `desktop:menu:action` to the renderer.
- **Startup/identity (Phase 4):** `electron/splash.cjs` shows a frameless splash before
  the main window (`main.cjs` closes it on `ready-to-show`, skips it under `--smoke`).
  Renderer version strings come from `lib/version.ts` — never hard-code "1.0"-style
  labels. `electron/updater.cjs` is packaged-only and inert without a feed — never let
  it touch the network when no feed is configured. `npm run icon` regenerates
  `build/icon.ico|png`; keep the splash SVG visually in sync with the icon.
- `IncomePlan` is a **standalone** source, NOT tied to income categories.
  `setIncomePlan(month, id | null, patch)` upserts ONE source (merge by id; `null`
  creates). Never rewrite the whole `incomePlans` array from a form — the modal drafts
  per source and saves per entry id (regression: "editing one source never wipes
  another"). Deleting a category is NOT blocked by income plans.

## First-run onboarding
- Gate: `settings.firstRunDone` (seeded **false**). `AppShell` renders
  `OnboardingFlow` INSTEAD of the shell while false — keep `TitleBar` + `ToastHost`
  mounted, drop sidebar/header/nav/name-modal, clear the 44px title bar with `pt-11`.
- Step position is SEPARATE state: `onboarding:step` via the storage seam
  (`lib/onboarding.ts`) — never in AppState. `store/useOnboarding.ts` must stay
  `ready: false` until AppShell seeds it at mount, or onboarding flashes for returners.
- Guided setup MUST write through the ordinary actions (`setIncomePlan`, `addCategory`,
  `addBudget`). Never add an onboarding-only save path.
- No Import Statement, tier or upgrade wording anywhere in the flow (asserted by test).
  Spec: `docs/13_ONBOARDING_FLOW.md`.

## Debt payoff (FR-20)
- **`lib/debtPayoff.ts` is pure and stays that way**: no React, no store, no I/O, and
  **no AI/LLM call or network access**. Determinism is a product decision — projections
  must cost nothing and be byte-identical on every machine (a test asserts it). If
  narration is ever wanted, add a NEW module that CONSUMES a `PayoffPlan`; never let it
  compute or override a figure. ARCHITECTURE.md §3.4.
- **`Debt` is a separate record linked one-to-one to a category by `categoryId`** — never
  fold balance/rate/minimum into `Budget.limit`. A limit is one month's allowance and is
  recreated monthly; a debt outlives the month. Only `setCategoryDebt` writes it (`null`
  stops tracking); `deleteCategory` drops it; the validator drops orphans AND duplicates.
- Rates are integer **basis points** (`aprBps`, 1250 = 12.5%). 0% is valid and expected
  (informal/family loans) — never treat it as unset.
- `startingBalance` is display-only; the engine never reads it and `setCategoryDebt` only
  raises it, so paying down cannot rewrite where a debt started.
- With **fewer than 2 debts there is no comparison to show** — render one projection
  (`comparePayoff().mode`).
- Adding a nav destination: `BottomNav` derives its grid from `NAV_ITEMS.length` and
  `NavItem.shortLabel` exists for the ~50px mobile cell. Update both.

## Icon picker
- **Any icon a migration or badge assigns MUST exist in `ICON_GROUPS`**, or the category
  carries a value the picker cannot show as selected and the user cannot re-pick
  (`iconLibrary.test.ts` asserts this).
- `components/settings/iconLibrary.ts` is the registry: emoji options plus a "Line icons"
  vector set (`VECTOR_ICON_COMPONENTS`, keys like `"wallet"`). An icon value is an emoji
  char OR a vector key.
- Render icon strings with `components/ui/IconValue.tsx` — never print the raw string, or
  a vector key renders as text. Recharts axis labels skip the prefix when
  `isVectorIcon(icon)`.
- `IconPicker` persists favourites + recents in localStorage. Pass `vectors={false}` for
  category pickers — categories must stay emoji-only.

## Typography
- The typeface is **Inter**, loaded by `next/font/google` in `app/layout.tsx` and
  reaching the UI as `--font-inter` → `--font-sans` → `body`. **Never name a typeface in
  a component.** The Electron splash is a data: URL and cannot reference the bundled
  file, so it inlines the same woff2 as a data URI (`interFontFace()`).
- Figures use `tabular-nums` so money lines up. It is built into `AnimatedNumber`,
  `AnimatedMoney` and `MetricCard` — render through those rather than adding the class
  by hand. Running prose containing an amount is deliberately left proportional.

## Email alerts (FR-24) — SECURITY-SENSITIVE
- **Never add a "read secret" IPC channel.** The vault exposes available/set/status/
  clear only; `reveal()` is main-process-only and its return value must never cross
  IPC, be logged, or be written anywhere. See ARCHITECTURE §3.3b.
- **No plaintext fallback, ever.** If `safeStorage.isEncryptionAvailable()` is false,
  `set()` writes nothing and returns `encryption-unavailable`. Do not add base64
  "obfuscation" or a localStorage path — the feature is desktop-only precisely because
  a web page has no OS-backed secret store.
- **Sender matching is exact-host-or-subdomain, never substring.** A substring match
  accepts `gtbank.com.attacker.example`; a test asserts it must not.
- **Allowlist entries are VERIFIED SENDING DOMAINS, never brand-derived guesses.**
  Quick Microfinance Bank sends from `quickmart.com`. Never add a brand-name fallback —
  it would be an allowlist bypass.
- **Templates are tiered.** GTBank / Wema / Quick MFB are VERIFIED against real mail
  (fixtures in `emailAlertsReal.test.ts`); the other seven are representative guesses,
  banner-marked in the registry. Every Tier 1 template was wrong before its samples
  arrived — two were not recognised as alerts at all — so assume Tier 2 is wrong too.
- **Never write a template pattern that assumes `Label: Value` on one line.** GTBank and
  Wema send HTML tables (`| Label | : | Value |` after conversion); Quick MFB puts the
  value on the NEXT line. `normalizeAlertBody` flattens the former; the shared `LV`
  separator crosses one newline for the latter.
- **Merchant extraction is phone-anchored, not longest-segment** — longest-segment
  returns the ACCOUNT HOLDER on real data.
- **One money parser** (`parseMoneyToken` + the `MONEY` fragment) handles every confirmed
  shape. Do not add a second.
- **Balances are never amounts:** negatives are rejected and balance lines stripped before
  amount extraction. GTBank really sends `Available Balance : NGN -28.48`.
- **Per-institution parsing is DATA** (`ALERT_TEMPLATES`), read by one shared evaluator.
  Add a bank by adding a template + tests, never a new function; a guard test fails if a
  sender is added without a matching template.
- **A parse failure must surface**, never vanish: return `needs-review` with the fields
  read, the ones missing, and a capped snippet.
- `lib/emailPipeline.ts` owns NO categorization and NO duplicate logic — it calls
  `suggestCategory` and `findDuplicateCandidates` so both paths stay consistent.
  Format detail: `docs/15_EMAIL_PARSING.md`.

## Tray & background mode (FR-26)
- **The close-behaviour decision stays in `electron/backgroundMode.cjs`, which imports
  nothing from `electron`.** That is what makes it testable without a main process. An
  explicit quit and a missing tray each force a quit regardless of the setting — never
  remove either guard: one stops the tray trapping the app, the other stops it hiding
  the window somewhere unreachable. Default is OFF and every migration backfills OFF.
- **Main is TOLD `settings.backgroundMode` by the renderer; it never parses AppState.**
- **Quick-add is the same app at `/quick-add`, calling the ordinary `addTransaction`.**
  Never give it its own write path. `AppShell` must keep branching on the route BEFORE
  `MainShell` mounts — that second renderer must not run the write-at-mount hooks.
- Cross-window sync is a bare `desktop:state:changed` ping; never send state over it.

## Learned categorization (FR-22)
- **`suggestCategory` in lib/learnedRules.ts is THE categorization entry point.** It takes
  plain strings (`{description, merchant?, provider?, direction?}`), not a statement row,
  so anything needing a suggestion (the email-alert parser included) calls it rather than
  copying the logic. `activeRuleFor` is a thin enabled-only wrapper.
- Matching: ALL exact key matches across every signal first, THEN token-overlap fuzzy at
  `FUZZY_MATCH_THRESHOLD` (0.82), resolved per signal. Keep the threshold high — a false
  positive files money under the wrong category, which is worse than asking again.
- `confident` (strength >= `RULE_MIN_STRENGTH`) separates **pre-fill** from **auto-apply**.
  Do NOT weaken the activation threshold to make suggestions appear sooner.
- Learned mappings live in **`AppState.learnedRules`**, not a separate `budget-planner:*`
  key — they reference `Category` ids, so they must be validated, migrated, exported and
  restored WITH the ledger. ARCHITECTURE §3.4a.
- `lastUsedAt` is stamped only when a pre-filled row is imported WITHOUT being overridden
  (corrections are learning, not usage). Nothing expires automatically.

## Streaks & badges (FR-21)
- **Never define "on track" a second time.** `lib/streak.ts` defers to
  `budgetUtilizationSeries` and only interprets its result. Compare RAW totals, never the
  rounded `pct` — 100.4% rounds to 100.
- The streak counts **finished months only**. A month with no budgets is `no-data` and
  BREAKS a run — it must never qualify by having nothing to fail.
- **Streak is derived every read; badges are persisted append-only.** A streak must follow
  edits to past months; an achievement must survive a reset. Streak-based criteria
  therefore measure `longest`, never `current`.
- **Badges are data** — add one by appending to `BADGES`, never by adding component code
  or a conditional. `criteria` is a descriptor read only by `criteriaMet`.
- **`reward` is reserved, always `null`, and nothing reads it.** There is NO
  reward-granting logic here. A future perk system goes in a NEW module that READS the
  field — do not add behaviour to the evaluator. ARCHITECTURE.md §3.5.

## Deriving state at mount
- **State DERIVED from store data must be derived every render, via
  `hooks/useOverridableValue.ts` — never frozen in a lazy `useState` initializer.**
  It tracks the derived value until `set` is called, then keeps the user's value (a
  falsy one included). Two bugs came from freezing it.
- **Persistence here is SYNCHRONOUS** — `lib/storageAdapter.ts` is sync in both browser
  and Electron, so zustand persist hydrates inside `create()` before React renders.
  "The store hadn't hydrated" is NOT a real failure mode in this codebase; both bugs
  above were originally misdiagnosed that way. `useOverridableValue.test.tsx` fails
  first if that ever changes.
- A lazy initializer is still CORRECT for a form draft seeded from a prop
  (`TransactionForm`, `CategoryModal`, `BudgetForm`) — those are meant to freeze, and are
  restarted with a keyed remount, never by syncing state.
- `useOnboarding` / `useDisplayName` are the only genuinely deferred stores. Subscribe
  reactively and gate on their `ready` flag; never snapshot them into `useState`.
  ARCHITECTURE.md §3.3a.

## Other gotchas
- `Select` requires a `label` prop. Never render plain objects as React children.
- `Button`'s size presets hard-code horizontal padding (`sm` = `px-3`), and a `px-0` via
  `className` does NOT win (equal specificity), so an icon-only `Button` sized `w-6` gets
  a 0px content box. Build icon-only row buttons as plain `<button>`s with an explicit
  square and `shrink-0` on the glyph (see `BudgetRow`, `RecentActivity`).
- `Modal`/`Drawer` use a shared scroll lock and only react to Escape when focus is inside
  their own dialog — nested dialogs are supported (e.g. IconPicker inside a modal).
- `react-hooks` rules are strict here: no setState synchronously inside effects (seed state
  at mount instead), no render-time ref writes.
- Docs in `docs/` (PROJECT_SPEC, UI_UX_SPEC, ARCHITECTURE, ROADMAP) are the source of truth
  and must be updated when behavior changes; log scope changes in ROADMAP.md "Change log".
