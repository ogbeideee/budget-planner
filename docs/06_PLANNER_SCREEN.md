# Budget Planner Desktop
# Planner Screen Specification v2.0

This document completely defines the Planner screen.

It overrides any previous Planner layout.

Do not invent layouts.

Follow this specification exactly.

--------------------------------------------------
PAGE GOAL
--------------------------------------------------

The Planner is the application's flagship screen.

It should communicate:

• Financial confidence
• Clarity
• Calmness
• Control

When the user opens the application, this page should immediately answer:

How am I doing?

What needs attention?

What should I do next?

--------------------------------------------------
PAGE ORDER
--------------------------------------------------

The Planner MUST follow this order.

Hero

↓

Recommendation Card

↓

Summary KPI Cards

↓

Month At A Glance

↓

Needs Funding + Budget Health (2-column)

↓

Budget Allocation

↓

Expense Breakdown

↓

Recent Activity

No additional sections should interrupt this flow.

--------------------------------------------------
PAGE HEADER
--------------------------------------------------

Title

Planner

Description

A short, encouraging sentence.

Example:

"Everything you need to stay on top of your finances this month."

Primary actions (right)

+ Add Expense

+ Add Income

Month Selector

Never crowd the header.

--------------------------------------------------
HERO
--------------------------------------------------

Height

220px

Full width.

Background

Very subtle gradient

White → #F7F8FC

Large greeting.

Examples

Good morning, Archer

Good afternoon

Good evening

Below greeting

Current planning status.

Example

"You're on track to finish the month with ₦186,000 remaining."

This should be dynamically generated.

Primary CTA

Review Budget

Secondary CTA

View Reports

Right side

Large abstract financial illustration or decorative shape.

Never empty.

--------------------------------------------------
RECOMMENDATION CARD
--------------------------------------------------

Appears immediately below Hero.

Only one recommendation is expanded.

Others collapse.

Height

Approximately 120px collapsed

Auto height expanded.

Background depends on recommendation type.

Example

Green

Healthy month.

Amber

Needs attention.

Red

Critical.

Layout

Large icon

↓

Headline

↓

Description

↓

CTA

The CTA must be obvious.

--------------------------------------------------
SUMMARY KPI GRID
--------------------------------------------------

Exactly four cards.

Equal width.

Equal height.

180px.

Cards

Expected Income

Remaining

Budgeted

Savings Rate

Each card contains

Pastel icon

Metric

Label

Supporting text

Optional trend indicator

Hover

Card lifts slightly.

--------------------------------------------------
MONTH AT A GLANCE
--------------------------------------------------

Single wide card.

Three columns.

Left

Income

Middle

Expenses

Right

Remaining

No nested cards.

Large numbers.

Lots of whitespace.

--------------------------------------------------
NEEDS FUNDING
--------------------------------------------------

Left column.

Approximately 60% width.

Card title

Needs Funding

Subtitle

Categories requiring attention.

Each row

Category icon

Category name

Target

Allocated

Missing

Progress bar

Fund button

Fund button

Rounded pill.

Primary color.

Hover elevation.

Rows

64px height.

Hover

Soft background.

No borders between rows.

--------------------------------------------------
BUDGET HEALTH
--------------------------------------------------

Right column.

40% width.

Contains

Overall score

Large percentage

Status pill

Animated circular progress

Three supporting insights.

Example

Healthy

Overspending Risk

Allocation Efficiency

Each insight uses an icon.

No dense text.

--------------------------------------------------
BUDGET ALLOCATION
--------------------------------------------------

Full width.

Left

Donut chart.

Right

Allocation summary.

Legend

Color dot

Category

Amount

Percentage

Hovering a legend highlights the corresponding chart segment.

--------------------------------------------------
EXPENSE BREAKDOWN
--------------------------------------------------

Card title

Expense Breakdown

Each category row contains

Icon

Category

Amount

Percentage

Animated progress bar

Rows should feel spacious.

Never table-like.

--------------------------------------------------
RECENT ACTIVITY
--------------------------------------------------

Latest five transactions.

Each row

Icon

Title

Category

Date

Amount

Hover highlight.

Button

View Full Timeline

--------------------------------------------------
CARD STYLING
--------------------------------------------------

Every Planner card uses

Radius

20px

Padding

28px

Soft shadow

White background

Hover

TranslateY(-2px)

Transition

220ms

--------------------------------------------------
SPACING
--------------------------------------------------

Gap between sections

40px

Gap between cards

24px

Internal spacing

28px

The page should never feel cramped.

--------------------------------------------------
EMPTY STATES
--------------------------------------------------

If a section has no data,

show a premium empty state.

Never display

"No data."

Instead explain:

Why it is empty.

How to populate it.

Provide a CTA.

--------------------------------------------------
MICRO INTERACTIONS
--------------------------------------------------

Summary cards

Lift on hover.

Progress bars

Animate.

Charts

Animate.

Recommendation

Expand smoothly.

Buttons

Subtle elevation.

Rows

Soft highlight.

No abrupt transitions.

--------------------------------------------------
RESPONSIVENESS
--------------------------------------------------

Desktop

Two-column layout.

Laptop

Maintain two columns if possible.

Tablet

Stack columns.

Never compromise desktop spacing.

--------------------------------------------------
DO NOT CHANGE
--------------------------------------------------

Business logic

Calculations

Selectors

Storage

Routing

State management

This document defines presentation only.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The Planner should immediately feel comparable to a premium fintech application.

The user should instinctively understand:

Current financial health

Remaining money

What needs funding

Recommended next action

Without having to search the page.