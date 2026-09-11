# Budget Planner Desktop
# Email Alert Parsing — Security Model and Template Registry v1.0

This document defines FR-24: connecting an email account so bank transaction
alerts become draft transactions.

This is the most security-sensitive feature in the app. Read the security
model before changing anything in `lib/emailAlerts.ts`,
`electron/credentials.cjs`, or the IPC surface between them.

--------------------------------------------------
STATUS
--------------------------------------------------

Landed and tested:

- Sender allowlist and per-institution template registry (`lib/emailAlerts.ts`)
- Credential vault over Electron `safeStorage` (`electron/credentials.cjs`),
  wired through IPC and the preload bridge
- Draft pipeline reusing the categorization and duplicate engines
  (`lib/emailPipeline.ts`)
- IMAP transport (`electron/imapTransport.cjs` — imapflow kept behind this one
  module; read-only session, error categorization, secret redaction)
- Email account configuration + initial-lookback setting
  (`lib/emailAccount.ts`, normalized again in main by
  `electron/imapConfig.cjs` — a parity test pins the two together)
- Connection manager and the four IPC channels
  (`desktop:email:connect|test|disconnect|status`,
  `electron/emailConnection.cjs`), with the connect/disconnect/test/status UI
  in Settings (`components/settings/EmailAlertsPanel.tsx`)

Landed and tested, sync stage (2026-09):

- The sync manager (`electron/emailSync.cjs`) — ONE canonical operation
  (`checkNow`) behind every entry point, an `inFlight` guard against
  overlapping sessions, one held-open transport across ticks, failure
  backoff, and mailbox-level UID dedupe via `electron/emailSyncStore.cjs`
  (a non-ledger record through the storage seam, never AppState)
- The hourly scheduler (`electron/emailScheduler.cjs`, ONE timer handle,
  cleared before every restart) and the manual "Check now" button + tray
  "Check for new alerts now" item, all calling the SAME canonical operation
- Delivery to the renderer (`desktop:email:alerts` + safe summary on
  `desktop:email:sync-result`), the renderer bridge (`hooks/useEmailSync.ts`)
  running the EXISTING parser + pipeline, auto-import through `planImport`,
  and the needs-review queue (`components/email/EmailDraftsReviewModal.tsx`)
- Hidden-window handling (`electron/emailDelivery.cjs`): a sync that finds
  alerts while the main window is in the tray caches the batch (still
  unconfirmed) and raises an OS notification whose click restores the window
  on Settings → Email alerts; nothing is lost even if the app quits first

See "Remaining work" at the end for what is still open — notably that
NOTHING here has been verified against a real mailbox yet: every test runs
against a fake transport, so the whole sync stage is representative, not
verified (§4.1a).

--------------------------------------------------
SECURITY MODEL
--------------------------------------------------

Five properties, in priority order. If a change would weaken any of them, the
change is wrong.

### 1. The stored secret is never readable by renderer code

The email password is encrypted with Electron's `safeStorage`, which is backed
by the OS keychain — DPAPI on Windows, Keychain on macOS, libsecret/kwallet on
Linux. The ciphertext lives at `<userData>/credentials.v1.json`; the KEY never
leaves the OS store, so the file alone is useless on another machine or under
another user account.

**The IPC surface has no "read secret" channel, and must never gain one.**
The renderer can:

- ask whether encryption is available
- store a secret
- ask whether one exists (and when it was saved)
- delete it

Decryption happens only in the main process, at the moment a connection is
opened. A compromised renderer — the part of the app running web content —
cannot obtain the password.

### 2. No plaintext fallback, ever

If the OS cannot encrypt, `createCredentialStore().set()` returns
`{ ok: false, reason: "encryption-unavailable" }` and **writes nothing**. There
is no base64 "obfuscation", no home-rolled cipher, no localStorage fallback.

The UI must call `isAvailable()` *before* collecting a password, so the user is
never asked for a secret this machine cannot protect.

**This is why the feature is desktop-only.** The app also ships as a static
browser build, where `safeStorage` does not exist and every storage mechanism
available to a page (`localStorage`, IndexedDB, cookies) is plainly readable by
any script on the origin. `lib/emailCredentials.ts` reports
`{ available: false, reason: "not-desktop" }` there and refuses to proceed. A
"best effort" browser fallback would look like the feature working while
leaving the password readable, which is worse than not shipping it.

### 3. The allowlist, not the inbox

