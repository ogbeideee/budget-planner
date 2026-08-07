# Budget Planner Desktop
# Timeline Screen Specification v2.0

This document defines the Timeline screen.

The Timeline should feel like a modern financial activity feed.

Not a table.

Not a spreadsheet.

Not an accounting ledger.

The user should enjoy scrolling through their financial history.

--------------------------------------------------
PAGE GOAL
--------------------------------------------------

The Timeline should answer:

• Where did my money go?

• When did it happen?

• Which categories dominate?

• What changed recently?

The Timeline should encourage exploration.

--------------------------------------------------
PAGE STRUCTURE
--------------------------------------------------

Timeline

↓

Quick Filters

↓

Search

↓

Summary Chips

↓

Activity Feed

--------------------------------------------------
HEADER
--------------------------------------------------

Title

Timeline

Description

"Review every transaction and understand your financial journey."

Right Side

Export

Filter

Month Selector

--------------------------------------------------
SUMMARY CHIPS
--------------------------------------------------

Immediately below the header.

Four compact chips.

Income

Expenses

Transfers

Transactions

Each chip

Rounded pill

Small icon

Metric

Hover elevation

--------------------------------------------------
SEARCH
--------------------------------------------------

Large desktop search.

Width

420px

Height

48px

Rounded

Left search icon

Placeholder

Search transactions, notes or categories...

Typing should instantly filter.

No debounce delay greater than 150ms.

--------------------------------------------------
FILTER BAR
--------------------------------------------------

Soft floating container.

Contains

Category

Income/Expense

Date

Amount Range

Sort

Clear Filters

Filters collapse into one row.

Never stack unnecessarily on desktop.

--------------------------------------------------
DATE GROUPS
--------------------------------------------------

Transactions are grouped by date.

Examples

Today

Yesterday

Monday

Last Week

August 2026

Each group begins with

Large heading

Small summary

Example

Today

4 transactions • ₦18,450 spent

--------------------------------------------------
TRANSACTION CARD
--------------------------------------------------

Each transaction appears as a card.

Never a table row.

Height

Approximately 84px

Radius

18px

Padding

20px

Shadow

Very subtle

Hover

Lift

Soft background tint

--------------------------------------------------
TRANSACTION LAYOUT
--------------------------------------------------

Left

Category icon

Middle

Title

Category

Optional note

Right

Amount

Time

Status badge (optional)

Everything vertically centered.

--------------------------------------------------
CATEGORY ICON
--------------------------------------------------

52x52

Rounded square

Pastel background

Category-specific icon

Examples

Food

Transport

Salary

Entertainment

Utilities

--------------------------------------------------
TRANSACTION TITLE
--------------------------------------------------

16px

600

Primary color

Never truncate unnecessarily.

--------------------------------------------------
CATEGORY LABEL
--------------------------------------------------

Small pastel pill.

Examples

Food

Bills

Salary

Shopping

Uses semantic colors.

--------------------------------------------------
NOTE
--------------------------------------------------

Muted

14px

Maximum two lines

Ellipsis after two lines.

--------------------------------------------------
AMOUNT
--------------------------------------------------

Largest element on the right.

Income

Green

Expense

Primary text

No red unless truly negative.

Always formatted:

₦125,000

--------------------------------------------------
TIME
--------------------------------------------------

Small muted text.

Examples

9:14 AM

Yesterday

2 days ago

--------------------------------------------------
STATUS BADGES
--------------------------------------------------

Examples

Recurring

Upcoming

Manual

Imported

Rounded pills

Pastel backgrounds

--------------------------------------------------
ROW INTERACTION
--------------------------------------------------

Hover

Lift

Shadow increases

Background tint

Cursor pointer

Click

Expand details

No navigation required.

--------------------------------------------------
EXPANDED DETAILS
--------------------------------------------------

Smooth accordion.

Shows

Full note

Category

Date

Time

Payment method

Budget association

Actions

Edit

Duplicate

Delete

--------------------------------------------------
ANIMATIONS
--------------------------------------------------

Hover

160ms

Expand

220ms

Filter

180ms

Search

150ms

All animations ease.

--------------------------------------------------
EMPTY STATE
--------------------------------------------------

Illustration

Headline

"No transactions yet"

Supporting text

Primary CTA

"Add your first transaction"

--------------------------------------------------
SCROLLING
--------------------------------------------------

Smooth.

Date headers may remain sticky.

Sticky headers must NEVER cover transactions.

First transaction should always remain visible.

--------------------------------------------------
VISUAL RHYTHM
--------------------------------------------------

Date Group

↓

24px

↓

Transactions

↓

40px

↓

Next Date Group

Large breathing room.

--------------------------------------------------
COLORS
--------------------------------------------------

Income

Emerald

Expense

Slate

Upcoming

Amber

Recurring

Blue

Manual

Purple

Imported

Teal

--------------------------------------------------
DO NOT CHANGE
--------------------------------------------------

Sorting

Filtering

Business logic

Selectors

Storage

Only redesign the presentation.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The Timeline should resemble the activity feed of a premium banking application.

Users should be able to scan months of financial history comfortably without feeling like they are reading a spreadsheet.

The experience should encourage exploration while remaining clean and uncluttered.