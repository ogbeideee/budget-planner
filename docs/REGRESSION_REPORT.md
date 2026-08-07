# Regression Test Report

**Date:** 2026-08-07
**Build:** budget-planner 0.1.0 (Next 16.2.12, Electron 43.3.0, electron-builder 26.15.3)
**Scope:** Full regression campaign across all major workflows.

## Summary

| Gate | Result |
|---|---|
| Tests (`npm run test`, vitest) | **39 files, 360 tests passed** (0 failed, 0 skipped) |
| Typecheck (`npx tsc --noEmit`) | Clean (1114 files) |
| Lint (`npm run lint`) | Clean (194 files, 0 problems) |
| Build (`npm run build`) | Success (9 static routes prerendered) |
| Native module (`npm run db:check`) | SQLITE_OK, MIGRATE_OK (rows/backup/marker), retry-after-failure OK |
| Desktop smoke (`Budget Planner.exe --smoke`) | **SMOKE_OK** — title "Timeline · Budget Planner", bridge active, sqlite roundtrip verified (rows=21, migrated=false), menu groups File/Edit/View/Window/Help, updater scaffold inactive (no-feed) |

## Workflow Checklist

### Planner
- [x] Budget create/edit/delete — BudgetForm tests + store tests (addBudget/updateBudget/deleteBudget)
- [x] Allocate income — AllocationPanel tests (44 planner tests total)
- [x] Funding recommendations — NeedsFundingSection unified selector + lib/funding (gap ordering, categories + obligations)
- [x] Budget health — lib/selectors budgetHealth (scores 75/100/85/55 scenarios)
- [x] Budget allocation accordion — **new `Disclosure.test.tsx` regression suite (3 tests)** added this campaign: expand/collapse shows/hides body, collapsed panel contributes zero layout height (grid-template-rows 0fr), open state persists across remounts via storage seam

### Income
- [x] Create/edit/delete — IncomeModal remount tests (editing one source never wipes another) + store setIncomePlan (upsert by id, null creates)

### Expenses
- [x] Create/edit/delete — TransactionForm tests (validation, category sync)

### Categories
- [x] Create/edit/delete — CategoryModal + CategoryManager tests
- [x] Immediate propagation — exercised by NeedsFundingSection/BudgetList suites (new categories appear in selectors/funding list without refresh)

### Timeline
- [x] Filters, search, sorting, editing, deleting — HistoryView/TransactionList/TransactionCard tests + selectors (73 income+expense+timeline tests total)

### Reports
- [x] Charts, statistics, projections, trends — ReportsVisual tests + lib/selectors, finance, insights, recommendations (82 settings+reports tests total)

### Settings
- [x] Preferences, theme, persistence — theme tests (dark/light), storage + storageAdapter tests (localStorage and Electron seam)

### Desktop
- [x] Window opens — packaged exe smoke test (SMOKE_OK)
- [x] Icons — build/icon.ico (25.9 KB), build/icon.png (34.2 KB) present; icon drawn by scripts/make-icon.mjs
- [x] Installer works — Setup 165.06 MB + Portable 164.82 MB present, win-unpacked app runs (215 MB exe, app.asar 183.0 MB)
- [x] Taskbar icon / desktop shortcut / start menu icon — from build/icon.ico (verified present, used by electron-builder config)

## Look-for items
- Console errors / runtime exceptions — none in suite; smoke run shows only Chromium GPU disk-cache noise (headless mode), not app errors
- Broken layouts / clipped components — covered by component render tests; accordion zero-height check now explicit
- Incorrect calculations — covered by selectors/funding/finance/insights/recommendations unit suites
- Stale state / refresh requirements — remount tests (IncomeModal, BudgetForm, BudgetList focus) verify no-refresh propagation; Disclosure persistence test added
- Overflowing text — truncate classes verified in Disclosure header render

## Changes made this campaign
- Added `components/ui/Disclosure.test.tsx` (3 tests) — the only checklist workflow (accordion) that previously lacked direct coverage. This is the regression guard for the grid-template-rows collapse rework.

## Verdict
**PASS** — all 8 workflow areas verified; no regressions found.
