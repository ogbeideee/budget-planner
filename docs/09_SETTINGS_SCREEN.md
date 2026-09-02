# Budget Planner Desktop
# Settings Screen Specification v2.0

This document completely defines the Settings screen.

The Settings page should not feel like a collection of forms.

It should feel like a polished desktop application's preferences window.

The experience should resemble:

• macOS System Settings
• Raycast Preferences
• Arc Browser Settings
• Linear Preferences

--------------------------------------------------
PAGE GOAL
--------------------------------------------------

Users should immediately understand:

• where every setting lives
• what each setting affects
• how to change it

Nothing should feel hidden.

Nothing should require hunting.

--------------------------------------------------
PAGE STRUCTURE
--------------------------------------------------

Settings

↓

Profile

↓

Appearance

↓

Budget Preferences

↓

Categories

↓

Recurring

↓

Income Sources

↓

Learned rules

↓

Desktop          (desktop build only)

↓

Data & Backups

↓

About

--------------------------------------------------
HEADER
--------------------------------------------------

Title

Settings

Description

"Customize your budgeting experience."

No actions beside the title.

--------------------------------------------------
LEFT NAVIGATION
--------------------------------------------------

Desktop layout uses two columns.

LEFT

Settings navigation

RIGHT

Selected settings panel

Navigation width

280px

Content

Remaining width

--------------------------------------------------
NAVIGATION ITEMS
--------------------------------------------------

Each navigation item

48px height

Radius

14px

Icon

20px

Title

15px

Hover

Soft gray

Selected

Pastel emerald background

Small left indicator

--------------------------------------------------
PROFILE SECTION
--------------------------------------------------

Large profile card.

Contains

Application icon

Application name

Version

Storage status

Current month

Optional future sync status

--------------------------------------------------
APPEARANCE
--------------------------------------------------

Cards instead of forms.

Theme

Accent color

Animations

Density

Preview cards

Changing theme animates smoothly.

--------------------------------------------------
THEME PICKER
--------------------------------------------------

Three cards.

Light

Dark

System

Each preview

Mini application screenshot

Selected

Large checkmark

--------------------------------------------------
ACCENT COLOR
--------------------------------------------------

Display colors as circular swatches.

Emerald

Blue

Indigo

Amber

Slate

Hover

Grow slightly

Selected

White ring

--------------------------------------------------
BUDGET PREFERENCES
--------------------------------------------------

Grouped settings.

Examples

Default currency

Month starts on

Default reminder time

Number formatting

Each setting

Label

Description

Control

--------------------------------------------------
CATEGORY MANAGEMENT
--------------------------------------------------

The most polished area.

Each category shown as a premium list row.

Row contains

Icon

Name

Color

Type

Transaction count

Actions

Hover

Soft lift

--------------------------------------------------
DESKTOP  (desktop build only)
--------------------------------------------------

Hidden entirely in the browser build. A web page has no system tray and no
process to keep alive, so every control here would be inert.

One card: "Closing the window".

Toggle — "Keep running in the background"

  OFF (default)
    Closing the window quits the app, exactly as it always has.
    Helper text says so in as many words.

  ON
    Closing the window hides it to the system tray; the app keeps running.
    Helper text explains the tray is how you get back: add an expense,
    reopen the window, or Quit.

The default is OFF and it is not a stylistic choice. Closing the window has
quit this app for its entire life, so leaving a process running for someone
who never opted in would be a change made on their behalf. Existing installs
migrate to OFF (schema v9 → v10); nobody is opted in.

Below the toggle, always: "The app never starts itself. This only changes what
the close button does while you are already running it."

Warning state — the setting is ON but the OS gave us no tray icon:

  "This system didn't provide a tray icon, so closing the window will still
  quit the app. Nothing is lost — the setting takes effect if a tray becomes
  available."

  Shown because without a tray there is nowhere to minimise into, so
  close-to-quit stays in force whatever the toggle says. The user must not
  discover that by losing the app.

Wording note: this card says nothing about email alerts. Background email
checking is not possible yet — FR-24's IMAP transport has not landed, so
nothing reads a mailbox whether the app is running or not. The copy gets
revisited when the transport ships. See docs/15_EMAIL_PARSING.md and
ARCHITECTURE §3.7.

