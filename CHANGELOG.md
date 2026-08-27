# Changelog

## [Unreleased]

### Added

- **Groundwork for reading bank alert emails** — the parsing engine, the list of
  bank senders it will ever look at, and secure password storage are in place.
  Your email password is kept in the operating system’s own keychain; if that
  isn’t available the app refuses to store it rather than putting it somewhere
  readable. Only alerts from your bank are ever read, nothing is sent anywhere,
  and every detected transaction would be a draft you confirm. Not switched on
  yet — the mailbox connection and its screens are still to come.
- **Import Statement remembers your corrections better.** Fixed a bug where only the
  first merchant you taught it was ever recognised — every learned merchant now
  matches. Close spellings of the same merchant are recognised too, and a row filled
  in from something you taught it is marked “Learned” so you can see where the
  category came from and change it before importing. Settings → Learned rules gains
  a “Clear all” if you want to start over.
- **Savings streaks and badges** — finish a month inside your total budget and it
  counts toward a streak, shown right in the budget status band as “3-month
  streak”. Tap it for the badge list: what you’ve earned, and what the next one
  needs. Only finished months count, so a good month in progress isn’t claimed
  early and a rough patch mid-month doesn’t break anything yet. Badges are just
  recognition — they don’t unlock anything.
- **Debt payoff planning** — switch on “Track as debt” for a category, add what you
  owe, the interest rate (0% is fine for a family loan) and the minimum payment, and
  the new Debt payoff page under Analytics shows when you’ll be clear. With two or
  more debts it compares avalanche (highest rate first) against snowball (smallest
  balance first) side by side, with the payoff order and total interest for each, and
  tells you which costs less. With one debt it just shows the projection — comparing
  a strategy against itself would be noise. Set the extra you can put in each month;
  it starts from what’s left in this month’s budget and is yours to change.
  All worked out on your machine from ordinary interest arithmetic.
- **Rollover budgets** — switch on “Roll over unused funds” for a category and
  whatever you don’t spend that month is added to next month’s limit, up to one
  extra month’s worth. Off by default, and chosen per category rather than
  globally. Going over your limit rolls nothing forward: the next month still
  starts at its full limit, never a reduced one. A boosted row shows where the
  extra came from — a “+$600.00” badge and the “base + carry” breakdown —
  instead of just a bigger number.

- **A lot more category icons to choose from** — 100 → 153, reorganised into
  14 groups including new Housing, Utilities, Connectivity, Work, Giving and
  Travel sections. Nothing was removed, so any icon you have already picked is
  still there and still selectable.

- **Category names, icons and colours now come from one place.** The same two
  display bugs kept reappearing because each component formatted the name,
  read the icon, and picked a colour its own way. All 19 components that show
  a category now read from a single registry, and a test fails the build if a
  new one does its own thing.

- **New users now get a first-run onboarding flow.** Three short screens
  explaining what the app is for, then a required setup that collects your
  expected income and at least two budget categories before the dashboard
  opens — so nobody's first view is an empty planner. The intro can be
  skipped; the setup cannot. Close the app part-way through and it picks up
  where you left off.
- Setup uses the app's real income and budget creation, so anything added
  there behaves exactly like data you add manually later.
- Existing installs are unaffected and will not see onboarding.

- **Category names are capitalized consistently everywhere now.** The Category
  analysis list still showed "internet" in lowercase while the rest of the app
  showed "Internet". Every remaining place that printed a category name
  straight from storage now goes through the same formatter, and a test now
  fails the build if a new component forgets it.
- **Removed a repeated title:** the Cash flow card sat under a "Cash flow"
  section header saying the same thing twice. The card is now "Money in vs
  out", matching how the other sections pair a header with a differently
  worded card title.
- **Recommendations now open the most urgent card, not the first one.** The
  expanded card is the warning with the most money at stake; if nothing needs
  attention, they all start collapsed. This also fixes a bug where the
  expanded default silently never applied at all.

- **Reports: the Budget utilization chart is hidden until there are two
  months of data.** With a single month it drew one solid bar across the whole
  card, which looked broken rather than informative. It is now left out of the
  page entirely until there is enough history to plot a trend, using the same
  threshold as the "you're looking at data from just one month so far" banner
  — which still shows, so it is clear why the chart is absent. Every other
  trend chart on the page was checked and left alone: they plot every month in
  the window with zeros where there is no data, which reads correctly.

- **Reports: "Expected vs actual" and "Income trend" are now one card.** Both
  compared planned income against what actually arrived — one broken out by
  source for the month, the other as a six-month trend. They are now a single
  "Income: expected vs received" card with a **By source / Over time** toggle,
  opening on By source. The Expected/Received legend is shared, so switching
  views does not look like a different chart. "Income sources" is unchanged.

- **Reports no longer repeats the same category breakdown five times.** The
  page showed "which category spent how much" in five places; it now shows it
  in two. "Spending by category" and the "Top categories" chart are gone, as
  is the Financial Insights chip that restated the headline above it word for
  word. What remains is the Category analysis donut + list — moved up into the
  Spending breakdown section, under Income vs expenses — and the
  Recommendations cards, which are kept because they are actionable.

- **The Planner hero card is condensed and matched to the redesign reference.**
  Tighter padding and per-block spacing bring it from a tall card down to
  ~254px, lifting the metric cards and everything below it up the page. The
  stat row gains inline icons — a calendar before "days remaining" and a trend
  mark before the per-day amount — replacing the old dot-and-bullet treatment.
  The progress row now shows received / expected on the right, above the bar.
  The background illustration is the same artwork, just bounded and dimmed so
  it reads as a backdrop instead of competing with the text.
  Verified in dark mode against the reference, and re-checked in light mode.

- **Category icons audited again, and the icon library expanded.** Three
  categories carried an icon a new user would misread: Loan showed a piggy
  bank (reads as savings, and was the same icon as Salary), Misc showed a
  shopping cart, and internet showed a light bulb. They are now a repayment,
  a box and a globe. The other ten categories were judged correct and left
  alone. As before, the fix only applies where the old icon is still in place,
  so anything you have re-iconed yourself is untouched.
- **14 new icons**, covering gaps the picker could not previously serve:
  internet, mobile data/airtime, satellite, insurance, charity, transfers,
  bills, loan repayment, basket, dining out, TV/streaming, celebrations,
  birthdays, and a new "Other" group with a miscellaneous catch-all. This also
  adds the two icons the previous audit assigned but never made pickable, so
  every category's icon can now be found and changed in the picker.

