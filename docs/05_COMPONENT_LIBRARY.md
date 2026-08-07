# Budget Planner Desktop
# Component Library v2.0

This document defines every reusable UI component.

No component should be styled independently.

Every screen must compose these components.

--------------------------------------------------
DESIGN PRINCIPLE
--------------------------------------------------

Components should feel:

Soft

Premium

Comfortable

Minimal

Elegant

Never technical.

Never corporate.

Never Bootstrap.

--------------------------------------------------
KPI CARD
--------------------------------------------------

Purpose

Display one primary metric.

Examples

Expected Income

Remaining

Savings

Budget Health

Upcoming Expenses

Specification

Height

150px (min 140px)

Radius

16px

Padding

16px

Background

White

Border

1px solid #EDF2F7

Shadow

0 12px 40px rgba(15,23,42,.06)

Hover

Translate Y

-2px

Increase shadow

Duration

220ms

Structure

Top row

↓

Metric Icon

Action Chip

↓

24px

↓

Large Number

↓

8px

↓

Label

↓

6px

↓

Supporting text

Never place buttons inside KPI cards unless explicitly required.

--------------------------------------------------
METRIC ICON
--------------------------------------------------

Size

36x36

Background

Pastel

Radius

12px

Centered icon

18px icon size

Never use floating icons.

--------------------------------------------------
ACTION CHIP
--------------------------------------------------

Examples

Today

This Month

Healthy

Updated

Height

30px

Radius

999px

Horizontal Padding

14px

Background

Very light neutral

Text

13px

Medium

--------------------------------------------------
SECTION CARD
--------------------------------------------------

Purpose

Contains grouped information.

Padding

24px

Radius

20px

Minimum Height

152px

Title

Top left

Action

Top right

Divider

Avoid unless absolutely necessary.

--------------------------------------------------
BUTTONS
--------------------------------------------------

Primary

Height

40px

Radius

12px

Padding

16px

Background

Brand teal

Text

White

Shadow

None

Hover

Slight elevation

Darker teal

Secondary

Transparent

Border

Light gray

Hover

Soft gray fill

Danger

White

Red border

Hover

Light red surface

Never use square buttons.

--------------------------------------------------
ICON BUTTONS
--------------------------------------------------

40x40

Radius

12px

Hover

Soft neutral background

Never use circular icon buttons unless inside toolbars.

--------------------------------------------------
TEXT INPUT
--------------------------------------------------

Height

48px

Radius

14px

Padding

16px

Border

Light gray

Focus

Brand teal border

Soft glow

Placeholder

Muted

Labels always visible.

--------------------------------------------------
SELECT
--------------------------------------------------

Same dimensions as input.

Chevron aligned right.

Hover

Soft border change.

--------------------------------------------------
SEARCH BAR
--------------------------------------------------

Height

48px

Left icon

Search

Padding

16px

Large width

Rounded ends

Very soft appearance.

--------------------------------------------------
TEXT AREA
--------------------------------------------------

Minimum height

120px

Radius

14px

Padding

16px

Auto grow

Preferred.

--------------------------------------------------
TOGGLE
--------------------------------------------------

Width

44px

Height

24px

Smooth animation

Brand teal when enabled.

--------------------------------------------------
CHECKBOX
--------------------------------------------------

18px

Rounded corners

Animated checkmark.

--------------------------------------------------
RADIO BUTTON
--------------------------------------------------

18px

Soft transition.

--------------------------------------------------
SIDEBAR
--------------------------------------------------

Width

240px

Background

White

Sections

Large spacing

Navigation items

44px height

Radius

12px

Active item

Pastel green

Hover

Neutral gray

Logo area

80px

Footer

Pinned bottom.

--------------------------------------------------
TOP BAR
--------------------------------------------------

Minimal.

Avoid heavy headers.

Contains

Page title

Search

Profile

Actions

Height

72px

--------------------------------------------------
RECOMMENDATION CARD
--------------------------------------------------

Padding

28px

Radius

20px

Large icon

56px

Primary message

18px

Secondary text

15px

CTA button aligned right.

Background depends on recommendation type.

--------------------------------------------------
NEEDS FUNDING ROW
--------------------------------------------------

Height

68px

Structure

Icon

↓

Category

↓

Target

↓

Allocated

↓

Missing

↓

Progress

↓

Fund Button

Progress

10px

Rounded

Fund button

Primary pill

--------------------------------------------------
PROGRESS BAR
--------------------------------------------------

Height

10px

Radius

999px

Background

Light gray

Animated fill

Color depends on status.

--------------------------------------------------
TIMELINE ITEM
--------------------------------------------------

Padding

20px

Radius

16px

Hover

Soft background

Icon left

Amount right

Notes below title

Never table-like.

--------------------------------------------------
TRANSACTION CARD
--------------------------------------------------

White surface

Comfortable spacing

No harsh borders

Soft hover

Amount emphasized

Metadata subdued.

--------------------------------------------------
CHART CARD
--------------------------------------------------

Padding

24px

Title

Top left

Filter

Top right

Chart

Large

Legend

Bottom

No unnecessary borders.

--------------------------------------------------
DONUT CHART
--------------------------------------------------

Large center value

Soft colors

Rounded segments

Animated loading.

--------------------------------------------------
BAR CHART
--------------------------------------------------

Rounded bars

Soft gradients

Animated growth

Generous spacing

No harsh grid lines.

--------------------------------------------------
LINE CHART
--------------------------------------------------

Rounded joins

Smooth animation

Hover dots

Soft tooltip.

--------------------------------------------------
TOOLTIP
--------------------------------------------------

Dark surface

Rounded

14px padding

Small shadow

Never exceed necessary width.

--------------------------------------------------
EMPTY STATE
--------------------------------------------------

Large illustration area

80px icon

Headline

Support text

Primary CTA

Secondary CTA optional.

--------------------------------------------------
TOAST
--------------------------------------------------

Top right

Rounded

Soft shadow

Auto dismiss

Success

Green accent

Error

Red accent

Information

Blue accent.

--------------------------------------------------
DIALOG
--------------------------------------------------

Radius

24px

Padding

32px

Large title

Visible actions

Scrollable body

Footer fixed.

--------------------------------------------------
DRAWER
--------------------------------------------------

Width

420px

Padding

28px

Sections separated by 32px.

--------------------------------------------------
DROPDOWN
--------------------------------------------------

Radius

14px

Padding

8px

Items

44px height

Hover

Soft gray

Selected

Pastel teal.

--------------------------------------------------
ACCORDION
--------------------------------------------------

Smooth animation

220ms

Chevron rotates

Content fades

Never snap open.

--------------------------------------------------
TABLES
--------------------------------------------------

Avoid whenever possible.

Prefer rich list rows.

If tables are required:

Large spacing

Hover states

Rounded corners

Sticky header

No vertical borders.

--------------------------------------------------
LOADING
--------------------------------------------------

Always skeletons.

Skeletons mimic final layout.

Never show blank white screens.

--------------------------------------------------
MICRO INTERACTIONS
--------------------------------------------------

Cards lift

Buttons brighten

Icons fade

Charts animate

Rows highlight

Accordions expand smoothly

Dialogs fade and scale

Every interaction should provide subtle feedback.

--------------------------------------------------
COMPONENT RULE

If a new component is introduced,

it must follow this document.

No one-off styling is permitted.