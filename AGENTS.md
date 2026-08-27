<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (budget-planner)

## Verification gates (must all pass before finishing a task)
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Tests: `npm run test` (vitest; currently 1525 tests across 102 files, 1 env-gated skip)
- Build: `npm run build`

On Windows PowerShell, invoke via `cmd /c "..."`; do NOT use `&&` or `cd` inside commands.

## State model (current: schema version 9)
- `AppState.version` is `9`; stored under `budget-planner:state` with `CURRENT_STORAGE_VERSION = 9`.
  Bumping the schema means bumping BOTH — they are separate constants in separate files
  (lib/types.ts + lib/seed.ts, and lib/storage.ts); missing the second one silently
  mis-snapshots every save as "legacy".
- `validateAppState` (lib/validate.ts) accepts versions 1–9 and migrates: v1 backfills income
  categories and converts tagged `monthlyIncome` transactions into category-bound plans;
  v2 rewrites those into standalone `IncomePlan` entries; v3 backfills the `learnedRules`
  array (learned classification rules, prompt 6A — new in v4); v4 corrects two category
  icons ONCE by lowercase name AND the specific wrong icon — "Edi" 🌲/🌱→📶, "Essentials"
  🏪/🎁→🧺 — so an icon the user has since changed is never stomped and both stay editable;
  v5 runs a second icon audit ("Loan" 💰→💸, "Misc" 🛒→📦, "internet" 💡→🌐); both
  icon migrations share `applyIconFixes`; v6 backfills `rollovers: []` and opts NOBODY
  into rollover; v7 backfills `debts: []` + `settings.debtStrategy` and flags NO category
  as debt; v8 backfills `badges: []` and awards nothing retroactively. Legacy field
  normalization always runs.
  If you change the schema, bump the version everywhere and add a migration.
- **Rollover budgets (FR-19) are opt-in per CATEGORY and read-only history.**
  `Category.rollover?: boolean` is the opt-in — on the category, not the per-month
  `Budget`, because budgets are recreated each month and a per-budget flag would switch
  itself off every month. Only `setCategoryRollover` writes it, and OFF is stored as
  absent, never `false`. `AppState.rollovers: RolloverRecord[]` is append-only history,
  one record per (category, month), written ONCE at the month transition and NEVER
  recalculated — that is what keeps a past month's limit equal to what it actually was.
  Read through `effectiveLimit` / `rolledOverInto` / `budgetProgress(b, tx, rollovers?)`
  in lib/selectors.ts; produce ONLY through `computeRollovers` in lib/rollover.ts
  (rollover.ts imports selectors.ts, never the reverse — keep that one-directional).
  Every rollover-aware selector takes `rollovers` as an OPTIONAL last argument defaulting
  to `[]`, so pre-FR-19 call sites stay bit-for-bit unchanged; keep it that way.
  The transition runs from `hooks/useRollover.ts` at mount in AppShell and detects a new
  month by the ABSENCE of records for it — do not add a "last opened month" marker.
  Never display a rollover-boosted limit as a bare bigger number: use `RolloverBadge`
  (category registry chip colours) plus the base + carry breakdown.
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
  `lib/theme.ts` bootstrap and the adapter's browser backend). In Electron the seam
  routes through the preload bridge (`window.budgetPlannerDesktop.storage`,
  `lib/desktop.ts`) into SQLite in the main process (`electron/db.cjs`, kv table at
  `<userData>/budget-planner.sqlite3`); the renderer must never access SQLite directly.
  First-launch migration from localStorage runs in the preload (backup row
  `budget-planner:backup:migration-browser:*` + rows + marker in one transaction).
  `better-sqlite3` is Electron-ABI only — never import it in code loaded by vitest.
  `npm run db:check` verifies the native module.
