# Budget Planner — System Architecture (Phase 2)

Status: Maintained (refreshed 2026-08-05) · Owner: Project · Deliverable of: `ROADMAP.md` Phase 2
Baseline requirements: `PROJECT_SPEC.md` (Phase 1).

> The project uses Next.js 16.2.12, which has breaking changes vs. older Next.js.
> Before writing any app code, read the relevant guide in `node_modules/next/dist/docs/`
> (e.g. `01-app/01-getting-started`, `01-app/03-api-reference`) and heed deprecation notes.
> In particular verify current conventions for: async `params`/`searchParams`, client/server
> component boundaries, `use client` directives, and metadata APIs.

## 1. Stack decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Framework | Next.js 16.2.12, App Router | Project default; routing + SSR-free static shell |
| UI | React 19.2.4 with `"use client"` components | All app logic is client-side |
| Styling | Tailwind CSS 4 (`@theme` tokens in `app/globals.css`) | Zero-config, token-based design system per `UI_UX_SPEC.md` |
| State | Zustand (`zustand` v5, `persist` middleware) | Minimal boilerplate; persistence seam = localStorage in the browser, SQLite in the Electron main process (via IPC) |
| ID | `createId()` in `lib/ids.ts` — `crypto.randomUUID()` with a `Date.now()`/`Math.random()` fallback | `randomUUID` requires a secure context; the fallback keeps entity creation safe in non-secure contexts (e.g. a packaged desktop shell over `file://`/custom protocol) |
| Charts | Recharts (`recharts` v3) for analytical charts on `/reports`; pure CSS/SVG animated components (CSS width transitions) for the Planner's `BarChart` | Recharts approved by product owner (ROADMAP change log 2026-08-01); bundle is route-split — only the Reports page loads it. Planner keeps the lightweight custom chart (FR-15) |
| Dates | Native `Date` + fixed `"YYYY-MM"` / `"YYYY-MM-DD"` helpers in `lib/date.ts` | No dependency; all parsing/formatting centralized |
| Testing | `vitest` + `@testing-library/react` | See `PHASE-04-IMPLEMENTATION.md` §4 |

## 2. Module layout

```
app/
  layout.tsx                 # root layout: fonts, <html lang="en">, <AppShell>
  page.tsx                   # /  Planner (primary workspace)
  todo/page.tsx              # /todo  (actionable recommendations, FR-17)
  history/page.tsx           # /history  (chronological ledger)
  reports/page.tsx           # /reports
  settings/page.tsx          # /settings
  upcoming/page.tsx          # /upcoming  (future expenses + funding urgency)
  globals.css                # Tailwind entry + @theme design tokens
  error.tsx                  # fatal error boundary -> RecoveryPanel
components/
  shell/  AppShell.tsx, Sidebar.tsx, BottomNav.tsx, Header.tsx, PageHeader.tsx, nav.ts
  ui/     Button.tsx, Card.tsx, Input.tsx, Select.tsx, Modal.tsx, Drawer.tsx,
          ConfirmDialog.tsx, Disclosure.tsx, EmptyState.tsx, Toast.tsx, ToastHost.tsx,
          MonthPicker.tsx, Slider.tsx, ProgressBar.tsx, SectionHeading.tsx,
          PageSkeleton.tsx, AnimatedNumber.tsx, IconPicker.tsx, IconValue.tsx, icons.tsx
  onboarding/ OnboardingFlow.tsx, SetupFrame.tsx, SetupIncomeStep.tsx,
              SetupBudgetsStep.tsx  — first-run only; AppShell renders this
              INSTEAD of the shell while `settings.firstRunDone` is false
  planner/ PlannerView.tsx, Hero.tsx, SummaryCards.tsx,
           BudgetStatusBand.tsx, reviewBudgets.ts, BudgetList.tsx, BudgetForm.tsx,
           BudgetRow.tsx, PriorityBadge.tsx,
           AllocationDrawer.tsx, QuickAddExpense.tsx, DeferredSection.tsx,
           InsightsPanel.tsx, ExpenseBreakdown.tsx (Reports only — no longer
           on the Planner), BudgetSuggestions.tsx, IncomeModal.tsx, RecurringSuggestions.tsx
  history/ HistoryView.tsx, TransactionList.tsx
  txn/     TransactionForm.tsx, TransactionRow.tsx, TransactionFilters.tsx,
           RecurrenceForm.tsx, RecurringQuickFill.tsx, AnomalyNote.tsx
  upcoming/ UpcomingView.tsx, FutureExpenseForm.tsx
  reports/ ReportsView.tsx, ChartCard.tsx, chartStyles.ts, IncomeExpenseChart.tsx,
           SpendingTrendChart.tsx, SavingsChart.tsx, BudgetUtilizationChart.tsx,
           TopCategoriesChart.tsx, ExpectedVsActualChart.tsx, IncomeSourceChart.tsx,
           IncomeTrendChart.tsx, MonthlyOverview.tsx, FinancialInsights.tsx,
           CategoryAnalysisChart.tsx, CashFlowChart.tsx, ForecastCard.tsx,
           Recommendations.tsx
  todo/    TodoView.tsx
  insights/ InsightList.tsx
  settings/ SettingsView.tsx, SettingsNav.tsx, ProfilePanel.tsx, AppearancePanel.tsx,
            BudgetPreferencesPanel.tsx, CategoryManager.tsx, CategoryModal.tsx,
            IncomeSourcesPanel.tsx, IncomeSourceModal.tsx, DataBackupsPanel.tsx,
            AboutPanel.tsx, BackupsManager.tsx, categoryColors.ts, iconLibrary.ts
  theme/   ThemeToggle.tsx
  recovery/ RecoveryPanel.tsx
  charts/  BarChart.tsx            # custom animated CSS chart (Planner, FR-15)
lib/                          # pure TS, zero React imports — unit-tested (17 test files)
  types.ts                    # AppState + entity interfaces (PROJECT_SPEC §6.1)
  ids.ts                      # createId() — randomUUID + non-secure-context fallback
  date.ts                     # isMonth/isIsoDate, monthKey, parseMonth, monthOffset,
                              # todayIso, dateToIso/isoToDate, daysBetween, nextMonthDate,
                              # formatMonthLabel/Short, formatDateShort, ...
  money.ts                    # formatMoney(minor, currency), toMinorUnits(input),
                              # minorToInput(), compactMoney(), MINOR_UNITS_PER_UNIT
  finance.ts                  # monthFinance(transactions, incomePlans, month) — the single
                              # source of truth for Received/Expected/Expenses/Net/Remaining/
                              # Projected remaining/Savings rate (pure)
  selectors.ts                # spent(), totals(), budgetProgress(), isDeeplyOverBudget(),
                              # overBudgetCategories(), deferredExpenses(),
                              # spendingByCategory(), receivedForMonth(), sortTransactions(),
                              # windowMonths(), monthlySeries(), budgetUtilizationSeries(),
                              # incomePlan selectors (pure)
  funding.ts                  # fundingNeeds(budgets, categories, futureExpenses, month) —
                              # the single source of truth for "Needs Funding": every
                              # funding surface (Planner panel, health checklist, header
                              # status, insights) derives from it (pure)
  allocation.ts               # clampAllocation(), totalAllocated() (pure, FR-11)
  insights.ts                 # insightsFor(...) -> Insight[] (pure, FR-13)
  todo.ts                     # todoFor(state, month) -> TodoItem[] (pure, FR-17)
  predictions.ts              # monthlyPredictions() — avg daily spend, projected month-end
  recommendations.ts          # budgetSuggestions() (FR-13)
  reportTrends.ts             # reportTrends() — 6-month window series for Reports
  monthStats.ts               # monthStats() — planner "month at a glance" metrics
  budgetHealth.ts             # budgetHealth() — score + checklist (FR-14)
  accents.ts                  # categoryColor() + CATEGORY_COLOR_FALLBACK (shared palette)
  timeline.ts                 # timelineLabel(), groupTransactionsByTime() (history buckets)
  upcoming.ts                 # groupLabel(), groupFutureExpenses(), fundingUrgency()
  recurrence.ts               # generateInstances(rule, month), recordException(rule, month, id)
  recurringPatterns.ts        # detectRecurringPatterns(), weightedExpectedAmount(),
                              # isPatternDue(), patternsDueBetween() — FR-25 recurring
                              # patterns (pure, derived from the ledger, never persisted)
  anomalies.ts                # categoryRecentAverage(), checkAnomaly() — FR-25 soft
                              # anomaly verdicts for a new entry (pure)
  categorize.ts               # suggestCategory(), rememberMapping() (keywords + learned)
  statementImport.ts          # statement file reading: CSV/Excel/PDF → cells (parseCsv,
                              # parseAmountCell, rowsFromPdf/rowsFromExcel,
                              # extractStatementRows, buildCandidates, detectCategory);
                              # PDFs whose text layer is missing/useless route to OCR
                              # via extractStatementRowsWithOcr (8D)
  ocrService.ts               # OcrService abstraction (recognize(image, page), isAvailable()
                              # never throws) + the Tesseract.js 5.1.1 implementation —
                              # 100% local: assets served by the app itself from
                              # /vendor/tesseract (UMD injected as a classic script, worker/
                              # core/lang paths there too, gzip: false, workerBlobURL: true);
                              # a missing asset → unavailable → graceful user message
                              # (no network, ever; nothing logs statement content)
  statementOcr.ts             # scanned-statement OCR orchestration (8D): needsOcr(cells)
                              # (empty / < 40 chars / no row with a date AND an amount →
                              # true), ocrPdfToCells(data, {service, onPhase, signal,
                              # renderPage}) — lazy pdfjs, pages rendered at scale 3
                              # (216 dpi), per-page failure isolation (failedPages), abort
                              # via AbortSignal (OcrAbortError), phase callbacks; OCR text
                              # → the SAME cell grid shape the text pipeline produces;
                              # extractStatementRowsWithOcr(file) routes CSV/Excel (never
                              # OCR'd), text-layer PDFs (never OCR'd) and scanned PDFs
  statementTypes.ts           # NormalizedBankTransaction + enums (kind/direction/confidence/
                              # status/sourceBank + deterministic TransactionType, 8F +
                              # categoryConfidence/categoryReason, 8G) — the
                              # canonical import intermediate;
                              # BankStatementParser contract + BankParseResult (Prompt 7A)
  statementNormalize.ts       # candidatesToNormalized() — detection → normalized model
                              # (classification stays neutral; next phase)
  statementRegistry.ts        # BANK_PARSERS — the only place the pipeline learns about a
                              # bank (Prompt 7A): parser contract entries = id + label +
                              # detection rule (headerScore, distinctiveTokens,
                              # minHeaderScore) + parse; adding a bank never touches the
                              # classification/import engine
  transactionTypes.ts         # deterministic transaction-type layer (8F): TRANSACTION_TYPE_RULES
                              # (ordered word-boundary table) + classifyTransactionType() — WHAT
                              # a row is (transfer/card-payment/bank-charge/transfer-fee/vat/
                               # stamp-duty/sms-charge/airtime/mobile-data/interest/refund/savings/
                               # withdrawal/deposit/internal-transfer/loan-payment/salary/unknown),
                               # narration-only (direction never consulted, income/expense never
                               # assumed), SEPARATE from kind/categories
  merchant.ts                 # merchant normalization (8G): normalizeMerchantKey (lowercase,
                               # punctuation stripped, whitespace collapsed), word-boundary
                               # merchantKeyMatches, curated KNOWN_MERCHANTS (Nigerian telcos,
                               # streamers, rides, retail, food delivery, fuel, health — banks &
                               # wallets deliberately excluded), extractMerchantFromNarration()
                               # — exposes "FRIDAY PATIENCE NISMA" from "Transfer to FRIDAY
                               # PATIENCE NISMA | Sterling Bank | …" WITHOUT touching the
                               # original description (known merchant → high, recipient → medium)
  categoryMatching.ts          # automatic expense category matcher (8G): MERCHANT_CATEGORY_HINTS
                               # (merchant → category-NAME hints resolved adaptively against the
                               # EXISTING expense categories — never hard-coded ids) +
                               # matchExpenseCategory() → {categoryId, confidence: high|medium|low,
                               # reason}; reuses KEYWORD_ALIASES (statementImport.ts); deterministic,
                               # offline; LOW assignments are never silently certain
  statementColumnar.ts         # SHARED columnar engine (8J): headerToken, ColumnarSpec,
                               # columnarHeaderScore, parseColumnarStatement — GTCO/OPay are
                               # thin specs over it (role regexes, minHeaderScore, reference
                               # cap, enrichers); value-date fallback; ids gt-r / op-r
  gtcoParser.ts               # GTCO statement parser: header-vocabulary columns (Trans./
                              # Value Date, Reference, Debits/Credits, Balance, Branch,
                              # Remarks) → NormalizedBankTransaction[] (sourceBank "gtco")
                              # with per-row error tolerance; positional fallback;
                              # conforms to BankStatementParser
  opayParser.ts               # OPay/OWealth statement parser: header-vocabulary columns
                              # (Trans. Time, Value Date, Description, Debit/Credit(₦),
                              # Balance After(₦), Channel, Transaction Reference) →
                              # NormalizedBankTransaction[] (sourceBank "opay"); narration
                              # "|"-parts → merchant/provider; per-row error tolerance;
                              # conforms to BankStatementParser
  kudaParser.ts               # Kuda statement parser (8E): works on a WHITESPACE TOKEN
                              # stream because BOTH Kuda forms must reach the same parser
                              # — text-layer PDFs (column-split cells) and scanned PDFs
                              # (OCR cells, one line per cell with single spaces);
                              # phrase-aware kudaHeaderScore (detection matches multi-
                              # word anchors inside cells, never cell positions);
                              # two-line transaction blocks (date line + time line) with
                              # wrapped-description merging, balance-delta direction
                              # chain (exact, epsilon-guarded) then Kuda's own printed
                              # category tags — "Transfer" alone never decides; rows
                               # skip + report per-row errors, never crash; conforms to
                               # BankStatementParser
  palmpayParser.ts            # PalmPay statement parser (8J): real text-layer PDF (75 certified
                               # rows, printed totals ₦183,800.71 in / ₦340,270.00 out);
                               # month-first MM/DD/YYYY dates, SIGNED amounts (sign = direction),
                               # wrapped Detail/ID lines merged via rowYs geometry on the same
                               # page, lone page-number footers ignored, no balance/value-date/
                               # category fabricated, per-row "missing debit and credit" skips,
                               # reference cap 80, ids pp-r; NOT OCR-aware (columnar)
  statementClassify.ts        # classification layer: CLASSIFICATION_RULES + PROVIDER_RULES
                              # (word-boundary patterns, ordered, extensible; tax incl.
                              # "vatrecover") → kind + confidence + existing categoryId +
                              # needsReview; type vs category separate; transfers stay
                              # transfers; suggestCategory fallback only on whole-word
                              # keyword matches (6B — "BUSINESS" never becomes Transport);
                              # also sets the deterministic txType (8F) via transactionTypes.ts;
                              # Kuda's structural labels (local funds/outward transfer,
                              # spend and save) classify deterministically (8F);
                              # Prompt 8G category matcher (categoryMatching.ts + merchant.ts):
                              # refines expense categories with categoryConfidence/categoryReason
                              # (HIGH merchant overrides the rule hint; learned-rule decisions
                              # are never refined) and upgrades UNKNOWN debits to expense only
                              # on a HIGH known-merchant match — fees/taxes/refunds/transfers/
                              # savings are never reclassified
  statementRelations.ts       # relationships (3E): detectRelationships() → duplicate
                              # groups (multi-signal, never amount alone), funding/savings
                              # links (movement + transfer, same amount+direction), and
                              # movementIds (savings/internal-transfer = money movement,
                              # never spending); pure, never deletes or merges
  statementPipeline.ts        # processStatement(cells, {currency}, categories) → preview:
                              # detectStatementFormat walks BANK_PARSERS (header
                              # vocabulary + distinctive-token tie-break, never the bank
                              # name) → the detected parser → classify →
                              # detectRelationships; unrecognized statements → status
                              # "unsupported" with an explanation — nothing is guessed;
                              # STOPS at the preview (no budget writes)
  seed.ts                     # DEFAULT_CATEGORIES, createInitialState()
  validate.ts                 # validateAppState(json) -> AppState | throws; migrations v1→v2→v3
  storage.ts                  # STORAGE_KEY, CATEGORIZATION_KEY, BACKUP_PREFIX, saveAppState(),
                              # setWritesEnabled(), parseStoredState() (legacy/corrupt auto
                              # snapshots), writeBackup(), snapshotCurrentState(),
                              # listBackupSnapshots(), scanRecoverablePayloads(),
                              # serializeExport(), parseExportPayload()
  theme.ts                    # resolveTheme(), applyTheme(), THEME_BOOTSTRAP_SCRIPT;
                              # accent system — Accent type, ACCENTS, ACCENT_STORAGE_KEY,
                              # applyAccent/applyAnimations + extended bootstrap that sets
                              # data-accent / data-animations pre-paint
  scrollLock.ts               # lockScroll()/unlockScroll() — shared by Modal/Drawer
store/
  useAppStore.ts              # Zustand store (state + actions), persist middleware;
                              # also exports useAppStoreErrors (hydrateError)
  useToastStore.ts            # transient toast queue (not persisted)
hooks/
  useMonth.ts                 # shared month selection state (URL param)
  useRecurring.ts             # effect that materializes recurring instances
  useToast.ts                 # success()/error() wrappers over useToastStore
  useTheme.ts                 # theme state + applyTheme; useReducedMotion.ts (a11y)
  useAppearance.ts            # accent + animation preferences (reads/writes storage,
                              # applies data-accent / data-animations attributes)
  usePlannerStatus.ts         # planner derived flags; useAnimatedNumber.ts (rAF counter)
  useChartColors.ts           # theme-aware chart palette (MutationObserver on data-theme)
public/                       # favicon.ico only (starter SVGs removed)
tests: components/*.test.tsx (colocated) · lib/__tests__/ (17 files) · store/__tests__/
```