- **Typography audit.** The app was already running on Inter (loaded and
  self-hosted by Next's font optimisation), so the typeface itself did not
  change. Two real gaps were fixed: the Electron startup splash was rendering
  in Segoe UI rather than Inter, and 11 of 35 currency values on the Planner
  were using proportional digits — including the whole "spent · left" column
  in the budget list, so amounts did not line up row to row. Figures now use
  tabular numerals everywhere they sit in a column.

- **The Budgets donut is now a single continuous ring.** Categories used to
  render as separate arcs with rounded ends and a gap between each one; they
  are now flush conic-gradient wedges with hard edges and no gap anywhere, and
  the ring is noticeably thicker. Segment order, proportions and colours are
  unchanged, and the legend swatches still match the wedges exactly.
- Fixed along the way: a month with a single budgeted category rendered a blank
  ring, because a one-colour gradient is invalid CSS and browsers dropped it.

- **Fixed: the edit / allocate / delete icons on each budget row were
  invisible.** Two separate problems. The icons were sized to zero width — the
  shared button component's small size forces horizontal padding that the
  override could not beat, leaving no room inside a 24px button — and the whole
  group was transparent until you hovered the row. They now render at a proper
  32px touch target with 16px glyphs, and are visible at rest rather than on
  hover, so they are reachable by touch and by keyboard/screen-reader users.
  Verified by screenshotting the running app: all three show clearly on
  on-track rows, a long-name row, and both over-limit (red-tinted) rows.
  Colour was already fine — muted grey clears the contrast threshold on every
  row tint including the red one — and nothing was being clipped.

- **Category names now display with a capital first letter** wherever they are
  printed (budget list, donut legend, status band, allocation drawer, recent
  activity, timeline, expense details, report insights and chart axes) — a
  category stored as `internet` reads "Internet". The stored name is untouched,
  so accent/tint lookups and sorting are unaffected.
- **Two category icons corrected** to match what they represent: "Edi"
  (data/airtime top-ups) 🌲 → 📶 and "Essentials" 🏪 → 🧺 (a basket rather than a
  cart, so it does not collide with Misc's 🛒, which stays as-is). Applied once on load
  and only where the old icon is still in place — if you have already picked
  your own icon for either, yours is kept, and both stay editable afterwards.
  Transport, Loan, Misc, Internet and Palmpay are untouched. State schema
  bumped to version 5 to carry this migration.
- **The hero greeting card is less tall** — its vertical padding is reduced so
  the card sits closer to its content, lifting the metric cards and everything
  below it up the page. No content removed and the illustration stays.
- Checked that the hero's "Review Budget" and the status band's "Review
  budgets" go to the same destination: they already did (both route through
  `components/planner/reviewBudgets.ts`), so no change was needed.
- **Fixed: every budget row has a working "edit budget" action again.** An
  earlier change in this same unreleased batch repurposed the row's pencil to
  open the allocation drawer, which left no way to edit an on-track category's
  limit or priority from the list — only over-limit categories could reach the
  edit form, through the recommendations panel. The pencil now opens the
  original edit form (limit + priority) on every row, and a separate
  arrows/exchange icon beside it opens the allocation drawer. Order at the end
  of the row is edit → allocate → delete, all the same size, and the two
  actions read distinctly to screen readers ("Edit {category} budget" vs
  "Allocate funds to {category}").
- **Planner: "Allocate remaining" is no longer a permanent section.** It used
  to render one slider per budget on every page load, including for categories
  with nothing left to allocate. That section is gone — the Planner now shows
  no allocation sliders at rest.
- **Allocation happens in an on-demand drawer** that slides in from the right
  (~400px, full height, dimmed scrim). It opens per category from a budget
  row's arrows/exchange action, or from the "Remaining" summary card, which now lists the
  month's budgets and hands the chosen one to the same drawer. The drawer
  reads live data every time it opens: an over-budget hint with the real
  overage and limit, one "move funds from" row per other category that
  actually has room (omitted entirely when none do), and a dashed row to raise
  the category's own limit.
- Moving from several categories at once sums correctly against the target's
  shortfall and is clamped so it can bring the target exactly to its limit and
  no further; no source can be pushed negative. Cancel, Escape and clicking
  the scrim all discard changes. Apply updates the affected rows in place.
- **Planner: "Budget Allocation" and "Expense breakdown" merged into one
  "Budgets" section.** Both listed the same categories. The standalone Expense
  breakdown section is gone from the Planner; the section that remains is
  titled "Budgets · N categories" (count is live) and keeps the donut card
  (now a fixed 300px) beside the flexible category list. The donut centre
  reads "{budgeted} / of {total} · {pct}%" and gained a top-5 legend
  (swatch, name, share) below it — the rest of the categories are already in
  the list beside it.
- **Over-limit rows are now obvious at a glance:** a "{pct}% · {overage} over"
  badge on the name line, a tick on the progress bar marking where the limit
  was crossed inside the full red bar, and the shared danger red tint as the
  row background (same row height and spacing as before).
- With no budgets, the donut card shows "No budgets set up yet" with a create
  CTA instead of an empty ring, and the list card is not rendered.
- `ExpenseBreakdown` itself is retained — the Reports page still renders it as
  "Spending by category". Nothing on Reports changed.
- **Planner: one Budget status band replaces three overlapping widgets.** The
  red "Budget needs attention" alert banner, the "Needs Funding" card and the
  "Budget Health" card all said versions of the same thing; they are gone,
  replaced by a single card below the four metric cards. It shows a
  conic-gradient health ring with the score (red arc, border-colored
  remainder), "Budget health" with an info tooltip, a pill derived from the
  score ("At risk" below 60, "Good" at 60+), status flags — every over-limit
  category with its overage, plus the funding/income line, collapsing to "All
  budgets on track this month." when nothing is wrong — and a right-anchored
  "Review budgets" button. Under 980px the regions stack and the divider is
  hidden. The band does not render when no categories are configured.
- **The hero's "Review Budget" and the band's "Review budgets" now go to the
  identical destination** (`components/planner/reviewBudgets.ts`); previously
  the hero only scrolled while the banner also navigated to `/?focus=over`.
- The health-score calculation (`budgetHealth`) and `fundingNeeds` are
  unchanged — only their presentation moved.

## [0.1.2] - 2026-08-18

- **Fixed OCR startup in the packaged desktop app (real Kuda scanned-statement
  import).** The Tesseract engine could not start in ANY runtime (dev or
  packaged): `workerBlobURL: true` made tesseract.js wrap the worker code in a
  `blob:` URL whose contents are `importScripts("/vendor/tesseract/worker.min.js")`,
  and inside a blob worker that leading-slash path cannot resolve against the
  blob base URL — Chromium rejects it with "The URL ... is invalid", so every
  scanned import ended on "The built-in scanner couldn't start on this device".
  Fixed with `workerBlobURL: false`: the worker loads from its real URL
  (`/vendor/tesseract/worker.min.js`), which resolves against the page origin
  (`app://bundle` in the EXE, the dev server in development) — the same
  mechanism the pdfjs worker already uses in the packaged app. Verified
  end-to-end in the packaged runtime: the real Kuda PDF renders page 1
  (1785×2526 @ scale 3) and OCR returns the real statement text. Added a small
  diagnostic path: `OcrService.lastStartError` / `OcrPdfOutcome.engineError`
  surface the engine-level reason under the generic OCR-unavailable message
  (asset/worker errors only — never statement content).
- **Packaged desktop app rebuilt to ship the prompt-8L fix** — the installed EXEs
  (built 8/17 10:09 AM) predated the 8L header-anchored alignment seam (8/17
  19:36–20:10 PM): the real password-protected GTCO file unlocked but parsed 0
  transactions ("No transactions could be detected in that file"). The current
  source was re-verified end-to-end (real file + real password → 49 transactions;
  extraction identical in Node and a real Electron/Chromium worker) and the app
  was re-packaged (`dist/win-unpacked`, Setup, Portable). No source changes
  were needed — the binaries were stale.

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- **Password-protected GTCO export PDF — real-fixture regression coverage
  (prompt 8L): the REAL protected statement now parses end-to-end — 49
  transactions, 0 skipped, 0 errors — through the REAL runtime path
  (classify with the user's password → aligned text-layer cells → GTCO
  parser).** Root cause of the reported "zero transactions": the file IS
  protected (Standard security handler, /V 2 /R 3 /Length 128 = RC4-128,
  fully supported by pdfjs — unlock was never the problem) and it HAS a text
  layer, but pdfjs emits NO text for empty cells, so every sparse row came
  out left-packed and the columnar engine's misalignment guards correctly
  rejected the shifted numbers (0 transactions, 118 skipped, all rows
  "misaligned row"). Detection was always correct (gtco, supported).
  **Fix — a header-anchored alignment seam, not a parser swap**: new
  `rowsFromPdfItems` in `lib/statementImport.ts` re-slots every text-layer
  line into the columns anchored by the page's columnar table header (nearest
  x, explicit empty cells) when that header carries ≥5 columnar vocabulary
  tokens (GTCO/OPay-shape headers); PalmPay/Kuda/mock headers deliberately
  stay below the trigger and keep raw reading-order cells — their parsers are
  untouched. The columnar engine (`lib/statementColumnar.ts`) additionally
  gained: repeated-table-header silent skip (multi-page tables), a boundary
  stop when a second account's block starts ("CUSTOMER STATEMENT" token, or a
  "Statement Period" + date-range label row — multi-account statements never
  mix accounts; the 6 cosmetic invalid-date rows of the account-2 label block
  are no longer read), and narration continuation-line merging: wrapped
  narrations printed on their own lines (no date/amounts/balance) form
  groups that attach to whichever of the previous transaction / next row is
  NEAREST by page line (`rowYs` geometry — tie → next), falling back to the
  previous transaction when geometry is unknown; trailing fragments after a
  boundary stop are dropped (they belong to the next account's label block).
  `gtcoParser.ts` composes the description from the Originating Branch cell
  only when the statement actually HAS a Remarks column (`hasColumn` gate) —
  the real PDF prints long narrations inside the branch column; remarks-less
  exports are unchanged. **Fixtures (all REAL, additive)**:
  `tests/fixtures/statements/GTCO-real-protected.pdf` + `GTCO-real.extracted.json`
  (real pdfjs text-layer snapshot: 5 pages, 839 items — the snapshot is
  decrypted text only, no password/encryption material); registered as
  fixture id `"gtco-real"` in the manifest with layout facts (RC4-128
  protected, one file three accounts, sparse text layer → alignment, wrapped
  narrations, repeated headers). The user's password is NEVER committed:
  the real-unlock test reads `GTCO_STATEMENT_PASSWORD` and skips cleanly when
  unset. Tests (+18): a fixture describe asserts the sparse→8-column
  realignment, silent repeated headers, the exact 49 transactions (spot rows
  12/17/20/27/92/101/104 — merged wrapped narrations included), and the full
  pipeline (supported, gtco, 49, 0 skipped/errors); env-gated real-engine
  tests prove needs-password / incorrect-password / the full unlock→parse
  flow; unit tests cover alignment triggering/fallback, continuation merge
  geometry (above/below/tie→next/no-geometry), and both boundary stops.
  Parser identity, detection, encryption support and the import UI are
  untouched. Full suite 1111 → 1128 (+1 skipped env-gated), 0 failed;
  tsc/lint/build clean.

- **Rasterized Kuda export PDF — real-fixture regression coverage (prompt 8F):
  the new `KUDA-real.pdf` is proven to have NO text layer, its REAL OCR output
  parses as the 5 known Kuda transactions, and the parser itself needed ZERO
  changes.** Root cause of the reported "zero transactions": the file's page
  content streams draw ONLY image XObjects — every page is a strip of JPEG
  images (raw-stream evidence: `Do` paint-XObject calls, no text operators;
  the single real text run per page is the "Page 1 of 2" marker, mapped by a
  Type0 CIDFontType2 ToUnicode that decodes only the marker glyphs). pdfjs
  text extraction (verified with the legacy build, the same engine the modern
  build uses) surfaces exactly the two page markers; the app's
  `needsOcr`/classify path therefore routes the file to OCR — correct
  behavior, not a parser workaround, and the file is NOT misrouted as text
  (there is no transaction text to misroute). The REAL OCR of the new file
  (regenerated with the same `scripts/ocr-check.mjs` tooling: mupdf render at
  scale 3 + tesseract.js eng with the vendored assets — ground truth
  `KUDA-real.ocr.txt`, never hand-edited) is the SAME statement as the
  scanned fixture (account 2003640955, period 01/07/2026 - 14/08/2026) and
  parses through the EXISTING Kuda parser into the same 5 transactions:
  01/08/26 13:05:08 money in ₦2,925.00 (local funds transfer, "Sporty Internet
  Ltd - Disbursment/3000127755/Kuda"), 02/08/26 21:39:58 money out ₦2,800.00
  (outward transfer to Wema Bank, wrapped to/from), 04/08/26 16:53:03 money
  out ₦100.00 (Opay outward), 04/08/26 16:53:03 money out ₦10.00 (spend and
  save), and the Spend + Save pocket's own row (₦10.00, 840.00 balance) —
  exact dates/times/amounts/directions/balances/row numbers, zero skipped,
  zero errors, and no summary/totals/header/footer row ever becomes a
  transaction. **Spend + Save decision (prompt 8F)**: the pocket section is
  NOT skipped — each pocket's own table is parsed and produces its
  transaction, exactly as the existing parser already did for the scanned
  fixture; the internal "spend and save" movements stay money movements
  (direction out) that the existing transfer/duplicate semantics handle (the
  main-section ₦10.00 and the pocket ₦10.00 are the same internal movement).
  **Fixtures (all REAL, additive)**: `tests/fixtures/statements/KUDA-real.pdf`
  + `KUDA-real.ocr.txt` (real OCR) + `KUDA-real.extracted.json` (real pdfjs
  page markers); registered as fixture id `"kuda-real"` in the manifest;
  `scripts/ocr-check.mjs` gained optional `<pdfPath> <outTxtPath>` arguments
  so any fixture's OCR ground truth is regenerable by the documented tool.
  Tests (+8): a real-engine test proves the REAL pdfjs yields zero rows from
  the REAL file and `needsOcr` (never misrouted as text), and a fixture
  describe asserts the real OCR → cells shape, Kuda detection (high), the 5
  exact transactions, the no-summary/header/footer rule, and the full
  pipeline (supported, 5 tx, 0 skipped/errors). Parser logic, OCR scope,
  encryption support and the import UI are untouched. Full suite 1101 → 1109,
  0 failed; tsc/lint clean.

- **Password-protected bank statement PDFs — encrypted-PDF import (Phase D).
  Password entry, local unlock, text/OCR routing; no new parsers, no schema
  change.** Previously a protected PDF landed on the generic "couldn't read
  that file" error; now the import modal shows a dedicated password stage.
  **Classification seam** — new `lib/statementPdf.ts` carries the SHARED
  vocabulary: `PdfDocumentKind` ("text" | "scanned" | "encrypted" |
  "unsupported"), `PdfPasswordStatus` (needs-password / incorrect-password /
  unsupported-encryption), the typed `PdfPasswordError` the UI understands,
  and `passwordStatusOf` (pdfjs `PasswordException` code 1/2 → status). New
  `classifyPdfDocument(data, { password? })` in `lib/statementOcr.ts` probes
  a PDF WITHOUT rendering pages: opens it with pdfjs, reads the text layer,
  and reports kind + password status. **Routing** — `extractStatementRowsWithOcr`
  classifies FIRST: an "encrypted" probe throws `PdfPasswordError` (the modal
  keeps the file and shows its password screen); on retry with a password the
  probe unlocks and routes by text-layer presence — "text" → the existing
  cells → `processStatement` → registry bank detection → the existing parsers
  (GTCO/OPay/Kuda/PalmPay — NOTHING duplicated), "scanned" → the existing
  OCR pipeline (`ocrPdfToCells`, per-page isolation, abort, phase callbacks)
  with the password threaded through. `lib/statementImport.ts`'s
  `pdfRowsFromPdf` gained the same `password` param and
  PasswordException→`PdfPasswordError` mapping for the older seam. **UI** —
  `ImportStatementModal` gained the "password" stage: the file is kept
  (`pendingFile`) for Unlock to retry the SAME bytes, the password lives in
  component state ONLY (never persisted, logged or sent anywhere — reset on
  any close), a wrong password stays on the stage with "That password is
  incorrect — try again.", unsupported encryption returns to upload with a
  specific message, and cancellation (X/overlay/Escape/Cancel) aborts any
  in-flight pass and clears the password. **Real-engine encrypted tests**
  (new `tests/fixtures/statements/buildPdf.ts` + `statementEncrypted.test.ts`,
  6 tests) run the REAL pdfjs engine against REAL bytes: AES-256-encrypted
  stand-ins built with mupdf from the exact layouts the parser suites use
  (a REAL embedded TrueType font — base-14 Helvetica is not embedded, so
  jsdom's missing `standardFontDataUrl` would mangle metrics): encrypted
  text Kuda → needs-password → wrong password → unlock → full pipeline
  (5 transactions); encrypted OPay → columnar debit-only grid → 3
  transactions; encrypted GTCO → credit-only grid → 2 transactions (PDF text
  layers have NO empty cells — a blank column emits no text run, cells
  left-pack and the columnar engine's misalignment guards reject the row, so
  the synthesized columnar grids are single-sided with trailing money
  columns; this is the app's real limitation, the tests document it);
  encrypted SCANNED Kuda (the REAL fixture, encrypted in-memory only) →
  wrong password → unlock → OCR path with the REAL `kuda.ocr.txt` text → 5
  transactions; the same statements import unencrypted (regression); and
  `PdfPasswordError` is the typed error the modal's password stage handles.
  **Fix surfaced by the scanned test** — `extractStatementRowsWithOcr` reused
  the ArrayBuffer for OCR after `classifyPdfDocument` had detached it (pdfjs
  transfers the buffer to its worker): encrypted scanned PDFs crashed with
  "Cannot perform Construct on a detached ArrayBuffer"; the OCR pass now
  re-reads `file.arrayBuffer()` (same as the plain scanned path).
  **Privacy** — passwords are memory-only end to end (unit tests assert the
  password is threaded to pdfjs but never into storage or any
  console/output), PDFs are unlocked locally by the in-app pdfjs engine and
  never leave the device. Tests: +5 `statementPdf`, +9 `statementOcr`
  (classify encrypted/incorrect/unsupported, password threading, unlock
  text/scanned, PdfPasswordError), password mapping in `statementImport`,
  +7 modal (asks for the password, unlocks + preview, wrong-password retry,
  unsupported encryption, cancel without persisting, never persists or
  logs), +6 real-engine encrypted. Full suite 1046 → 1101, 0 failed;
  tsc/lint/build green; EXE deliberately not built.

- **Redesign the import review transaction list (8I.1) — UI/UX correction
  only; no parser, OCR, categorization, duplicate-detection, database or
  model changes.** The review screen no longer feels like a form: each
  transaction is a COMPACT ONE-ROW LIST ITEM — checkbox, date, direction icon
  + truncated description (gets the width, `flex-1 min-w-0 truncate`),
  category chip (or a compact warn-styled "Assign" button when uncategorized
  that opens the row), subtle confidence label (High/Medium/Uncertain, hidden
  below `sm`), actionable status chips only (Already imported, Possible
  duplicate + Skip/Keep, Duplicate, Excluded, Needs review), right-aligned
  strong amount (explicit "+" prefix for credits, `text-income`/`text-expense`
  styling), chevron. The per-row "New" chip is removed (a fresh import is new
  by definition; ledger matches still show "Already imported"). Editing
  controls moved into an EXPANDED DETAILS section (click the row or chevron;
  `aria-expanded` row + dedicated chevron button, inner controls stop
  propagation): full description, merchant/provider/channel/branch line,
  date/time/value-date/reference/transaction-type metadata, Transaction type
  and Category selects, confidence readout, "Exclude from import" toggle.
  Rows stay single-line at desktop widths and wrap gracefully on narrow
  windows (flex-wrap, no shrinking fonts). Empty/error states and all import
  logic untouched. Modal tests updated to the new structure (expand-before-
  edit helper; chip assertions adjusted) — 66 modal tests green. Suite 1046;
  tsc/lint/build/dist green.

- **Final bank statement import audit (8M) — full-feature audit 8A→8L with
  two concrete cleanup fixes; no redesign, no schema change.** Audited all 19
  checklist areas (file selection, format detection, PDF text extraction, OCR
  fallback, the four parsers, normalization, classification, categorization,
  confidence, duplicates, review UI, SQLite persistence, error handling,
  privacy/security, EXE packaging, tests, performance, cleanup). Financial
  correctness verified: statement amounts are never read from the running
  balance (Kuda flow = first amount token, balance = last; columnar
  debit/credit vs balance are distinct column roles); debit/credit direction
  always comes from a cell fact (CR/DR tag, sign, parens, balance-delta
  epsilon chain) and is never inferred from narration; fees, refunds,
  interest, internal transfers and expenses stay distinct kinds —
  transfers/fees/taxes/savings/loan-payments never enter the ledger
  (`ledgerKindFor` → null), so an internal transfer can never become an
  accidental expense; duplicate imports are reference-first identity +
  single atomic write. EXE deployment confirmed: the packaged app ships the
  OCR assets inside `out/vendor/tesseract/`, the pdfjs worker is emitted by
  the bundler and SheetJS is bundled — an EXE user needs nothing installed.
  Fixes: (1) duplicated `pipelineToken` removed from `statementPipeline.ts`
  (the shared `headerToken` from `statementColumnar.ts` is now imported —
  detection scoring can never drift apart); (2) obsolete module header in
  `statementNormalize.ts` corrected (the `buildCandidates →
  candidatesToNormalized` seam is the documented pre-7A legacy helper, not
  the live path). No defects found in cancellation, loading states, error
  messaging, database atomicity, temp files or logging. Docs updated
  (ROADMAP change log, ARCHITECTURE §4.1 deployment contract + known
  limitations + how-to-add-a-bank + testing instructions). Suite still 1046
  green; tsc/lint/build green.

- **Comprehensive bank statement import testing (8L) — full-pipeline test
  pass; no feature changes, no functionality added except test coverage.**
  Audited the whole flow (FILE → format detection → text extraction → OCR
  fallback → parser → normalization → classification → categorization →
  duplicate detection → review → SQLite commit) against the 8L checklist and
  closed the gaps. (1) **Real-engine integration tests** — new
  `tests/fixtures/statements/statementRealEngine.test.ts` (10 tests) runs the
  REAL pdfjs and SheetJS engines against REAL bytes (no mocks, no snapshots):
  the real PalmPay PDF's text layer extracts into statement cells and flows
  through `extractStatementRows` → `needsOcr(false)` → `processStatement` as a
  supported PalmPay preview with all 75 transactions; the real scanned Kuda
  PDF yields zero cells and `needsOcr(true)`; corrupt bytes and zero-byte
  PDFs reject through the real engine (the modal's generic catch path);
  multi-page extraction visits every page; a real SheetJS-built `.xlsx`
  workbook reads back through `rowsFromExcel` and `extractStatementRows` into
  the pipeline; a real CSV File flows end-to-end and is detected as GTCO.
  PLATFORM-DEPENDENT BY DESIGN (8L): pdfjs-dist's modern build needs browser
  globals jsdom lacks (DOMMatrix, `Uint8Array.prototype.toHex`), so the file
  (a) installs a minimal test-side DOMMatrix shim and (b) routes the app's
  `pdfjs-dist` import to the official LEGACY build for Node — the same
  parsing engine with Node-compatible shims; the app itself keeps the modern
  build (browser/Electron). The ordinary unit suite never touches these
  shims and real OCR engine availability is NOT required anywhere in the
  suite (the Kuda OCR ground truth `kuda.ocr.txt` remains the OCR-path
  fixture). (2) **Parser-failure edge** — new modal test locks a registered
  parser throwing mid-`processStatement`: generic user-facing error (no
  parser internals/statement contents), clean upload-stage session, nothing
  in the store or the persisted database. (3) **OCR-failure edge** — new
  modal test locks the "OCR ran but read no page" branch (`ocrUsed: true`
  with zero cells): the "We couldn't read the scanned pages…" copy, never the
  "OCR unavailable" or empty-file messages, session clean. Suite 1034 →
  1046; 0 failed, 0 skipped; tsc/lint/build green. | `CHANGELOG.md`,
  `ARCHITECTURE.md`, `ROADMAP.md`.

- **Security & privacy hardening for bank statement import (8K) — audit +
  targeted hardening + tests; no feature redesign, no schema change.** Audited
  every surface: imported files, temporary files, OCR images, OCR text, parsed
  transactions, logs, error messages, SQLite persistence, cached data, debug
  output, analytics/telemetry. (1) **Raw data** — files/OCR images/OCR text
  live only in renderer memory (`file.text()`/`arrayBuffer()`, canvas
  `getImageData`); NO temporary files are created by OCR or parsing (nothing to
  clean up on success or failure); nothing is uploaded; no analytics/telemetry
  (no fetch/beacon/XHR in `lib/`). (2) **Parsed transactions / SQLite** — only
  CONFIRMED rows persist through the single storage seam: capped ledger fields
  + `importSource` provenance (reference ≤80, raw narration ≤200, statement
  date, bank — required for re-import detection); balances, full raw
  statements, account numbers and OCR text never persist. Fixed a stale
  comment in `lib/statementTypes.ts` that claimed raw narration is "never
  persisted" — it is persisted capped on confirmed rows only, never logged.
  (3) **Account numbers** — never extracted into structured/persisted fields
  (Kuda parser refuses bare 10+ digit runs as amounts); header account numbers
  masked at display ("Account •••• 6789") as a convenience, not the security
  boundary. (4) **Errors** — every user-facing failure is generic (no stack
  traces, filesystem paths, OCR command lines, parser internals). (5)
  **Logging** — no renderer path logs statement content. (6) **Dependencies /
  network** — pdfjs + SheetJS fully local; Tesseract.js fully vendored, but the
  shipped bundles carry **jsdelivr CDN defaults** for worker/core/lang that are
  only safe because every path is overridden to `/vendor/tesseract/` with gzip
  off — hardened: `lib/ocrService.ts` exposes the config as a named
  `TESSERACT_WORKER_OPTIONS` const, locked by new `lib/__tests__/ocrService.test.ts`
  (4 tests: local-only paths, no network origin, gzip false, workerBlobURL
  true). (7) **EXE distribution** — the four OCR assets ship inside the EXE via
  the normal static-export path (`public/vendor/tesseract/` → `out/` → asar);
  no native OCR module, no separate installation. **Documented packaging
  limitation: `public/` is currently UNTRACKED in git** —
  `scripts/fetch-ocr-assets.mjs` (pinned URLs, dev-time network only) must run
  before a fresh build/dist or the packaged EXE ships without OCR (graceful
  "scanned + OCR unavailable" fallback). Suite 1030 → 1034; tsc/lint/build
  green; `out/vendor/tesseract` verified present after build.

- **Harden multi-bank statement support (8J) — shared columnar engine, real
  PalmPay parser, registry capabilities, wrapped-line geometry; GTCO/OPay/Kuda
  behavior unchanged and test-locked.** (1) **Shared columnar engine** — new
  `lib/statementColumnar.ts` (`headerToken`, `ColumnarSpec`,
  `columnarHeaderScore`, `parseColumnarStatement`): the duplicated GTCO/OPay
  engine logic is now ONE engine driven by a thin per-bank spec;
  `lib/gtcoParser.ts`/`lib/opayParser.ts` are specs over it (exports preserved;
  ids now `gt-r`/`op-r`; value-date fallback kept — a statement without a
  "Trans. Time" column falls back to the value date). (2) **Real PalmPay
  parser** — new `lib/palmpayParser.ts` reads the real text-layer statement (75
  certified rows, printed totals ₦183,800.71 in / ₦340,270.00 out):
  month-first MM/DD/YYYY dates (08/09/2026 = 9 Aug, never 8 Sep), SIGNED
  amounts (sign decides direction — never the "unknown" default), wrapped
  Detail/Transaction-ID lines merged in reading order, lone page-number
  footers ignored, no balance/value-date/category ever fabricated, per-row
  "missing debit and credit" skips (never silent), reference cap 80, ids
  `pp-r`. (3) **Wrapped-line geometry** — y geometry threaded end-to-end:
  `groupPdfRows` → `ExtractedStatement.rowYs` → `StatementOcrOutcome.rowYs` →
  `StatementPipelineInput.rowYs` → `parse(cells, context, rowYs?)`; PalmPay
  attaches each continuation to the nearest date line within 8 y units on the
  SAME page (pdfjs y resets per page — a page-2 fragment at y=568.5 would
  otherwise glue onto the page-1 date line at y=570.5); index-walk fallback
  for geometry-less CSV/Excel. The real "Send to FRIDAY PATIENCE NISMA" row
  merges verbatim. (4) **Registry capabilities** — every `BANK_PARSERS` entry
  carries `capabilities { ocrAware, wrappedLines }` (GTCO/OPay false/false,
  Kuda true/true, PalmPay false/true); `ImportProvenance.bank` + `IMPORT_BANKS`
  include "palmpay"; `supportedBankList()` → "GTCO, OPay, Kuda, PalmPay".
  **OCR matrix is accurate and non-overstated: OCR is implemented for KUDA
  ONLY (`ocrAware: true`); GTCO/OPay/PalmPay are text-layer/columnar
  (`ocrAware: false`) — a scanned/image-only PDF for them is UNSUPPORTED and
  lands honestly on "unsupported" (zero transactions, never misdetected).**
  (5) **Detection** — PalmPay entry min 6 (real header 11; generic
  "Transaction Date + Detail + Amount" = 5 never qualifies); cross-bank matrix
  test proves each bank's header detects as ITSELF (PalmPay header: GTCO 3 /
  OPay 3 / Kuda 4, none viable; GTCO header 14 vs OPay 13 → distinctive
  tie-break keeps GTCO). **Bank-specific date handling is preserved per
  parser, never normalized to one convention: PalmPay stays month-first
  MM/DD/YYYY ("08/09/2026" = 9 Aug, never 8 Sep), GTCO/OPay day-first NGN,
  Kuda day-first with 2-digit years.** (6) **Fixes surfaced** — `headerToken`/`pipelineToken`
  trailing trim; `groupPdfLines` now top-down (y descending) so the PalmPay
  table header is within the first-12-row detection scan. (7) **Tests** — new
  `palmpayParser.test.ts` (17) incl. real-fixture totals/lens rows/reading
  order/skip-never-silent; cross-bank describe in statementPipeline; fixture
  integration passes `rowYs` through `processStatement`; manifest gains
  `fixtureRowYs`. Suite 1009 → 1030; tsc/lint/full suite/build green.

- **Automatic expense categorization for imported statements (8G) — deterministic,
  LOCAL, no external AI API; the existing manual expense-entry behavior is
  untouched.** (1) **Merchant normalization** — new `lib/merchant.ts`:
  `normalizeMerchantKey` (lowercase, punctuation stripped, whitespace
  collapsed), word-boundary `merchantKeyMatches`, curated `KNOWN_MERCHANTS`
  (Nigerian telcos MTN/Airtel/9mobile/Glo/Spectranet/Smile incl. aliases
  Etisalat→9mobile, Glo/Globacom, D.S.T.V→DSTV; streamers Netflix/Spotify/
  Showmax/Disney+/Apple TV/Amazon Prime/YouTube Premium; rides Uber/Bolt/
  inDrive; retail Shoprite/SPAR/Checkers/Justu/Jumia/Konga/Game/Park N Shop;
  food Chowdeck/Glovo/Uber Eats/Pizza Hut/Domino's/KFC/McDonald's/Chicken
  Republic/Kilimanjaro/Tantalizers/Mr Bigg's; fuel Total/Oando/NNPC/Conoil/
  11 PLC; health MedPlus/HealthPlus), and `extractMerchantFromNarration` — a
  reusable mechanism that exposes "FRIDAY PATIENCE NISMA" from "Transfer to
  FRIDAY PATIENCE NISMA | Sterling Bank | 0059375307" WITHOUT modifying the
  original description (known merchant → HIGH, transfer recipient → MEDIUM;
  banks/wallets — Sterling, Wema, PalmPay, OPay, Paystack, Kora — are NOT
  merchants). Replaces the local `extractRecipient` in classification. (2)
  **Category matching** — new `lib/categoryMatching.ts`: `MERCHANT_CATEGORY_HINTS`
  maps merchants → category-NAME hints resolved adaptively against the
  EXISTING expense categories (exact then containment, never hard-coded ids —
  "MTN" → hints ['utilities','mobile data','data',…], landing on Utilities or
  the user's "Mobile Data"/"Bills & Utilities"; food merchants fall back to
  Groceries when no Food category exists); `matchExpenseCategory` returns
  `{ categoryId, confidence: high|medium|low, reason }` — HIGH = known
  merchant/provider or the category's own name, MEDIUM = strong whole-word
  alias (reusing the shared `KEYWORD_ALIASES`, now exported from
  `lib/statementImport.ts`), LOW = short/weak alias (< 5 chars, never silently
  certain); matching is case-/punctuation-/number-insensitive. (3)
  **Classify integration** (`lib/statementClassify.ts`): expense rows get the
  matcher's category + `categoryConfidence`/`categoryReason` (new transient
  fields on `NormalizedBankTransaction`; HIGH merchant overrides the rule
  hint, learned-rule decisions from 6A are never refined — user corrections
  always win); an UNKNOWN debit upgrades to expense only on a HIGH
  known-merchant match ("SHOPRITE PURCHASE" → expense/Groceries); fees, taxes,
  refunds, interest, savings, transfers and internal transfers are never
  reclassified (8F eligibility layer respected). Future-friendly overrides:
  the 6A `learnedRules` mechanism is unchanged and test-proven to beat the
  matcher (a corrected provider category becomes a reusable rule for later
  imports; no rule-management UI built). (4) **44 new tests** (`merchant.test.ts`
  + `categoryMatching.test.ts`): merchant aliases, case/punctuation/number
  insensitivity, Nigerian providers, mobile-data packaging, transfer/wallet/
  bank non-merchants, fees/refunds/interest/savings never matched, internal
  transfers, unknown merchants, confidence tiers, adaptive category-name
  resolution (incl. no-hint → null), whole-word guards ("FOODSTUFF GLOBAL"
  stays review), unknown→expense upgrade + non-upgrade, and the learned-rule-
  wins flow. Suite 944 → 988; tsc/lint/build green.

- **Transaction normalization & classification hardening (8F) — the SAME
  conceptual transaction now normalizes identically across GTCO, OPay and
  Kuda, and every classified row carries a deterministic transaction type.**
  (1) **Deterministic transaction-type layer** — new `lib/transactionTypes.ts`:
  `TransactionType` (transfer, card-payment, bank-charge, transfer-fee, vat,
  stamp-duty, sms-charge, airtime, mobile-data, interest, refund, savings,
  withdrawal, deposit, internal-transfer, loan-payment, salary, unknown) +
  `classifyTransactionType(description)`: ordered word-boundary rule table,
  first-match-wins, **narration-only** — direction is never consulted (an
  incoming transfer is still "transfer", never income) and the type is kept
  **separate from expense categories** ("Transfer to John" → type "transfer"
  while its category may later become Personal/Family). `classifyTransaction`
  now attaches `txType` (new transient field on `NormalizedBankTransaction`;
  never persisted). Specificity is locked by tests: "VAT on Transfer Fee" →
  vat, "Commission on NIP Transfer CHARGES" → transfer-fee, "Card maintenance
  fee" → bank-charge, "POS Withdrawal" → card-payment, "ATM Withdrawal" →
  withdrawal, "OWealth Deposit (Transaction Refund)" → refund before
  internal-transfer. (2) **Kuda structural labels classify deterministically**
  (`lib/statementClassify.ts`): "local funds transfer" / "outward transfer" /
  "incoming transfer" → **transfer** (never income/expense); "spend and save" /
  "spend + save" → **savings** (own-account movement, never spending); patterns
  are regex-escaped so the literal "+" phrase matches as written. (3)
  **Cross-parser description fix** (`lib/gtcoParser.ts`): the transaction
  reference/branch is no longer used as the `description` fallback — remarks
  only, else "(no description)" (reference stays in its own field), matching
  OPay/Kuda. (4) **30 new tests** (`transactionTypes.test.ts` +
  `statementNormalization.test.ts`): same conceptual transaction → same
  representation across all three banks (date, debit/credit split, direction,
  balance, kind AND txType); amount is always the transaction amount, never
  the running balance; single-amount Kuda rows leave balance absent; charges
  never become ordinary expenses; incoming transfers are never income;
  ambiguous statements stay honest (Kuda "local funds transfer" could be a
  salary — stays transfer; Kuda "bank charges" can't separate VAT from SMS —
  stays generic bank-charge). Existing tests updated where behavior
  intentionally improved (GTCO no-remarks fallback; Kuda end-to-end now
  transfer/savings). Suite 914 → 944; tsc/lint/build green.

- **Kuda statement parser (8E) — both Kuda forms reach the SAME parser.**
  New `lib/kudaParser.ts` + a registry entry: Kuda is now a supported bank
  ("GTCO, OPay, Kuda"), detected through the existing pipeline from either a
  text-based Kuda PDF (column-split cells) or a scanned one (the 8D OCR cells,
  which arrive as ONE line per cell with single spaces). **Detection**
  (`kudaHeaderScore`): phrase-aware — the OCR defect found while building this
  (OCR'd lines lose column gaps, so cell-position vocabulary would never match)
  is fixed by matching Kuda's multi-word anchors ("date/time", "money in/out",
  "opening/closing balance", "to/from", "spend account", "spend + save",
  "account number", …) inside cells over a normalized token stream; the
  registry entry carries its own higher viability bar (`minHeaderScore` 8 vs
  the shared 5) because "opening balance"/"closing balance" alone sum to 6 —
  a generic statement must never qualify on those labels (real Kuda tables
  always score 10–11). Verified non-triggering: GTCO/OPay/PalmPay headers and
  transfer-heavy random statements. **Parsing** (`parseKudaStatement`): works
  on a whitespace token stream; a transaction starts at a date row
  (dd/mm/yy — `parseStatementDate` gained a calendar-validated 2-digit-year
  branch with the same day-first ambiguity rules; `parseAmountCell` gained the
  OCR-read naira sign "#" — both superset changes, existing parsers
  unaffected); the optional next token is the time; section rows ("Spend
  Account", "Spend + Save", summary/totals/table headers, "Page N of M")
  close the open block and reset the balance chain; the two-line transaction
  block (date line + time line) merges wrapped descriptions, with a junk
  guard (stray text-only rows after a completed block are OCR footer noise,
  never description). **Direction is a structural fact**: the running-balance
  delta decides first (exact, epsilon-guarded; a mismatch poisons the chain),
  then Kuda's own printed category tags ("outward", "local funds", "spend and
  save", "merchant payment", "top up", …); the word "Transfer" alone never
  decides — a bare "Transfer to JOHN DOE" stays unresolved and is skipped with
  a per-row error. Reference-like "/"-strings in descriptions are never parsed
  as amounts (bare 10+ digit runs are text). One bad row never fails the
  import (skip + report "missing debit and credit" / "unresolved direction");
  no reference/channel/valueDate fields (8C honesty — Kuda prints none).
  **Tests (35 unit + 19 fixture)**: detection (one-cell OCR rows detected —
  locks the 8D defect fix; cross-bank false positives); parsing of the text
  form and the OCR form to identical transactions (5 real rows, exact kobo
  amounts, times, balances); wrapped descriptions (2- and 3-line); fees,
  "#"-amounts, 2-digit dates, malformed/unresolved/empty statements; the
  REAL OCR ground truth of the scanned fixture (`tests/fixtures/statements/
  Kuda/kuda.ocr.txt`, regenerated without the dump script's page banners so
  it is a faithful OCR transcript) through `ocrTextToCells` →
  `detectStatementFormat` (kuda, high) → `parseKudaStatement` (5 transactions
  with exact values; page-2 noise never becomes transactions); the pipeline
  treats the OCR'd statement as supported. Honest limits: page-2 of the real
  scan is dark/noisy (reads nothing — zero fabricated rows), a mangled OCR
  balance breaks the delta chain (tag fallback keeps the row), and the
  wrapped third line of a very long description is dropped when the time row
  is already merged (the trade-off that keeps OCR footer junk out). Full
  suite green; tsc/lint/build green.

- **Scanned-statement OCR fallback (8D) — local, private, fully offline.**
  Scanned PDFs (like the real Kuda statement from 8C, which has no text
  layer) are now detected and read via OCR. **Everything runs on-device:
  Tesseract.js (WASM) loaded from assets bundled with the app
  (`public/vendor/tesseract/` — `app://bundle/vendor/tesseract/...` in the
  EXE), with the English language data vendored too — no cloud, no network,
  no telemetry; statement content never leaves the device.** New
  `lib/ocrService.ts` (engine abstraction `OcrService` + the Tesseract
  implementation, worker/core/language loaded by script injection with a
  graceful `isAvailable()` failure path) and `lib/statementOcr.ts`
  (orchestration): `needsOcr` decides when a PDF's text layer is not a usable
  statement (empty, or < 40 chars, or rows lacking both a date AND an amount
  — so a logo/cover page is sent to OCR while PalmPay/GTCO/OPay text stays on
  the normal path); `ocrPdfToCells` renders each page at 3x (216 dpi) with
  pdfjs and OCRs it page by page with **per-page failure isolation**
  (`failedPages` — one bad page never kills the import), abort support
  (closing the modal cancels), and phase callbacks; OCR text is converted to
  the same cell grid the text pipeline produces (`ocrTextToCells`: lines →
  rows, 2+ space runs/tabs → columns), so the existing parsers, detection and
  pipeline run unchanged. Routing: `extractStatementRowsWithOcr` — CSV/Excel
  and text-layer PDFs never touch OCR; only scanned PDFs do. **UI:** the
  import modal shows "Reading your statement…" → "Scanning pages…" →
  "Extracting transactions…" while scanning; a scanned statement that cannot
  be read explains why and suggests the bank's CSV/Excel export; partial page
  failures surface as a warning in the preview instead of failing the import.
  **Packaging into the EXE:** `public/` is copied into `out/` by the Next.js
  static export, and Electron serves `out/` via the existing `app://bundle`
  protocol — no electron-builder changes, no native module, no
  `extraResources`; the worker/core/WASM/language data are plain static
  assets. **Tests (33):** unit tests for `needsOcr`, `ocrTextToCells`,
  page ordering/failure isolation/abort/unavailability, and routing; a
  fixture test that runs the REAL scanned Kuda PDF through the OCR layer with
  a fake engine (page markers → OCR engaged; OCR cells flow through
  `detectStatementFormat`/`processStatement` like any extraction); modal
  tests for the scanned-statement message, OCR→preview, phase label,
  partial-failure warning and close-mid-OCR cancellation. Manual real-OCR
  verification: `node scripts/ocr-check.mjs` renders the real Kuda pages with
  MuPDF (WASM) and OCRs them with the vendored data (devDeps `tesseract.js`
  + `mupdf` only — never part of the app bundle); `scripts/fetch-ocr-assets.
  mjs` regenerates the vendored assets. Limits, honestly stated: OCR quality
  depends on the scan (the real Kuda page 2 is dark/noisy and reads poorly —
  page 1's account number, period and balances read well), and OCR output
  only feeds the existing pipeline — no Kuda parser yet (8E+). Full suite
  874/874 green; tsc/lint/build green.

### Changed

- **Bank statement review & confirmation experience (8I) — targeted
  improvements to the import modal; no redesign, manual expense entry
  untouched.** (1) **REVIEW SUMMARY** — the preview header now also counts
  duplicates (rows flagged within the statement), uncategorized (ledger-able
  rows without a category) and low-confidence (low/uncertain) transactions,
  alongside the existing bank chip, period, transactions/expenses/income/
  transfers/needs-review/excluded — every number the review screen should
  show. (2) **NO RAW PARSER INFO** — the technical `detectionReason`
  ("GTCO header vocabulary (score 14, distinctive 13)") is no longer shown
  in the review banner (it stays a data-only field), and the unsupported-
  bank explanation no longer prints per-bank scores for ambiguous headers.
  (3) **NEW FILTERS** — Uncategorized and Low confidence filter pills (with
  live counts), so the summary numbers are actionable. (4) **CONFIRMATION**
  — the footer now reads "You're about to import N transactions."
  immediately before the final Import action ("Assign a category to the
  highlighted rows to import." while any category is missing; "Nothing new
  will be imported." when nothing is importable). (5) **SUCCESS** — the
  done screen now reports "N imported · N skipped as duplicates · N
  requiring review" (requiring review = imported rows still flagged needs
  review or low/uncertain confidence) plus the full Skipped breakdown, now
  also covering excluded rows. (6) **DUPLICATE COPY** — the duplicate
  banner explains each group is imported once and the repeats are skipped
  automatically, so users understand nothing is imported twice without
  removing anything by hand. (7) **8 new modal tests** (8I): review-summary
  counts, within-statement duplicate count, raw-scores-never-shown,
  uncategorized + low-confidence filters, the confirmation summary, the
  blocked-import message, and the imported/skipped-as-duplicates/requiring-
  review success line (incl. the duplicate-only case); 5 existing
  done-summary assertions updated to the new friendly line. Suite 1001 →
  1009; tsc/lint/build green.

- **Safe, idempotent bank statement import (8H) — a full audit + test-locking
  pass; no feature changes.** Verified the whole import feature against the
  prompt's safety contract and locked every guarantee with 13 new tests. (1)
  **EXACT DUPLICATE STRATEGY (regression-locked):** a statement row's identity
  is `bank + date + amount + direction + reference + normalized description`;
  references are PREFERRED but never required — a ledger transaction WITH a
  stored reference matches only by that reference (same-day same-amount
  payments with different references are distinct transactions), while only
  REFERENCE-LESS ledger rows fall back to full-details (date + amount +
  direction + normalized description); amount alone NEVER matches (two ₦1,000
  same-day rows are never duplicates); reference-less rows stay CONSERVATIVE —
  a partial overlap is "possible duplicate" (default KEEP, user Skip/Keep),
  never silently merged or deleted. Duplicate fees/refunds can never
  double-book: fees and money movements never enter the ledger at all; refunds
  import once by reference or full details. (2) **IDEMPOTENCY:** re-importing
  the same statement = 0 new / N already existing; OVERLAPPING statements
  (e.g. January then January–March) import only the genuinely new rows —
  existing rows are "already existing", the ledger is untouched; identical
  reference-less rows merge only on full-details equality. (3) **PREVIEW
  BEFORE COMMIT:** the plan (imported / excluded / movements / duplicates /
  already-existing / possible / failed / missing-category counts) is computed
  before any write; nothing reaches the ledger until confirm. (4) **ATOMICITY:**
  one confirmed import = ONE `addTransactions` write = one atomic kv UPSERT; a
  mid-batch failure writes NOTHING — the new modal test proves a throwing
  write leaves the persisted database untouched and returns to the upload
  stage with the session intact for retry. (5) **13 new tests:** +5
  `statementIdentity` (conservative reference-less strategy — same-day
  same-amount different descriptions → possible-duplicate never
  already-imported, identical reference-less rows merge only on full details,
  duplicate refunds by reference AND by details, distinct refunds never
  merged, duplicate fees never silently confirmed); +2 `statementRelations`
  (fee rows with distinct references stay separate vs same-reference fee
  duplicates grouping); +5 `statementPipeline` (overlapping statements import
  only genuinely new rows, duplicate refunds, reference-less refund
  fallback, duplicate fees as movements never double-booked, empty
  statement); +1 modal atomicity. Full suite 988 → 1001; tsc/lint/build
  green.

- **Real Kuda + PalmPay statement fixtures (8C) — the actual bank PDFs become
  the ground truth; no parsers built yet, no engine changes.** The real
  statements live in `tests/fixtures/statements/{Kuda,Palmpay}/` with pdfjs
  text-layer snapshots captured from them (`*.extracted.json` — generated,
  never hand-edited). New fixture registry `tests/fixtures/statements/
  manifest.ts`: per-fixture layout facts, pages, text-layer presence, and an
  **optional-fields map** (which optional normalized fields the real
  statement carries — a future parser may only produce those; missing values
  are never forced into fake ones). The real PDFs revealed: the **Kuda PDF is
  scanned** (2 pages, image XObjects, no transaction text — pdfjs yields only
  the page markers), so a future Kuda parser needs OCR; the **PalmPay PDF has
  a text layer** — a 5-column table (Transaction Date · Transaction Detail ·
  Money In (NGN) · Money Out (NGN) · Transaction ID) under an account header
  block, with wrapped detail/ID cells and **no running balance column**.
  Tests (14): manifest integrity; Kuda — real cells are empty through the
  runtime path, never detected as GTCO/OPay, pipeline reports unsupported
  with zero transactions ("Nothing was read"); PalmPay — real cells contain
  the header block + table header, never falsely detected, unsupported until
  a parser exists; a TEST-ONLY integrity lens (explicitly not the product
  parser) reads the real extraction by column and proves the fixture is
  complete: exactly 75 transaction rows, sums match the statement's own
  printed totals (₦183,800.71 in / ₦340,270.00 out), every row has exactly
  one signed amount + a date + a detail + a transaction id, wrapped cells
  join in reading order (real rows: "Send to FRIDAY PATIENCE NISMA",
  "Received from DAVID OSAHON OGBEIDE", "Disbursement-Installment loan",
  wrapped stamp-duty id "20260809114820399392 0649447"), and the account
  header block is never mistaken for transactions. No registry/parser/pipeline
  changes (GTCO/OPay behavior untouched). Full suite 841/841 green;
  tsc/lint/build green.

- **Final bank statement import production-readiness audit (8B).** End-to-end
  audit of the whole feature — no new functionality. **Financial
  correctness:** classification never alters amounts (`classifyTransaction`
  rewrites metadata only); `planImport` writes only positive minor-unit
  amounts for the row's own direction; a kind/direction mismatch is counted
  "failed", never written with a wrong amount; unparseable cells are
  skipped + reported, never invented; dates validated to real calendar days;
  transfers/fees/taxes/savings/loan payments never enter the ledger.
  **Duplicates:** repeated imports cannot double-book (reference-identical
  rows → "already imported"; in-statement groups keep the first row;
  possible duplicates default to keep with user Skip/Keep). **Database
  safety:** one import = one atomic kv UPSERT; a failed write touches
  nothing. **Performance (measured at 10/100/500/1,000+ rows):** two obvious
  hot spots fixed — `planImport` (O(rows × ledger)) was recomputed on every
  modal render → `useMemo`; `PreviewStage` re-derived the per-row match map
  per render and the whole review table re-rendered on any single-row edit →
  memoized `statusById`/`duplicateIds` + extracted memoized `ReviewRowItem`
  (stable `updateRow` via `useCallback`), so a correction re-renders one
  row, not 1,000. **Windows/EXE:** SQLite embedded (better-sqlite3 +
  asarUnpack; verified via `db:check`); data in `<userData>`; statement
  picker cancel = no-op; statements never touch disk; atomic-write temp
  cleanup verified (7B); no dev-machine paths; NEW guard — `openDatabase`
  failure now shows a native error dialog + clean exit instead of an
  unhandled rejection leaving a broken app. **Error handling:** corrupt /
  unsupported / cancelled / parser failure / empty / duplicate / unexpected
  structure all covered; SQLite failure degrades gracefully. **Code
  quality:** no TODOs, no dead code added, no swallowed exceptions, minimal
  logging. Known limitation (fail-safe by design): a debit-side
  refund/interest row stays classified income and is reported "failed" at
  import — never written with a wrong amount. Full suite 827/827 green;
  tsc/lint/build green; `out/` + `dist/` rebuilt.

- **Complete bank statement import test suite (8A).** Comprehensive test
  pass over the whole feature — no feature changes, no refactors. Audit
  against the checklist: (1) PARSERS — GTCO (21) + OPay (25) suites cover
  normal debit/credit, transfers, NIP, charges, taxes, interest, savings,
  merchant/provider lifting, headerless files, positional fallback, title
  rows, missing columns; **+3 gaps closed**: empty statements (both
  parsers return zero transactions/skipped/errors — verified no crash on
  `[]` or all-blank rows) and very large amounts (GTCO: ₦2.5bn /
  ₦9,999,999,999.99 exact in minor units); malformed rows, decimals,
  leading-dot amounts, small naira amounts and missing values were already
  covered. (2) CLASSIFICATION — all 11 kinds explicitly tested: expense,
  income (salary), transfer, internal-transfer, bank-fee, tax, refund,
  interest, savings, loan-payment, unknown/needs-review (49 cases). (3)
  DUPLICATES — same statement twice (pipeline re-import suite + modal e2e
  "0 imported · 3 already existing"), in-statement duplicate groups,
  same-amount-different-transaction, same-description-different-date,
  partial previous import (19 identity + 17 relations cases). (4) USER
  REVIEW — editing categories, changing type, excluding, bulk assign/
  exclude/include, review counter, cancel, confirm (48 modal cases).
  (5) DATABASE — expenses/income import with exact amounts, dates, notes,
  categories and `importSource` provenance; transfers never booked as
  expenses; excluded rows never imported; duplicates never created;
  **+2 new seam tests** assert the PERSISTED payload (`budget-planner:state`
  through the single storage seam — localStorage here, SQLite kv on the
  desktop): canceling a review leaves the persisted database byte-identical
  (no descriptions, no account number), and a confirmed import lands in the
  persisted database exactly once (expense ₦500,000 / income ₦900,000, no
  movements, no transfers). (6) REGRESSION — the ENTIRE suite ran clean:
  65 files / **827 tests, 0 failed, 0 skipped** (no test is disabled or
  `todo`d; the only `.skip` hits in the tree are inside `node_modules`);
  every failure from the working tree was already investigated and fixed
  during 7A/7B (none were left for this pass). (7) REPORT — see ROADMAP
  change-log row. Gates: tsc/lint/full suite/build green.

- **Bank statement privacy and local file security (7B).** Full audit of the
  import feature for unnecessary data exposure. RAW STATEMENTS: files are
  read in memory only (`file.text()`/`file.arrayBuffer()`) and discarded —
  never written to disk (browser or Electron), never uploaded, never
  persisted; the only statement-derived data that survives an import is the
  CONFIRMED row's capped `importSource` provenance (reference ≤ 80,
  original narration ≤ 200, statement date, issuing bank) required for
  re-import detection, plus the ledger note — the raw file, PDF bytes,
  account numbers and balances are never stored (already true since 5A;
  now regression-locked). LOGGING: no renderer path logs statement contents
  — the modal's catch blocks don't even `console.error` — and the main
  process logs paths/status only; the error boundary's `console.error` and
  all main/preload logs were reviewed (no account numbers, references,
  names or file paths beyond the app's own `userData`). ERRORS: every
  user-facing failure stays generic ("We couldn't read that file…",
  "Unsupported bank statement format. …") — no stack traces, no parser
  internals, no statement contents; dev diagnostics never carry financial
  data. DATABASE: the single kv row holds only AppState (transactions with
  capped notes + provenance); no raw statements, no unnecessary account
  numbers (header account numbers are masked "Account •••• 6789" in the UI
  and never leave the renderer). TEMP FILES: statement processing creates
  NO temp files; the one leak found was in the desktop's atomic-write
  helpers — `desktop:fs:writeText`, `desktop:export` and
  `electron/backups.cjs` `writeBackup` left `<target>.tmp` behind when the
  write or rename failed (a partial copy of sensitive content — full state
  JSON on export). Fixed with a shared `electron/atomicWrite.cjs`
  `atomicWriteText` (temp file + rename, best-effort temp removal on ANY
  failure, target never half-written) used by all three sites. WINDOWS:
  the renderer is sandboxed with contextIsolation and no nodeIntegration,
  dialogs/fs only via validated IPC, so the model is identical on a user's
  EXE — and the temp-cleanup fix matters most there (rename can fail with
  EPERM). Tests: +5 `electron/atomicWrite.test.ts` (success leaves no
  `.tmp`, write failure removes the temp file, rename failure removes it
  and keeps the target intact, mkdir option, invalid inputs never touch the
  fs) and +3 modal cases (failed parse leaves no session state behind —
  stage/file name/preview all reset, close + reopen starts clean; statement
  contents are never logged even when parsing fails — console spies +
  generic error asserted; raw statement contents never enter app state —
  masked account in UI, account number absent from serialized state). Suite
  814 → 822. Gates: tsc/lint/full suite/build green.

- **Extensible bank statement format architecture (7A).** The importer no
  longer hardcodes GTCO/OPay — statement formats are now a pluggable registry,
  so adding a bank means ONE new parser + its tests + ONE registry entry,
  nothing else. The parser contract lives in `lib/statementTypes.ts`:
  `BankStatementParser` (id, label, header scoring, distinctive tokens, min
  header score, parse fn), `BankParseResult` and `StatementRowError`; both
  GTCO (`GtcoRowError`/`GtcoParseResult`) and OPay (`OpayRowError`/
  `OpayParseResult`) now implement it. New `lib/statementRegistry.ts` is the
  ONLY place the engine learns about banks — `BANK_PARSERS` (one entry per
  bank: GTCO + OPay, distinctive tokens moved here from the pipeline) and
  `supportedBankList()` ("GTCO, OPay" in UI copy). `lib/statementPipeline.ts`
  is registry-driven: `detectStatementFormat`/`processStatement` accept
  `parsers = BANK_PARSERS`, and the old two-way GTCO-vs-OPay winner logic is
  generalized to N parsers (score gap ≥ 3 → high confidence; a close race is
  decided by the contender with the uniquely-highest distinctive-column count
  → medium; distinctive tie → ambiguous). **Unknown formats are no longer
  guessed**: statements that match no registered bank come back as
  `status: "unsupported"` with `unsupportedReason` — "Unsupported bank
  statement format. We couldn't recognize this statement's layout — it
  matches none of the supported banks (GTCO, OPay). Nothing was read from
  the file…" (or the ambiguous-headers variant with each bank's score) — and
  the generic `buildCandidates` fallback is gone from the pipeline
  (`detectStatementFormat` uses no filename, no bank name — header vocabulary
  only, as before). Detection is never based on the file name. The modal
  (`ImportStatementModal.tsx`) shows that explanation as an upload-stage
  error (back to the drop zone), and the preview banner now uses the
  registry-provided `detectedLabel`. Tests: pipeline +8 — unsupported
  statements (useful explanation, zero invented transactions, nothing
  read) and registry extensibility (a mock parser added to `BANK_PARSERS`
  detects its own header, runs through the full detection → parse →
  classification pipeline, and GTCO/OPay behave exactly as before — the
  "adding a bank never touches the engine" guarantee); the old generic
  fallback case was removed (suite 807 → 814). Gates: tsc/lint/full
  suite/build green.

- **Classification accuracy improvements (6B).** Audited every pattern from the
  real GTCO and OPay statements. Two fixes in `lib/statementClassify.ts` (no UI
  changes, no schema/SQLite changes, 6A learned rules untouched). (1)
  "VATrecover Partial Charges" was classified as a bank fee via the "charges"
  keyword — the tax rule now also matches `vatrecover`, so VAT-recovery charges
  classify as tax. (2) Overclassification guard: the expense fallback trusted
  the keyword system's substring matching, so "BUSINESS" matched the transport
  keyword "bus" and was confidently classified as Transport, and "FOODSTUFF
  GLOBAL" as Food — a confident-but-wrong category is worse than Needs Review,
  so the fallback now only accepts a suggestion whose keyword is present as a
  whole word ("BUSINESS"/"FOODSTUFF" stay unknown → needs review; "GYM
  MEMBERSHIP" → Health and "ONLINE DELIVERY" → Groceries still work). Everything
  else was already right and is now regression-locked with 27 new tests (7 GTCO
  patterns, 12 OPay patterns, 3 type-vs-category separation, 5 overclassification
  guards): generic "Transfer to JOHN DOE" stays a low-confidence transfer with no
  category; "Paystack Checkout" is an expense that needs review; type (kind) and
  category remain separate concepts (transfers/bank-fees/taxes have
  `categoryId: null` and can never be imported as spending or income). Suite
  780 → 807 tests, all green; tsc/lint/build green.

- **Learning from classification corrections (6A).** If you correct the same
  kind of statement transaction repeatedly, the app now learns it — a purely
  local, deterministic rule system (`lib/learnedRules.ts`), no AI API, no new
  database table: rules live in AppState (`LearnedRule[]`, schema **v4** with
  a v3→v4 migration, validated and exported like everything else). How it
  works: a correction is when you change a review row's category away from
  the suggested one and then actually import that row (rows that end up
  excluded, deduplicated or already existing never teach; cancelled sessions
  forget everything; `planImport` reports `importedIds` so learning is tied
  to the ledger write). Each correction keys on the row's most reliable
  signal — provider ("MTN") over merchant ("DAVID") over the full normalized
  description. One correction only creates an inactive candidate — a rule is
  never created from a single ambiguous transaction — and a second matching
  correction activates it; future matching rows are then classified to your
  category with high confidence, ahead of every built-in rule. Conflicting
  corrections re-baseline the rule (latest intent wins, strength resets), so
  flip-flopping never activates anything. Direction guards mirror the
  built-in rules (an expense rule never fires on credits). Settings → "
  Learned rules" gives you control: see each rule (signal, category, strength,
  Active/Candidate status), disable/re-enable, re-target the category, or
  delete. Tests: 26 new `learnedRules.test.ts` cases (repeated correction,
  provider/merchant/description rules, conflicting rules + flip-flop,
  disabled rule, deleted rule, deleted category, direction guards,
  validation/migration), pipeline +3 (learned rules through
  `processStatement`, inactive rules ignored, `importedIds`), modal e2e +2
  (two MTN corrections activate a rule that pre-classifies the third
  statement; cancelled/excluded corrections never learn), store +3, settings
  panel +6, validator v3→v4 + version-gate updates (suite 739→780, all
  green; tsc/lint/build green).

- **Safe re-import and duplicate protection (5B).** Repeated imports can no
  longer double-book: every preview row is matched against the existing
  ledger by deterministic transaction identity (`lib/statementIdentity.ts`,
  new pure module — `matchExistingTransaction`). Identity fields (prompt
  §2): bank, transaction date, amount, debit/credit direction, reference,
  normalized description — amount alone NEVER matches. Verdicts: **Already
  imported** (confirmed: same bank + direction + amount + normalized
  reference, or — only for reference-less ledger rows — same bank + date +
  amount + normalized description), **Possible duplicate** (same bank +
  amount + direction with date or description overlapping while the other
  detail is absent/conflicting), **New**, **Excluded** (existing session
  flag). Reference rules stay authoritative (3E/5A consistent): a ledger
  transaction WITH a stored reference is matched only by that reference; a
  row whose reference differs from a ledger row's reference is a DIFFERENT
  transaction (banks distinguish same-day same-amount payments by
  reference). User control (prompt §4): possible duplicates are NEVER
  silently discarded — they stay importable by default, get a "Possible
  duplicate" badge + a per-row Skip/Keep toggle (session-only
  `skipAsDuplicate`), a warn banner ("N transactions may already be in your
  budget…"), and two new filters ("Already imported", "Possible
  duplicates"); the done stage adds a "N possible duplicate(s)" breakdown
  item for user-skipped rows. Re-import flow (prompt §5): second import of
  the same statement = 0 new records, N already imported — and
  already-imported rows no longer block import on missing categories
  (identity is checked before the category gate, so a plain re-import needs
  no reassignment). Fixes from 5A audits: `addTransactions` was DROPPING
  `importSource` on write (reference-based detection could never work) —
  provenance is now persisted; the old date+amount+note dedupe is replaced
  by the shared identity module (referenced ledger rows still match by
  reference only — the fallback stays unambiguous). Tests: new
  `statementIdentity.test.ts` (19 tests — the prompt's 7 scenarios: exact
  duplicate, same amount different transaction, same description different
  date, same date and amount different reference, repeated statement
  import, partial previous import, duplicate internal transfer — plus
  bank/direction/ref-normalization edges), planImport re-import suite
  extended (possible-duplicate default-keep, skip, already-imported never
  blocks on category) (pipeline suite 25→28), modal suite 38→43 (status
  chips, skip/keep, banner, new filters, re-import without category
  reassignment; importSource asserted on stored rows), store +1
  (provenance preserved through `addTransactions`) (suite 711→739). Gates:
  tsc/lint/full suite/build green.
- **SQLite statement import engine (5A).** The confirm step is fully wired to
  persistence: Import writes the planned rows via the existing `addTransactions`
  bulk action — one store update, one atomic `kv` UPSERT through the single
  persistence seam (`lib/storageAdapter.ts`; Electron: preload bridge → main →
  `electron/db.cjs`). No second transaction database exists (or is needed):
  all state, transactions included, lives in the AppState JSON under the
  `budget-planner:state` kv row. Confirmed rows now carry `importSource`
  provenance (`ImportProvenance`, lib/types.ts — optional field on
  `Transaction`/`TransactionInput`, so no schema version bump): source,
  issuing bank (`sourceBank` from the parser), and the capped bank reference,
  original narration and value date (the only persisted slice of the raw
  statement; `validateTransaction` round-trips it so it survives
  validation/hydration). Re-import detection: a transaction with a stored
  reference is matched by reference; reference-less transactions fall back to
  amount + date + note — same statements are reported as "already existing"
  and never double-booked. The done stage now shows the full five-way result
  ("N imported · N skipped · N excluded · N already existing · N failed")
  plus a "Skipped:" breakdown, so the user always knows exactly what happened.
  Import remains a single atomic batch: on failure nothing is persisted, the
  error is shown, and the session stays intact to retry. Transfers/movements
  are still never forced into expenses. Tests: planImport re-import suite
  (reference match, fallback match, no false positives on referenced rows) +
  provenance preservation (pipeline suite 21→25), validator provenance
  round-trip + malformed rejection (validate +2), modal five-way summary +
  re-import click-through (modal suite 36→38; suite 703→711). Gates:
  tsc/lint/full suite/build green.
- **Import confirm step (4D).** The Import button now works — the review
  session is turned into ledger rows via `planImport` (lib/statementPipeline.ts)
  and written with the existing `addTransactions` bulk action (one write,
  through the single persistence seam; nothing else changes in the app).
  Rules, all pure and recomputed at click time: excluded rows stay out; money
  movements (transfers, internal transfers, bank fees, tax, loan payments,
  savings) are NEVER booked — the ledger has no transfer type, and they can
  never be miscategorized as spending; rows without a readable date can't be
  booked; of each duplicate group only the first importable row is kept; every
  ledger row must have a category — until then the button is disabled with a
  "Pick a category for N transactions before importing" title and the label
  shows the honest count ("Import N transactions" = what will actually be
  written; "Nothing to import" when zero). Imported amounts are absolute minor
  units (debit → expense, credit → income), `type` matches the category kind
  (required by the validator), and the description becomes the note (capped at
  200). New done stage: success state with the count ("N transactions added to
  your budget") and a skipped breakdown (excluded / duplicates / money
  movements / no date); "Add another file" resets to upload, "Done" closes —
  and ANY close now discards the session (fresh upload next time). Tests:
  modal suite 30→36 (blocked until categorized, imports reviewed rows with
  exact amounts/notes into the store, movements never imported, only the first
  duplicate imported, excluded rows honoured, Done closes + session discarded)
  plus 8 new unit tests for `ledgerKindFor`/`planImport` (pipeline suite
  13→21; suite 689→703). Gates: tsc/lint/full suite/build green.
- **Transaction review and classification editing (4C).** The preview rows are
  now editable — all changes live ONLY in the modal's session state until a
  (future) confirm. **Per-row editing**: the kind chip became a type select
  (all `BankTransactionKind` options — "Transfer to JOHN DOE" can become
  Expense → Food, matching the prompt's example), the category select re-pools
  by the chosen type (income kinds → income categories, etc.), changing the
  kind resets a now-mismatched category and settles the row's needs-review
  flag, and a per-row exclude/include toggle button marks rows the user
  doesn't want imported. **Excluded rows** stay visible, muted and
  line-through, get an "Excluded" badge, drop out of the stats, the needs
  review / import counts and the Needs review filter — and can be re-included.
  **Bulk actions** (appears when rows are checked): "N selected" + Assign
  category… (applies only to rows whose ledger kind matches the category
  kind) + Exclude / Include / Clear selection. **Review counter**: "N needs
  review" stat counts down as rows are fixed, and the Needs review filter
  finds them. Tests: modal suite 23→30 (reclassify transfer → Expense + Food,
  kind change resets mismatched category, exclude keeps the row visible +
  updates stats and the Import label, bulk assign/exclude/include, review
  counter countdown) (suite 682→689). Gates: tsc/lint/full suite/build green.
- **Statement preview screen (4B).** The `ImportStatementModal` preview is now
  a full review surface, still operating ONLY on the import session — no
  database/store writes, canceling or closing changes nothing. **Preview
  header**: bank chip (GTCO/OPay/General), masked account number when the
  statement header carries one (`findMaskedAccount` — 10-digit NUBAN-style
  run in the first 12 rows, dates/amounts excluded; shown as "Account ••••
  6789"), statement period ("Aug 1, 2026 – Aug 5, 2026" from the transaction
  dates), currency symbol+code, and a summary group with transactions /
  expenses / income / transfers / needs-review counts; the detection reason
  (scores) and skipped/unreadable-row notes stay. **Transaction list**: each
  row shows date, description (+ merchant/provider/channel/branch microcopy),
  kind chip, confidence badge (High/Medium/Low/Uncertain — always visible),
  possible-duplicate badge (RepeatIcon), "Needs review" badge, money-flow
  direction icon (money in / money out), signed amount, and the category
  select for ledger-able rows only. **Review states**: high/medium/low/
  uncertain, needs review, transfer, internal transfer (chip), duplicate —
  nothing uncertain is hidden. **Filters** (pill row with live counts,
  matching the app's chip language): All / Expenses / Income / Transfers /
  Needs review / Duplicates, with an empty-filter state. Tests: modal suite
  16→23 (header stats, period, masked account, badges, direction icons,
  per-filter filtering + counts + empty state) (suite 675→682). Gates:
  tsc/lint/full suite/build green.
- **Bank statement import entry point (preview-only UI).** The
  `ImportStatementModal` now drives the 3F pipeline end-to-end and STOPS at
  the preview — nothing is ever written to the budget (`addTransactions` is
  no longer reachable from this screen; the Import button is disabled with an
  explanatory tooltip). Upload → processing → preview stages. The preview
  shows: a detection banner (bank chip GTCO/OPay/General + the pipeline's
  score-based reason; unknown formats add a "review carefully" note),
  summary counts (detected / needs review / rows skipped / rows unreadable),
  relationship findings from 3E (possible-duplicate warning, money-movement
  links note), and per-row classified output — date, description (+ merchant/
  provider/channel/branch microcopy), kind chip (Expense/Income/Transfer/
  Bank fee/Tax/Refund/Interest/Savings…), confidence label when not high,
  signed amount, "Needs review" badge, and a category select ONLY for rows
  that can be ledger entries (expense/income/refund/interest, plus unknown
  rows by flow direction) — transfers, fees, taxes, savings and loan
  payments get no category, so they can never be miscategorized as spending.
  Error states are user-friendly: unsupported file type, empty file, no
  readable transactions, unreadable/password-protected file — no stack
  traces. Parser fix surfaced by the UI: `parseOpayStatement` now falls back
  to the Value Date for `transactionDate` when the statement has no
  "Trans. Time" column (previously every such row showed "Date?" and broke
  duplicate detection). Tests: modal suite rewritten (16 tests: upload/
  processing/preview/errors/preview-only safety) + 1 new OPay parser
  regression test (suite 668→675). Gates: tsc/lint/full suite/build green.
- **Statement processing pipeline (format detection → preview).** New
  `lib/statementPipeline.ts`: `processStatement({ cells, context, categories })`
  runs the full import pipeline and STOPS at the preview — nothing is written
  to the budget, the store or storage. **Format detection**
  (`detectStatementFormat`): header-vocabulary scoring over the first 12 rows
  (min score 5) against each bank's column vocabulary; near-ties are broken
  by canonical distinctive columns (GTCO: remarks/debits/credits/originating
  branch/posting date… OPay: trans time/channel/balance after/description/
  debit/credit…); the bank name and file name are NEVER consulted. GTCO →
  `parseGtcoStatement`, OPay → `parseOpayStatement`, unknown → generic
  detection (`buildCandidates` → `candidatesToNormalized`). The result is a
  `StatementPreview`: classified transactions + `detectRelationships` report +
  skipped count + per-row parser errors + detection reason (scores shown in
  review). `gtcoHeaderScore(row)` / `opayHeaderScore(row)` are exported from
  the parsers as detection helpers. Tests: 13 new
  (`statementPipeline.test.ts`): full GTCO pipeline (9 classified rows incl.
  fees, VAT, interest, unknown deposit + skipped bad-date row), full OPay
  pipeline (12 rows incl. mobile data, salary, transfer, stamp duty, USSD/
  SMS charges, OWealth interest/auto-save/refund, funding-pair link,
  movementIds), duplicates through the pipeline, format-detection unit cases
  (GTCO/OPay/minimal headers, tie-break, generic → unknown, blank cells),
  generic fallback, and a safety test (no mutation of input cells, no
  imported statuses). Gates: tsc/lint/full suite (668)/build green.
- **Transfer relationships and duplicate detection.** New
  `lib/statementRelations.ts`: `detectRelationships(transactions)` produces a
  `RelationshipReport` for one import session — analysis only, nothing is
  deleted, merged or rewritten (every original row stays available for
  review). **Duplicates** (`duplicateGroups`): deterministic multi-signal
  matching — pass 1 pairs equal normalized references + same amount +
  same direction (high); pass 2 pairs identical normalized descriptions +
  same amount + same direction + same date, with a same timestamp → high
  and missing timestamps → medium. Same amount alone NEVER flags a
  duplicate; distinct timestamps on an otherwise identical row mean a
  legitimate same-day repeated payment; different references disprove a
  duplicate; empty descriptions only match by reference. Groups are
  unioned and ids come back in statement row order. **Links**
  (`links`): a movement row (savings / internal-transfer) paired with a
  transfer → `funding-pair` (e.g. "Transfer to X" followed by an OWealth
  Withdrawal funding it), or with another movement row → `savings-movement`
  (e.g. auto-save in and the matching withdrawal out); links require the
  same effective amount + same direction, same date → high confidence,
  otherwise medium; partial savings withdrawals are deliberately NOT
  linked. **Money movement** (`movementIds` + `isMoneyMovement`): rows
  classified savings/internal-transfer are flagged as money movement and
  never treated as spending. Tests: 20 new (`statementRelations.test.ts`).
  Gates: tsc/lint/full suite/build green.
- **Bank statement classification layer.** New `lib/statementClassify.ts`:
  `classifyTransaction(tx, categories)` / `classifyTransactions(txs,
  categories)` analyze normalized transactions and attach a SUGGESTED kind +
  confidence + existing Category id + `needsReview` — analysis only, nothing
  is written to the budget, SQLite or storage (no imports, no UI, no merges).
  Kind vocabulary is the existing kebab-case `BankTransactionKind`
  (prompt's "internal_transfer" → "internal-transfer", "bank_fee" →
  "bank-fee", "tax_or_charge" → "tax", "loan_payment" → "loan-payment").
  **One category system**: categories resolve against the app's existing
  `Category[]` by name hint (exact, then containment — "Utilities" matches
  "Bills & Utilities"); unmatched hints stay `categoryId: null` = Needs
  Review instead of guessing. **Transfers stay transfers**: "Transfer to
  John Doe" is never mapped to Food/Shopping/Transport; bare transfers are
  low confidence, "Transfer to X | Provider" medium; only explicit merchant
  evidence (payment gateways — Paystack, Kora, Moniepoint, Flutterwave,
  Interswitch — "merchant order", "checkout") classifies as expense.
  Extensible rule tables (`CLASSIFICATION_RULES` — ordered, first match
  wins: refund → loan → tax → bank-fee → interest → savings →
  internal-transfer → merchant-gateway → transfer → income-salary →
  expense patterns — and `PROVIDER_RULES` for PalmPay/OPay/MTN/Airtel/
  Paystack/Kora/Moniepoint/Access/Sterling/Wema/Fidelity etc.) are data, not
  engine code; patterns match on word boundaries ("QWE786JSALARYXQWERTY"
  never matches "salary"). Expense rules skip credits and income rules skip
  debits. Confidence: high (explicit narration patterns), medium (merchant
  gateways, keyword-suggestion fallback via the existing
  `suggestCategory`), low (unstructured transfers), "none" (unknown, stays
  "draft"). Rows get `classificationReason` (rule id) and `needsReview`
  (unknown kind OR no confident category). Merchant/recipient extraction
  fills gaps when the parser provided none. Tests: 35 new
  (`statementClassify.test.ts`). Gates: tsc/lint/full suite/build green.
- **OPay/OWealth bank statement parser.** New `lib/opayParser.ts`:
  `parseOpayStatement(cells, {currency})` converts OPay statement rows straight
  into the normalized model (`NormalizedBankTransaction[]`, `sourceBank:
  "opay"`, type "unknown" / confidence "none" / categoryId null / status
  "draft" — classification stays a later phase). Columns are matched **by
  header name** — "Trans. Time", "Value Date", "Description", "Debit(₦)",
  "Credit(₦)", "Balance After(₦)", "Channel", "Transaction Reference"
  (currency markers like "(₦)" are stripped from tokens; tolerant variants
  like "Transaction Date" / "Narration" accepted; header located by
  vocabulary scoring in the first 12 rows) — with the canonical export order
  as a positional fallback for headerless files. The **complete original
  description is preserved** (capped) in `description` and
  `originalDescription`; only obvious structured facts are lifted out —
  merchant/recipient and provider from "|"-separated narrations
  ("Transfer to DAVID OSAHON OGBEIDE | PalmPay" → merchant + provider;
  "Mobile Data | MTN | 3.2GB 2 Days Plan" → provider "MTN", plan detail kept
  for classification; "Third-Party Merchant Order | Kora Payments Network
  Limited" → provider only). No category classification. Channel goes into a
  new transient `channel` field on the model. Amounts reuse
  `parseAmountCell` (₦0.70/₦0.75/₦1.88 and large amounts exact; empty
  debit/credit cells stay `undefined`, never forced to zero). A malformed row
  never fails the import: invalid dates, unparseable amounts and rows with
  neither debit nor credit are skipped and reported per-row in `errors`;
  missing descriptions fall back to "(no description)"; footer rows are
  ignored silently. Tests: 25 new (`opayParser.test.ts`: normal transfer with
  merchant/provider, truncated recipient, mobile data, OWealth
  withdrawal/interest/auto-save/refund, stamp duty, VAT on transfer fee, USSD
  charge, EaseMoni loan repayment, merchant payment, naira decimals, large
  amounts, empty amount cells, malformed rows, missing columns, headerless
  fallback, title-row tolerance, multi-row independence). Gates:
  tsc/lint/full suite/build green.
- **GTCO bank statement parser.** New `lib/gtcoParser.ts`:
  `parseGtcoStatement(cells, {currency})` converts GTCO statement rows straight
  into the normalized model (`NormalizedBankTransaction[]`, `sourceBank:
  "gtco"`, type "unknown" / confidence "none" / categoryId null / status
  "draft" — classification stays a later phase). Columns are matched **by
  header name** — "Trans. Date", "Value Date", "Reference", "Debits",
  "Credits", "Balance", "Originating Branch", "Remarks" (plus tolerant
  variants like "Transaction Date" / "Narration"; the header row is located
  by vocabulary scoring in the first 12 rows) — with the canonical export
  order as a positional fallback for headerless files. Remarks is the primary
  description and is preserved verbatim (capped at
  `MAX_ORIGINAL_DESCRIPTION_LENGTH`) in `originalDescription` for the
  classification layer; branch goes into a new transient
  `originatingBranch` field. Amounts reuse `parseAmountCell`, which now
  accepts Excel-style leading-dot decimals (`.20`, `.75`). A malformed row
  never fails the import: invalid dates, unparseable amounts and rows with
  neither debit nor credit are skipped and reported per-row in `errors`
  (footer rows with no date are ignored silently). Tests: 21 new
  (`gtcoParser.test.ts`: debit/credit, NIP transfer, transfer between
  customers, commission/VAT/SMS charges, capitalised interest, leading-dot
  and comma/whole amounts, transaction time, malformed rows, missing
  columns, headerless fallback, title-row tolerance) + 1 new
  `parseAmountCell` case (suite 553→575). Gates: tsc/lint/full suite/build
  green.
- **Normalized bank transaction foundation (statement import groundwork — no
  parsers, no classification, no UI changes yet).** New `lib/statementTypes.ts`
  defines the canonical intermediate between a raw bank statement and the
  ledger: `NormalizedBankTransaction` (session id, transactionDate ±
  transactionTime, valueDate, description, capped originalDescription,
  transient reference, debitAmount/creditAmount split, balanceAfter, currency,
  sourceBank, merchant/provider, type, direction, confidence, categoryId,
  status, source row) plus the enums `BankTransactionKind` (expense / income /
  transfer / internal-transfer / bank-fee / tax / refund / interest /
  loan-payment / savings / unknown), `BankDirection` ("in"|"out"|"unknown" —
  mirrors `ParsedAmount["direction"]`), `ClassificationConfidence`
  (high/medium/low/none — extends the existing high/low pattern from
  `categorize.ts`), `ImportStatus` (draft/classified/reviewed/imported/
  skipped) and `BankSource` (gtco/opay/owealth/other/unknown). The layer is
  **transient**: never written to AppState, localStorage or SQLite (privacy —
  references/raw narrations are capped and never logged). New
  `lib/statementNormalize.ts` maps `ImportCandidate[]` → normalized
  transactions (`candidatesToNormalized`) without interpreting the sign:
  debit/credit only set `direction`; `type` starts "unknown", confidence
  "none", categoryId null, status "draft" — explicitly NOT debit=expense /
  credit=income. `lib/statementImport.ts` gained `parseStatementDateTime`
  (date + optional 24h time from "12/08/2026 14:32", "2026-08-12T09:05:07",
  "2:32 PM"). Bank-specific parsers (GTCO, OPay) plug in ahead of
  `buildCandidates` and set `NormalizationContext.sourceBank`. Tests: 11 new
  (`statementNormalize.test.ts`) + 6 new `parseStatementDateTime` cases.
  Gates: tsc/lint/full suite/build green.
- **Bank statement import is now a working 4-stage flow (Upload → Processing
  → Review → Import), replacing the scaffold modal.** Drop or browse a CSV,
  Excel (`.xlsx`/`.xls`) or PDF bank statement; files are parsed entirely
  client-side in `lib/statementImport.ts` (`xlsx` via SheetJS CDN tarball
  0.20.3, `pdfjs-dist@6.2.108` lazily imported; the worker is bundled through
  the `new URL(..., import.meta.url)` pattern, which Turbopack emits as a
  hashed static asset at build time). The parser handles RFC-4180-ish CSV (quoted fields,
  embedded commas/newlines, unquoted comma-thousands like `500,000.00`),
  currency-aware amounts (CR/DR/DB markers, parens, `₦$€£¥` prefixes,
  minor units), day-first vs ISO dates (dd/mm ambiguous → day-first for NGN
  statements), x-gap column splitting for PDFs, header-vocabulary column
  detection with balance-delta direction inference, and keyword-based
  category detection (`detectCategory`). The review stage shows each detected
  row (date, description, signed amount, type chip, compact category select)
  with warnings for uncategorized rows or unreadable dates; Import stays
  disabled until every transaction has a category and a date, and nothing is
  written until the user confirms (single bulk write via the new
  `addTransactions` store action). The modal resets per open
  (`PlannerView` remounts it with a `key`). Tests: 35 new lib tests + 10
  component tests + 2 store tests (337→385). Gates: tsc/lint/build green.
- **Added an "Import Statement" action to the Planner header (scaffold —
  superseded by the working flow above).** A subtle outlined secondary
  button with an upload icon sits alongside Add Expense and Add Income and
  opened a placeholder modal. Replaced in the same release; kept for
  history. Tests 5 new (`ImportStatementModal`).
- **Fixed the Next.js runtime crash in `app/layout.tsx` ("Encountered a
  script tag while rendering React component") and a resulting hydration
  failure.** The theme bootstrap is now injected per the official Next.js 16
  "preventing flash before hydration" pattern: a real executable inline
  `<script type="text/javascript">` in the root layout `<head>`
  (`components/ui/InlineScript.tsx`) that runs synchronously while the
  browser parses the HTML (before first paint, before hydration), so
  `THEME_BOOTSTRAP_SCRIPT` (theme/accent/animations bootstrap) still
  prevents theme flicker. `InlineScript` renders `type="text/plain"` on the
  client so React treats the node as a data block — it never creates or
  executes a script element in the client tree, which removes the dev-mode
  script-tag warning; `suppressHydrationWarning` covers the type difference
  (`next/script` was wrong here: it serializes a `self.__next_s` push script
  inside the body, which shifts hydration matching and triggers both errors).
  The first-run name modal was also made hydration-safe: the display-name
  store now starts `ready: false` on both server and client (AppShell seeds
  the saved name at mount), so the modal never renders in the server HTML
  and its presence can no longer diverge between SSR and hydration.
  Gates: tsc/lint/full suite 488/build green; dev + Electron browser console
  clean, served HTML carries the inline bootstrap script.
- **Budget attention bar is now responsive (CSS/layout only — fullscreen
  appearance, "Review budgets" and "View more" behavior unchanged).** The
  alert is a CSS container (`@container`): at container widths below 896 px
  only the most important budget message shows alongside "View more" (the
  second message is `hidden @4xl:flex`); at wider widths the up-to-2-message
  layout is identical to before. All messages are `min-w-0` with `truncate`
  text, so budget messages ellipsize instead of overlapping the title, "View
  more" or the button; the title/button stay `shrink-0` and the button keeps
  `ml-auto`, so it always renders fully clickable. No JS resize listeners.
  Tests 486→487.
- **First-install name setup:** on first launch with no saved display name, a
  small non-dismissable modal asks "What should we call you?" — supporting
  copy, a single name input (placeholder "Enter your name") and a teal
  **Continue** button that stays disabled until the trimmed value is
  non-empty (Enter submits). Saving trims and persists the name through the
  existing storage seam (`settings:display-name`; SQLite on desktop,
  localStorage in the browser — no schema/migration/user model involved) and
  the modal never appears again. The Planner hero greeting now uses the saved
  name ("Good afternoon, Daniel 👋") instead of the hardcoded "Archer",
  falling back to a nameless greeting when none is saved. New tests:
  `displayName.test.ts` (4), `NameSetupModal.test.tsx` (7 — plus the
  hydration-safe `ready` gate), Hero +1.
  Gates: tsc/lint/full suite 488/build green.
- **Reports page polished into the analytics companion to Planner
  (presentation only — data, calculations, routing, report functionality and
  page dimensions untouched).** Header and decoration unchanged. Monthly
  overview KPI cards keep the four-column layout but form a coherent group
  (per-card `shadow-none`, hairline border) and, where previous-month data
  exists, show the change directly beneath the primary value: "↑/↓ ₦X from
  last month" for income/expenses/net savings (green for positive movement,
  restrained red for negative — expenses falling is green) and "↑/↓ N% from
  last month" for the savings rate (its duplicate % chip dropped); the "No
  prior month to compare yet" / "Record income to start comparing" /
  "Spending more than you earn" fallbacks are retained. Financial insights:
  the main card gets a deliberate treatment (teal-white tint
  `bg-brand-500/[0.03]`, `border-brand-500/20`, no shadow, h-10 icon tile)
  with headline + explanation; the three supporting observations become
  compact bordered surface cards with contextual icons and red/amber/green
  semantic tints. New **Spending breakdown** section below insights —
  two-column on lg: "Income vs expenses" (6-month bar + net-line) and
  "Spending by category" (this month's top-5 horizontal bars via
  `ExpenseBreakdown`, existing category colors, total footer, empty state).
  New **Savings trend** section below it (the quiet thin-line `SavingsChart`).
  The old standalone "Income vs expenses" section and the duplicated
  SavingsChart + "Spending this month" cards were removed from Detailed
  breakdowns (charts moved, not deleted); everything else is untouched. New
  tests: `MonthlyOverview.test.tsx` (5), `FinancialInsights.test.tsx` (2),
  `ReportsView.test.tsx` (3). Gates: tsc/lint/full suite 475/build green.
- **To-Do page reworked into a focused task/action screen (presentation only —
  functionality, routing, data model, task behavior and sidebar untouched).**
  The header row (title, description, month selector) keeps its sizing and
  positioning; a compact muted summary line sits beneath it — "N item(s)
  needs attention · 0 completed · N high priority" (attention = danger/warn
  items, high priority = danger items; no completed state exists so that
  count is 0). The oversized single `Card` becomes an intentional task
  section "To-do · <month>" with a compact dot-separated filter control
  (All • Needs attention • Completed, All active; purely client-side —
  Completed always shows "Nothing completed yet."). Tasks are compact
  horizontal rows (surface, subtle border, rounded-xl, consistent padding):
  tinted icon tile, title + priority chip, muted description, and a subtle
  teal ghost "Resolve" button far right — still linking to the same
  resolving page. Tone treatments stay subtle: danger = soft red/pink tint
  + red icon + "High priority", warn = soft amber tint + "Medium priority",
  success = soft green tint + "On track", neutral = neutral surface +
  "Normal". Below the list a subtle dashed section reads "You're all caught
  up." / "Nothing else needs your attention this month." with a small teal
  "View Planner" action (shown whenever no additional unresolved tasks
  exist). Existing decoration and dark-mode tokens kept; rows wrap instead
  of overflowing. New `TodoView.test.tsx` (4 tests). Gates:
  tsc/lint/full suite 465/build green.
- **Upcoming page reworked into a forward-looking planning screen
  (presentation only — no functionality, data model, routing or header
  changes).** A compact 4-tile summary row (2 cols mobile → 4 desktop,
  Planner card language) shows "Upcoming expenses" total + planned count,
  "Next due" (amount, relative countdown, date; brand-tinted icon; "—" /
  "Nothing scheduled" when empty), "This month" total + count, and
  "Recurring" count — from new pure helpers `upcomingSummary()` +
  `filterUpcoming()` in `lib/upcoming.ts`. The Disclosure preview list
  becomes an always-open timeline: "Upcoming" heading with right-aligned
  controls, a subtle left rail (`border-l-2`) with muted dots on each
  date-group header (existing Overdue/Today/Tomorrow/This week/Next
  week/Later grouping, counts, group totals), rows unchanged (icon, name,
  category + recurring chip, countdown chip, date, amount, actions menu,
  edit-on-click), and a very subtle teal tint + border on the soonest
  expense (`accent` prop). New client-side controls: **All / This month /
  Later** filter pills (active = subtle brand tint, `aria-pressed`) and a
  **Soonest ↔ Latest** sort toggle (Latest = flat descending list). Empty
  state is now intentional: "You're clear for the rest of the month." /
  "Nothing else is scheduled." + small "+ Add upcoming expense" secondary
  action (replaces both old empty cards; Paid section stays). Decoration
  kept and raised; no horizontal overflow at any breakpoint. The
  long-standing date-flaky "counts the items in each date group" test was
  rewritten deterministically (all items at the same relative offset →
  always one group): UpcomingView tests 5→9, upcoming lib tests +6; full
  suite 451→461 — now 100% green with no known flakes. Gates:
  tsc/lint/full suite 461/build green.
- **Add Expense modal refined to the reference (presentation only — fields,
  positions, dimensions, data model, submission and validation untouched;
  no Payment method / no Receipt upload).** The modal panel swaps the heavy
  `shadow-pop` for a subtle full-opacity 1px `border-border` + `shadow-card`
  (scoped via a new optional `panelClassName` prop on the shared `Modal`;
  every other modal keeps its current look). The heading is now the
  per-kind action — "Add Expense" / "Add Transfer" / "Add Income"
  ("Edit transaction" when editing) — instead of "New transaction", and a
  close icon sits top-right (new optional `closeButton` prop on `Modal`,
  wired to the existing `onClose`; the header gains `pr-20` so long titles
  never collide); the header also gets slightly more breathing room from
  the first form row. The tabs are restyled from a filled segmented pill to
  the reference underline style: Expense/Transfer/Income keep their order,
  labels and `aria-pressed`; the active tab is a 2px teal `border-brand-500`
  underline with ink text, inactive tabs are muted blue-gray with a
  transparent underline, and a subtle `border-border/70` divider sits
  underneath (`-mb-px` overlap). Form rows get slightly more vertical rhythm
  (`gap-y-5`, horizontal `gap-x-4` unchanged; labels still sit close to
  their inputs). The Amount input now shows the configured currency symbol
  as a subtle left-edge prefix (new optional `prefix` prop on the shared
  `Input`, `pl-11` keeps the value visually separated; `currencySymbol()`
  exported from `lib/money.ts`). The note becomes a 3-row `textarea` —
  same `maxLength` 200 cap and behavior, placeholder now "Add a note...",
  slightly more internal padding (`pt-3 pb-7 px-4`), and a subtle `0/200`
  tabular-nums counter pinned bottom-right (aria-hidden, derived from
  `note.length`). The select chevron, native date field, labels, borders,
  teal focus rings, and the bottom-right Cancel/Add buttons already matched
  the reference and are untouched. 4 new `TransactionForm.test.tsx` cases
  (heading reads "Add Expense", close icon calls `onClose`, "$" prefix with
  the default USD currency, counter 0/200 → 9/200 while typing). Gates:
  tsc/lint/TransactionForm 17 tests/build green; full suite 450/451 (only
  the pre-existing date-flaky UpcomingView failure unchanged).

- **Budget Allocation rows refined to the reference palette and layout
  (presentation only — data, ordering, calculations, functionality,
  row/card dimensions, typography and bar thickness unchanged).** Each
  `BudgetRow` now has an extremely subtle pastel category-tinted
  background (Transport very light warm cream/yellow, Loan very light
  pink/lilac, Edi very light red/pink, Misc very light cool gray/blue,
  Essentials very light pink/red, Internet very light warm peach/orange,
  PalmPay very light blue — 8–10% alpha, never saturated; unknown
  categories keep their stored-color tint). The thin progress bar and
  the percentage now carry the stronger per-category accent (Edi red,
  Internet orange, Essentials red, Transport teal, PalmPay blue, Loan
  teal, Misc muted gray) via a new optional `fillColor` prop on
  `ProgressBar`; over-budget rows keep the existing warn (orange) and
  far-over danger (red) treatment. Row layout inside the unchanged
  40px height follows the reference: icon far left → category name +
  Medium badge close together; below, the progress bar starts at the
  same left alignment, percentage immediately right of the bar, "spent
  · left" after it, and the budget amount pinned far right — consistent
  alignments across all seven rows, no overlaps. The unintended
  floating "Priority: Medium" tooltip is gone: `PriorityBadge` no
  longer passes a `title` attribute to `Badge` (the badge itself
  remains). Treatment palette lives in `lib/accents.ts`
  (`budgetRowTreatment`) with 3 new tests; gates: tsc/lint/planner
  95 + accents 8/build green (446/447, only the pre-existing
  date-flaky UpcomingView failure unchanged).

- **"Review budgets" in the Budget needs attention bar now actually
  opens Budget Allocation (bugfix — appearance, size, position, text,
  and banner untouched).** The button was a plain `next/link` to
  `/?focus=over`; its client-side navigation rides the App Router,
  which is a no-op in this static-export Electron build (the same
  reason `router.push` is documented as unsupported), so clicking it
  did nothing. It now attaches the same proven handler the working
  hero "Review Budget" button uses — a direct DOM
  `scrollIntoView` to the `#budget-allocation` section (smooth,
  block-start) — directly on the rendered link element, so it works
  with mouse and keyboard (Enter). The `href="/?focus=over"` and the
  `Link` semantics are preserved for any router-capable context
  (middle-click, open-in-new-tab), and if both fire they converge on
  the same section. The `next/link` mock in `BudgetAttentionBar.test.tsx`
  was corrected to compose the real `onClick` instead of clobbering
  it (previously the tests passed while the real handler could never
  run); one test added (clicking Review budgets calls
  `scrollIntoView({ behavior: "smooth", block: "start" })` on the
  Budget Allocation section).

- **"Split red donut" root-caused and fixed — duplicate category
  colors, not rendering (data and business logic untouched).** Inspecting
  the user's actual app state showed four categories (internet,
  Essentials, Misc, Loan) all store the same red `#ef4444`, so the
  already-correct one-arc-per-category renderer legitimately drew four
  separate red arcs — reading as "the red category split into pieces".
  `BudgetList` now de-duplicates donut colors presentation-only when
  building its segments: the first category keeps its stored color and
  each repeat gets a distinct reserve hue (purple, orange, teal, pink,
  indigo, dark teal), so the donut shows one clean arc of each color
  (red → yellow → blue → green → teal → purple → orange). Stored
  categories, budget values, the budget list, and every other section
  are untouched; each category remains exactly one continuous arc.
  Added `DonutChart.test.tsx` (5 tests) covering: one path per
  category, no internal sub-arcs, same-colored categories staying
  separate arcs, real 5–30° angular gaps between every adjacent pair,
  all-zero segments rendering nothing, and the accessible label.

- **Donut segments now render as single continuous arcs — split-segment
  bug fixed (presentation only — proportions, colors, data, and
  functionality unchanged).** The previous dash-based rendering
  (`strokeDasharray` on `<circle>` elements) could emit a single
  category as several separate pieces whenever its dash crossed the SVG
  path seam at 12 o'clock — the red (first) category visibly rendered
  as multiple separate red arcs. `DonutChart` now calculates one
  startAngle/endAngle per category from its proportion and renders
  exactly ONE `<path>` arc per category, with no dash patterns, no
  subdivision, and no rotation change. The path seam now falls inside
  an inter-category gap, so no arc can straddle it. Each arc's sweep is
  reduced only at its own start and end boundaries, keeping the real
  visible ~5° gaps (≈7px at mid-radius, background showing through)
  between adjacent categories around the whole ring and rounded ends
  (`strokeLinecap="round"`). Hover/active highlighting (stroke-width
  +4) is preserved; the small-segment guard (`gapPerSide` capped at
  `length/3`) keeps tiny categories visible as single arcs. Diameter
  (180px), ring thickness, colors, proportions, and centre text are
  unchanged.

- **Donut segment separation actually fixed (presentation only —
  proportions, colors, data, and functionality unchanged).** The
  previous 4° gap was invisible: with an 18px stroke and
  `strokeLinecap="round"`, each rounded cap extends 9px past its dash
  end, so the ~6px gap was fully covered and adjacent segments kept
  overlapping. `DonutChart` now subtracts `strokeWidth` from the sweep
  reduction as well, so the caps' combined reach sits inside the removed
  arc and the donut background genuinely shows through — a visible ~5°
  gap (≈7px at mid-radius, ~6–8px across the ring) separates every
  adjacent category consistently around the whole circle (red → yellow →
  blue → purple → green → teal → red). Segments remain independently
  rounded at both ends; a per-segment guard caps the gap at one-third of
  the segment length so tiny categories never vanish. Diameter (180px),
  ring thickness, colors, proportions, centre text, and rotation are
  all unchanged.

- **Donut segment gaps widened to match the reference (presentation
  only — proportions, colors, data, and functionality unchanged).** The
  Budget Allocation donut's inter-segment gap grew from 3° to 4° (~6px
  visible at the outer edge, inside the 5–7px target), so every category
  segment is now clearly separated by a small, consistent radial gap
  around the entire ring (red → yellow → blue → purple → green → teal →
  red). Segments remain independently rounded at both ends; the donut
  diameter (180px), ring thickness, colors, segment proportions, centre
  text, and the rest of the card are untouched. Implemented via a new
  optional `segmentGapDegrees` prop on `DonutChart` (defaults to 3°, so
  any other consumer is unaffected) set to 4° by the Budget Allocation
  card.

- **Budget Allocation donut enlarged and statistics moved lower
  (presentation only — data, calculations, colors, and functionality
  unchanged).** The donut grows 150px→180px — larger and visually
  prominent but still centered with comfortable whitespace on both
  sides, keeping the proportional ring thickness, rounded segment ends,
  and category colors. Centre text is unchanged (13px "Budgeted", 18px
  bold KPI, 12px "of ₦X", 12px pill) with the same 4px line grouping
  and clear breathing room to the ring. The Allocated/Remaining section
  now sits noticeably lower (28px deliberate gap below the donut, up
  from 16px) with a clean, even rhythm — a uniform 12px between every
  element (label row → progress bar → label row → progress bar), labels
  left / amounts middle / percentages bold far right, and 6px bars.
  The card grows in height naturally to fit the larger donut and lower
  statistics, with no compression and no excessive bottom space.
  Nothing else on the page changed.

- **Budget Allocation donut card rescaled to a compact in-card chart
  (presentation only — data, calculations, colors, and functionality
  unchanged).** Donut reduced 160px→150px so it reads as a compact
  chart inside the card rather than a giant circular graphic: it sits
  in the upper-center with generous whitespace on both sides (upper
  ~55% of the card; the statistics occupy the lower ~35%; card ~300–330px
  tall). Centre content is significantly smaller and tightly grouped
  with clear empty space between the text and the ring on all sides:
  "Budgeted" at 13px, the committed amount at 18px bold as the main KPI,
  "of ₦X" at 12px directly underneath, and the "N% allocated" pill at
  12px. Ring thickness unchanged (proportional to the diameter, rounded
  caps and gaps kept). A 16px gap separates the donut from the
  statistics; the Allocated and Remaining rows keep ~14px typography
  (label left, amount middle, percentage bold far right) with ~10px
  between each label row and its 6px progress bar and ~14px between the
  two bars. Nothing else on the page changed.

- **Budget Allocation donut card rescaled to the reference proportions
  (presentation only — data, calculations, colors, and functionality
  unchanged).** Donut reduced 185px→160px so it no longer dominates the
  card; horizontal padding stays ~24px with ~24px top padding and a
  small bottom padding. The centre content now sits with consistent 4px
  line spacing and clear breathing room inside the donut: "Budgeted"
  at 14px, the committed amount at 20px bold as the main KPI, "of ₦X"
  at 13px directly underneath, and the "N% allocated" pill at 13px. A
  20px gap separates the donut from the statistics; the Allocated and
  Remaining rows use ~14px typography with the percentages (85% / 15%)
  bold and pinned far right, ~10px between each label row and its 6px
  progress bar, and ~12px between the two progress bars. Nothing else
  on the page changed.

- **Budget Allocation chart card scaled up to the reference's visual
  weight (presentation only — data, calculations, colors, and
  functionality unchanged).** The left donut card is now a proper
  dashboard analytics card: donut enlarged 140px→185px and dominant in
  the card; its centre text upgraded ("Budgeted" caption, committed
  amount as a 24px bold KPI, "of ₦X" directly beneath, and a clearly
  visible "N% allocated" pill). Card padding raised to ~24px, spacing
  between the donut and the Allocated/Remaining statistics roughly
  doubled, and the statistics raised from tiny caption text to
  comfortable readable typography with the percentages (85% / 15%)
  pinned far right as bold values. The 6px progress bars still span the
  full card width. Nothing else on the page changed.

- **Budget Allocation content densified to the reference (presentation
  only — no calculation/data/action changes).** The two-column allocation
  area is now a dense dashboard module. Left card: padding reduced, the
  140px donut stays at the top, and the Allocated/Remaining rows sit
  directly beneath with tighter gaps. Right card (`BudgetRow` rebuilt):
  rows are now ~40px (was 64px+) with no per-row card styling — a small
  icon, category name with the small inline priority badge and the budget
  amount far right; below, a thin subordinate progress bar with the
  percentage beside it and tiny "spent · left" secondary text. Each row
  gets a subtle background tint from its category color (over-budget rows
  keep the existing warn/danger tint); hover reveals small Edit/Delete
  actions. Rows are now ordered by category list order (Edi, Transport,
  Internet, Essentials, PalmPay, Misc, Loan) instead of priority; the
  donut segments follow the same order. No new information was added.

- **Budget Allocation donut card refined to the reference (presentation
  only — no calculation/data changes).** The left card of the allocation
  grid is now a white card (subtle border, small rounded corners) with a
  substantially smaller 140px donut (was 220px) centered near the top,
  preserving the existing category colors. The donut centre shows
  "Budgeted" → committed amount → "of ₦X" (allocatable income) → a small
  "N% allocated" pill. Below the donut are two compact progress rows —
  "Allocated ₦X N%" and "Remaining ₦X (100−N)%" each with a thin progress
  bar — replacing the old "Allocated X of Y allocatable / Remaining to
  allocate Z / Over allocated" caption block. The over-allocated case is
  preserved: the true ratio is labeled, the allocated bar clamps to 100%,
  remaining shows ₦0.00 / 0%, plus a short warn caption. Funding tests
  rewritten for the new structure.

- **Budget Allocation reworked to the reference (presentation only — no
  data/calculation/action changes).** The section is now an always-open
  compact card instead of a collapsible Disclosure with a preview: header
  row keeps "Budget Allocation" + the "N budgets" pill badge beside the
  title and the outlined "New budget" button far right. Directly below the
  header sits a compact warm/cream recommendations panel ("A few budgets
  are over their limits") with one row per over-limit budget — a
  category-colored chip, then "Name → increase limit by X or reduce
  spending" when the overage is covered by remaining income or "Name →
  reduce spending by X to stay within limit" otherwise — and a "View
  recommendations →" link at the bottom-left (`/reports`). Clicking a row
  still opens the budget edit form (the previous Adjust action). The large
  "N budgets over their limits" adjustment panel is gone. Below it, the
  main area is a compact two-column layout: LEFT donut-chart card
  (committed amount in the centre + the existing funding caption and
  progress bar), RIGHT card with all budget rows (unchanged `BudgetRow`).
  Focus flows (`focus=over`, `focus=create`, `planner:focus-budget`) keep
  scroll/highlight/focus behavior minus the now-unneeded expansion; the
  Past-months list and the Allocate-remaining sliders remain below,
  unchanged. `BudgetSuggestions.tsx` rewritten; new `BudgetSuggestions`
  tests (6) added; BudgetList focus/funding and NeedsFundingSection tests
  updated for the always-open layout.

- **Planner summary cards updated to the reference (presentation only —
  no calculations/data changes).** The four Summary KPI cards adopt the
  reference's compact vertical hierarchy: icon → label (directly below the
  icon) → main value → supporting text → comparison row aligned near the
  card bottom. Content is top-aligned (was `justify-between`, which
  stretched the cards vertically) and the main value uses the
  kpi-secondary scale (slightly smaller than the hero scale). `MetricCard`
  gains optional `compact`/`labelExtra`/`comparison` props; the Reports
  overview tiles (same component) are untouched. Per card: Expected Income
  keeps the Edit action and green arrow icon with a green "↑ ₦25,000 from
  last month" row; Remaining keeps the target icon and progress bar, its
  subtitle is now "% of allocatable income", with a red "↓ ₦17,500 from
  last week" row; Budgeted gains the small info icon beside the label,
  subtitle is now "% of allocatable income" (the "N budgets" text is
  gone), with a green "↓ ₦12,300 from last week" row; Savings Rate now
  shows a "%" suffix ("12%"), subtitle "₦X remaining", with a red "↓ 2%
  from last month" row. Comparison rows are reference copy, not derived
  from data. New `ArrowDownRightIcon` added to `components/ui/icons.tsx`.
  One SummaryCards test copy assertion updated.

- **Budget attention bar collapses to 2 readable issues (presentation
  only).** The collapsed `BudgetAttentionBar` shows exactly the top 2
  attention items (previous limit of 3 caused the third chip to be
  truncated): both visible issue texts render in full with no ellipsis,
  keeping the existing order, and hidden items no longer influence the
  collapsed row width. "View more" reveals all remaining issues; "View
  less" returns to exactly 2. Everything else (colors, typography,
  button, navigation, calculations, expand behavior) is unchanged.

- **Budget attention bar collapse/expand (presentation only).** The
  `BudgetAttentionBar` never grows past its compact ~76px row when many
  budgets need attention: the collapsed state shows only the top 3 issues
  (existing order) with a subtle text "View more" + downward chevron
  control, and clicking it expands the same bar to reveal all remaining
  issues ("View less" + upward chevron collapses back). The "N
  recommendations" count text is gone; issue styling, ordering, the
  "Review budgets →" action and the underlying calculations are unchanged.

- **Planner budget alert area reworked to the reference (presentation only).**
  The three separate blocks — "Over budget this month" card, the "Budget far
  over limit" recommendation card, and the "N more recommendations"
  disclosure — are replaced by one compact horizontal alert bar
  (`BudgetAttentionBar`): ~76px tall, 18px radius, very light red/pink fill
  with a subtle 1px light-red border; warning triangle in a 40x40px pale-red
  circle, "Budget needs attention" heading, one chip per category (red dot for
  over-limit with "Name is ₦X over its ₦Y limit", orange dot for "Name is at
  100% of its limit"), an "N recommendations" count with a downward chevron
  (count from `insightsFor`), and a teal "Review budgets →" button pinned
  right (navigates to `/?focus=over`, the existing focus mechanism). Wraps
  gracefully at narrow widths — no horizontal overflow. `OverBudgetAlert` and
  `TodayRecommendations` are deleted; the underlying data and actions are
  unchanged. 5 new `BudgetAttentionBar` tests.

- **Planner hero rework (presentation only).** The top of the Planner matches
  the approved hero reference: header row unchanged (Planner title + subtitle
  left; Add Expense / Add Income + month selector right); the "Month at a
  glance" card is replaced by a large hero card with a left column (current
  date, "Good afternoon, Archer 👋" greeting, projected-remaining sentence
  from `monthFinance`, Review Budget / View Reports buttons) and two stat
  tiles on the right (days left + daily available, expected income received %
  over a thin progress bar). Soft teal/blue glows, translucent circles and
  curved lines sit on the hero's right inside an `overflow-hidden` clip layer
  — no horizontal page overflow. `MonthlyStats` is gone; its 5 tests were
  replaced by 8 `Hero` tests. No business logic, calculations, storage or
  routing changes.

- **Planner horizontal-overflow fix (presentation only).** The Planner page
  no longer scrolls horizontally at any desktop size. Cause: decorative
  gradient blobs and curved-line SVGs positioned with negative right offsets
  sat in non-clipping containers — the page-level blob alone extended ~60 px
  past the viewport edge. Rule applied across the five Planner decorative
  layers (`PlannerView`, `MonthlyStats`, `RecentActivity`, `BudgetList`,
  `AllocationPanel`): each decoration layer is now clipped with
  `overflow-hidden` on its own `absolute inset-0` wrapper, so decorations can
  never widen the layout. No content, spacing, business logic or data
  changes; no global overflow hack. Verified in a real render of the running
  app at 1280 / 1440 / 1536 px — zero document overflow at all widths.

- **Planner dashboard redesign (presentation only).** (1) **Reorder:** Month at a
  Glance now sits directly under the Hero, followed by the recommendation card,
  the four KPI cards (Expected Income / Remaining / Budgeted / Savings Rate),
  Needs Funding + Budget Health, then the Budget Allocation section, Expense
  Breakdown and Recent Activity. All calculations and navigation untouched.
  (2) **Budget Allocation compact preview:** the disclosure is collapsed by
  default into a compact card — mini donut with allocated % in the centre, the
  top three budgets (icon, name, amount) with a "+N more" line, a footer with
  the allocated-of-allocatable + remaining figures (or the over-allocated
  warning) and a "View all" button that expands the full disclosure in place.
  Focus flows (`focus=over`, `focus=create`, `planner:focus-budget`,
  hero "Review Budget") still force-expand exactly as before. (3) **Recent
  Activity compact:** shows the latest three transactions with a "View all"
  button into the timeline; row click → edit and hover-reveal Edit/Delete
  unchanged. (4) **Visual language:** the soft teal/blue radial-gradient glows
  and curved-line/concentric-circle motifs are now a recurring, subtle backdrop
  on the Planner — page-level layer behind the hero/summary sections, inside
  the Month at a Glance card's whitespace and in the allocation/empty-state
  areas; decorations stay out from behind dense content. (5) Docs updated:
  `06_PLANNER_SCREEN.md` page order, Budget Allocation (preview + expanded),
  Recent Activity ("View all") and a new "Visual language" section.

- **Planner layout to the approved mockup (presentation only).** The standalone
  Hero is no longer rendered — the Month at a Glance card is now the page hero,
  sitting directly below the page header. The previously dormant
  `OverBudgetAlert` is now the **Budget Alert Banner**, rendered between Month
  at a Glance and the recommendation card whenever any category is over its
  limit: one compact full-width row — warning icon chip, "Over budget this
  month" title, one-line count description and a right-aligned "Review budgets"
  button (`/?focus=over`, which expands the Budget Allocation disclosure); the
  per-category overage chips and the inline text link are gone. The sections
  below the KPI cards are unchanged except that **Recent Activity now precedes
  Expense Breakdown**. `Hero.tsx` remains in the codebase, unused and
  untouched. Docs updated: `06_PLANNER_SCREEN.md` page order (Hero removed,
  banner added, Expense Breakdown moved below Recent Activity) and a new
  "Budget alert banner" section.

- **Expense Breakdown + Recent Activity interactivity.** Expense breakdown:
  every category row is now a clickable button (hover tint, focus ring,
  keyboard-activatable) that navigates to the timeline filtered to that
  category (`/history?month=YYYY-MM&category=ID`, reusing the History page's
  existing category filter). Chart visuals, tooltips, the long-bar cap, the
  totals footer and the collapse-after-five behaviour are untouched; the chart
  container drops `role="img"` when rows are interactive and each row carries
  its own `aria-label`. Recent activity: each transaction row is now an
  explicit button — clicking anywhere on the row opens the existing
  TransactionForm edit flow for that record (same handler as the pencil icon;
  no new transaction logic), and the existing hover-reveal Edit/Delete actions
  are unchanged.

- **Budget Allocation + Allocate remaining polish.** The over-budget warning
  (`BudgetSuggestions`) is now compact: one header line with the over-budget
  count and a short coverage status ("Covered / Partly covered / Not covered by
  remaining income"), then one line per affected budget — icon, name, overage,
  suggested limit, inline trim hint when available, and the "Adjust" action
  (opens that budget's edit form). Previously it was a taller block with a
  title, a multi-line description per budget and a separate coverage note.
  "Allocate remaining" sliders gained a small editable amount field beside each
  slider: moving the slider rewrites the field and typing an amount moves the
  slider (draft text lives in `AllocationPanel` local state, parsed with the
  existing `toMinorUnits`/`minorToInput` helpers). Typed amounts go through the
  same `clampAllocation` rule as the slider — the sum can never exceed the
  remaining balance — invalid input leaves the slider untouched and snaps back
  on blur. No allocation logic changed (`lib/allocation.ts` untouched); slider
  sync, Apply/Reset/Clear behaviour unchanged.

- **Instant, simultaneous theme switching (no more lagging strip).** The
  page canvas is `body`'s background (`html` carries none), and `body` used to
  transition `background-color` over 250 ms while every surface (sidebar,
  title bar, header, cards) switched instantly — so the canvas gutter at the
  sidebar/content boundary kept the old theme for a beat and flashed a dark
  (or light) strip during every Light↔Dark toggle. The transition is removed:
  the whole app now switches theme in the same frame, no strip, no white/black
  flash. The Electron window's `backgroundColor` is now resolved from the
  persisted theme too (light `#f7f8fc` / dark `#0f172a` canvas tokens instead
  of a hardcoded dark `#0d0f14`), so the frame never paints an off-theme
  color before first render. Smoke suite asserts the renderer has no
  background-color transition on `body`.
- **VS Code-style auto-hiding scrollbars.** Scrollbars are now painted by the
  app instead of the OS: a 6 px fully rounded thumb on a transparent track,
  tinted with the `--color-muted` neutral token (60 %, 75 % on direct hover).
  The thumb is transparent at rest, fades in (220 ms, `--ease-premium`) on
  hover or while scrolling, and fades out 600 ms after the last scroll event
  (`html[data-scrolling]` toggled by `lib/overlayScrollbars.ts`, a passive
  capture-phase scroll listener in the shell). Painting the scrollbar
  ourselves makes the behaviour identical on every machine, independent of
  the OS "Automatically hide scroll bars" setting; custom `::-webkit-scrollbar`
  scrollbars are overlay in this Chromium, so no layout space is reserved and
  there is no layout shift. A `scrollbar-width: thin` + `scrollbar-color`
  pair remains as a Firefox-only fallback (Chromium ignores it while the
  webkit pseudos are styled). Smoke suite now asserts the real painting
  behaviour: a 6 px thumb, transparent at rest, visible while scrolling.
- **Custom title bar (desktop).** The window now uses Electron's recommended
  custom title-bar approach (`titleBarStyle: "hidden"` + `titleBarOverlay`):
  the renderer paints a 44 px bar on the app's neutral surface color with a
  subtle bottom border, showing the Budget Planner logo + name on the left;
  the native Windows minimize / maximize-restore / close controls stay overlaid
  on the right with OS hover states. The whole bar is a drag region
  (`-webkit-app-region: drag`), so dragging, double-click maximize and Aero
  snap work natively. The overlay button colors follow the theme live
  (design-token colors sync over a new `window.setTitleBarOverlay` IPC).
  Shell layout realigned: the sidebar sits below the bar (brand block folded
  into it), the mobile header slides under it, toasts drop below it. The
  File/Edit/View/Window/Help menu stays installed (all accelerators keep
  working, menu bar hidden as before).
- **Native menu bar hidden by default.** The main window now launches with
  `autoHideMenuBar: true`: the File/Edit/View/Window/Help bar is hidden at
  startup and pressing **Alt** temporarily reveals it (Windows default
  behaviour). The application menu remains installed, so every keyboard
  shortcut (Ctrl+O import, Ctrl+S export, Ctrl+B backup, …) keeps working.
  The smoke suite now asserts the menu bar is hidden on launch.
- **Insight action links now actually do something.** Every budget-related
  action in the Today's Insight list used `href: "/"` — a no-op when the
  planner is already the current page, so "Review budgets" / "Create a
  budget" / "Add a budget" / "Fund them" appeared dead. They now target the
  same focus modes the over-budget alert uses: review actions navigate to
  `/?focus=over` (BudgetList expands, scrolls to the Budget Allocation
  section and highlights the over-limit rows), and creation actions navigate
  to `/?focus=create` (new mode: expands the disclosure, scrolls into view
  and opens the New budget form). The insights hrefs are covered by tests.

## [0.1.1] — 2026-08-07 Production release

First production release of the **Budget Planner** Windows desktop app
(installer + portable). Includes every section below: the full Electron
desktop migration (dev workflow + secure shell, SQLite persistence, native
desktop features, splash/startup identity/auto-update scaffold), all UI/UX
polish passes, and the release-hardening work:

- **Regression verification** — full pass documented in
  `docs/REGRESSION_REPORT.md` (8 workflows, PASS).
- **UX review** — 2 High / 10 Medium / 10 Low findings documented in
  `docs/UX_REVIEW.md` (High items tracked for the next release).
- **Financial summary consistency audit** — every widget with an X-of-Y,
  percentage, progress bar, or remaining figure verified against one business
  rule; 9 inconsistencies fixed in one pass (unclamped budget-row %, true
  cash-flow expense totals, canonical `received`/`savingsRate` in
  Recommendations, aggregate overage coverage, allocatable-based "Unallocated
  funds", "% of allocatable" labels, top-categories caption, projected
  remaining copy). Budget-allocation funding bar uses `allocatable = received`
  with a never-faked percentage (`BudgetList.funding.test.tsx`).
- **Suite:** 363 tests across 40 files, green with tsc/lint/build.

## [Unreleased] — Desktop migration: startup, identity & updates

### Added

- **Splash screen.** New `electron/splash.cjs`: a frameless, skip-taskbar splash
  window (dark, inline SVG replica of the app icon, app name, `v<version>`,
  animated progress bar — a `data:` URL with no preload, so it can never touch
  app state) shown while the main window boots. It appears after the first
  paint of the main window (`ready-to-show`) closes the splash and shows the
  app; the splash is destroyed on quit. Skipped entirely in smoke mode so the
  smoke run stays deterministic.
- **Loading screen.** New `app/loading.tsx` — the root route renders the
  existing `PageSkeleton` while the Next.js client bundle loads and on route
  transitions, so the static export shows a branded skeleton instead of a
  blank window during first paint.
- **Proper application icon.** `scripts/make-icon.mjs` rewritten: the icon is
  now a designed mark — indigo rounded square with a diagonal brand gradient
  (brand-500 → brand-600 → brand-800), a white coin with a soft brand-700 edge
  shade and a subtle drop shadow, and three ascending bars (growth motif). The
  master is drawn at 512 px with 4×4 supersampled anti-aliasing (SDF-based
  geometry, still pure Node with zero dependencies) and box-downsampled into
  seven PNG-compressed ICO entries (16/24/32/48/64/128/256) plus the 512 px
  PNG. Used by the exe, installer, window icon, and splash.
- **Version information.** New `lib/version.ts` (`APP_NAME`/`APP_VERSION`
  straight from `package.json`) replaces the hard-coded "1.0" in the Settings
  About card, which now shows `Budget Planner v0.1.0` plus the desktop shell
  versions (Electron / Chromium) from `getAppInfo()`. The native About dialog
  (Help menu) now lists app version, Electron/Chromium/Node versions, platform,
  update-feed state, and the data/backup folder paths.
- **Auto-update scaffold.** New `electron/updater.cjs` built on
  `electron-updater`: a generic provider feed configured via the
  `AUTO_UPDATE_URL` environment variable or a plain-text `update-feed.txt` in
  the data folder (env wins). Without a feed it is a no-op — never fires in
  development or in builds without a feed. When configured (packaged app only):
  background check at startup, `Help → Check for updates…` on demand, automatic
  download, install-on-quit, and system notifications for available/ready
  updates and failures.
- **Installer branding.** NSIS now uses `build/icon.ico` for the installer
  and uninstaller icons plus the header icon; `copyright` metadata is set.

### Changed

- `electron/main.cjs` shows the splash before creating the main window (and
  only outside smoke mode), reports the updater state at startup, and the
  `desktop:app-info` payload now includes `versions` (electron/chrome/node).

### Verification

- Gates: `npx tsc --noEmit`, `npm run lint`, `npm run test` (337/337),
  `npm run build`, `npm run db:check` (success + forced-failure paths).
- Smoke green in prod and dev modes (splash/updater both no-ops under
  `--smoke`); packaged-exe smoke green after a full `npm run dist` rebuild.

## [Unreleased] — Desktop migration: native desktop features

### Added

- **Native application menu** (`electron/menu.cjs`) with keyboard shortcuts:
  File (Import `Ctrl+O`, Export `Ctrl+S`, Back up now `Ctrl+B`, Restore latest
  backup `Ctrl+Shift+B`, Open backup folder `Ctrl+Shift+O`, Reveal data folder
  `Ctrl+Shift+D`, Quit `Ctrl+Q`), Edit (standard clipboard roles so copy/paste
  works in inputs), View (reload, devtools, zoom, full screen), Window, and
  Help (About dialog with the data folder paths). Menu items that need renderer
  state (import/export/backup/restore) send `desktop:menu:action` to the
  focused window; folder actions and About run entirely in the main process.
- **Native file dialogs + safe file IPC.** The preload bridge exposes
  `dialog.open/save` (generic, validated options) and restricted
  `fs.writeText/readText` (absolute paths only, `.json`-only writes, 16 MB
  cap). Composite `desktop:import` (open dialog → destructive-action
  confirmation → read) and `desktop:export` (save dialog → atomic write) power
  the Import/Export buttons and the menu items. Browser mode keeps its
  download/file-input behaviour unchanged.
- **Desktop notifications.** `desktop:notify` (`Notification.isSupported()`
  guarded; AUMID already set). Used for backup failures and restore results;
  available to the renderer for future alerts.
- **Automatic file backups.** New `electron/backups.cjs`: atomic writes
  (temp + rename), content dedupe (unchanged payloads are skipped), and
  pruning to the newest 30 files in `<userData>/backups/`. Renderer-driven
  schedule (`lib/desktopBootstrap.ts` + `startAutoBackups`): once at boot after
  hydration, every 30 minutes, and a final flush on `beforeunload` (the create
  channel is synchronous, like the storage seam). Failures surface as a toast
  and a desktop notification.
- **Restore backup workflow.** File backups appear in Settings → Data →
  BackupsManager as "Backup files" (list, restore with confirmation, download
  via save dialog, delete). "Restore latest backup" (`Ctrl+Shift+B`) reads the
  newest file in the main process, confirms natively, and restores through the
  existing `importState` path. Export files and file backups share the same
  `{ state, version }` envelope, so both restore through the validated import
  flow.
- **Open Backup Folder / Reveal Data Folder.** `shell.openPath` /
  `shell.showItemInFolder` via IPC; buttons in Settings (Data + BackupsManager)
  and the File menu. The About card and Data card show the real folder paths.

### Changed

- `electron/main.cjs` registers the desktop feature handlers and installs the
  application menu at startup; the smoke test now asserts the menu groups and
  accelerators, the full bridge surface, and a create/list/read/delete backup
  roundtrip against the real backups folder (cleaned up after).

### Verification

- Smoke green in dev and prod modes: menu groups `File/Edit/View/Window/Help`,
  bridge surface (dialog, fs, shell, notify, paths, backups, menu), backup
  roundtrip.
- Gates: `npx tsc --noEmit`, `npm run lint`, `npm run test` (337/337, +7
  `electron/backups.test.ts` cases), `npm run build`.

## [Unreleased] — Desktop migration: SQLite persistence

### Changed

- **Browser persistence replaced inside the desktop shell.** `better-sqlite3` now owns
  the data in the Electron app; the browser mode keeps `localStorage` and every existing
  behaviour is preserved.
  - `electron/db.cjs`: the only SQLite access, in the **main process** — the renderer
    never touches the database. A `kv(key, value)` table (WAL,
    `synchronous=NORMAL`, `user_version = 1`) at
    `<userData>/budget-planner.sqlite3`. `better-sqlite3@13` is a runtime dependency;
    electron-builder rebuilds it for the Electron ABI and unpacks it from the asar.
  - **IPC storage seam.** The preload exposes a synchronous `storage` bridge
    (`desktop:storage:get/set/remove/keys/needs-migration/migrate` via
    `ipcRenderer.sendSync`; inputs validated main-side). `lib/desktop.ts` types the
    bridge; `lib/storageAdapter.ts` is the single persistence seam for the whole app —
    bridge in Electron, `localStorage` in a browser, no-op outside the browser. All
    call sites migrated: zustand persist, `lib/storage.ts` (state, backups, snapshots,
    export/scan), categorization mappings, the theme bootstrap (bridge first,
    localStorage fallback), disclosure state, and icon favourites/recents. A failed
    bridge write throws, mirroring browser quota exceptions.
  - **First-launch migration.** When the database is empty, the preload ships the page
    origin's localStorage to the main process, which writes a full backup row
    (`budget-planner:backup:migration-browser:*` — same envelope as app backups, so it
    is restorable from `BackupsManager`) **before** the migrated rows and the
    `migration:browser:done` marker, all in one transaction. Idempotent (marker +
    non-empty-db guard).
  - **Migration failure handling.** The whole migration (including the marker and
    backup checks) returns a structured error instead of throwing across IPC. A failure
    rolls the transaction back, so nothing is written, the browser data is never touched
    and the marker is absent — the app retries automatically on the next launch. The
    main process notifies the user with a native error dialog (skipped in smoke mode)
    and both processes log the failure. `npm run db:check` now exercises both the
    success path (backup + marker + rows) and a forced-failure path (error returned, 0
    rows left, retry-ready).
  - Top-level `productName: "Budget Planner"` so the desktop app owns its userData
    profile (now `Roaming\Budget Planner`).
- **Toolchain.** `better-sqlite3` needs a native rebuild for Electron; `postinstall` is
  `electron-builder install-app-deps` (keeps the module matched to Electron after any
  `npm install`). New `npm run db:check` (`electron/scripts/dbcheck.cjs`, project-local)
  verifies the native module loads and can dump a real database read-only.
  `npm run electron:rebuild` re-runs the rebuild manually.

### Verification

- Smoke test now asserts a full SQLite roundtrip through the bridge (`set`/`get`/
  `remove`) and that the database file exists under `userData` — green in dev mode,
  prod mode, and the packaged exe.
- Migration verified on a real profile: 10 browser keys migrated with the backup row and
  marker; second launch unchanged (no double migration).
- Gates: `npx tsc --noEmit`, `npm run lint`, `npm run test` (330/330, +6
  `storageAdapter` cases), `npm run build`. `npm run dist` produces
  `BudgetPlanner-Setup-0.1.0.exe` + `BudgetPlanner-Portable-0.1.0.exe`.

## [Unreleased] — Desktop migration: dev workflow + secure shell

### Added

- **Dev workflow.** `npm run dev` now launches the Next.js dev server **and** Electron
  together (`concurrently` + `wait-on`; parts `dev:web` / `dev:electron`). Electron
  `--dev` mode loads the dev server (`ELECTRON_DEV_URL`, default
  `http://localhost:3000`) with a retry loop until it answers (60s cap), and skips the
  `out/` bundle check that only applies to production. `--dev --smoke` runs the full
  smoke suite against the dev server.
- **Secure preload + IPC seam.** New `electron/preload.cjs`, run sandboxed
  (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no remote
  module). It exposes a feature-less `window.budgetPlannerDesktop` bridge
  (`platform` + `getAppInfo()`) backed by `ipcMain.handle("desktop:app-info")`
  (name/version/platform/isPackaged). No desktop features yet — this is the future IPC
  seam, and the smoke test now asserts the bridge is exposed and answers.
- **Scripts.** `npm run electron` (launch packaged/source prod build),
  `npm run dev`, `npm run build` (static export), `npm run dist` (electron-builder
  Windows installer + portable), `npm run icon` (regenerate the app icon);
  `desktop:package` is now `build` + `dist`.
- **Application icon.** `scripts/make-icon.mjs` is a dependency-free PNG/ICO encoder
  (Node zlib + manual chunk framing) that draws the placeholder brand mark — indigo
  rounded square with a white coin and brand ring (brand-600/700) — into
  `build/icon.ico` (256px PNG-compressed entry) and `build/icon.png`. Replaces the
  default Electron icon in the executable and installer; regenerate with `npm run icon`
  or swap `draw()` for real artwork.
- **Assisted installer.** NSIS `oneClick: false`: install-directory choice, desktop +
  start-menu shortcuts, and standard uninstall support (Add/Remove Programs entry).

### Verification

- Gates green: `npx tsc --noEmit`, `npm run lint`, `npm run test` (324/324), `npm run build`.
- Smoke green in both modes: `electron . --dev --smoke` (loads `http://localhost:3000`,
  navigates, bridge answered) and the packaged `Budget Planner.exe --smoke`
  (`app://bundle`).
- `npm run dist` → `dist/BudgetPlanner-Setup-0.1.0.exe` + `BudgetPlanner-Portable-0.1.0.exe`
  with the icon applied.

## [Unreleased] — Electron desktop app

### Added

- **Desktop packaging (Electron).** The app now ships as a Windows desktop app with
  zero app-code changes: `next.config.ts` sets `output: "export"` (all 6 routes
  prerender to `out/`), and `electron/main.cjs` serves the static export over a
  privileged `app://bundle` protocol (registered `standard/secure/supportFetchAPI/
  stream`, so localStorage, client-side routing, and `createId()` work unchanged).
  The protocol handler falls back to the app shell (`index.html`) for extensionless
  client routes, maps Next 16's `__next.<route>.__PAGE__.txt` prefetch requests onto
  the exported RSC payload files (otherwise the router 404s on hover prefetches),
  and guards path traversal via `path.resolve` + prefix check. Window: 1280×800
  (min 375×600), `contextIsolation` + `sandbox` on, popups denied, macOS `activate`
  handled, missing-bundle dialog.
- **Smoke test.** `--smoke` mode (also `npm run desktop:smoke`) boots the app, clicks
  the `/history` nav link (retrying until hydration/routing converges — pre-hydration
  clicks fall back to a full page load), and asserts the Timeline title, body content,
  and zero renderer console errors. Passes from the source tree and from the packaged
  exe. The `console-message` listener uses Electron 43's event-object API.
- **Packaging scripts + electron-builder config.** `start: electron .`,
  `desktop:package` (`next build` then `electron-builder --win`) → NSIS installer
  `dist/BudgetPlanner-Setup-0.1.0.exe` + portable `dist/BudgetPlanner-Portable-0.1.0.exe`
  (appId `com.budgetplanner.desktop`, productName "Budget Planner"). `electron@43.3.0`
  and `electron-builder@26.15.3` added to devDependencies; `electron/` is
  eslint-ignored and git-tracked; `out/` and `dist/` are gitignored.
- Known gaps: default Electron icon (no brand icon yet); executables are unsigned.

### Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test` (324/324), `npm run build`, smoke
  test from source, and smoke test of the packaged exe all pass.

## [Unreleased] — Production readiness audit

### Refactors (behavior-preserving)

- **Schema version constant reconciled.** `CURRENT_STORAGE_VERSION` in
  `lib/storage.ts` was `2` while the app store, seed state, and `validateAppState`
  all emit schema `3`. It is now `3`: legacy v2 payloads are snapshotted before
  migration (the corrupt-v2 snapshot test documents the new two-snapshot flow:
  `auto-v2` + `auto-corrupt`).
- **One ID generator.** New `lib/ids.ts` `createId()` (crypto.randomUUID with a
  non-secure-context fallback) replaces 8 raw `crypto.randomUUID()` call sites
  (store ×6, toast store, seed) and the duplicated fallback inside
  `lib/validate.ts` migrations. This removes the only code path that would
  crash entity creation in non-secure contexts (e.g. a packaged desktop shell).
- **One day-diff implementation.** `daysBetween` in `lib/date.ts` replaces the
  three `DAY_MS = 86_400_000` constants and the three nearly identical
  midnight-diff helpers in `lib/timeline.ts`, `lib/upcoming.ts`, and
  `lib/insights.ts`.
- **Toast timing owned by the store.** The duplicate 3s auto-dismiss `setTimeout`
  inside `components/ui/Toast.tsx` is removed; `useToastStore`'s timer is the
  single source of dismissal.
- **Storage-write guards.** `localStorage.setItem` in the zustand persist
  `setItem`, `saveAppState`, and all backup snapshot writers now swallow
  quota/security exceptions instead of crashing the boot path (previously a
  failing snapshot write masked the real `CorruptedStateError`).
- **Dead code removed:** `loadAppState`, `removeAppState` (storage),
  `readStoredTheme` (theme), `currencySymbol` (money), unused components
  `KpiStrip`, `Badge`, `Spinner`, and the five starter SVGs in `public/`.
- **Magic numbers replaced:** `MINOR_UNITS_PER_UNIT` (money) used by
  `toMinorUnits` and the CSV export; `MAX_NOTE_LENGTH`/`MAX_TITLE_LENGTH`/
  `MAX_CATEGORY_NAME` now back the input `maxLength` attributes; the shared
  `CATEGORIZATION_KEY` import replaces the duplicated constant in
  `lib/categorize.ts`; the `over120` deep-over-budget predicate is a shared
  `isDeeplyOverBudget` selector used by insights and todo; `parseMonth` hoisted
  out of a render loop in `ReportsView`.
- **API cleanup:** `toMinorUnits` drops its never-used `_currency` parameter
  (31 call sites); `RecoveryPanel` defers `URL.revokeObjectURL` so downloads
  always fire.

### Tests

- `currencySymbol` spec removed with the dead export. Storage corrupt-snapshot
  spec updated for the v2-legacy + corrupt double snapshot. Tests 325 → 324;
  tsc/lint/build green.

## [Unreleased] — Responsive QA pass

### Bug fixes
- **Month picker overflowed the page at 320px.** The label forced a 128px
  minimum and the "This month" shortcut appeared alongside, so the control
  measured ~297px inside a 272px content column when viewing any past or
  future month (Hero, Reports header, Timeline filters). The label can now
  shrink (`min-w-0 truncate`) and the "This month" shortcut is hidden below
  the `sm` breakpoint — the chevrons still navigate there.
- **Reports header action row overflowed at 320px.** The MonthPicker +
  Export cluster was a non-wrapping flex row (~320px) in a 272px column; it
  now wraps, so Export drops to its own line on narrow phones.
- **The last upcoming expense's menu was invisible.** The Upcoming list
  container used `overflow-hidden` for its rounded corners, so the row menu
  (`absolute top-full`) of the last item rendered entirely outside the clip
  region. The container no longer clips; the first group header takes the
  top rounding instead (`rounded-t-2xl`).
- **Category edit/delete buttons were invisible on touch devices.** The
  category rows revealed their actions with `opacity-0 group-hover:opacity-100`
  at every breakpoint — phones (no hover) could never see them. The reveal
  is now `sm:`-gated and includes `group-focus-within`, matching the
  recurring-rules rows.
- **Income source rows were unusable at 320px.** Inside the income modal
  (240px content at 320px viewport) the fixed 144px icon picker + icon +
  trash button left the name input ~0px wide and clipped the trash button.
  The row wraps: the name keeps a 144px minimum, and the icon picker drops
  to a full-width row below on small screens (`w-full sm:w-36`).
- **Needs-funding stats collided at 320px.** The Allocated/Needed/Missing
  trio was a 3-column grid at every width; ~74px tracks couldn't hold
  labels + unbreakable money values. It now stacks one-per-row below `sm`.
- **Over-budget pills ignored their truncate.** The pill's `truncate` span
  could never shrink (flex `min-width:auto`), so long category names spilled
  past the alert card's edge. Pills cap at `max-w-full` and the name
  truncates (`min-w-0`).

### Tests
- No new tests (responsive layout only); suite stays 325.

## [Unreleased] — Settings QA pass

### Bug fixes
- **Importing a non-JSON file crashed the app.** The import confirmation ran
  `JSON.parse(pendingImport)` outside any try/catch, so picking a corrupt or
  plain-text `.json` file threw a SyntaxError that took down the whole page.
  Parsing moved inside `importState`'s existing try/catch: `importState` now
  accepts a JSON string OR a parsed object and reports a clean error message
  either way.
- **Deleting a category used by transactions silently "succeeded".** The store
  blocks the delete (`in-use-transactions`) but `CategoryManager` didn't handle
  that reason, so the dialog closed with a "Category deleted." toast while the
  category stayed. The reason is now handled with an error toast, matching the
  budgets/upcoming/rules branches.
- **Clearing the icon picker then saving a category corrupted persisted state.**
  A category with an empty icon passes the old save paths, but
  `validateAppState` rejects empty category icons — the next page load threw
  "Saved data is corrupted" and the app was unusable (data effectively lost).
  Category add/edit now require an icon (with inline + toast errors), and the
  store rejects empty icons/names/bad colors at the action level.
- **Category validation hardening (store + UI):** `addCategory`,
  `renameCategory`, and `updateCategory` now validate (trimmed non-empty name,
  `MAX_CATEGORY_NAME = 30` chars, non-empty icon, hex color) and reject
  case-insensitive duplicate names; all three return a boolean. Add-form and
  edit-modal inputs cap at 30 characters with precise error messages
  (duplicate → "A category named "X" already exists", icon → "…icon is
  required"). `validateAppState` deliberately stays lenient on name length so
  previously created long names never brick the store on load.
- **Category row edit/delete icon buttons had no accessible names** — now
  labeled "Edit {name}" / "Delete {name}".

### Tests
- New `CategoryManager.test.tsx` (4 cases: in-use delete shows an error toast
  and keeps the category, duplicate add rejected, cleared-icon add rejected,
  filter input keeps DOM identity while typing) and 2 new
  `CategoryEditModal.test.tsx` cases (cleared icon, rename to existing name).
  9 new store cases (empty icon / bad color / duplicate / over-length / trim +
  rename-guard, updateCategory icon+duplicate guards, string import invalid +
  valid round-trip). Suite 310→325; gates green.

## [Unreleased] — Timeline QA pass

### Bug fixes
- **Sticky filter bar broke the sticky table header.** The timeline's pinned filter bar sat
  above a pinned table header with a fixed offset (`lg:top-[4.75rem]` = 76px) that never
  matched the bar's real height (69px on one row, ~125px when the filters wrapped on
  narrower desktops) — scrolling left a 7px gap of content between the two, or tucked the
  header under the bar entirely. On mobile the header pinned at `top-0`, hiding it behind
  the opaque app header and the wrapped filter bar (~180px tall on phones). The filter row
  is no longer sticky (matches the rest of the app — no other page pins a toolbar), and the
  table header uses the planner's proven pattern (`sticky top-16 lg:top-0`): flush with the
  app header on mobile, flush with the viewport on desktop, no overlaps, no gaps.
- **Long unbroken notes could widen the table past the panel** on desktop (the wrapper only
  scrolls horizontally on mobile). The note cell now wraps mid-word (`break-words`), so a
  200-character note (the form's max) can never push the table off the card.

### Tests
- New `TransactionList.test.tsx` cases: the filter bar stays in flow (no `sticky` class)
  and every header cell pins via `sticky top-16 lg:top-0`; long unbroken notes get
  `break-words`. Suite 308→310; gates green.

## [Unreleased] — Reports QA pass

### Bug fixes
- **Income trend "Received" ignored the ledger.** `incomeTrendSeries` summed plan
  `receivedAmount` only, so months funded purely by income transactions (no income plan)
  plotted $0 received while the Income vs expenses chart and the snapshot showed the real
  income. The series now uses `receivedForMonth` — ledger income floor, plans canonical,
  max avoids double counting — the same single source every other income number uses.
- **Budget utilization bars overflowed the 100% axis.** Utilization above 100% rendered a
  bar taller than the plot area (Y domain is `[0, 100]`). The bar geometry is now clamped at
  100% (`barPct`) while the tooltip and aria-label keep the true percentage (e.g. 150%).
  The percentage itself moved into `budgetUtilizationSeries` so chart, tooltip and label
  share one calculation.
- **"Expenses vs last month" showed the NET delta.** The snapshot's Expenses caption used
  `monthStats.vsLastMonth.delta`, which is `net − lastNet`. If income changed too, the
  caption misattributed a net swing to expenses. ReportsView now computes the true expense
  delta (`totals(month).expenses − totals(lastMonth).expenses`).
- **CSV export wrote raw minor-unit integers.** A $1,250.00 transaction exported as
  `125000`. The Amount column now exports the currency amount (`1250.00`) and a Currency
  column was added.
- **Misleading empty-state copy** on Expected vs actual / Income sources promised
  "record income" would populate them; income sources come from income plans. Copy now
  directs users to plan sources on the Planner.

### Tests
- New `incomeTrendSeries` cases (ledger floor, plan canonical, max avoids double counting,
  ledger-only months), a `budgetUtilizationSeries` over-100% case, and 2
  `BudgetUtilizationChart` cases (true % in aria-label, empty state). Suite 303→308; gates
  green.

## [Unreleased] — Planner QA pass

### Bug fixes
- Allocation sliders were unusable when the remaining balance was below one whole unit
  (e.g. $0.50): the range input used `step={100}` while `max` was smaller, so zero was the
  only selectable value. The step now adapts to the balance — `step = min(100, remaining)` —
  keeping sub-whole-unit balances fully allocatable (50¢ increments for a 50¢ balance,
  $1 steps otherwise).

### Tests
- New `AllocationPanel.test.tsx` (6 cases): hidden without budgets, nothing-to-allocate
  message, sub-unit slider usability, whole-unit step for normal balances, apply raises the
  budget limit, combined allocations clamp to the remaining balance. Suite 297→303; gates
  green.

## [Unreleased] — Final UI consistency polish

### Design
- Single surface radius: `Card`/`Disclosure` quiet and brand variants drop `rounded-2xl` for
  the same `rounded-xl` used everywhere else — every card surface now shares one radius.
- One caption scale: every stray `text-[11px]` becomes `text-xs` (SummaryCard hints and the
  "Edit" pill, Month-at-a-glance labels, AllocationPanel "% of pool" pills, Backup snapshot
  badges, bottom-nav labels, Reports snapshot/prediction captions).
- One motion timing: `Disclosure` chevron and height animations move from `duration-[220ms]`
  to the app-standard `duration-200`.
- Income trend chart's empty state now uses the shared `EmptyState` illustration treatment
  (all six report charts are now consistent).
- Missing category colors fall back to the shared palette (`categoryColor()`) instead of an
  off-palette raw `#6b7280` in the allocation panel and recurring-rule rows.
- Timeline income rows: the placeholder slot is `w-10` so Edit/Delete align pixel-perfectly
  with expense rows (three `sm` buttons ≈ two buttons + placeholder).
- Theme-toggle icons sized via `h-4 w-4` classes instead of hard-coded 16px SVG attributes.
- Income modal inputs grow to the app-wide `h-11` control height.
- Page skeleton blocks use `rounded-xl` so the loading preview mirrors real cards.

### Code refactors
- `TransactionRow.test.tsx` placeholder-width assertion updated (`w-11`→`w-10`); suite stays
  at 297 tests, gates green.

## [Unreleased] — Reports anti-busy pass

### Design
- Chart cards switch to the calm quiet treatment (canvas wash, hairline border, no shadow)
  so charts stop competing with each other; only the Financial snapshot tiles stay raised,
  on a softened app-wide `--shadow-card`.
- Breathing room: page gap `gap-6`→`gap-8`; every section is a `flex flex-col gap-6`
  layer; chart grids `gap-4`→`gap-6` (snapshot `gap-5`).
- Section titles are larger (`SectionHeading` `text-xs`→`text-sm`).
- Every chart carries a concise subtitle — "Last 6 months" for window charts (Income vs
  expenses, Income trend, Monthly spending trend, Savings, Budget utilization, Top
  categories), "This month" for month-scoped ones (Expected vs actual, Income sources), and
  "By category" for the Spending-this-month card.

### Code refactors
- `ChartCard` renders with the quiet `Card` variant; `ReportsInsights` quietened to match.
- New shared `categoryColor()` + `CATEGORY_COLOR_FALLBACK` in `lib/accents.ts`, used by
  Planner `ExpenseBreakdown` and Reports `TopCategoriesChart`, so every category-colored
  chart matches the Planner palette.

## [Unreleased] — Timeline polish

### Design
- Rows light up with a stronger `hover:bg-canvas` fill and date groups gain breathing room
  via an 8px spacer row between them.
- The **Today** group is highlighted with a subtle brand accent: a tinted header band, a
  colored label and a small brand dot.
- Running group totals (Today ₦…, Last week ₦…) are now prominent — `text-sm font-bold`
  ink amounts (brand-colored for Today).
- Row action icon buttons were reduced to the compact `sm` size; income rows render an
  invisible fixed-width placeholder in the "Move to next month" slot so Edit and Delete stay
  perfectly aligned across every row.

### Code refactors
- `TransactionRow` row actions switch to `size="sm"`; `TransactionList` group headers get
  the Today accent, prominent totals and inter-group spacer rows.

## [Unreleased] — Expense breakdown v2

### Design
- Percentage now sits in a cleaner right-aligned column beside each progress bar (amount on
  top, percentage underneath, tabular numerals); the longest bar is capped at 80% of the track
  while shorter bars keep the same proportions.
- Hovering a row reveals a tooltip with Category, Amount, Percentage, Budget limit (or "Not
  budgeted") and Spent — categories with a budget show a "X of Y" readout that turns red when
  over budget.
- More than five categories collapse to five behind a "Show N more categories" button
  (replacing the plain-text "N more categories when expanded" footer); clicking it reveals the
  rest with an animated entrance. In the Planner's collapsed preview the button expands the
  panel.

### Code refactors
- `BarChart` gains optional `budget` / `spent` / `overBudget` item fields, a capped 80% bar
  width, per-row hover tooltips and an `animateFrom` prop for animated row entrances;
  `ExpenseBreakdown` owns the collapse-after-five state and an optional `onExpand` hook.

## [Unreleased] — Refinement pass · income planning & insight reports

### Income by source
- Income is now planned per category instead of a single monthly figure: each income category (Salary, Business, Freelancing, Forex, Bonus, Rental Income) tracks Expected, Received, and Difference.
- New `Expected income` modal on the planner lists every income source with its received amount and a live "+X to collect / −X over received" delta; per-source expected inputs validate amounts, prefill saved values, and clear on empty save.
- Planner income card shows expected income with a received/difference hint; the Net summary modal now breaks out Received income, Expected income, Difference, Expenses, and Net.
- State schema advanced to version 2 with an `incomePlans` collection; version 1 states migrate automatically — the old tagged monthly-income transaction converts into an income plan, and missing standard income categories are backfilled.

### Reports as an insight page
- Reports rebuilt into a structured dashboard: Financial snapshot (Net / Income / Expenses / Savings rate), Income (expected vs actual, income sources, income trend), Spending & savings (income vs expenses, spending trend, savings, top categories), Budget health, Insights, Predictions, and Spending this month.
- New charts: Expected vs actual (grouped bars), Income sources (horizontal ranked bars with category colors), and Income trend (expected dashed vs received line over six months).
- Predictions card (current month): day count, average daily spend, projected month-end spending, and projected savings, all pace-based.
- Trends card: biggest spending increase/decrease between months, savings movement, highest-cost category, and over-budget alerts.
- Export menu with PDF (via print dialog), CSV (downloads the six-month window), and Print; print CSS hides nav/headers and keeps cards intact on paper.
- Charts fall back to informative placeholders when there isn't enough history; a banner calls out when fewer than two months of data exist.

### Upcoming expenses
- Bug fix: editing an upcoming expense now preloads every field and updates the existing expense instead of opening a blank form (and the old flow could create duplicates).
- Per-row overflow menu: Mark as paid (creates the expense transaction on its due date, marks it paid, and updates the planner), Reschedule (new due date), Skip month / Postpone (moves to next month), Edit, and Delete with confirmation.
- Empty state now explains the flow and links to planning.

### Allocation drawer
- "Allocate remaining" opens in a new right-side Drawer (max 420px, full-width on mobile, internally scrollable) instead of a modal; backdrop click and Escape both close it, with focus trapped inside while open.
- Allocation cards show icon tile, current allocation, spent, and remaining, an animated slider with a "Projected limit" readout after moving, the available pool, and Clear / Reset / Apply actions.

### Polish
- Planner header simplified to "August 2026 Budget", the current weekday/date, and one projected month-end balance line.
- Better empty states across Recurring, Upcoming, Reports, History, and Budgets.
- Shell chrome (sidebar, header, bottom nav) excluded from print output.

### Code refactors
- `Drawer` component added; `Card`/`Disclosure` variants (`quiet`, `brand`) from the earlier pass now used consistently; new icons: CalendarClock, Forward, Print, Download, FileText, TrendDown.
- New libs: `lib/predictions.ts` (monthly pace projections) and `lib/reportTrends.ts` (trend deltas, highest category, history depth); selectors gain income-plan breakdowns and income trend series.
- `MonthlyIncomeModal` replaced by `IncomeModal`; `setMonthlyIncome` replaced by `setIncomePlan` in the store; deleting an income category used by plans is guarded.

## [Unreleased] — Settings · consumer polish

### Design
- Settings page rebuilt as a scannable dashboard: a sticky, chip-style anchor nav (General / Appearance / Budget / Categories / Recurring / Data / About) scrolls along under the mobile header, and every section is reachable by hash link with proper scroll offsets.
- Theme selector upgraded to a card-style radio group: each option (Light / Dark / System) is a selectable card with an icon tile, label, and circular check indicator; the compact pill toggle remains for the header and sidebar.
- Category manager refined: income/expense groups collapse independently (state persists per device), instant search filters across categories, rows carry icon tiles tinted with the category color, premium income/expense pills, usage subtitles ("N transactions · N budgets" or "Unused"), and a hover-only overflow menu (Edit / Delete) that dismisses on outside click or Escape. Deleting is still guarded for in-use categories.
- Recurring transactions list polished: category color chips, frequency + start-date meta, a proper empty state with a "Create a rule" CTA, and Edit / Delete actions that appear on hover; the auto-generate setting is now a real accessible switch.
- Budget, Data, and About sections recede as quiet panels; About gains a brand tile with a local-storage note, and General / Appearance sit side by side on desktop.

### UX
- Rule rows expose the same premium affordances as categories: inline icons for Edit and Delete, tabular numerals for amounts, and a confirm dialog before deleting a rule.
- Reset flow unchanged but now reachable from the Data section with its own quiet panel and typed RESET confirmation.

### Motion
- Category overflow menus animate in with a new `menu-in` keyframe (fade + rise + settle) on the premium easing.

### Code refactors
- `ThemeToggle` gains a `variant` prop (`compact` | `cards`); `Card` gains an `id` prop for anchor navigation; `MoreHorizontalIcon` added to the icon set.
- `CategoryManager` fully rewritten: inline edit/add forms (icon, color, name, kind), instant search, collapse persistence, and menu state scoped per open menu.

## [Unreleased] — Presentation pass · de-templating

### Design
- Planner KPI row rebuilt from a uniform 4-card grid into an asymmetric editorial composition: a dominant "Remaining" hero card (2×2 on desktop) with a brand gradient wash, larger 4xl value, and a live "committed of allocatable" funding bar; Income and Expenses shrink to compact cards; Net anchors the bottom-right as a wide card.
- Reports KPI strip de-striped: Income and Expenses are two compact cards, and Net becomes a wide hero bar with the Savings rate inline behind a hairline divider.
- Settings no longer reads as four identical stacked cards: General is a quiet panel (hairline + canvas tint) with a two-column currency/theme split, Categories and Recurring sit side by side (3/5 + 2/5), and Data is a quiet panel at the bottom. A duplicate leftover General card was removed.
- Upcoming page: the repeated per-group cards merged into one continuous list with in-band group headers showing each group's total; "Paid" recedes into a quiet inset panel with strikethrough rows, read as an archive.
- Planner section rhythm differentiated: Budgets is the anchor panel (brand-tinted border, larger radius), Expense breakdown recedes to a quiet hairline panel, the rest stay standard — strong / standard / quiet hierarchy instead of identical chrome everywhere.
- Insight rows are now tone-tinted (danger/warn/success/neutral washes) so urgency is legible at a glance.

### Code refactors
- `Disclosure` and `SummaryCard` gain a `className` escape hatch so section chrome can vary per role.

## [Unreleased] — 1.0 product polish sprint

### Design
- Header cleanup: the greeting, floating month-picker row, and "Edit income" button are gone; the header is now the month name + year in 3xl/4xl, one status line ("₦21,000 remaining this month" / "short this month" / "Set your monthly income…"), and the month picker right-aligned.
- Dark mode overhaul: new dark palette (`ink #e3e6ec`, `muted #8f97a3`, `surface #17191e`, `canvas #0e1013`, `border #262b33`, income/expense softened to `#3fa98a` / `#e0778a`), dark shadows rebuilt with an inset top highlight for a premium "lit edge", and `--color-overlay` now defined in dark. Hardcoded red/amber over-budget row tints replaced with semantic `bg-danger/10` / `bg-warn/10`.
- Premium sliders: new `slider-premium` styling (thin 8px track, gradient fill driven by a `--slider-fill` custom property, branded thumb that scales and rings on hover/focus).
- Allocate remaining rebuilt as per-category cards: icon chip, current limit, live amount readout, filled slider, "% of remaining" + Clear affordance, and a "left to allocate / unallocated" footer that updates as you drag.
- Theme selector buttons gained custom hover tooltips (CSS-only, `role="tooltip"`, on hover and keyboard focus).
- Settings regrouped as General → Categories → Recurring transactions → Data; categories now live in a dedicated CategoryManager that shows per-category usage counts ("3 transactions · 2 budgets") and disables Delete for in-use categories.

### UX
- Intelligent recommendations: new insights — "Budget almost exhausted" (≥80% spent), "Spending is up this month" (category vs last month), "recurring bills due this week", "N categories need funding" (≥3), and "No issues detected this month" when everything is steady; the old "Next month starts on a Friday" filler is gone.
- Needs funding: rows are urgency-sorted and badged (Critical ≤3 days / Due soon ≤14 days / Low priority) with an attention-only preview showing just Critical + Due soon plus a "View all N categories" button.
- Expense breakdown: single consistent scale — the biggest category always renders full-width, hidden categories don't distort the chart; a footer totals "N more categories when expanded" plus the real Total, and empty states now carry a helpful tip.
- Timeline: the filter bar (month, type, category, sort, search, New record) is sticky under the header; on mobile, row actions collapse behind an expanding chevron row (Edit / Move / Delete).
- Reports: KPI strip is exactly Income / Expenses / Net / Savings rate; "Things to know" now includes recurring-due warnings; reports page reads as a proper dashboard.
- Upcoming: groups are now Overdue / Today / Tomorrow / This week / Next week / Later — weekday names merged into "This week" (grouping lib + tests updated).
- Empty states: Budget list gets a "Create a budget" CTA, timeline gets illustration + contextual CTA (Clear filters / New record), all states consistently use the 64px illustration tiles.
- Duplicate loan/debt accent removed from `lib/accents.ts`.

### Motion
- Button transitions consolidated onto one `transition-all` base so shadow, border, color, opacity and the press scale animate with the premium curve.

## [Unreleased] — Progressive disclosure pass

### Design
- Planner re-architected around progressive disclosure: the page opens with the header, summary cards, recommendations, and a Needs funding summary; everything else — Month at a glance, Budgets, Quick add, Deferred expenses, and Expense breakdown — collapses behind accessible headers that expand on click.
- Collapsed previews surface the essentials: Month at a glance shows Largest expense / Savings rate / Projected remaining; Expense breakdown shows the top 5 categories; Needs funding lists the first 3 categories with a "View all" button; Recommendations collapses to the top insight; the timeline previews the most recent 5 records; upcoming previews the next 3 expenses.
- Section headers are now interactive rows: title + chevron on the left, contextual action on the right ("New budget", "View in Timeline"); panel chrome (surface + shadow) preserved so cards still read as cards.

### Motion
- Every panel animates height + content fade in 220ms with the premium easing; chevrons rotate with the same curve; all motion collapses under `prefers-reduced-motion`.

### Accessibility
- Disclosure headers are real buttons with `aria-expanded` / `aria-controls`; content regions expose `role="region"` with a labelled name; keyboard-only users get the same expand/collapse flow, and the budgets panel auto-expands when arriving via the over-budget alert's "Review" link (`?focus=over`).

### Code refactors
- New `components/ui/Disclosure.tsx`: hydration-safe, SSR-friendly open state synced through `useSyncExternalStore`, per-panel + per-month localStorage persistence (`disclosure:<id>`), optional collapsed preview and right-side action slots, imperative `expand()` handle.
- `InsightList` gains a `limit` prop; `MonthlyStats` and `ExpenseBreakdown` gain `bare`/preview variants; `NeedsFundingSection` gains truncation (`limit` + `onExpand`); BudgetList's native `<details>` accordion replaced with the shared Disclosure.

## [Unreleased] — Premium craft pass · header, color & motion

### Design
- Brand palette remapped from sky-blue to a Linear-inspired violet-indigo family (`--color-brand-500: #5e6ad2`); every surface, focus ring, active state and chart follows via tokens, so the whole app reads calmer and less blue. Category and semantic colors (positive/warning/danger/information) untouched.
- Structured hero header replaces the floating layout: greeting eyebrow ("Good morning, Archer"), dominant `{Month} Budget` title (3xl → 4xl), large tabular amount with a "remaining / short this month" caption, and the month selector integrated into the header block with aligned breathing room.
- One primary action per header: subtle "Edit income" ghost when income is set, a primary "Set income" button when it isn't.
- KPI cards refined: 40px rounded icon tiles with larger glyphs, dominant 28px values, smaller 11px subtitles, per-card colored border on hover (income/expense/brand), soft hover lift and deeper shadow with premium easing; arrow still fades in on hover/focus.
- Page rhythm opened up: planner sections now breathe at `gap-10`; the floating month picker row is gone.

### UX
- Microcopy humanized: Deferred empty state now reads "Nothing has been pushed into this month" with "Moved into this month:" totals; reports empties rewritten ("Set budgets on the Planner and you'll see how each one holds up.").

### Motion
- New `--ease-premium` token (`cubic-bezier(0.22, 1, 0.36, 1)`) applied across buttons, cards, month picker, theme toggle, body theme switch, and every 150–220ms entry animation (dialogs, toasts, list-in, page-in).

### Accessibility
- All new interactions keep focus-visible rings and `motion-reduce` guards; reduced-motion media query still collapses every animation.

### Code refactors
- `Button` gains a `size` prop (`sm` | `md`), replacing fragile `min-h-*` className overrides that Tailwind's CSS ordering silently defeated; four call sites migrated (Hero, BudgetSuggestions, FutureExpenseForm).
- `useChartColors` SSR fallback synced to the new brand value (runtime colors already read `--color-brand-500`).

## [Unreleased] — UI polish pass

### Design
- Category accent remap with richer palette: Transport → yellow, Housing → blue, Utilities → amber, Health → red, Shopping → orange, Entertainment → purple, Food → green; new **Subscriptions** (cyan) and **Loan** (violet) groups; extended keyword matching (parking, real estate, bill, dentist, amazon, netflix, spotify, prime, disney, apple, software, cloud, loan, debt, interest, borrow, credit card, installment); loan group matches before transport so "credit card" stays violet.
- Editorial typography layer: new `SectionHeading` micro-label (`text-xs` uppercase, `0.12em` tracking) used across Today's Recommendations, Needs Funding, and Reports "Things to know"; planner hero redesigned with greeting eyebrow, tense-aware headline ("You're spending ahead of your income." / "Here's {month} budget."), and a large tabular amount.
- Card fatigue reduced: Today's Recommendations and Needs Funding are now borderless sections; budget-over-limit suggestions moved into an inline amber banner; summary-card chevron fades in on hover/focus instead of always showing.
- Custom line-art SVG empty-state illustrations (calendar, chart, list, target, clock, wallet) via the new `illustration` prop on `EmptyState`, replacing icon chips in 7 call sites.
- Reports page restructured: compact KPI strip (income, expenses, net, savings rate) in one hairline surface; "Income vs expenses" promoted to the full-width primary chart (300px); spending trend, savings, utilization, and top categories in a balanced two-column grid; "Spending this month" breakdown and "Things to know" insights card close the page.
- Chart polish: rounded 6px bars, taller primary chart, soft gradient fill under the spending-trend area, standardized 12px axis ticks and 12px-radius tooltips, inline income/expense legend.
- Timeline table: editorial column headers, tighter 4px row padding, hairline group rows with tabular totals, softer canvas hover for rows.

### UX
- Planner now speaks conversationally: empty state asks "Ready to plan {month}?" and an on-track state reassures "You're on track this month — nothing needs your attention right now."
- Button hierarchy rebalanced: "New budget" demoted to secondary, per-row actions ("Fund", "Adjust") use ghost; primary buttons reserved for page-level actions.
- Budget suggestions clarify what happens next: "raise the limit to X to cover what you've spent", optional trim line, and an overage-coverage note ("Your remaining income covers these overages.").
- Needs Funding rows show "No budget set yet" when a category has no limit, keeping the budget form one tap away.
- Microcopy pass across reports, timeline, upcoming, planner, and settings empties and dialogs.

### Performance
- Report charts lazy-loaded via `next/dynamic` with `ssr: false` and pulse skeletons, keeping the reports route static while cutting initial JS.

### Accessibility
- Reduced-motion respected in every chart animation (`useReducedMotion`), fade-in arrow, and list-in rows.
- Chart `role="img"` with descriptive `aria-label`s retained on all five report charts.

### Code refactors
- Shared `InsightList` extracted from duplicated row markup; reused by the planner and reports.
- `chartStyles.ts` centralizes tooltip and tick styles across all recharts surfaces.
- Deleted redundant surfaces: `InsightsPanel`, `SnapshotCards`, `Table`, `PagePlaceholder`; unused icon imports cleaned up.
- `accents.test.ts` updated to the new palette and group precedence.