- **Desktop features also go through IPC** (`lib/desktop.ts` types the whole bridge:
  `storage`, `dialog`, `fs`, `shell`, `notify`, `paths`, `backups`, `menu`). Renderer
  helpers live in `lib/desktopFeatures.ts` (bridge wrappers + `startAutoBackups`);
  `lib/desktopBootstrap.ts` wires auto-backups + native-menu actions into the store and
  is initialized once from `components/shell/AppShell.tsx`. Rules: never call
  `dialog`/`shell`/`fs` APIs from the renderer directly; never write outside
  `<userData>` except through the save dialog (main enforces absolute paths +
  `.json`-only writes + 16 MB cap); keep every feature a no-op when `isDesktop()` is
  false (browser mode is unchanged). File backups live in `<userData>/backups/`
  (`electron/backups.cjs`: atomic writes, content dedupe, prune to newest 30). The
  native menu is `electron/menu.cjs`; menu items that need app state send
  `desktop:menu:action` to the renderer.
- **Startup/identity (Phase 4):** `electron/splash.cjs` shows a frameless splash
  (data: URL, no preload) before the main window; `main.cjs` closes it on
  `ready-to-show` and skips it under `--smoke`. `app/loading.tsx` renders the
  shared `PageSkeleton` during hydration. Renderer version strings come from
  `lib/version.ts` (`APP_NAME`/`APP_VERSION` imported from package.json) — never
  hard-code "1.0"-style labels; the desktop runtimes come from `getAppInfo().versions`.
  `electron/updater.cjs` is an auto-update scaffold on `electron-updater`: generic
  feed via `AUTO_UPDATE_URL` env or `<userData>/update-feed.txt` (env wins),
  packaged-only and inert without a feed — never call the network from it when a
  feed is absent. The app icon is drawn by `scripts/make-icon.mjs` (SDF +
  supersampling, pure Node; `npm run icon` regenerates `build/icon.ico|png`);
  keep the splash SVG in `electron/splash.cjs` visually in sync with the icon.
- `IncomePlan` is a **standalone** source: `{ id, month, name, icon, expectedAmount, receivedAmount }`.
  It is NOT tied to income categories. `setIncomePlan(month, id | null, patch)` in
  store/useAppStore.ts upserts ONE source (merge by id; `null` creates). Never rewrite the
  whole `incomePlans` array from a form — the modal drafts per source and saves per entry id
  (regression: "editing one source never wipes another source").
- Income categories still exist for transactions/KPIs; deleting a category is NOT blocked by
  income plans (there is no `in-use-income-plans` reason anymore).

## First-run onboarding
- Gate: `settings.firstRunDone` (seeded **false** in `lib/seed.ts`). `AppShell` renders
  `components/onboarding/OnboardingFlow` INSTEAD of the shell while it is false —
  keep `TitleBar` + `ToastHost` mounted, drop sidebar/header/nav/name-modal, and clear
  the 44px title bar with `pt-11`.
- Step position is SEPARATE state: `onboarding:step` via the storage seam
  (`lib/onboarding.ts`, mirroring `lib/displayName.ts`) — never put it in AppState.
  `store/useOnboarding.ts` must stay `ready: false` until AppShell seeds it at mount,
  or onboarding flashes for returning users.
- Guided setup MUST write through the ordinary actions (`setIncomePlan`, `addCategory`,
  `addBudget`). Never add an onboarding-only save path.
- No Import Statement, tier or upgrade wording anywhere in the flow (asserted by test).
- Spec: `docs/13_ONBOARDING_FLOW.md`.

## Debt payoff (FR-20)
- **`lib/debtPayoff.ts` is pure and stays that way**: no React, no store, no I/O, and
  **no AI/LLM call or network access**. Determinism is the product decision, not an
  implementation detail — projections must cost nothing and be byte-identical on every
  machine (a test asserts it). If narration is ever wanted, add a NEW module that CONSUMES
  a `PayoffPlan` and returns prose; never let it compute or override a figure. See
  ARCHITECTURE.md §3.4.
- **`Debt` is a separate record linked one-to-one to a category by `categoryId`** — never
  fold balance/rate/minimum into `Budget.limit`. A limit is one month's allowance and is
  recreated monthly; a debt outlives the month. Only `setCategoryDebt` writes it (`null`
  stops tracking); `deleteCategory` drops it; the validator drops orphans AND duplicates.
- Rates are integer **basis points** (`aprBps`, 1250 = 12.5%), for the same reason money is
  minor units. 0% is valid and expected (informal/family loans) — never treat it as unset.
- `startingBalance` is display-only (the "% paid off" bar). The engine never reads it, and
  `setCategoryDebt` only raises it, so paying down cannot rewrite where a debt started.
