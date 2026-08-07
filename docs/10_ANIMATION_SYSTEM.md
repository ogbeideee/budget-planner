# Budget Planner Desktop
# Animation & Motion System v2.0

This document defines every animation used throughout the application.

Animation is functional.

It communicates:

• hierarchy

• feedback

• continuity

• confidence

Never animate simply because it looks nice.

Every animation must have a purpose.

--------------------------------------------------
DESIGN PRINCIPLE
--------------------------------------------------

The application should feel alive.

Nothing should suddenly appear.

Nothing should suddenly disappear.

Everything transitions naturally.

Motion should be calm.

Not playful.

--------------------------------------------------
TIMING SYSTEM
--------------------------------------------------

Very Fast

120ms

Fast

180ms

Standard

220ms

Slow

320ms

Large transitions

420ms

Never exceed 500ms.

--------------------------------------------------
EASING
--------------------------------------------------

Default

ease-out

Entering

ease-out

Leaving

ease-in

No bounce.

No elastic.

No overshoot.

--------------------------------------------------
PAGE TRANSITIONS
--------------------------------------------------

When changing pages

Old page

Fade out slightly

↓

New page

Fade in

↓

Translate upward

8px

Duration

220ms

--------------------------------------------------
CARD HOVER
--------------------------------------------------

Hover

TranslateY(-2px)

Shadow

Increase

Scale

Never

Cards should never zoom.

--------------------------------------------------
BUTTONS
--------------------------------------------------

Hover

Slight brightness increase

↓

Soft shadow

↓

Background transition

Active

TranslateY(1px)

Duration

150ms

--------------------------------------------------
SIDEBAR
--------------------------------------------------

Hover

Soft background fade

Active

Background slides smoothly

Indicator

Animates

No snapping.

--------------------------------------------------
INPUTS
--------------------------------------------------

Focus ring

Fade in

Border color

Transition

Placeholder

Color transition

Never abrupt.

--------------------------------------------------
DIALOGS
--------------------------------------------------

Opening

Opacity

0 → 100

Scale

96%

↓

100%

Duration

180ms

Closing

Reverse.

Backdrop

Fade only.

--------------------------------------------------
DRAWERS
--------------------------------------------------

Slide from right

Opacity

0 → 100

Duration

220ms

Backdrop

Fade.

--------------------------------------------------
DROPDOWNS
--------------------------------------------------

Fade

↓

Scale

98%

↓

100%

Duration

160ms

--------------------------------------------------
ACCORDIONS
--------------------------------------------------

Height animation

220ms

Opacity

220ms

Chevron

Rotate

180°

No snapping.

--------------------------------------------------
TOASTS
--------------------------------------------------

Slide

Right

↓

Left

Fade

Duration

180ms

Dismiss

Reverse.

--------------------------------------------------
SEARCH RESULTS
--------------------------------------------------

Fade between result sets.

Never flash.

Never clear abruptly.

--------------------------------------------------
TABLE ROWS
--------------------------------------------------

Hover

Soft background

Duration

140ms

Selected

Soft highlight

--------------------------------------------------
TIMELINE ITEMS
--------------------------------------------------

Hover

Lift slightly

Background tint

Expand

Animate height

No instant jumps.

--------------------------------------------------
PROGRESS BARS
--------------------------------------------------

Animate width

400ms

Ease out.

Never instant.

--------------------------------------------------
DONUT CHART
--------------------------------------------------

Animate sweep

500ms

Center metric

Count up

400ms

--------------------------------------------------
LINE CHART
--------------------------------------------------

Line draws

500ms

Area fades

300ms

Points appear

Last

--------------------------------------------------
BAR CHART
--------------------------------------------------

Bars grow upward

450ms

Hover

Highlight

--------------------------------------------------
NUMBER ANIMATIONS
--------------------------------------------------

Large KPI values

Count upward

Duration

500ms

Never animate every render.

Only animate when value changes.

--------------------------------------------------
LOADING
--------------------------------------------------

Never show blank content.

Use skeletons.

Skeleton shimmer

Very subtle.

--------------------------------------------------
EMPTY STATES
--------------------------------------------------

Illustration

Fade in

Text

Slides upward

Button

Appears last.

--------------------------------------------------
SUCCESS STATES
--------------------------------------------------

Save completed

Toast

↓

Button briefly changes

↓

Optional check icon

No confetti.

--------------------------------------------------
ERROR STATES
--------------------------------------------------

Soft shake

Maximum

6px

Only inputs.

Never shake the whole dialog.

--------------------------------------------------
THEME CHANGE
--------------------------------------------------

Theme transitions

Background

Text

Cards

Animate over

250ms

Never flash white.

--------------------------------------------------
MICRO INTERACTIONS
--------------------------------------------------

Hovering charts

Highlight series

Hovering legends

Highlight chart

Hovering KPI

Lift

Hovering category

Tint

Hovering navigation

Soft fade

Every interactive element should respond.

--------------------------------------------------
SCROLLING
--------------------------------------------------

Native smooth scrolling.

Sticky headers

Remain fixed

Never overlap content.

--------------------------------------------------
REDUCED MOTION
--------------------------------------------------

Respect the user's operating system preference.

When reduced motion is enabled:

Disable

Count-up animations

Chart drawing

Large transitions

Keep

Opacity transitions

Focus transitions

Hover feedback

--------------------------------------------------
FINAL RULE
--------------------------------------------------

The user should notice when animations are missing,

not when they are present.

Good animation is almost invisible.