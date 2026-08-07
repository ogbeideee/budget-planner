# Budget Planner Desktop
# Design Tokens

This file defines the implementation tokens for the entire application.

Every spacing value, color, radius, shadow, typography size, animation duration and z-index in the application must originate from these tokens.

No component should contain hardcoded values.

--------------------------------------------------
COLORS
--------------------------------------------------

Primary
#0EA5A4

Primary Hover
#0F766E

Primary Dark
#115E59

Secondary
#2563EB

Accent
#8B5CF6

Success
#22C55E

Warning
#F59E0B

Danger
#EF4444

Background
#F7F8FC

Surface
#FFFFFF

Border
#E8EDF3

Text
#0F172A

Text Secondary
#475569

Text Muted
#64748B

--------------------------------------------------
SPACING
--------------------------------------------------

space-1 = 4px
space-2 = 8px
space-3 = 12px
space-4 = 16px
space-5 = 20px
space-6 = 24px
space-8 = 32px

Avoid spacing values above 32px unless absolutely necessary
(e.g. empty states).

--------------------------------------------------
RADIUS
--------------------------------------------------

xs = 6px
sm = 10px
md = 14px
lg = 18px
xl = 20px
2xl = 24px
pill = 999px

--------------------------------------------------
SHADOWS
--------------------------------------------------

Card

0 12px 40px rgba(15,23,42,.06)

Hover

0 18px 50px rgba(15,23,42,.10)

Dialog

0 30px 80px rgba(15,23,42,.15)

--------------------------------------------------
TYPOGRAPHY
--------------------------------------------------

Page Title

32px

Section Title

22px

Card Title

16px

Navigation

14px

Body

13px

Secondary Text

12px

Caption

11px

Primary KPI

30px

Secondary KPI

24px

Small KPI

20px

Badge

11px

Designed for desktop productivity density (Linear, Raycast, Notion-class),
not marketing websites.

KPI card

Height 150px max · Padding 16px · Radius 16px · Element gap 8px

--------------------------------------------------
BUTTONS
--------------------------------------------------

Height

40px

Small

32px

Large

44px

Radius

12px

Horizontal padding

16px

--------------------------------------------------
INPUTS

Height

44px

Radius

12px

--------------------------------------------------
ANIMATION

Fast

150ms

Default

220ms

Slow

400ms