`ALERT_SENDERS` in `lib/emailAlerts.ts` is an allowlist of institution sending
domains. Mail from anything else is never parsed, never stored, and is
discarded at the sender check.

Domain matching is exact-host-or-subdomain, never substring:

```
host === domain  ||  host.endsWith("." + domain)
```

Substring matching would accept `gtbank.com.attacker.example`. There are tests
for exactly that attack, and they must keep passing.

The fetch layer is additionally expected to narrow server-side (an IMAP
`SEARCH FROM` per allowlisted domain), so non-matching mail is never
downloaded in the first place. The allowlist check in `parseAlert` is the
second line of defence, not the only one.

### 4. Nothing leaves the machine

Parsing is pure local string work. No email content is sent to any API, model
or third-party service. `lib/emailAlerts.ts` has no network imports and must
not gain any.

Only a capped excerpt (`SNIPPET_MAX_CHARS`, 400 characters) of a body is
retained, and only for an alert that failed to parse, so the user can see what
arrived. Successfully parsed alerts retain the extracted fields only.

### 5. Read-only, draft-only

The feature reads alert mail and produces drafts. It cannot send mail, move
money, or write to the ledger. Parsed alerts become `ImportRow`s that flow
through the same `planImport` confirm step as a CSV/PDF import — nothing is
saved without the user approving the batch.

--------------------------------------------------
WHAT THE USER MUST BE TOLD, BEFORE CONNECTING
--------------------------------------------------

The connect screen must state all four, in plain language, before any field is
shown:

1. It reads **only** transaction alerts from a fixed list of bank senders —
   the rest of the inbox is never opened. Show the actual list.
2. Email content is processed **on this computer** and is never sent anywhere.
3. It **never** sends mail, moves money, or changes anything in the mailbox.
4. Every detected transaction is a **draft** the user confirms; nothing is
   saved automatically.

Plus the practical part: it needs an **app-specific password**, not the main
account password, with per-provider instructions (see below).

--------------------------------------------------
IMAP vs OAUTH — THE CHOICE, AND WHY
--------------------------------------------------

**IMAP with an app-specific password.**

The requirement allowed Gmail OAuth instead *if* the codebase already had an
OAuth pattern to build from. It does not: there is no OAuth client, no token
refresh, no redirect handling and no OAuth dependency anywhere in the project
(`electron-updater` is the only network-touching dependency).

Adding a first OAuth implementation would mean a client secret shipped inside a
desktop binary — where it is not secret — plus a loopback redirect listener and
refresh-token storage. That is more moving parts and more attack surface than
one app password in the OS keychain, for one provider.

IMAP also satisfies "works with any provider, not locked to one" directly.

App passwords are provider-generated, scoped to one application, revocable from
the provider's own security page without touching the main password, and
useless for interactive sign-in. Instructions the UI must show:

- **Gmail** — requires 2-Step Verification, then
  Google Account → Security → 2-Step Verification → App passwords.
  Host `imap.gmail.com`, port 993, TLS.
- **Outlook / Hotmail** — Microsoft Account → Security → Advanced security
  options → App passwords (requires two-step verification).
  Host `outlook.office365.com`, port 993, TLS.
- **Yahoo** — Account Security → Generate app password.
  Host `imap.mail.yahoo.com`, port 993, TLS.

--------------------------------------------------
THE TEMPLATE REGISTRY
--------------------------------------------------

Each institution formats its alerts differently, so parsing is **data**, not
code. `ALERT_TEMPLATES` is a list of `AlertTemplate` entries; one shared
evaluator (`parseAlert`) interprets every one of them.

```ts
interface AlertTemplate {
  institution: Institution;
  alertMarkers?: readonly RegExp[];  // gate: is this even an alert?
  amount:       readonly RegExp[];   // capture group 1 = amount
  debit:        readonly RegExp[];   // any match => money out
  credit:       readonly RegExp[];   // any match => money in
  description:  readonly RegExp[];   // capture group 1 = narration
  date:         readonly RegExp[];   // capture group 1 = date string
}
```

Each field lists patterns tried **in order**; the first with a usable capture
wins. That lets one template absorb several layouts from the same sender
without a bespoke function.

There is no per-institution parsing function anywhere, and there should never
be one. If a bank's format cannot be expressed as ordered patterns, extend the
`AlertTemplate` shape and the shared evaluator — do not add a special case.

### Adding a new institution

1. Add an `AlertSender` entry with the institution's real alert domain(s).
   Be precise: a wrong domain here is a privacy failure, not a missing feature.