Rules:

- `lib/*` is pure and has zero React imports → unit-testable with `vitest`.
- `store/*` depends only on `lib/*` and `zustand`.
- `components/*` depend on `store` + `lib` + `components/ui` only. No `lib` function may
  import a component.
- Pages are thin composition layers; all behavior lives in components + store actions.

## 3. State management

### 3.1 Store shape (Zustand)

```ts
interface AppStore {
  state: AppState;                          // persists via persist middleware
  // actions (all immutable updates via set())
  addTransaction(input: TransactionInput): void;
  updateTransaction(id: ID, patch: Partial<TransactionInput>): void;
  deleteTransaction(id: ID): void;
  moveTransactionToNextMonth(id: ID): void;  // FR-12 — deferred flag + rule detach
  setIncomePlan(month: Month, id: ID | null, patch: {
    name?: string; icon?: string; expectedAmount?: number; receivedAmount?: number;
  }): boolean;                     // FR-18 — upsert ONE standalone source (null id = create)
  addBudget(input: BudgetInput): boolean;    // validates; same-month duplicate guard
  updateBudget(id: ID, patch: Partial<Pick<Budget, "categoryId" | "limit" | "priority">>): void;
  deleteBudget(id: ID): void;
  addFutureExpense(input: FutureExpenseInput): boolean;
  updateFutureExpense(id: ID, patch: Partial<FutureExpenseInput>): void;
  deleteFutureExpense(id: ID): void;
  addCategory(input: CategoryInput): boolean;   // validates name ≤ 30, non-empty icon, hex color
  renameCategory(id: ID, name: string): boolean;
  updateCategory(id: ID, patch: Partial<Pick<Category, "name" | "icon" | "color">>): boolean;
  deleteCategory(id: ID): { ok: boolean; reason?: CategoryDeleteReason };
  addRecurrenceRule(input: RecurrenceRuleInput): void;
  updateRecurrenceRule(id: ID, patch: Partial<RecurrenceRule>): void;
  deleteRecurrenceRule(id: ID): void;
  setSettings(patch: Partial<Settings>): void;
  importState(json: unknown): { ok: boolean; error?: string };  // validate + replace
  recoverFromBackup(key: string): { ok: boolean; error?: string };
  resetAll(): void;
  addGeneratedInstances(instances: Transaction[]): void;   // internal (useRecurring)
}

interface AppStoreErrors {               // store/useAppStore.ts — NOT persisted
  hydrateError: string | null;
  setHydrateError(error: string | null): void;
}

interface ToastStore {                      // store/useToastStore.ts — NOT persisted
  toasts: { id: ID; message: string; tone: "success" | "error" }[];
  push(message: string, tone?: "success" | "error"): void;  // auto-dismiss 3 s
  dismiss(id: ID): void;
}
```

- Persistence: `persist(state, { name: "budget-planner:state", version: 4 })` from
  `zustand/middleware` with a custom `storage` adapter. `getItem` runs `parseStoredState`
  (validation + migration); `setItem`/`removeItem` route through `lib/storageAdapter.ts`
  (writes disabled while the state is corrupt, exceptions swallowed). Writes are
  **synchronous** after every `set` — the persist middleware serializes immediately;
  there is no debounce.
- **One storage seam, two backends.** `lib/storageAdapter.ts` is the only persistence
  entry point for the whole app. In a plain browser it wraps `localStorage`. Under
  Electron it routes through the preload bridge (`window.budgetPlannerDesktop.storage`,
  `lib/desktop.ts`) into SQLite in the **main process** (`electron/db.cjs`): a
  `kv(key, value)` table (WAL, `user_version = 1`) at
  `<userData>/budget-planner.sqlite3`. The renderer never touches the database or
  better-sqlite3; all access is synchronous IPC (`desktop:storage:*` channels,
  `ipcRenderer.sendSync` — deliberately sync because the storage seam is
  localStorage-shaped and the handlers are trivial prepared statements). A failure to
  write over the bridge throws, mirroring browser quota exceptions.
- **First-launch migration.** Before the bridge is exposed, the preload checks
  `desktop:storage:needs-migration` (db empty). If the page origin's localStorage holds
  browser-era data, it is sent to the main process, which writes a full backup row
  (`budget-planner:backup:migration-browser:*`, same envelope as app backups, so it
  appears in `BackupsManager`) **before** the migrated rows and the
  `migration:browser:done` marker — all in one SQLite transaction. Migration is
  idempotent (marker + non-empty-db guard).
- **Migration failure semantics.** The entire migration (marker check, backup, rows,
  marker insert) returns a structured error rather than throwing across IPC. A failure
  rolls the transaction back: nothing is written, the marker is absent, and the browser
  localStorage (the source of truth) was never modified — so the original data is
  restored by construction and the migration retries automatically on the next launch.
  The main process notifies the user with a native error dialog (suppressed in smoke
  mode) and logs the failure; the preload logs it too.
- **File-based backups** (`electron/backups.cjs`, desktop only). A second safety net
  beside the in-store snapshots: full state payloads written atomically
  (temp file + rename) into `<userData>/backups/budget-planner-backup-<ISO>.json`,
  deduped (an identical newest backup is skipped) and pruned to the newest 30 files.
  The renderer schedules them (see below); restores read the file and go through the
  same validated `importState` path as exports.