- With **fewer than 2 debts there is no comparison to show** — the strategies are identical
  by definition. Render one projection instead (`comparePayoff().mode`).
- Adding a nav destination: `BottomNav` derives its grid from `NAV_ITEMS.length` (see
  `GRID_COLUMNS`) and `NavItem.shortLabel` exists for the ~50px mobile cell. Update both.

## Icon picker
- **Any icon a migration assigns MUST exist in `ICON_GROUPS`**, or the category ends up
  carrying a value the picker cannot show as selected and the user cannot re-pick
  (`iconLibrary.test.ts` asserts this for every assigned icon).
- `components/settings/iconLibrary.ts` is the icon registry: emoji options plus a "Line
  icons" vector set (`VECTOR_ICON_COMPONENTS`, keys like `"wallet"`). An icon value is an
  emoji char OR a vector key.
- Render icon strings with `components/ui/IconValue.tsx` (never print the raw string — a
  vector key like `"wallet"` renders as text otherwise).
- `components/ui/IconPicker.tsx` has favourites + recents persisted in localStorage
  (`settings:favourite-icons`, `settings:recent-icons`). Pass `vectors={false}` for category
  pickers (categories must stay emoji-only; category icons render as text elsewhere).
- Recharts axis labels: skip the icon prefix when `isVectorIcon(icon)` (see
  components/reports/IncomeSourceChart.tsx).

## Typography
- The app's typeface is **Inter**, loaded by `next/font/google` in `app/layout.tsx`
  (self-hosted woff2, `font-display: swap`, preloaded latin subset, plus Next's
  metric-matched `Inter Fallback` so the swap causes no layout shift). It reaches
  the UI as `--font-inter` → `--font-sans` (`app/globals.css` `@theme`) →
  `body { font-family: var(--font-sans) }`. **Never name a typeface in a
  component.** The Electron splash (`electron/splash.cjs`) is a data: URL and
  cannot reference the bundled file, so it inlines the same woff2 as a data URI
  (`interFontFace()`), falling back to the system stack if the file is absent.
- Figures use `tabular-nums` so money lines up in columns. It is built into the
  number primitives — `AnimatedNumber`, `AnimatedMoney`, and `MetricCard`'s value
  and support slots — so prefer rendering through those over adding the class by
  hand. Running prose containing an amount is deliberately left proportional.

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
- **Templates are tiered.** GTBank / Wema / Quick MFB are corrected against real mail;
  the other seven are representative guesses and are banner-marked in the registry.
  Do not assume a Tier 2 template works.
- **One money parser** (`parseMoneyToken` + the `MONEY` fragment) handles code-prefix,
  code-suffix, symbol-prefix, glued and decimal-less amounts. Do not add a second.
- **Balances are never amounts:** negatives are rejected outright and balance lines are
  stripped before amount extraction. GTBank really sends `Available Balance : NGN -28.48`.
- **Per-institution parsing is DATA** (`ALERT_TEMPLATES` in lib/emailAlerts.ts), read by
  one shared evaluator. Add a bank by adding a template + tests, never a new function.
  A guard test fails if a sender is added without a matching template.
- **A parse failure must surface**, never vanish: return `needs-review` with the fields
  that were read, the ones missing, and a capped snippet.
- `lib/emailPipeline.ts` must own NO categorization and NO duplicate logic — it calls
  `suggestCategory` and `findDuplicateCandidates` so both paths stay consistent.
- Docs: `docs/15_EMAIL_PARSING.md`.

## Learned categorization (FR-22)
- **`suggestCategory` in lib/learnedRules.ts is THE categorization entry point.** It takes
  plain strings (`{description, merchant?, provider?, direction?}`), not a statement row, so
  anything needing a category suggestion — the planned email-alert parser included — calls
  it instead of copying the logic. `activeRuleFor` is a thin enabled-only wrapper.
- Matching: ALL exact key matches across every signal first (an exact key is what the user
  actually corrected), THEN token-overlap fuzzy at `FUZZY_MATCH_THRESHOLD` (0.82), resolved
  per signal. Keep the threshold high — a false positive files money under the wrong
  category, which is worse than asking again.