2. Add an `AlertTemplate` with the same `institution` key.
3. Add a test in `lib/__tests__/emailAlerts.test.ts` using a **realistic**
   sample body, asserting amount, direction, description and date.
4. Add a malformed variant asserting it lands in `needs-review`.

The existing test `"has a template for every allowlisted institution"` fails if
you add a sender without a template.

### Template confidence — READ THIS BEFORE TRUSTING A TEMPLATE

**Tier 1 — verified against real mail (2026-08-27).** Six real redacted
alerts (a debit/credit pair each) are pinned as fixtures in
`lib/__tests__/emailAlertsReal.test.ts`.

| Institution | Domain | Body layout | Amount format | Direction signal |
|---|---|---|---|---|
| GTBank | `gtbank.com` | flattened HTML **table** (`Label \| : \| Value`) | code prefix, decimals **optional**: `NGN 3.51` *and* `NGN 26388` | `a DEBIT/CREDIT transaction occurred` |
| Wema Bank | `wemabank.com` | flattened HTML **table** | code **suffix**: `800.00 NGN`, `3,000.00 NGN` | `a Debit/Credit transaction recently occurred` |
| Quick Microfinance | `quickmart.com` | **block** — label on one line, value on the NEXT | **symbol** prefix: `₦53.75`, `₦250,000.23` | `has been debited/credited`, `Money Debited/Received` |

**Tier 2 — representative guesses, NOT verified** (Access, UBA, Zenith, Kuda,
Moniepoint, PalmPay, OPay). Banner-marked in the registry. Assume they are
wrong until real samples prove otherwise — every Tier 1 template was wrong
before its samples arrived, two of them completely.

### What the real samples changed

Three layout facts invalidated the original guesses outright:

1. **GTBank and Wema send HTML tables**, which arrive as
   `| Label | : | Value |` once converted to text. Every label-anchored
   pattern failed, because label and value are separated by ` | : | `, not
   `: `. `normalizeAlertBody` now flattens those rows before any matching.
2. **Quick Microfinance is not a table at all** — the label sits on its own
   line with the value on the next (`Amount\n₦53.75`). The `LV` separator
   crosses exactly one newline to handle this.
3. **Field labels were all wrong**: real GTBank uses `Description`,
   `Amount`, `Value Date` — not the `Desc:`/`Amt:` that was assumed.

Plus two recognition failures that would have silently dropped whole
institutions:

- **GTBank** matched none of its `alertMarkers` (`transaction alert`,
  `\bTxn\b`, `\bAmt\b`); its real subject is "Transaction Notification".
- **Wema** matched none either — its real wording is "a Debit transaction
  recently occurred", and the only "wema" in the body is inside
  `wemabank.com`, where `\bwema\b` fails on the trailing "b".

### One money parser, not three

`parseMoneyToken` (and the `MONEY` fragment templates embed) normalizes every
confirmed shape and is built to absorb a fourth:

```
"NGN 3.51"       code prefix, decimals        GTBank
"NGN 26388"      code prefix, NO decimals     GTBank — same sender
"NGN7,450.00"    code prefix, glued           (no space)
"800.00 NGN"     code SUFFIX                  Wema
"₦250,000.23"    symbol prefix, comma groups  Quick Microfinance
"99.99 USD"      either side, any code        a future institution
```

It returns `{ minor, negative }` — sign kept **separate** rather than folded
into the value, which is what makes the balance rule below possible.

### Balances are never amounts

GTBank really sends `Available Balance : NGN -28.48` two rows below the
amount. Three guards:

1. `parseAlertAmount` rejects any negative token outright.
2. The evaluator strips every line matching
   `/balance|bal\s*[:.]|avail\s*bal/i` **before** amount extraction, so even
   a positive balance cannot be captured.
3. When a balance **label** carries no figure — Quick Microfinance's
   `Current Available Balance` with `₦250,765.10` on the next line — the
   following line is dropped too. Removing only the label would leave the
   figure behind as an orphan for a later pattern to find.

All three apply to every template, present and future.

### Narration: the merchant is anchored by the phone number

Quick Microfinance's real debit narration is:

```
FT_Out Fee:DAVID OSAHON OGBEIDE_8082389369_OPAY NIGERIA_Amount Transfer
           ^ account holder     ^ phone     ^ MERCHANT   ^ type
```

