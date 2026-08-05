<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions (budget-planner)

## Verification gates (must all pass before finishing a task)
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Tests: `npm run test` (vitest; currently 330 tests across 35 files)
- Build: `npm run build`

On Windows PowerShell, invoke via `cmd /c "..."`; do NOT use `&&` or `cd` inside commands.

## State model (current: schema version 3)
- `AppState.version` is `3`; stored under `budget-planner:state` with `CURRENT_STORAGE_VERSION = 3`.
- `validateAppState` (lib/validate.ts) accepts versions 1–3 and migrates: v1 backfills income
  categories and converts tagged `monthlyIncome` transactions into category-bound plans;
  v2 rewrites those into standalone `IncomePlan` entries; legacy field normalization always
  runs. If you change the schema, bump the version everywhere and add a migration.
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
- `IncomePlan` is a **standalone** source: `{ id, month, name, icon, expectedAmount, receivedAmount }`.
  It is NOT tied to income categories. `setIncomePlan(month, id | null, patch)` in
  store/useAppStore.ts upserts ONE source (merge by id; `null` creates). Never rewrite the
  whole `incomePlans` array from a form — the modal drafts per source and saves per entry id
  (regression: "editing one source never wipes another source").
- Income categories still exist for transactions/KPIs; deleting a category is NOT blocked by
  income plans (there is no `in-use-income-plans` reason anymore).

## Icon picker
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

## Other gotchas
- `Select` requires a `label` prop. Never render plain objects as React children.
- `Modal`/`Drawer` use a shared scroll lock and only react to Escape when focus is inside
  their own dialog — nested dialogs are supported (e.g. IconPicker inside a modal).
- `react-hooks` rules are strict here: no setState synchronously inside effects (seed state
  at mount instead), no render-time ref writes.
- Docs in `docs/` (PROJECT_SPEC, UI_UX_SPEC, ARCHITECTURE, ROADMAP) are the source of truth
  and must be updated when behavior changes; log scope changes in ROADMAP.md "Change log".