- **Native desktop features** (Phase 3, desktop only) — all over IPC, nothing exposed
  that the renderer doesn't need:
  - `electron/menu.cjs`: native application menu. File (Import `Ctrl+O`, Export
    `Ctrl+S`, Back up now `Ctrl+B`, Restore latest backup `Ctrl+Shift+B`, Open backup
    folder `Ctrl+Shift+O`, Reveal data folder `Ctrl+Shift+D`, Quit `Ctrl+Q`), Edit
    (standard clipboard roles — needed for copy/paste in inputs), View (reload,
    devtools, zoom, full screen), Window, Help (About with folder paths). Items that
    need renderer state send `desktop:menu:action` to the focused window; folder
    actions and About run entirely in main.
  - `electron/main.cjs` handlers: generic `desktop:dialog:open/save` (validated
    options); restricted `desktop:fs:writeText/readText` (absolute paths only,
    `.json`-only writes, 16 MB cap); composite `desktop:import` (open dialog →
    destructive-action `showMessageBox` → read) and `desktop:export` (save dialog →
    atomic write); `desktop:shell:openPath/showItemInFolder`; `desktop:notify`
    (`Notification.isSupported()`-guarded; AUMID set at startup); `desktop:paths`
    (userData/backupsDir/dbFile for the Settings UI); `desktop:backup:*`
    (create is **sync** so the renderer can flush on `beforeunload`; list/read/
    delete/restore-latest are async; restore-latest confirms natively in main).
  - `electron/preload.cjs` exposes `window.budgetPlannerDesktop.{dialog,fs,shell,
    notify,paths,backups,menu}` in addition to the existing `storage`/`getAppInfo`;
    `lib/desktop.ts` types the whole surface.
  - Renderer wiring: `lib/desktopFeatures.ts` (bridge wrappers + `startAutoBackups`),
    `lib/desktopBootstrap.ts` (auto-backup hooks + menu-action dispatcher, initialized
    once from `AppShell`). Automatic backups run at boot (after hydration), every
    30 minutes, and on `beforeunload`; failures surface as a toast + desktop
    notification. Browser mode is untouched — every feature degrades to a no-op.
- **Startup, identity & updates** (Phase 4, desktop only):
  - **Splash** (`electron/splash.cjs`): a frameless, skip-taskbar window loading a
    `data:` URL (inline SVG icon replica, app name, `v<version>`, animated bar) with
    **no preload** — it can never touch app state. `main.cjs` shows it before
    `createWindow()` and destroys it on the main window's `ready-to-show` (and on
    `before-quit`). Skipped in `--smoke` mode. The renderer additionally shows the
    shared `PageSkeleton` while the client bundle hydrates via `app/loading.tsx`.
  - **App icon** (`scripts/make-icon.mjs`): pure-Node PNG/ICO encoder drawing the
    brand mark (indigo gradient square, white coin with brand edge shade + drop
    shadow, three ascending bars) — 512 px master with 4×4 supersampled AA (SDF
    geometry), box-downsampled into seven PNG-compressed ICO entries (16–256 px)
    plus the 512 px PNG (`npm run icon`). The ICO directory precedes the image
    data. Consumed by the exe, NSIS installer/uninstaller/header icons, the window
    and the splash.
  - **Version information**: `lib/version.ts` (`APP_NAME`/`APP_VERSION` read from
    `package.json`, bundled at build time) is the renderer's single version source;
    the Settings About card shows `v<version>` + the desktop shell's
    Electron/Chromium from `getAppInfo()` (`desktop:app-info` now returns
    `versions`). The native About dialog (Help) lists app version, runtimes,
    platform, update-feed state and folder paths — all main-process data, no IPC
    to the renderer.
  - **Auto-update scaffold** (`electron/updater.cjs`, `electron-updater`): generic
    feed from `AUTO_UPDATE_URL` env or `<userData>/update-feed.txt` (env wins).
    Packaged-only and inert without a feed — development and feed-less builds
    never touch the network. When enabled: background check at startup,
    `Help → Check for updates…` on demand, auto-download, install-on-quit, and
    system notifications. Menu wiring lives in `electron/menu.cjs`.
- On rehydrate, `onRehydrateStorage` sets `useAppStoreErrors.hydrateError` and disables
  writes (`setWritesEnabled(false)`) when the payload is corrupt, so nothing can overwrite
  the unreadable state until the user recovers. `app/error.tsx` detects the corrupt state
  and renders `RecoveryPanel` (scan browser, restore backup, import file, or start fresh).
- `validateAppState` accepts versions 1–9 and normalizes on load: v1 backfills income
  categories + converts tagged monthly-income transactions into plans; v2 rewrites
  category-bound plans into standalone `IncomePlan` entries (name/icon from the category,
  `receivedAmount` backfilled from income transactions); v3 backfills the `learnedRules`
  array (empty — the field is new in v4, Prompt 6A); v4 corrects two mismatched category
  icons ONCE, matched by lowercase name AND the specific wrong icon — "Edi" (a data/airtime
  category carrying a plant) → 📶 and "Essentials" (carrying a store/gift glyph) → 🧺 (the
  basket, not the cart — "Misc" already owns 🛒 and must not change) — so a category the
  user has since re-iconed keeps its choice and both stay freely editable afterwards; legacy
  fields (`currencySymbol` → currency, missing budget `priority` → `"medium"`) are normalized
  (AC-16); v5 runs a second category-icon audit ("Loan" piggy bank → repayment, "Misc" cart → box, "internet" bulb → globe) through the same `applyIconFixes` helper and the same name+wrong-icon matching; v6 backfills `rollovers: []` for FR-19 and deliberately sets NO category's `rollover` flag and invents NO carryover records for months already in the ledger — the feature is opt-in, so an existing state must behave identically until the user turns it on. v7 backfills `debts: []` and `settings.debtStrategy: "avalanche"` for FR-20, flagging NO category as debt — guessing from a name ("Loan", "Card") would invent balances and rates the user never entered; v8 backfills `badges: []` for FR-21 and awards nothing retroactively (the streak is derived from the ledger, so real history is recognised on the next evaluation without a migration inventing earned records). Version > 9 is rejected.
- **Category names are display-formatted, never rewritten.** A name is both user data and the
  lookup key for `categoryAccent`/`budgetRowTreatment`, so `lib/categoryDisplay.ts` provides
  `categoryLabel` / `categoryLabelOr` (capitalize the first character only) and every site
  that PRINTS a category name goes through it — planner rows, donut legend, status band,
  allocation drawer, recent activity, deferred, timeline, expense details, reports insights
  and chart axes. Lookups, sorts and accent maps keep using the raw stored value.
- **First-run onboarding state lives in TWO places on purpose.** The completed flag
  is `AppState.settings.firstRunDone` (the field that already existed for it; seeded
  `false` by `createInitialState` so new installs onboard and every existing stored
  state, which carries `true`, is never re-onboarded — no migration needed). The step
  position is `onboarding:step` written through the storage seam by `lib/onboarding.ts`,
  mirroring `lib/displayName.ts`: NOT part of AppState, so it needs no schema migration
  and an import/restore of the ledger leaves it untouched. `loadOnboardingStep` falls
  back to the first screen for absent/corrupt/unknown values. `store/useOnboarding.ts`
  starts `ready: false` on both server and client and is seeded in AppShell's mount
  effect — the same hydration gate `useDisplayName` uses, so onboarding never renders
  into the server HTML and vanish on hydration for a returning user.
- Before parsing, `parseStoredState` auto-snapshots legacy (`auto-v{n}`) and corrupt
  (`auto-corrupt`) payloads under `budget-planner:backup:*`, so the original bytes are
  never destroyed and remain restorable from `RecoveryPanel`/`BackupsManager`. In
  Electron these snapshots land in SQLite through the same seam.
- No component writes to storage directly; production writes flow through the persist
  middleware, and storage helpers (`saveAppState`, snapshots, backups) go through
  `lib/storage.ts`, which delegates to the seam. UI state keys (disclosure, icon
  favourites/recents) also go through the seam.
- The toast store is intentionally separate and transient: `push()` schedules auto-dismiss
  (3 s) and `ToastHost` renders; nothing toast-related is persisted.

- **Rollover carryover history (FR-19) is append-only persisted state.**
  `AppState.rollovers: RolloverRecord[]` holds one record per (category, month), where
  `month` is the month funds carried INTO. Records are written once at the month transition
  and NEVER recalculated — that is what makes a past month's effective limit equal to what
  it actually was, rather than something re-derived from today's settings, today's cap
  default, or transactions the user edited afterwards.
  - Read side (`lib/selectors.ts`): `findRollover` / `rolledOverInto` / `effectiveLimit`,
    and `budgetProgress(budget, transactions, rollovers?)` which returns `baseLimit`,
    `rolledOver` and an effective `limit`. `rollovers` is optional everywhere and defaults
    to none, so every pre-FR-19 call site is bit-for-bit unchanged.
  - Write side (`lib/rollover.ts`): `computeRollovers()` closes the previous month and is
    the ONLY producer of records. It imports from `selectors.ts` and never the reverse —
    one direction, no cycle.
  - The opt-in itself is `Category.rollover?: boolean` (on the category, not the per-month
    `Budget`, so it survives into months whose budget does not exist yet), written only by
    `setCategoryRollover`. Stored as absent rather than `false` when off, so an untouched
    category serializes exactly as it did before the feature.
  - `deleteCategory` drops that category's records, and the validator drops orphans on load.

- **Debt records (FR-20) are linked to categories, not folded into them.**
  `AppState.debts: Debt[]` holds at most one record per category, keyed by `categoryId`.
  A balance, an interest rate and a minimum payment describe an obligation that outlives
  any single month, whereas `Budget.limit` is one month's spending allowance — overloading
  the two would have made a limit mean different things for different categories, and would
  have tied a debt to a record that is recreated every month.
  - The rate is stored as **integer basis points** (`aprBps`, 1250 = 12.5%) for the same
    reason money is stored in minor units: no float drift in persisted data.
  - `startingBalance` is display-only (the "N% paid off" bar) and is never read by the
    payoff engine. `setCategoryDebt` only raises it, so paying a balance down cannot
    silently rewrite where it started.
  - Written only by `setCategoryDebt(categoryId, input | null)`; `null` stops tracking.
  - `deleteCategory` drops the linked debt, and the validator drops both orphans (unknown
    category) and duplicates (a second record for the same category — it would make the
    engine count one obligation twice).

### 3.2a Rollover month transition

- `hooks/useRollover.ts`: a mount-time `useEffect` in `AppShell`, mirroring `useRecurring`.
  There is no backend and no scheduler, so "the month changed" is detected the only way a
  local-first app can — on open, by noticing the current month has no carryover records yet.
  That check is simultaneously the transition detector AND the idempotency guard, which is
  why no separate "last opened month" marker is stored: a marker could drift out of sync
  with the records it is supposed to describe, whereas the records cannot disagree with
  themselves.
- `computeRollovers` writes a record for every category that held a budget in the closing
  month, **including** those that carried nothing (overspent, or opted out). Sealing the
  transition that way is what stops a switch flipped mid-month from retroactively granting
  funds for a month already under way — the change takes effect at the next month end.
- Amounts are capped at `ROLLOVER_CAP_MULTIPLIER` (currently `1`) x the destination month's
  base limit, so the effective limit plateaus at 2x base instead of growing without bound.
  Each record stores the `cap` that was in force, so exposing or changing the default later
  stays auditable and cannot rewrite settled months.
- Known limitation, deliberate and out of scope: editing past transactions after a carryover
  has been applied does not reconcile it. The settled record stands.

### 3.2 Recurring materialization

- `hooks/useRecurring.ts`: a `useEffect` keyed on `settings.recurringEnabled` runs once per
  app load and calls `generateInstances(rule, month)` for the current and previous month for
  every enabled rule, then dispatches `store.addGeneratedInstances(instances)` (internal
  action) — idempotent via `recurringRuleId + date` lookup.
- `generateInstances` is pure; unit tests cover AC-06/AC-07.

### 3.3 Allocation & move-to-next-month