An earlier "longest alphabetic segment" heuristic picked **the account
holder** — their name is longer than the merchant's. The phone number is a
reliable positional anchor, so `cleanNarration` takes the first usable
segment **after** it, yielding `OPAY NIGERIA`. Length is a guess; position
is not.

GTBank prefixes a ~30-digit bank reference
(`100004260730180812166829083192-TRANSFER FROM ...`). Left in, every
transaction would have a unique categorization key and no learned rule could
ever match twice, so a leading run of 8+ digits is stripped.

`cleanNarration` returns any string **without underscores** unchanged, which
is what keeps clean prose (`July 2026 Bestaf Tech Staff Salary`), Wema's
`NIP:UFY X UNIVERSAL SERVICES LIMITED- Prime`, and GTBank's hyphen-containing
`SMS ALERT CHARGE FOR 27-JUN-26 TO 28-JUL-26` intact.

### Truncated descriptions are valid, not errors

Both GTBank (`...-DAVID OSA`) and Wema (`...OGBEIDE FROM DA`) truncate their
own fields mid-word. Treated as valid-but-imperfect: no crash, no
`needs-review`, kept verbatim.

### The allowlist is keyed to VERIFIED SENDING DOMAINS, never brand names

Quick Microfinance Bank sends from **`quickmart.com`** — a domain with no
relationship to its brand. Any brand-name-derived guess (`quickmfb.com`,
`quickmicrofinance.com`) would have rejected every legitimate alert.

The rule this confirms: **only observed sending domains go in the allowlist**,
and there is deliberately **no brand-name fallback**. A fallback that matched
"quick" or "microfinance" anywhere in a domain would be an allowlist bypass —
`quick-microfinance.attacker.example` would sail through. Matching stays
exact-host-or-subdomain, and tests assert both that `quickmart.com` is accepted
and that brand-shaped lookalikes are not.

--------------------------------------------------
PARSE OUTCOMES
--------------------------------------------------

`parseAlert` returns one of three things and never throws:

| Status | Meaning |
|---|---|
| `parsed` | All four required fields extracted |
| `needs-review` | Right sender, recognisably an alert, but a field could not be read |
| `ignored` | Not an allowlisted sender, or not a transaction alert at all |

`needs-review` is the important one. A partially-readable alert keeps
everything that *was* understood, lists exactly which fields are missing, and
carries a capped body snippet — so the user completes one field rather than
retyping, and nothing disappears unexplained. It can never be imported as-is:
`planImport` refuses a row with no amount or no category.

The mail `Date` header is a legitimate fallback when the body carries no date
(alerts arrive within seconds of the transaction). When used, the draft is
flagged `dateFromHeader` so the review UI can say so.

--------------------------------------------------
REUSING THE EXISTING ENGINES
--------------------------------------------------

`lib/emailPipeline.ts` owns **no** categorization and **no** duplicate logic.
It calls:

- `suggestCategory` (`lib/learnedRules.ts`) — the same engine the statement
  importer uses, so a rule the user taught during a CSV import applies to an
  email alert, and vice versa.
- `findDuplicateCandidates` (`lib/duplicateScore.ts`) — so an alert mirroring a
  hand-typed transaction is caught exactly as an imported row would be, and
  blocks the batch until explicitly resolved.

Both were built to take plain strings for this reason. Growing a second engine
here was the specific thing to avoid.

Output is `ImportRow[]`, fed to the existing `planImport` — so the email path
inherits the whole confirm step rather than reimplementing it.

--------------------------------------------------
REMAINING WORK
--------------------------------------------------

1. **Live-mailbox verification — the only remaining build item, and the one
   that matters most.** Every layer (transport, sync, scheduler, delivery,
   review UI) is built and unit-tested against FAKE transports. Per §4.1a the
   whole sync stage is therefore representative, not verified. Verification
   means connecting a real Gmail account with a real app password and walking
   connect → hourly/manual sync → HTML→text conversion → parse → auto-import
   / needs-review for at least one REAL alert from each Tier 1 institution
   (GTBank / Wema / Quick MFB). Tier 2 templates stay banner-marked guesses
   until their real samples arrive — assume they are wrong (every Tier 1
   template was, before its samples did).