- `confident` (strength >= `RULE_MIN_STRENGTH`) separates **pre-fill** from **auto-apply**.
  A single correction pre-fills but leaves the row flagged. Do NOT weaken the activation
  threshold to make suggestions appear sooner; use `confident` instead.
- Learned mappings live in **`AppState.learnedRules`**, deliberately not a separate
  `budget-planner:*` key — they reference `Category` ids, so they must be validated,
  migrated, exported, backed up and restored WITH the ledger. See ARCHITECTURE §3.4a.
- `lastUsedAt` is stamped only when a pre-filled row is imported WITHOUT being overridden
  (corrections are learning, not usage). Nothing expires automatically.

## Streaks & badges (FR-21)
- **Never define "on track" a second time.** `lib/streak.ts` defers to
  `budgetUtilizationSeries` (the existing total-spent-vs-total-budgeted selector) and only
  interprets its result. Compare RAW totals, never the rounded `pct` — 100.4% rounds to 100.
- The streak counts **finished months only**; the month in progress never contributes. A
  month with no budgets is `no-data` and BREAKS a run — it must never qualify by having
  nothing to fail.
- **Streak is derived every read; badges are persisted append-only.** That asymmetry is
  deliberate: a streak must follow edits to past months, an achievement must survive a
  reset. Streak-based criteria therefore measure `longest`, never `current`.
- **Badges are data.** Add one by appending to `BADGES` in lib/streak.ts — never by adding
  component code or a conditional. `criteria` is a descriptor read only by `criteriaMet`.
  Badge icons must exist in `ICON_GROUPS` (asserted by test).
- **`reward` is reserved, always `null`, and nothing reads it.** There is NO reward-granting
  logic in this codebase. A future perk system goes in a NEW module that READS the field —
  do not add behaviour to the evaluator. Docs: ARCHITECTURE.md §3.5.

## Deriving state at mount
- **State DERIVED from store data must be derived every render, via
  `hooks/useOverridableValue.ts` — never frozen in a lazy `useState` initializer.**
  `const [v, set, reset] = useOverridableValue(derivedValue)` tracks `derivedValue`
  until `set` is called, then keeps the user's value (a falsy one included).
  Two bugs came from freezing it: the Recommendations default-open card and the
  debt payoff extra-payment field.
- **Persistence here is SYNCHRONOUS** — `lib/storageAdapter.ts` is sync in both the
  browser and Electron, so zustand persist hydrates inside `create()` before React
  renders. A `useState` initializer always sees hydrated store data; "the store
  hadn't hydrated" is NOT a real failure mode in this codebase (both bugs above were
  originally misdiagnosed that way). A test in
  `hooks/__tests__/useOverridableValue.test.tsx` fails first if that ever changes.
- A lazy initializer is still CORRECT for a form draft seeded from a prop
  (`TransactionForm`, `CategoryModal`, `BudgetForm`, …) — those are meant to freeze,
  and are restarted with a keyed remount, never by syncing state.
- `useOnboarding` / `useDisplayName` are the only genuinely deferred stores (seeded
  in AppShell's mount effect). Subscribe to them reactively and gate on their
  existing `ready` flag; never snapshot them into a `useState` initializer.
- Docs: ARCHITECTURE.md §3.3a.

## Other gotchas
- `Select` requires a `label` prop. Never render plain objects as React children.
- `Button`'s size presets hard-code horizontal padding (`sm` = `px-3`). A `px-0`
  passed via `className` does NOT win — equal specificity, compiled CSS order
  decides — so an icon-only `Button` sized `w-6` gets a 0px content box and its
  icon collapses to zero width. Build icon-only row buttons as plain
  `<button>`s with an explicit square and `shrink-0` on the glyph (see
  `BudgetRow`, `RecentActivity`).
- `Modal`/`Drawer` use a shared scroll lock and only react to Escape when focus is inside
  their own dialog — nested dialogs are supported (e.g. IconPicker inside a modal).
- `react-hooks` rules are strict here: no setState synchronously inside effects (seed state
  at mount instead), no render-time ref writes.
- Docs in `docs/` (PROJECT_SPEC, UI_UX_SPEC, ARCHITECTURE, ROADMAP) are the source of truth
  and must be updated when behavior changes; log scope changes in ROADMAP.md "Change log".