- **Finance rules (single source of truth):** `lib/finance.ts` `monthFinance()` is the one
  place that defines Received / Expected / Expenses / Net / Remaining / Projected remaining /
  Savings rate. Received = `max(income transactions, Σ plan.receivedAmount)` (plans are
  canonical; transactions are a fallback floor so legacy and transaction-only states don't
  collapse; the max prevents double counting after the v2→v3 backfill). Net = Remaining
  (before clamping) = Received − Expenses; Remaining clamps at 0 (allocatable balance);
  Projected remaining = Expected − Expenses. Every screen — summary cards, allocation,
  budget lists/health, hero, monthly stats, recommendations, insights, to-dos, reports,
  KPIs and charts — derives these from `monthFinance`/`financeSeries`; no component
  reimplements the math.
- **Allocation (FR-11):** lives entirely in the on-demand `AllocationDrawer` — nothing is
  mounted until a trigger asks for it (a budget row's arrows/exchange action — `BudgetRow`
  keeps `onEdit` for the pencil/edit-form and `onAllocate` for this one as two separate
  props — or the "Remaining" summary card's picker). The drawer body is keyed on the target budget id, so each open remounts
  from live store data with empty drafts; that key is also what makes Cancel / Escape /
  scrim discard changes with no extra bookkeeping. Move amounts are a component-local
  `Allocations` map. `lib/allocation.ts` still provides
  `clampAllocation(next, remaining, otherTotal)` and `totalAllocated(allocations)` —
  here `remaining` is the target's overage when it is over budget (so the moves can only
  bring it back to its limit), and each move is additionally clamped to its source's
  `available = limit − spent`; integer arithmetic only. Applying dispatches one
  `updateBudget(id, { limit: limit − moved })` per contributing source and one
  `updateBudget(target, { limit: newLimit + totalMoved })` — still the only persistence path.
- **Move to next month (FR-12/FR-17):** `moveTransactionToNextMonth(id)` sets
  `date = nextMonthDate(date)` (`lib/date.ts`, day clamped) and marks the transaction
  `deferred: true` so the destination month's Planner can surface it. For a
  recurring-generated instance it also applies `recordException(rule, month, id)`
  (`lib/recurrence.ts`), which appends the id to `rule.exceptions[month]` so regeneration
  skips it, and detaches the transaction from the rule (`recurringRuleId`/`edited` unset).
- **To-Do (FR-17):** `lib/todo.ts` `todoFor(state, month)` maps the FR-13 rule set plus a
  deferred-expenses check into `TodoItem[]` (title, detail, tone, href). Pure and
  deterministic; the To-Do page renders it, the Planner renders insights separately.

### 3.3a Deriving state at mount — REQUIRED convention

**Rule: if a piece of local state is DERIVED from store data, derive it on every
render through `hooks/useOverridableValue.ts`. Never freeze it with a lazy
`useState` initializer.**

```ts
// WRONG when the default comes from data that can change:
const [openKey, setOpenKey] = useState(() => mostUrgent(items));

// RIGHT:
const [openKey, setOpenKey] = useOverridableValue(mostUrgent(items));
```

`useOverridableValue(derived)` returns `[value, set, reset]`. The value tracks
`derived` until `set` is called; afterwards the user's value wins and stays,
**including a falsy one** (`""`, `null`, `0`). That last part is why the
override is boxed internally — an unboxed `T | null` would treat "user cleared
the field" as "never touched" and snap back, which is the same bug in a new
costume. `reset()` hands control back to the derived value.

#### Why this rule exists

Two bugs, fixed separately before the cause was properly understood:

1. **Reports → Recommendations** — which card opens by default was frozen at
   first render, so it did not follow the month changing or the data being
   edited.
2. **Debt payoff → extra-payment field** — the amount suggested from the
   Planner's "Remaining" figure was frozen at first render, so income arriving
   afterwards never updated it.

**Both were originally diagnosed as "the persisted store had not hydrated
yet". That diagnosis was WRONG, and the comments asserting it have been
corrected.** Persistence in this app is fully synchronous: `lib/storageAdapter.ts`
returns a synchronous backend in both the browser (`localStorage`) and Electron
(the preload bridge into SQLite), so zustand's persist middleware finishes
hydrating inside `create()` at module load — before React renders anything.
A `useState` initializer therefore always sees hydrated data.
`hooks/__tests__/useOverridableValue.test.tsx` pins this down with a test that
reads the store immediately after `createAppStore()`; if persistence ever
becomes asynchronous that test fails first, and every lazy initializer reading
the store becomes suspect at that moment.

The real failure is simpler and has nothing to do with hydration: **a default
derived once from data that keeps moving.** Chasing the hydration theory would
have produced `ready`-flag gating that fixes nothing.

#### When a lazy initializer is still correct

Form drafts seeded from a prop — `TransactionForm`, `RecurrenceForm`,
`FutureExpenseForm`, `IncomeSourceModal`, `CategoryModal`, `BudgetForm`. Those
are MEANT to freeze: the user is editing a snapshot, and live data overwriting
their half-typed input would be the bug. This codebase restarts such drafts
with a keyed remount (`key={formSession}` in `BudgetList`, `key={target.budgetId}`
in `AllocationDrawer`) rather than by syncing state.

#### The other two stores

`useOnboarding` and `useDisplayName` are the only genuinely deferred state:
they start `ready: false` on both server and client and are seeded in
`AppShell`'s mount effect (deliberately — see §3.1). They already carry a
`ready` flag, and consumers must subscribe to them reactively and gate on
`ready`, never snapshot them into a `useState` initializer. No new mechanism
was added for them; the existing flag is the convention.

`components/ui/Disclosure.tsx` reads persisted open/closed state through
`useSyncExternalStore` with a server snapshot, which is the correct React
primitive for an external store and needs no change.

### 3.4 Debt payoff engine — deterministic by design

`lib/debtPayoff.ts` is a pure module: no React, no store access, no I/O, and
**no AI/LLM call and no network access of any kind**. Every figure on the Debt
payoff screen is standard monthly amortization arithmetic over integer minor
units. This is a deliberate product decision, not an implementation shortcut:

- **No per-use cost.** A projection is free to compute, so the screen can
  recalculate on every keystroke of the extra-payment input.
- **Reproducible.** Identical inputs give a byte-identical schedule on every
  machine, forever. A test asserts this directly.
- **Auditable.** A user can check the numbers by hand. Nothing is sampled,
  inferred or generated.
- **Testable in isolation.** Because the engine takes plain data and returns
  plain data, `lib/__tests__/debtPayoff.test.ts` exercises it against
  hand-computed schedules without rendering anything.

Model, applied once per simulated month:
1. interest accrues on every outstanding debt (`monthlyInterest`, rounded to
   minor units);
2. every outstanding debt receives its minimum payment;
3. the remainder of the monthly budget cascades down the payoff order, so the
   target debt absorbs the extra and any surplus rolls into the next debt in
   the same month.

The monthly budget is held constant at `sum(minimums) + extra`, which is what
produces the standard rolling effect in BOTH strategies: a cleared debt's
minimum is not saved, it moves to the next debt. Ordering is the only
difference between the strategies (`payoffOrder`), and its tie-breaks are total
so the schedule can never depend on input order.

`MAX_PAYOFF_MONTHS` (600) bounds the loop. A plan that has not cleared by then
is returned with `stalled: true` rather than looping forever or reporting a
fabricated date — a budget that cannot outrun its interest is a real answer the
user needs.