2. **Sync scheduling** — **LANDED** as `electron/emailScheduler.cjs`, with
   ONE decision superseded on the way: the interval is **ONE HOUR**
   (`EMAIL_SYNC_INTERVAL_MS = 60 * 60 * 1000`, decided in the sync-stage
   build session, recorded in the module and pinned by its test), NOT the
   30 minutes decided here on 2026-08-29. The earlier 15-minute and 30-minute
   suggestions are both obsolete — do not "fix" the constant back to 30.
   The constraints below all hold as specified:
   - The interval is a named constant declared next to the scheduler.
   - "Check now" (renderer button and tray item) bypasses the timer via
     `runNow()` and calls the same canonical `checkNow`.
   - ONE timer handle, `unref`'d, cleared before every (re)start.
   A scheduled tick that finds nothing toasts NOTHING renderer-side
   (`shouldToastSyncSummary` in hooks/useEmailSync.ts) — an hourly "no new
   alerts" toast would be worse than no check. Failures surface on every
   trigger.

--------------------------------------------------
BACKGROUND CHECKING (FR-26) — WHAT CHANGED, AND WHAT DID NOT
--------------------------------------------------

FR-26 added a system tray, a quick-add window, and an opt-in
`settings.backgroundMode` that makes closing the main window hide it to the
tray instead of quitting the app. That lifts the constraint this document used
to state — that syncing was "explicitly scoped to a running, foreground app".

**Background checking now WORKS** (2026-09 sync stage): the transport, sync
manager and scheduler are landed, and the tray's "Check for new alerts now"
item is wired — `main.cjs` registers
`tray.setAlertChecker(() => emailScheduler.runNow("tray"))`, so a sync that
finds nothing leaves the app silent, and one that finds alerts while the
window is hidden caches the batch and raises an OS notification
(`electron/emailDelivery.cjs`) whose click restores the window on
Settings → Email alerts. What FR-26 originally provided was the
*precondition*: a process that can still be alive with no window on screen,
and a place to surface what it finds.

What FR-26 actually landed for this feature:

- **A tray menu seam.** `tray.setAlertChecker(fn)` makes a "Check for new
  alerts now" item appear in the tray context menu. **Now wired:** the
  scheduler's `runNow("tray")` is registered in `main.cjs`, so the item and
  the renderer's "Check now" call the same canonical operation — the manual
  check never goes through the timer.
- **A notification path with a click target.** `desktop:notify` now accepts a
  `deepLink`; clicking the toast restores the main window and routes there.
  Use the existing path (`sendDesktopNotification`, `Notification.isSupported()`
  -guarded) — do not introduce a second notification mechanism.
- **Cross-window state invalidation.** `desktop:state:changed` already exists
  for quick-add; drafts written while a window is open will reach it the same
  way.

### Connection lifecycle in the background state — decided now

These bind whoever builds the transport. They are written down before the code
because the failure they prevent (a provider throttling the account, or
prompting for auth repeatedly) is discovered late and is painful to unwind.

1. **One connection, held open — never one per tick.** The connection is
   established when checking starts and kept idle between the 30-minute ticks.
   Do NOT connect, `SEARCH`, and disconnect every cycle: a predictable
   connect/auth cycle every 30 minutes for hours is precisely the pattern that
   earns rate-limiting and repeated authentication challenges, and it multiplies
   the number of times the secret is decrypted for no benefit.
2. **Reconnect on failure, with backoff — never on a schedule.** Providers do
   drop idle IMAP connections. Handle that by reconnecting when a tick finds the
   connection dead, backing off on repeated failure; do not pre-emptively cycle
   the connection to "keep it fresh".
3. **The security model is unchanged, not relaxed.** `reveal()` stays
   main-process-only; its return value never crosses IPC, is never logged, and is
   never written anywhere. There is still no "read secret" channel and there must
   never be one. Note the direction of the risk here: a checker running with no
   window open has strictly LESS renderer surface than one with a window, not
   more. Background mode weakens nothing in this document's five properties.
4. **The credential is not re-collected because the window closed.** Hiding to
   the tray is not a logout. The vault is on disk, encrypted by the OS keychain,
   and unchanged by window state.
5. **Review-first is independent of when the check runs.** A background check
   populates the review queue and confirms NOTHING. Nothing reaches the ledger
   without the user approving it, whether the check ran with the window open,
   closed, or from the tray's manual item.
6. **Off by default, and the timer follows the setting.** With
   `backgroundMode` off — the default, and what every pre-v10 install migrates
   to — closing the window quits the app and checking stops, matching today's
   behaviour exactly. The timer must stop with the app; it must not be the
   reason a process outlives its window.

Architecture rationale for the tray, the close-behaviour decision and the
manual-verification list: ARCHITECTURE §3.7.