Where background mode is visible elsewhere: the tray tooltip, a disabled
"Background mode: on/off" line in the tray menu, and a "Stays in tray" chip in
the title bar beside the close button.

--------------------------------------------------
CATEGORY EDIT
--------------------------------------------------

Dialog.

Large icon preview.

Category name

Icon

Color

Type

Save button

Delete button

--------------------------------------------------
ICON PICKER
--------------------------------------------------

Premium experience.

Search always visible.

Sticky search bar.

Categories

Finance

Food

Transport

Shopping

Bills

Lifestyle

Health

Technology

Education

General

Each icon

48x48

Rounded

Hover animation

Selected state

Never reset scroll position while searching.

--------------------------------------------------
COLOR PICKER
--------------------------------------------------

Preset palette.

Large circular swatches.

No tiny color inputs.

--------------------------------------------------
INCOME SOURCES
--------------------------------------------------

Each income source appears as a card.

Displays

Icon

Name

Expected

Received

Difference

Actions

Cards align in responsive grid.

--------------------------------------------------
DATA & BACKUPS
--------------------------------------------------

Premium storage card.

Displays

Storage location

Last backup

Backup size

Buttons

Create Backup

Restore

Export

Import

Open Backup Folder

Each action has its own icon.

--------------------------------------------------
IMPORT / EXPORT
--------------------------------------------------

Native desktop file picker.

Clear explanations.

Confirmation dialogs.

Success toast after completion.

--------------------------------------------------
ABOUT
--------------------------------------------------

Application logo

Version

Build number

Electron version

License

Developer

Repository (future)

Check for updates

--------------------------------------------------
LEARNED RULES SECTION (FR-22)
--------------------------------------------------

Where the app's learned category mappings are managed. Reached from the
left navigation like any other section; follows the standard section
pattern (heading + one-line explanation, then a Card).

Header

- "Learned rules" title, with a plain-language explanation: correcting a
  transaction's category twice while importing teaches the app, and it
  suggests that choice next time. It says explicitly that nothing is
  learned from a single correction.
- A secondary "Clear all" button, right-aligned, rendered ONLY when at
  least one mapping exists — a destructive control with nothing to
  destroy is noise.

Rows (one per mapping)

- The signal kind and matched key ("provider · mtn", "merchant · shoprite
  lekki"), the target category, and how many times it has been confirmed.
- A candidate (confirmed once) is visibly distinct from an active rule:
  it pre-fills a suggestion but does not classify on its own.
- Controls per row: enable/disable toggle, a category select to re-target
  it, and a delete button. Delete confirms first and says the mapping can
  be relearned by correcting again.

Clear all

Opens a `ConfirmDialog` naming the exact count ("All 2 learned rules will
be removed…"). The copy states that transactions and categories are NOT
affected and that learning restarts from the next import — the risk of
this control is that it reads as "delete my data", and it does not.

Empty state

When nothing has been learned yet, the section explains how learning
happens rather than showing an empty table.

--------------------------------------------------
TOGGLES
--------------------------------------------------

Large.

Easy to click.

Animated.

Labels always visible.

--------------------------------------------------
FORMS
--------------------------------------------------

Large spacing.

Labels above controls.

No cramped layouts.

--------------------------------------------------
DIALOGS
--------------------------------------------------

Radius

24px

Padding

32px

Footer fixed.

Scrollable body.

Never overflow the viewport.

--------------------------------------------------
EMPTY STATES
--------------------------------------------------

Illustration

Headline

Description

Primary CTA

Example

"No categories yet"

↓

Create Category

--------------------------------------------------
MICRO INTERACTIONS
--------------------------------------------------

Navigation

Smooth highlight

Cards

Lift

Buttons

Soft elevation

Dialogs

Fade + scale

Color swatches

Scale slightly

Icon picker

Soft hover

--------------------------------------------------
VISUAL STYLE
--------------------------------------------------

Predominantly white.

Minimal borders.

Large spacing.

Soft shadows.

Pastel accents.

Everything should feel calm.

--------------------------------------------------
DO NOT CHANGE
--------------------------------------------------

Settings logic

Persistence

Storage

Business logic

Only redesign the interface.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The Settings page should feel like the preferences window of a premium desktop application.

Users should immediately know where every setting lives.

No section should feel like a collection of plain forms.

The page should encourage exploration without overwhelming the user.