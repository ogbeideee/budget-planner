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

Income Sources

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