# Budget Planner Desktop
# Charts & Data Visualization v2.0

This document defines every chart in the application.

Charts should never feel like generic dashboard widgets.

Every visualization should communicate insight before data.

The user should immediately understand:

• What changed?
• Why it changed?
• What requires attention?

Charts are editorial.

Not technical.

--------------------------------------------------
DESIGN GOAL
--------------------------------------------------

Every chart should resemble those found in:

• Copilot Money
• Monarch Money
• Apple Stocks
• Linear Analytics
• Notion Analytics

Avoid:

• Excel
• Google Sheets
• Bootstrap dashboards
• ApexCharts defaults
• Recharts defaults

--------------------------------------------------
GENERAL RULES
--------------------------------------------------

Large charts.

Minimal clutter.

Very light grid lines.

Rounded geometry.

Soft colors.

Elegant motion.

Large tooltips.

Never display unnecessary information.

--------------------------------------------------
CHART CONTAINER
--------------------------------------------------

Radius

20px

Padding

32px

Background

White

Border

1px solid #EDF2F7

Shadow

0 12px 40px rgba(15,23,42,.06)

Minimum height

340px

Maximum height

460px

--------------------------------------------------
TITLE
--------------------------------------------------

22px

700

Subtitle

14px

Muted

Right side

Filter

Time selector

Export

--------------------------------------------------
GRID LINES
--------------------------------------------------

Very subtle.

Color

#EEF2F7

1px

No heavy axes.

--------------------------------------------------
AXIS LABELS
--------------------------------------------------

12px

Muted

Never bold.

Never black.

--------------------------------------------------
LEGEND
--------------------------------------------------

Bottom aligned.

Horizontal.

20px spacing.

Each legend item

Color dot

↓

Label

↓

Current value

Hovering legend

Highlights chart.

--------------------------------------------------
LINE CHART
--------------------------------------------------

Use for:

Spending Trend

Cash Flow

Savings Trend

Specification

Stroke width

4px

Rounded joins

Rounded caps

Smooth interpolation

No jagged lines.

Area underneath

Very soft gradient

15% opacity

Hover

Large point

Tooltip

All other points fade.

--------------------------------------------------
LINE COLORS
--------------------------------------------------

Income

Emerald

Expenses

Coral

Savings

Teal

Forecast

Indigo

--------------------------------------------------
BAR CHART
--------------------------------------------------

Bars

Radius

999px

Minimum width

18px

Spacing

16px

Hover

Brighten

Tooltip

Appears above

Bars animate upward.

--------------------------------------------------
STACKED BAR
--------------------------------------------------

Rounded top only.

Sections

Income

Expenses

Remaining

Animation

Grow upward.

--------------------------------------------------
DONUT CHART
--------------------------------------------------

Large.

Minimum diameter

220px

Rounded segments.

Center

Large value

↓

Description

↓

Small trend

Hover

Segment expands

Legend row highlights.

--------------------------------------------------
PIE CHART
--------------------------------------------------

Avoid.

Use donut instead.

--------------------------------------------------
PROGRESS CHART
--------------------------------------------------

Always rounded.

10px height.

Animated.

Never square.

--------------------------------------------------
FORECAST CARD
--------------------------------------------------

Large projected value.

Confidence pill.

Mini trend chart.

Supporting explanation.

Looks editorial.

--------------------------------------------------
CATEGORY ANALYSIS
--------------------------------------------------

Left

Donut

Right

Category ranking

Each row

Icon

Category

Amount

Percentage

Mini progress

Hovering row

Highlights donut segment.

--------------------------------------------------
TOOLTIPS
--------------------------------------------------

Background

#0F172A

Text

White

Radius

14px

Padding

16px

Show

Label

↓

Amount

↓

Percentage

↓

Supporting note

Never tiny tooltips.

--------------------------------------------------
COLOR PALETTE
--------------------------------------------------

Primary

#0EA5A4

Secondary

#2563EB

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

Purple

#8B5CF6

Slate

#64748B

Never random colors.

--------------------------------------------------
ANIMATIONS
--------------------------------------------------

Chart

Draw

500ms

Tooltip

Fade

120ms

Legend

Fade

150ms

Hover

Immediate

--------------------------------------------------
EMPTY CHART
--------------------------------------------------

Illustration

↓

Headline

↓

Explanation

↓

Primary CTA

Never show empty axes.

--------------------------------------------------
LOADING
--------------------------------------------------

Skeleton chart.

Bars

Placeholder.

Lines

Placeholder.

Never spinner.

--------------------------------------------------
RESPONSIVENESS
--------------------------------------------------

Desktop

Full chart.

Laptop

Slightly reduced padding.

Tablet

Stack legends.

Never reduce readability.

--------------------------------------------------
DATA STORYTELLING
--------------------------------------------------

Every chart should answer one question.

Never combine unrelated metrics.

One insight per chart.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

The user should understand every chart within five seconds.

The chart should explain itself through layout, hierarchy and color.

No chart should feel like it came directly from a charting library.