**Where an AI narration layer would go, if it is ever wanted.** Product
direction deliberately left this door open. `projectPayoff` / `comparePayoff`
return fully-formed `PayoffPlan` objects — months, total interest, total paid,
and a per-debt milestone list. A narration layer would be a NEW module that
takes an existing `PayoffPlan` as input and returns prose ("clearing the card
first saves you £412 — that's the whole car loan"), rendered as an additional,
clearly-labelled block on the screen. It would:

- consume the engine's output and never replace, re-derive or adjust it;
- require no change to `lib/debtPayoff.ts`, its types, or the stored data model;
- stay optional, so the screen keeps working — and keeps costing nothing —
  with the layer disabled, absent, or offline.

Nothing in the current design needs revisiting to add it. Do NOT let a
narration layer compute or override a figure: the number a user sees must
always be the one the engine produced.

### 3.3b Email alert ingestion (FR-24) — security boundary

The one place in this app that holds a user credential for an external service,
and the only feature that is deliberately unavailable in the browser build.

```
electron/credentials.cjs — createCredentialStore(userDataDir, safeStorage)
  │  Encrypts with the OS keychain (DPAPI / Keychain / libsecret). Ciphertext at
  │  <userData>/credentials.v1.json, mode 0600; the KEY never leaves the OS.
  │  REFUSES to store when encryption is unavailable — no plaintext fallback,
  │  no obfuscation. `reveal()` is main-process-only.
  ▼
main.cjs IPC — desktop:credentials:{available,set,status,clear}
  │  NOTE THE ABSENCE of a read channel. It must never be added: decryption
  │  happens only in main, at connection time, so a compromised renderer
  │  cannot obtain the password.
  ▼
preload.cjs `credentials` → lib/desktop.ts (typed) → lib/emailCredentials.ts
  │  Reports {available:false, reason:"not-desktop"} in the browser build and
  │  refuses to proceed, because no OS-backed store exists for a web page.
  ▼
lib/emailAlerts.ts — ALLOWLIST + per-institution TEMPLATE REGISTRY (pure)
  │  senderFor() matches exact host or subdomain, never substring.
  │  parseAlert() is one shared evaluator over data templates; adding a bank is
  │  a data entry, not a function. Returns parsed | needs-review | ignored and
  │  never throws. No network imports, ever.
  ▼
lib/emailPipeline.ts — buildEmailDrafts()
  │  Owns NO categorization and NO duplicate logic. Calls suggestCategory()
  │  and findDuplicateCandidates() — the same modules statement import uses —
  │  so a rule learned in one path applies to the other.
  ▼
ImportRow[] → planImport() (existing confirm step; nothing auto-saves)
```

Not yet built: the IMAP transport, the connect/disclosure UI, and sync
scheduling. See `15_EMAIL_PARSING.md` § Remaining work.

### 3.4a Learned categorization — storage location, and why not a new key

Learned mappings live in **`AppState.learnedRules`**, NOT under a separate
`budget-planner:categorization` key.

This is deliberate and predates FR-22. The Electron/SQLite architecture holds
the ledger as ONE state row behind `lib/storageAdapter.ts`, and everything in
`AppState` is validated, migrated, exported, backed up and restored together.
A separate top-level key would sit outside all five of those: it would need its
own validator and migration chain, would be silently missing from every export
and backup, and would survive a restore that rolled the ledger back — leaving
mappings pointing at category ids that no longer exist.

The keys that DO live outside `AppState` are the ones that must not travel with
the ledger: UI preferences (`settings:favourite-icons`, `settings:recent-icons`,
disclosure state), the display name, and the onboarding step. Learned mappings
are ledger data — they reference `Category` ids — so they belong inside.

### 3.5 Streaks and badges — data-driven, and cosmetic by design

`lib/streak.ts` is pure: no store access, no I/O.

**The streak is derived, the badges are stored.** `streakStats` walks the ledger
backwards from the last COMPLETE month on every read rather than incrementing a
saved counter, so editing a past month corrects the streak instead of leaving a
number that quietly disagrees with the data. Badges are the opposite and
deliberately so: an achievement must survive a later reset, so `AppState.badges`
records the fact of earning (`id`, `earnedAt`, `value`) append-only.

**"On track" has exactly one definition, and it is not this module's.**
`monthStatus` delegates to `budgetUtilizationSeries` — the existing
total-spent-versus-total-budgeted selector — and only interprets the result.
Nothing about budget health was changed; this reads it. The comparison is on raw
totals rather than the rounded `pct`, because at 100.4% the percentage rounds to
100 and would report an overspend as on track.

**Badges are data, evaluated by one shared function.** A `BadgeDefinition`
carries `{ id, name, icon, description, tier, criteria, reward }`, where
`criteria` is a *descriptor* — `{kind: "first-on-track-month"}` or
`{kind: "streak-months", months: N}` — not a function. `criteriaMet` is the only
place criteria are interpreted, and `evaluateBadges` / `newlyEarnedBadges` are
the only consumers. Adding a badge is therefore a new entry in the `BADGES`
array: no new component code, no new conditional, no new test scaffolding. The
drawer renders whatever the list contains, earned or locked.

Streak-based badges are measured against `longest`, not `current`, so a badge
already achieved cannot be taken away by a later reset.

#### The reserved `reward` field

Every `BadgeDefinition` carries `reward: null`. **Nothing reads it, and there is
no reward-granting logic anywhere in this codebase.** Badges are cosmetic
recognition; the badges drawer says so to the user in as many words.

The field exists because product direction wants the door left open for a later
functional-perk system (unlocking a feature, a cosmetic theme). Declaring it now
means that system can be layered on without migrating stored badge data or
reshaping the definitions — `EarnedBadge.value` already records the stat that
earned each badge, so a perk layer would not need to recompute history either.

When that system arrives it belongs in a NEW module that READS `reward`. Do not
add granting behaviour to `criteriaMet`, `evaluateBadges` or `newlyEarnedBadges`:
those decide whether a badge is *earned*, which is a separate question from what
a badge *does*, and conflating them is what makes achievement systems
untestable.

#### Evaluation cadence

`hooks/useBadges.ts` runs once at mount from `AppShell`, mirroring
`useRollover`. That is not merely convenient: the streak only counts completed
months, so it cannot change part-way through a session and there is nothing for
a live subscription to catch. `newlyEarnedBadges` returns only ids not already
held, and `grantBadges` filters again on write, so re-running every launch is
free and can never duplicate or re-grant an achievement.

### 3.6 Recurring-pattern detection and anomaly averages (FR-25) — pure, derived, advisory

`lib/recurringPatterns.ts` and `lib/anomalies.ts` are pure engines in the same
mould as `lib/debtPayoff.ts` (§3.4): no React, no store access, no I/O, no AI/LLM
call and no network. Both work purely from the ledger the user already owns, are
byte-deterministic for a given input, and take an explicit `today` where a due
window exists so tests never depend on the clock.

**Nothing here is persisted.** Patterns and averages are DERIVED from
`transactions` on every read — the deliberate FR-21 asymmetry applied again: a
detected pattern must follow edits to past months instead of freezing at what a
one-time scan found, and because nothing is stored there is no schema bump, no
migration, and nothing new to validate, export or back up. Deleting either
module would leave no trace in stored state.

Detection decides a pattern is established only after **3+ occurrences** at one
*detected* cadence with amounts chaining within ±10% step-to-step. The chain —
each occurrence compared against the *previous* one, not the first — is what
lets the expected amount (a recency-weighted mean) follow slow price drift
instead of pinning to the first-detected figure; when spending jumps beyond the
tolerance, the newer run simply wins the (category, cadence) id. Never weaken
these thresholds for quicker suggestions: a false "your recurring payment"
nudge costs more trust than a missed one, and a low anomaly threshold files
normal cheap weeks as typos.

Both engines exist as shared inputs, not features: `checkAnomaly` /
`categoryRecentAverage` (6-month trailing window, minimum 3 prior entries,
strict >2× ratio) and `detectRecurringPatterns` / `patternsDueBetween` /
`isPatternDue` are shaped so debt-payoff (§3.4) and rollover-budget (§3.2a)
analysis can consume them later without any UI change.

Everything user-facing built on them is additive and non-blocking:
`RecurringSuggestions` renders only when a pattern projects into the viewed
month; `RecurringQuickFill` hands a prefill (the form's `initialDraft`, frozen
at mount per §3.3a) into the ordinary form rather than saving;
`AnomalyNote` shows one dismissible sentence beside the amount. No dialog, no
validation change, no auto-created transaction anywhere.

## 4. Data flow

```
UI event (component)
  │  store.action(payload)          e.g. addTransaction
  ▼
Zustand store  ──set()──►  new immutable AppState
  │
  ├── persist middleware ──► storage seam (synchronous)
  │         ├── browser: localStorage "budget-planner:state"
  │         └── Electron: IPC → SQLite kv (main process, <userData>/budget-planner.sqlite3)
  │
  └── notify subscribers
        │
        ├── selectors (lib/selectors.ts) ──► derived values
        └── component re-render (selector-level subscriptions)
```

Server/client boundary: pages and the shell use `"use client"` (or render client components
only). `app/layout.tsx` stays a server component that renders `<AppShell>`; no server data
fetching occurs anywhere — remove/ignore the default `create-next-app` fetch scaffolding.

### 4.1 Statement import pipeline (bank statement → ledger)

```
BANK STATEMENT (CSV / Excel / PDF)
  │  lib/statementImport.ts — parseCsv | rowsFromExcel | rowsFromPdf → cells
  │    PDFs ALSO keep each line's y — groupPdfRows → { cells, rowYs }: the
  │    reading-order geometry wrapped-line parsers need to attach continuation
  │    lines to their transaction line (8J); groupPdfLines sorts top-down so
  │    the table header is within detection's first-12-row scan
  │    rowsFromPdfItems (8L, GTCO-real): header-ANCHORED realignment — pdfjs
  │    emits NO text for empty cells, so sparse rows arrive left-packed and
  │    the columnar engine's misalignment guards reject the shifted numbers;
  │    when the page's anchor line (most columnar-vocabulary tokens, ≥5 —
  │    GTCO/OPay-shape headers) qualifies, every line's items are re-slotted
  │    into the anchor's columns by nearest x, making missing cells explicit
  │    empties; PalmPay/Kuda/mock headers stay below the trigger and keep raw
  │    reading-order cells (their parsers are untouched)
  │    rowsFromPdfPage (OPay-real, 2026-08-27): the same alignment, but
  │    THREADED ACROSS PAGES and re-anchored at every header. Anchors are
  │    carried page to page because a continuation page reprints no header,
  │    and re-deriving columns from its data drifts; and a page may hold
  │    MORE THAN ONE header — OPay ends one account's table and starts the
  │    next on the same page, with the money columns ~38pt further left, so
  │    lines align to whichever header most recently preceded them rather
  │    than to one set of anchors chosen per page. Header labels the PDF
  │    splits across baselines ("Balance After" above "Debit (₦) Credit (₦)")
  │    merge into ONE header row via a header BAND that stops at the first
  │    data line in each direction, and fragments closer than 20pt collapse
  │    onto their leftmost anchor so "Debit" + "(₦)" stay one column.
  │    alignPdfLinesToColumns / rowsFromPdfItems remain as single-page
  │    wrappers, so every pre-existing call site is unchanged
  │  lib/statementOcr.ts — extractStatementRowsWithOcr (8D + Phase D):
  │    PDFs are CLASSIFIED FIRST — classifyPdfDocument opens the doc with
  │    pdfjs (no rendering) and reports kind + password status:
  │      "encrypted"  → throw PdfPasswordError (lib/statementPdf.ts: typed
  │                     error + PdfPasswordStatus; pdfjs PasswordException
  │                     code 1 needs / 2 incorrect / other unsupported) —
  │                     the modal shows its password stage; Unlock retries
  │                     the SAME file with the password (memory-only, never
  │                     persisted/logged); the probe then routes by text
  │                     layer: "text" → cells below (rowsFromPdfItems-
  │                     aligned); "scanned" → OCR below
  │      "scanned"    → OCR: cells empty / < 40 chars / no row carrying BOTH
  │                     a date and an amount — lib/ocrService.ts
  │                     (Tesseract.js 5.1.1, assets served by the app from
  │                     /vendor/tesseract, zero network) recognizes each page
  │                     (rendered at scale 3 via pdfjs canvas) → text → the
  │                     SAME cell grid shape (rowYs dropped on the OCR path);
  │                     per-page failure isolation (failedPages → user
  │                     warning), abortable, phase callbacks; the OCR pass
  │                     re-reads file.arrayBuffer() (classify detached it)
  │      "text"       → cells flow straight to the pipeline (never OCR'd)
  │
  ▼
lib/statementPipeline.ts — processStatement({ cells, context, categories, rowYs? })
    → preview (3F); rows via `parser.parse(cells, context, rowYs?)` (8J)
  │
  ├─► lib/statementPipeline.ts — detectStatementFormat(cells) (7A: registry-driven)
  │     walks lib/statementRegistry.ts BANK_PARSERS: each entry contributes its
  │     own detection rule — headerScore (header-vocabulary over the first 12
  │     rows, min 5) + distinctiveTokens (canonical columns unique to the bank)
  │     + capabilities { ocrAware, wrappedLines } (8J: Kuda/PalmPay wrappedLines,
  │     Kuda only ocrAware); highest score wins: gap ≥ 3 → high, else
  │     distinctive tie-break → medium; no match / too close → "unknown"; bank
  │     name and file name NEVER consulted
  │
  ├── known bank (gtco/opay/kuda/palmpay) ──► the detected parser (registry
  │     entry) → NormalizedBankTransaction[]
  │     lib/statementColumnar.ts — the SHARED columnar engine (8J): a thin
  │       spec (role regexes, minHeaderScore, reference cap, enrichers) drives
  │       columnarHeaderScore + parseColumnarStatement — GTCO/OPay are specs
  │       over it (duplicated engine logic removed); transactionDate falls back
  │       to the value date when no transaction-time column exists
  │       (8L, GTCO-real): silent repeated-table-header skip (multi-page
  │       tables reprint the header); ACCOUNT BOUNDARY STOP — a second
  │       account's block ("CUSTOMER STATEMENT" token, or a "Statement
  │       Period" + date-range label row after data started) halts the loop
  │       (multi-account statements never mix accounts; the next block's
  │       label rows are never read as junk); NARRATION CONTINUATION MERGE —
  │       lines with no date/amounts/balance form fragment groups attached to
  │       whichever of previous transaction / next row is NEAREST by rowYs
  │       (tie → next; no geometry → previous transaction, the historical
  │       behavior); trailing fragments after a boundary stop are dropped
  │       (they belong to the next account's label block)
  │       (OPay-real) a fragment group now ENDS at a block boundary: one
  │       transaction occupies a block of lines with the date/amount line in
  │       the MIDDLE, so consecutive continuation lines more than 1.8 line
  │       heights apart (medianRowGap over the statement's own baselines)
  │       belong to different blocks and are weighed against the transactions
  │       separately — grouping them merged one block's narration into its
  │       neighbour's. Geometry-less input (CSV/Excel) keeps one group, i.e.
  │       the previous behavior exactly
  │       two OPT-IN spec fields, both off by default so no other bank moves:
  │         emptyMoneyMarkers — placeholder text a bank prints in a money
  │           column that holds no value (OPay writes "--"). An explicit
  │           marker also PROVES the money columns did not shift, so the
  │           left-shift guard stands down for that row
  │         wrappedReference — the reference wraps across the block's lines
  │           and its halves are rejoined in page order instead of being
  │           folded into the narration. Off for banks whose reference fits
  │           one line: there, a value in that column on a continuation line
  │           is drifted narration, and appending it corrupts a good
  │           reference (proven by the GTCO fixture)
  │       headerToken also strips ORPHANED brackets and bare currency marks:
  │       a PDF emits "(₦)" as separate positioned items, so a header cell
  │       rebuilt from x-coordinates can arrive as "Balance After ₦)" and
  │       "( Channel" — unstripped, neither column matched its role and every
  │       OPay row came back with no balance and no channel
  │     lib/gtcoParser.ts — parseGtcoStatement(cells, context, rowYs?)
  │       header-vocabulary columns (Trans./Value Date, Reference, Debits/Credits,
  │       Balance, Branch, Remarks); positional fallback; malformed rows skipped
  │       with per-row errors, never crash the import; branch enricher (gt- ids);
  │       (8L) description composes the Originating Branch cell only when a
  │       Remarks column exists (hasColumn gate) — the real PDF prints long
  │       narrations inside the branch column; remarks-less exports unchanged
  │     lib/opayParser.ts — parseOpayStatement(cells, context, rowYs?)
  │       header-vocabulary columns (Trans. Time, Value Date, Description,
  │       Debit/Credit(₦), Balance After(₦), Channel, Transaction Reference);
  │       full narration preserved, "|"-parts → merchant/provider facts only
  │       (op- ids); spec opts into emptyMoneyMarkers ["--", "—", "–"] and
  │       wrappedReference, and the registry declares wrappedLines: true.
  │       (2026-08-27) the parser FORWARDS rowYs — it used to discard them.
  │       The real export wraps a transaction across a block of lines, and
  │       the geometry is the only thing that says which block a stray line
  │       belongs to; without it every wrapped line attached to the preceding
  │       transaction, mixing two narrations and splitting the 24-digit
  │       reference in half. CSV/Excel OPay exports pass no geometry and are
  │       unaffected
  │     lib/kudaParser.ts — parseKudaStatement(cells, context) (8E)
  │       ONE parser for BOTH Kuda forms: text-layer cells AND OCR cells
  │       (one line per cell — kudaHeaderScore matches multi-word phrases
  │       inside cells, not positions; registry minHeaderScore 8 so bare
  │       "Opening Balance / Closing Balance" labels never qualify)
  │       transactions are two-line blocks (dd/mm/yy date row + hh:mm:ss
  │       continuation, wrapped descriptions merged); direction = exact
  │       balance-delta chain first, then Kuda's printed category tags
  │       ("outward", "local funds", "spend and save", …) — the word
  │       "Transfer" alone never decides; "#" naira amounts (OCR); per-row
  │       errors ("missing debit and credit" / "unresolved direction")
  │     lib/palmpayParser.ts — parsePalmPayStatement(cells, context, rowYs?) (8J)
  │       real text-layer PDF (75 certified rows): 5-column header vocabulary
  │       (registry min 6; real header 11); month-first MM/DD/YYYY dates; SIGNED
  │       amounts (sign decides direction — never the "unknown" default);
  │       wrapped Detail/ID lines merge via the nearest date line within 8 y
  │       units ON THE SAME PAGE (pdfjs y resets per page — derived from the y
  │       jumps); lone page-number footers ignored; no balance/value date/category
  │       ever fabricated; index-walk fallback for geometry-less CSV/Excel (pp- ids)
  └── unknown bank ─► status "unsupported" + unsupportedReason (7A §4)
        "Unsupported bank statement format" with a useful explanation; ZERO
        transactions — no generic guessing (the old buildCandidates generic
        path was removed from the pipeline); the explanation never leaks raw
        parser scores (8I)
  ▼
NormalizedBankTransaction[]   ← canonical intermediate (3A foundation)
  │  type: "unknown" · confidence: "none" · categoryId: null · status: "draft"
  │  debit/credit split preserved — NO debit=expense / credit=income assumption
  ▼
lib/statementClassify.ts — classifyTransactions(txs, categories, learnedRules?) →
  │  suggested kind + confidence + existing categoryId + needsReview (3D; analysis only)
  │  + deterministic txType (8F): what the row IS (transfer/card-payment/vat/…), kept
  │  SEPARATE from kind/categories — "Transfer to John" is txType "transfer" though its
  │  expense category may later become Personal/Family; narration-only, direction never
  │  consulted (an incoming transfer is still "transfer", never income)
  │  ORDERED PRIORITY (6A): ① learned rules (lib/learnedRules.ts — user-created,
  │  provider > merchant > description, high confidence, never needs review)
  │  → ② word-boundary rules (refund → loan → tax (incl. "vatrecover", 6B) → bank-fee
  │  → interest → savings → internal-transfer → merchant gateways → transfer →
  │  income → expense patterns; type and category stay separate — transfer/bank-fee/
  │  tax rows carry categoryId: null and are never importable as spending/income)
  │  → ③ suggestCategory fallback, but ONLY when the matched keyword is present as a
  │  whole word (6B — substring matches like "bus" in "BUSINESS" or "food" in
  │  "FOODSTUFF" stay unknown → needs review; a confident-but-wrong category is worse
  │  than Needs Review); transfers to people stay transfers; no writes
  │  → ④ category matcher (8G): for expense rows, lib/categoryMatching.ts
  │  matchExpenseCategory() (KNOWN_MERCHANTS from lib/merchant.ts + KEYWORD_ALIASES,
  │  resolved adaptively against the user's EXISTING expense categories) refines the
  │  category and records categoryConfidence ("high" merchant · "medium" keyword ·
  │  "low" weak — LOW never silently certain) + categoryReason; learned-rule decisions
  │  (6A) are never refined; an UNKNOWN debit upgrades to expense ONLY on a HIGH
  │  known-merchant match ("SHOPRITE PURCHASE" → expense/Groceries); fees, taxes,
  │  refunds, interest, savings, transfers and internal transfers are never
  │  reclassified (8F eligibility respected); merchant = tx.merchant or
  │  extractMerchantFromNarration() (8G) for transfers/expenses
  ▼
lib/learnedRules.ts — recordCorrection(rules, correction) / activeRuleFor(tx, rules,
  │  categories) (6A; pure): a confirmed import correction (user CHANGED the suggested
  │  category and the row was actually imported) keys on the row's most specific
  │  reliable signal — provider ("MTN") > merchant ("DAVID") > normalized description.
  │  One correction = inactive candidate (strength 1, never applied); two = active
  │  rule (strength 2+, RULE_MIN_STRENGTH). Conflicting correction (same key, other
  │  category) re-baselines the rule (mapping replaced, strength 1, inactive) —
  │  flip-flopping never activates. Rules live in AppState (schema v4) and are
  │  validated/migrated/exported/backed-up with the state; Settings → "Learned rules"
  │  lists them (toggle, re-target category, delete, CLEAR ALL).
  │
  │  SHARED ENTRY POINT (FR-22): suggestCategory(input, rules, categories) — and the
  │  bare-string wrapper suggestCategoryForText(description, …) — is the general
  │  categorization engine. It takes plain strings ({description, merchant?, provider?,
  │  direction?}) rather than a statement row, so the planned email-alert parser can
  │  call it WITHOUT duplicating the learning. `activeRuleFor` is now a thin
  │  enabled-only wrapper over it, kept as the import pipeline's entry point.
  │  Matching: every EXACT key match across all signals is tried first (an exact key
  │  is what the user actually corrected, so it must never lose to a fuzzy match on a
  │  stronger signal), then token-overlap (Dice) fuzzy matching at
  │  FUZZY_MATCH_THRESHOLD = 0.82, resolved per signal. Token-based, not character-
  │  based: statement noise arrives as extra WORDS, and edit distance would score a
  │  long shared prefix as similar even when the trailing words name a different payee.
  │  The threshold is deliberately high — a false positive files money under the wrong
  │  category, which is worse than asking once more.
  │  `CategorySuggestion.confident` distinguishes a strength-1 candidate (PRE-FILL the
  │  category but leave the row flagged for review) from an enabled rule (auto-apply).
  │  markRulesUsed(rules, ids) stamps `lastUsedAt` when a pre-filled row is imported
  │  WITHOUT being overridden, so mappings that have gone quiet are identifiable.
  │  Nothing expires automatically.
  │
  │  BUG FIXED HERE: the previous matcher took only the FIRST rule of each kind
  │  (`candidates.find(r => r.kind === kind)`) and then compared its key, so once a
  │  user had two merchant rules the second could never fire — learning silently
  │  stopped after one mapping per signal. Regression-tested in
  │  lib/__tests__/suggestCategory.test.ts.
  ▼
lib/statementRelations.ts — detectRelationships(txs) (3E; analysis only)
  │  duplicates (multi-signal groups: reference/date/time/amount/direction/
  │  description — never amount alone, distinct timestamps = legit repeats)
  │  + links (funding-pair: transfer ↔ movement; savings-movement: savings ↔
  │  internal-transfer; same amount+direction, same date → high)
  │  + movementIds (savings/internal-transfer = money movement, not spending)
  │  nothing is deleted, merged or rewritten
  ▼
lib/statementIdentity.ts — matchExistingTransaction(row, ledger) (5B; pure)
  │  deterministic verdict vs the EXISTING ledger: Already imported
  │  (same bank+direction+amount+normalized reference, or — reference-less
  │  ledger rows only — same bank+date+amount+normalized description) /
  │  Possible duplicate (same bank+amount+direction with date or description
  │  overlapping, other detail absent/conflicting) / New; amount alone never
  │  matches; a stored reference is authoritative — differing references =
  │  different transactions; referenced ledger rows match by reference only
  ▼
StatementPreview { detectedBank, detectionReason, transactions, report, skipped, errors }
  │  pipeline STOPS here — nothing is written to the budget
  ▼
ImportStatementModal — preview + confirm + import (4A–4D, 5A, 5B, 6A): upload
  │  (CSV/XLSX/XLS/PDF; image/OCR slots into SUPPORTED_EXTENSIONS) →
  │  processing → preview; header: bank chip + masked account ("Account
  │  •••• 6789", NUBAN runs in the first 12 rows, amounts/dates excluded),
  │  statement period, currency, expenses/income/transfers/needs-review/
  │  duplicates/uncategorized/low-confidence/excluded counts (8I); raw
  │  parser scores ("GTCO header vocabulary (score 14, distinctive 13)")
  │  are NEVER shown — detectionReason stays a data-only detail; per-row
  │  EDITABLE review (ReviewRow = classified tx +
  │  excluded/selected session flags): type select re-pools the category
  │  select, kind changes reset mismatched categories and settle
  │  needs-review, exclude/include keeps rows visible and marked; bulk bar
  │  (assign category where kind matches, exclude, include, clear);
  │  confidence + duplicate badges, direction icons, filters
  │  All/Expenses/Income/Transfers/Needs review/Duplicates/Already imported/
  │  Possible duplicates/Uncategorized/Low confidence with counts (8I);
  │  per-row duplicate STATUS chip (New /
  │  Already imported / Possible duplicate; Excluded replaces it when
  │  excluded) + per-row Skip/Keep toggle for possible duplicates (5B — user
  │  decides, nothing silently discarded) + warn banner when possible
  │  duplicates exist (8I: explains each group is imported once and the
  │  repeats are skipped automatically — no manual removal needed);
  │  LEARNING (6A): changing a row's CATEGORY away from the suggested
  │  classification records an in-session correction (session id → chosen
  │  category + the row's provider/merchant/description); flipping back to
  │  the suggestion drops it; at IMPORT, only corrections on rows that were
  │  ACTUALLY imported (plan.importedIds) reach `learnFromCorrections`
  │  (one store write for the batch) — cancelled sessions, excluded rows and
  │  deduplicated/already-existing rows never teach anything;
  │  IMPORT (5B): `planImport(rows, report.duplicates, existingTransactions)`
  │  → `addTransactions` in ONE atomic write — movements/fees/taxes/
  │  savings/loan-payments and rows without dates are NEVER booked (counted
  │  in the done summary), the first row of each duplicate group is kept,
  │  excluded rows stay out, already-imported rows are skipped (identity is
  │  checked BEFORE the category gate — a plain re-import needs no
  │  reassignment), possible duplicates are imported unless the user skipped
  │  them (counted as possibleSkipped in the done breakdown), and any kept
  │  ledger row still missing a category is SKIPPED, not blocking — the
  │  categorized rows import and the uncategorized ones are counted
  │  (plan.missingCategory) in the done summary; uncategorized rows are
  │  deliberately SKIPPED rather than written into an "Uncategorized"
  │  bucket, because Transaction.categoryId is REQUIRED everywhere else in
  │  the app (manual entry validates "Choose a category."), so no such
  │  bucket exists to write into — the row stays visible in review with an
  │  inline warn "Assign" affordance and is reported in the skipped
  │  breakdown; CHECKBOX SELECTION NEVER SCOPES THE IMPORT: the per-row
  │  checkboxes + bulk bar (Select all, Assign category…, Exclude/Include)
  │  exist ONLY as an optional convenience for applying one category to
  │  many similar rows — `planImport` never reads `selected`, so the
  │  Import count and the write are always the whole reviewed,
  │  non-excluded batch and a user can complete an import using only the
  │  per-row category dropdowns; the button label shows the
  │  honest count of what will import ("Nothing to import" when zero — still
  │  enabled so a re-import shows the summary); only an UNANSWERED possible
  │  duplicate (FR-23) still disables the button ("Decide what to do with N
  │  possible duplicates before importing"); footer confirmation summary (8I):
  │  "You're about to import N transactions." plus "N uncategorized rows will
  │  be skipped — categorize them to include them." when any lack a category,
  │  "Assign a category to import — uncategorized rows are skipped." when none
  │  are categorized yet, "Nothing new will be imported." when nothing is
  │  importable; the plan is SNAPSHOTTED at click time; done
  │  stage (8I): "N imported · N skipped as duplicates · N requiring review"
  │  (requiring review = imported rows still flagged needsReview or low/
  │  uncertain confidence) + Skipped breakdown (movements/duplicates/
  │  excluded/no-date/already-existing/possible-duplicates/uncategorized/
  │  failed), "Add
  │  another file" / "Done"; any close discards the session; on write
  │  failure nothing is persisted (atomic) — error shown, session kept
  │  for retry
  ▼
USER REVIEW (ImportStatementModal) → edits + confirm
  ▼
store.addTransactions(TransactionInput[]) → ledger (single write, existing path)
  ▼
lib/storageAdapter.ts (the ONE persistence seam) → preload bridge → main
  process → electron/db.cjs kv table (budget-planner:state) — one atomic
  UPSERT per state save; there is NO separate transactions table: the whole
  AppState JSON lives under that single kv row, so a batch import is one
  atomic key-value write (a failure writes nothing)
```

**Supported formats & OCR matrix (8J — the exact, non-overstated truth):**

| Bank | Text-layer PDF / CSV / Excel | OCR (scanned PDF) | Scanned / image-only PDF |
|------|------------------------------|-------------------|--------------------------|
| GTCO | ✓ columnar parser | ✗ | ✗ → unsupported |
| OPay | ✓ columnar parser | ✗ | ✗ → unsupported |
| Kuda | ✓ (parser handles both forms) | ✓ OCR-aware parser | ✓ |
| PalmPay | ✓ wrapped-line parser + `rowYs` | ✗ | ✗ → unsupported |

- **OCR is implemented for Kuda only** (`ocrAware: true`). GTCO, OPay and PalmPay
  are columnar parsers (expect the x-split text-layer grid); they are NOT
  OCR-aware (`ocrAware: false`).
- OCR itself is content-triggered for ANY PDF (scanned-looking = empty / < 40
  chars / no row with both a date and an amount), so a scanned GTCO/OPay/PalmPay
  PDF still gets OCR'd — but the resulting one-cell-per-line cells never match
  those banks' header vocabulary, so detection reports **"unsupported"** honestly:
  zero transactions, never a misdetection, never a fabricated bank.
- **Bank-specific date handling is preserved per parser (never normalized to one
  convention):**
  - GTCO: day-first NGN (`dd/mm/yyyy` — "10/08/2026" = 10 August).
  - OPay: day-first NGN; falls back to the value date when no "Trans. Time"
    column exists.
  - Kuda: day-first NGN with 2-digit years (`dd/mm/yy`).
  - PalmPay: **month-first MM/DD/YYYY** — "08/09/2026" = 9 August, never 8
    September (deliberately kept, `StatementDateOrder = "month-day"`).

- **Transient by design**: the normalized layer exists only for the current import session
  and is never written to AppState, localStorage or SQLite — only the final `Transaction`
  rows persist (through the one storage seam, `lib/storageAdapter.ts`).
- **Direction ≠ meaning**: `BankDirection` ("in"|"out"|"unknown") is a fact of the statement
  cell; `BankTransactionKind` (expense/income/transfer/internal-transfer/bank-fee/tax/
  refund/interest/loan-payment/savings/unknown) is a classification decision that starts as
  "unknown". The existing `CategoryKind` ("income"|"expense") stays the only ledger type —
  the normalized kind maps onto it at import.
- **Privacy & local file security (Prompt 7B)**: statements are processed entirely in
  memory — `file.text()`/`file.arrayBuffer()` in the renderer, then discarded; the raw
  file is NEVER written to disk (no temp copies, browser or Electron), never uploaded,
  and never persisted. What survives an import is the CONFIRMED row's capped reference
  (≤80), capped original narration (≤200), statement date and issuing bank — as
  `importSource` provenance on the ledger `Transaction` (required for re-import
  detection); the whole raw statement, PDF bytes, account numbers and balances are
  never stored. Errors are generic and user-facing ("We couldn't read that file…",
  "Unsupported bank statement format. …") — no stack traces, no parser internals, no
  statement contents; parse failures never log anything. Account numbers from header
  rows are shown masked ("Account •••• 6789") and never leave the renderer. On the
  desktop, renderer/main isolation (sandbox, contextIsolation, no nodeIntegration)
  applies on a user's Windows machine exactly as in dev; the main process writes user
  files only through `electron/atomicWrite.cjs` (temp file + atomic rename, temp
  removed even on failure) so a crash mid-export/backup never leaves a partial copy of
  sensitive content behind.
- **Scanned-statement OCR (Prompt 8D)**: only PDFs whose text layer is unusable for a
  statement (empty cells, < 40 chars, or no row with both a date and an amount) go
  through OCR — CSV/Excel and text-layer PDFs never do (`needsOcr`, test-proven against
  the real Kuda (scanned → OCR) and PalmPay (text layer → skip) fixtures). The engine is
  **100% local**: `lib/ocrService.ts` injects `tesseract.min.js` (UMD, never bundled) and
  points the worker/core/lang at `/vendor/tesseract/` — four static files under
  `public/vendor/tesseract/` (regenerated by `scripts/fetch-ocr-assets.mjs` with pinned
  URLs: UMD + worker + WASM core + eng.traineddata, `gzip: false` since vendored data is
  plain). In the packaged EXE these ship with the UI through the existing static-export
  path (`public/` → `out/` → `app://bundle/vendor/tesseract/…`) — no electron-builder
  changes, no native modules, no `extraResources`; a missing/failed asset means
  `isAvailable()` is false and the modal shows the honest "scanned + OCR unavailable"
  message (suggesting the bank's CSV/Excel export). OCR text is session-transient: never
  logged, never stored, never uploaded — same privacy guarantees as the text pipeline
  (7B). Per-page failure isolation keeps one bad (e.g. dark/noisy) scan page from
   killing the import — the preview warns "N scanned page(s) couldn't be read". OCR output
   is detection-only input to the unchanged pipeline; the Kuda parser (Prompt 8E) reads
   exactly this OCR output (the real OCR of the scanned Kuda fixture, `kuda.ocr.txt`, is
   the parser's ground truth). Dev-only verification (`scripts/ocr-check.mjs`, `tesseract.js` +
  `mupdf` in devDependencies — pdfjs canvas rendering can't run in plain Node) read the
   real Kuda page 1 end-to-end (account number, period, balances, 36 rows) and confirmed
   page 2 is a genuinely poor scan — an honest, visible OCR-quality limit.
- **Security & privacy hardening (Prompt 8K)**: full audit of the statement-import
  surface. (1) **No raw data at rest or in transit** — imported files, rendered OCR
  images and OCR text exist only in renderer memory (`file.text()`/`file.arrayBuffer()`,
  pdfjs canvas → `getImageData`); NO temporary files are ever created (nothing to clean
  up on success or failure), no uploads, and there is no analytics/telemetry (no
  `fetch`/`sendBeacon`/`XMLHttpRequest` anywhere in `lib/`; `app/error.tsx`'s
  `console.error` is the generic error boundary, never statement content). (2) **Parsed
  transactions** — only CONFIRMED rows persist, through the one storage seam, as capped
  ledger fields + `importSource` provenance (reference ≤80, raw narration ≤200, statement
  date, issuing bank); the full raw statement, running balances, account numbers and OCR
  text never persist (verified: the SQLite kv holds AppState only). (3) **Account
  numbers** — never extracted into structured or persisted fields (Kuda's parser refuses
  bare 10+ digit runs as amounts — `BARE_DIGIT_RE`); header account numbers are masked at
  display ("Account •••• 6789") as a convenience, NOT as the security boundary — the
  boundary is that account numbers never leave the session as structured data and are
  never logged. (4) **Logs/errors** — no renderer path logs statement content (the import
  modal's catch blocks don't even `console.error`); every user-facing failure is generic
  ("We couldn't read that file…", "Unsupported bank statement format. …") with no stack
  traces, filesystem paths, OCR command lines or parser internals (7B regression-tested).
  (5) **Dependencies are local** — pdfjs (text extraction) and SheetJS run fully
  client-side; Tesseract.js is served by the app itself: every worker/core/lang path is
  overridden to `/vendor/tesseract/` with gzip off (`TESSERACT_WORKER_OPTIONS`), because
  the vendored bundles ship jsdelivr CDN defaults that must never be reached — locked by
  `lib/__tests__/ocrService.test.ts` (asserts no network origin, local asset dir, gzip
  false). (6) **EXE distribution** — the four OCR assets ship inside the EXE through the
  existing static-export path (`public/vendor/tesseract/` → `out/` → asar, served as
  `app://bundle/vendor/...`); no native OCR module and no separate installation.
  **Packaging limitation (8K): the vendored OCR assets are NOT tracked in git** (`public/`
  is currently untracked) — they are regenerated by `scripts/fetch-ocr-assets.mjs`
  (pinned URLs, dev-time network only); a fresh checkout or CI build must run that script
  before `npm run dist`, otherwise the packaged EXE ships without OCR and degrades
  gracefully to the honest "scanned + OCR unavailable" message (suggesting the bank's
  CSV/Excel export). Tesseract caches only the OCR language model (memory/IndexedDB) —
  never statement content.
- Bank-specific parsers (GTCO → `gtcoParser.ts`, OPay/OWealth → `opayParser.ts`,
  Kuda → `kudaParser.ts`, PalmPay → `palmpayParser.ts`) produce the normalized
  model directly from statement cells and set `sourceBank`. GTCO/OPay are thin
  specs over the shared columnar engine (`lib/statementColumnar.ts`, 8J), and
  PalmPay merges its wrapped lines with the `rowYs` geometry (8J). Every parser
  conforms to the `BankStatementParser` contract and is registered in
  `lib/statementRegistry.ts` — format detection and parsing ship together, so
  adding a bank (parser + parser tests + one registry entry) never touches the
  classification or import engine (Prompt 7A). Kuda detection carries its own, higher
  viability bar (`minHeaderScore` 8, vs the shared 5) because its strongest phrases
  ("opening balance"/"closing balance") sum to 6 alone — a generic statement must never
  qualify on those labels; real Kuda tables always score 10–11. Shared parser helpers
  grew for Kuda: `parseStatementDate` accepts 2-digit years (dd/mm/yy, day-first for
  NGN, calendar-validated) and `parseAmountCell` tolerates the OCR-read naira sign
  "#" — superset changes, existing parsers unaffected. Unrecognized statements are
  reported as **unsupported** with an explanation and ZERO transactions — the old
  generic `buildCandidates` fallback path is no longer used by the pipeline (the
  helpers stay exported for their own tests). OCR support is KUDA ONLY: the columnar
  GTCO/OPay/PalmPay parsers are not OCR-aware, so their scanned/image-only PDFs are
  unsupported (honest "unsupported", never misdetected — see the matrix in §4.1).
- Real-statement test fixtures (Prompt 8C) live in `tests/fixtures/statements/`: the
  actual Kuda and PalmPay statement PDFs (source of truth — never synthesized) plus
  pdfjs text-layer snapshots (`*.extracted.json`, generated from the PDFs) and, for the
  scanned Kuda PDF, its REAL OCR output (`Kuda/kuda.ocr.txt` — generated by
  `scripts/ocr-check.mjs`, never hand-edited; the ground truth for the 8E parser),
  registered in `tests/fixtures/statements/manifest.ts` (layout facts + an
  optional-fields map a parser may only fill from what the real statement carries).
  Since 8F the same statement also exists as a rasterized export fixture
  (`KUDA-real.pdf` — same account 2003640955 / period, every page an image strip; its
  REAL OCR ground truth `KUDA-real.ocr.txt` and pdfjs snapshot `KUDA-real.extracted.json`
  are registered as fixture id `"kuda-real"`; `scripts/ocr-check.mjs` takes optional
  `<pdfPath> <outTxtPath>` args so any fixture's OCR text is regenerable).
  Findings that shaped the prompts: the Kuda PDF is **scanned** (no text layer — the 8E
  parser reads its OCR output), while PalmPay's PDF has a text layer (5 columns, wrapped
  detail/ID cells, NO running balance). Since 8E/8J BOTH real statements are SUPPORTED:
  Kuda through OCR (its only path) and PalmPay through its text-layer parser (75 rows,
  wrapped Detail/ID lines merged via the `rowYs` geometry).
  `tests/fixtures/statements/statementFixtures.test.ts` locks in the honest current
  behavior (the text-layer-only path on the scanned Kuda PDF reports unsupported with
  zero transactions; the real Kuda OCR ground truth parses as 5 transactions; PalmPay
  detects as ITSELF — never GTCO/OPay/Kuda — and parses all 75 rows) and certifies the
  PalmPay fixture end-to-end against the statement's own printed totals
  (₦183,800.71 in / ₦340,270.00 out) with a TEST-ONLY integrity lens that is explicitly
  not the product parser — plus, since 8E, runs the REAL Kuda OCR ground truth through
  `ocrTextToCells` → `detectStatementFormat` (kuda, high) → `parseKudaStatement` and
  asserts the exact 5 transactions.
  **Real-engine integration tests (Prompt 8L)** live in
  `tests/fixtures/statements/statementRealEngine.test.ts`: the REAL pdfjs and SheetJS
  engines read REAL bytes (no mocks, no snapshots) — the PalmPay PDF flows end-to-end
  (extraction → `needsOcr` false → full pipeline, 75 transactions), the scanned Kuda
  PDF yields zero cells + `needsOcr` true, corrupt/zero-byte PDFs reject through the
  real engine, a real SheetJS-built `.xlsx` reads back, and a real CSV detects as
  GTCO. PLATFORM-DEPENDENT BY DESIGN: pdfjs-dist's modern build needs browser globals
  jsdom lacks (`DOMMatrix` at module load, `Uint8Array.prototype.toHex`), so the test
  file installs a minimal test-side DOMMatrix shim and routes the `pdfjs-dist` import
  to the official LEGACY build (the pdfjs team's documented Node choice — same engine,
  Node-compatible shims). The app keeps the modern build (browser/Electron renderer);
  the ordinary unit suite never touches the shims, and real OCR engine availability is
  NOT required anywhere in the suite (the Kuda OCR ground truth remains the OCR-path
  fixture).

  **Final audit (Prompt 8M)** confirmed every stage of the feature and documented the
  deployment contract: supported banks are exactly the four registry entries (GTCO,
  OPay, Kuda, PalmPay) over CSV / XLSX / XLS / PDF files; scanned PDFs are OCR'd ONLY
  when `needsOcr` finds no usable text layer, one page at a time, with per-page
  failure isolation and abort support; EXE users need NOTHING installed — the OCR
  assets ship inside the static export (`out/vendor/tesseract/`, served as
  `app://bundle/vendor/tesseract/...`), pdfjs's worker is emitted by the bundler, and
  SheetJS is bundled — all fully offline and local. Financial-correctness contract
  (test-locked): amounts are never read from the running-balance column/position
  (Kuda: flow = first amount token, balance = last; columnar: debit/credit vs balance
  columns are distinct roles), direction always comes from a cell fact (CR/DR tag,
  sign, parens, balance-delta epsilon chain) and is never inferred from narration,
  and fees/taxes/loan-payments/savings/internal-transfers are NOT ledger items —
  `ledgerKindFor` returns null for them, so an internal transfer can never become an
  accidental expense; refunds and interest import as income. Known limitation: the
  relationship linker is O(n²) in statement rows (fine for real monthly statements,
  noticeable only on very large files). How to add a bank parser: one file conforming
  to `BankStatementParser` (detection vocabulary + parse + capabilities) + parser
  tests + one `BANK_PARSERS` entry — the pipeline, classification and import engine
  are never touched (columnar banks can be thin specs over `lib/statementColumnar.ts`).
  Testing: the full import surface is covered by `lib/__tests__/` (parsers,
  classification, identity, relations, pipeline, OCR), the modal suite
  (`components/planner/ImportStatementModal.test.tsx`), the fixture suites
  (`tests/fixtures/statements/` — real PDFs, OCR ground truth, real-engine
  integration), plus `npm run desktop:smoke` for the packaged shell.

### 4.1a Statement format verification — READ THIS BEFORE TRUSTING A PARSER

A bank statement parser is only as current as the last real file someone
checked it against. OPay proved the failure mode: a real 11-page statement sat
in `tests/fixtures/statements/Opay/` wired into **nothing** — its manifest
entry did not even typecheck, so the repo's own fixture `id` union was missing
it — while `lib/__tests__/opayParser.test.ts` passed against a tidy
constructed header (`"Balance After(₦)"`, `"Channel"`) that the real export
does not emit. Every test was green and the live app imported nothing.

So statement fixtures carry the same **verified-vs-representative tiering** the
email templates use (`docs/15_EMAIL_PARSING.md`), declared as data on each
entry in `tests/fixtures/statements/manifest.ts` (`lastVerified`, `coverage`,
`coverageNote`) rather than as prose that can drift:

| Fixture | Real file | Coverage | Last verified | What is NOT covered |
|---|---|---|---|---|
| **opay** | 11-page text-layer PDF, two accounts | end-to-end | **2026-08-27** | — all 250 transactions reconcile against both printed summary blocks |
| **gtco-real** | 5-page password-protected PDF, three accounts | end-to-end | 2026-08-26 | only the FIRST account is imported, by design; `lib/__tests__/gtcoParser.test.ts` itself is representative |
| **palmpay** | 3-page text-layer PDF | end-to-end | 2026-08-26 | — reconciles against the printed Total Money In / Money Out |
| **kuda** | 2-page scanned PDF + real OCR text | partial | 2026-08-26 | page 2 of the scan is too dark to read, so only 5 transactions; and **no real text-layer Kuda statement exists in the repo**, so half the parser is exercised only by representative rows |
| **kuda-real** | rasterized twin of the above | partial | 2026-08-26 | proves only that pdfjs finds no text layer and OCR reproduces the same 5 transactions |

`tests/fixtures/statements/fixtureCoverage.test.ts` scans the test sources the
way `categoryRegistry.test.tsx` scans components and fails when a fixture is in
the repo but **no test loads it** — the exact gap that let OPay drift. Being in
the repo is not coverage.

Rules that follow from this:

- A parser test built on a **constructed** header row proves the spec, not the
  format. Keep them — they are the fast unit layer — but a bank is only
  "supported" once a real file parses end-to-end against figures the statement
  itself prints (its summary block, not numbers a human retyped).
- When you re-read a real file, bump `lastVerified` even if nothing changed.
  An unchanged date is the signal to re-check.
- Reconcile against **printed totals**, never against the previous run's
  output. Asserting last week's numbers only proves the parser is consistent,
  which a broken parser also is.

## 5. Error handling

| Layer | Behavior |
|-------|----------|
| Validation (forms) | Inline field errors from `lib/validate.ts` helpers; never throw to boundary |
| Storage parse failure | `app/error.tsx` detects `CorruptedStateError` and renders `RecoveryPanel`: scan browser for recoverable payloads, restore a backup, import an export file, or start fresh. The corrupt payload was auto-snapshotted (`budget-planner:backup:auto-corrupt:*`) before failure, so nothing is destroyed |
| Unexpected render error | `app/error.tsx` generic stack with reload button |
| Import of invalid file | Inline error in import UI; state untouched (AC-10) |
| Toast | Non-blocking `Toast.tsx` for success confirmations (saved / exported / imported) |

## 6. Security notes

- No secrets, no tokens, no server code. Never log `localStorage` contents; statement
  contents (descriptions, references, account numbers) are never logged — the import
  modal's catch blocks don't even `console.error` (7B regression-tested).
- Atomic writes (`electron/atomicWrite.cjs`, used by exports, `desktop:fs:writeText` and
  file backups): temp file + rename, temp file removed even when the write or rename
  fails — no partial files, no leftover copies of sensitive content on failure.
- File import only accepts `application/json`; content is parsed by `validateAppState`
  (schema check first: `version` between 1 and 3 and required arrays — never `JSON.parse` +
  spread directly into state).
- `dangerouslySetInnerHTML` is prohibited; user notes render as plain text.

## 7. Performance

- Selector-based store subscriptions: components subscribe to slices (e.g.
  `useAppStore((s) => s.state.transactions)`) — never the whole state.
- `React.memo` on `TransactionRow`, `BudgetRow`, `FutureExpenseRow` (upcoming), and the
  `BarChart` row component; `InsightsPanel` memoizes `insightsFor(...)` on its inputs.
- `TransactionList` paginates at 25 rows (FR-04); no virtualization dependency needed up to
  1000 rows.
- Charts re-render only when their data slice changes. Reports selectors are pure and
  shared with the Planner.
- `AllocationDrawer` is not mounted at all until a trigger opens it, so the Planner carries
  no allocation sliders at rest; once open it keeps its move amounts in local state and
  re-renders only on its own slider input or a store change in `budgets`/`transactions`.
- Chart/progress animations are pure CSS width transitions; no JS-driven frames after the
  one-time rAF mount pass.
- Recharts is imported only by `components/reports/*`; Next.js route-splits it so other
  pages never load the chart bundle.

## 8. Testing strategy (mapped to implementation phase)

- Unit (`vitest`): `lib/*` — dates, money (NGN/USD formatting, AC-20), recurrence generation
  (AC-06, AC-07, `recordException`), selectors (AC-12, AC-19 `budgetHealth`,
  `deferredExpenses` AC-24), validation (AC-10, AC-16 migration), allocation (AC-18),
  insights (AC-21), todo (AC-23), storage (migrations, corrupt snapshots, write guard).
- Component (`@testing-library/react`): form validation (AC-02), budget progress states
  (AC-03), add/edit/delete transaction flow (AC-04, AC-05), persistence across remount
  (AC-08), priority badge + move-to-next-month action (AC-17, AC-24), allocation
  apply/reset (AC-18), insights cards (AC-21), todo items (AC-23), modal focus isolation
  and node-identity/remount regression suites.
- Current totals: **324 tests / 34 files** (17 `lib/__tests__/`, 1 `store/__tests__/`,
  16 colocated component suites). Gates: `npx tsc --noEmit` · `npm run lint` ·
  `npm run test` · `npm run build`.
- Manual E2E checklist: `PHASE-04-IMPLEMENTATION.md` §5.
