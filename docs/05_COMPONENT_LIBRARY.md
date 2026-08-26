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

--------------------------------------------------
CATEGORY ICON LIBRARY
--------------------------------------------------

Source of truth: `components/settings/iconLibrary.ts` (`ICON_GROUPS`).
Rendered by `components/ui/IconValue.tsx`; chosen through
`components/ui/IconPicker.tsx` (searchable grouped grid, favourites, recents,
selected state, keyboard grid navigation).

FORMAT

Category icons are EMOJI, stored as the character itself on `Category.icon`.
The library also carries a "Line icons" group of SVG components keyed by name
(`VECTOR_ICON_COMPONENTS`), but category pickers pass `vectors={false}` and
never offer them: a category's icon is printed as raw text in Recharts axis
labels and native `<option>` elements, where a vector key would render as the
literal string "wallet". Income sources may use either.

GROUPS (114 options)

Finance — piggy bank, cash, card, bank, coin, exchange, growth, gift,
  repayment, bill, transfer, insurance, charity
Home & utilities — house, housing, building, light, electricity, water, waves,
  fire, cleaning
Shopping & food — cart, store, bags, apple, pizza, burger, noodles, coffee,
  salad, drink, basket, dining out
Transport — bus, car, taxi, train, bike, fuel, parking, plane
Lifestyle & family — clothes, babies, education, fitness, beauty, haircut,
  pets, toys, celebration, birthday
Entertainment — movie, games, headphones, music (+ instruments), dice, chess,
  target, TV
Health & care — hospital, medical, pill, lotion, ambulance, wellness, gym
Nature & outdoors — leaf, flower, butterfly, ladybug, beach, mountains,
  camping, tree
Tech & office — laptop, computer, phone, keyboard, mouse, printer, camera,
  video, books, chart, internet, signal, satellite
Other — miscellaneous, folder, label, star
Line icons (vector, non-category) — wallet, chart, trend up/down, target,
  calendar, clock, recurring, document, sparkles, arrows, plus, grid

Every option carries a label and search keywords; the picker filters on both.
Icon values are unique across the whole library (asserted in
`iconLibrary.test.ts`), and any icon a migration assigns must exist here or the
category ends up with a value the picker cannot show as selected.

CATEGORY ASSIGNMENT AUDITS

Two audits have corrected mismatched assignments, each as a one-time schema
migration matched on lowercase name AND the specific wrong icon, so a category
the user has since re-iconed keeps their choice:

v4 -> v5: Edi (plant -> signal), Essentials (store/gift -> basket).
v5 -> v6: Loan (piggy bank -> repayment), Misc (cart -> box),
  internet (light bulb -> globe).

--------------------------------------------------
CATEGORY REGISTRY  (lib/categoryRegistry.ts)
--------------------------------------------------

THE single source of truth for how a category is displayed.

RULE: any component rendering a category's name, icon or colour MUST call
`categoryDisplay()`. Do not format the name, read `.icon` off the record, or
reach for `categoryColor` / `categoryAccent` / `budgetRowTreatment` directly.

  import { categoryDisplay } from "@/lib/categoryRegistry";

  const display = categoryDisplay(category, "Category");
  // { id, name, icon, color, chip, tint, strong, missing }

  name    canonical, capitalized once (a category stored "internet" reads
          "Internet" everywhere)
  icon    the stored icon, or the shared fallback glyph "•"
  color   hex, for charts and inline styles
  chip    Tailwind classes for a tinted icon tile
  tint    very subtle row background
  strong  stronger accent for progress bars and percentages
  missing true when the category could not be resolved

`findCategoryDisplay(categories, id, fallbackName?)` is the same thing for
callers holding an id rather than the record.

PRESENTATIONAL OVERRIDES ARE FINE — size, opacity, layout, a different tint
alpha — as long as the BASE name/icon/colour come from the registry. Never
re-derive the underlying value.

USER-CREATED CATEGORIES need no registration: the registry derives everything
from the stored record, so a category created in Settings or in onboarding
resolves exactly like a seeded one. There is no hardcoded table to update.

WHY IT EXISTS: the same two bugs recurred repeatedly because each facet lived
somewhere different — the name was capitalized ad hoc per component, the icon
was read raw with a different fallback in each caller, and the colour came from
one of THREE parallel helpers. Each fix corrected one component and the bug
reappeared in the next.

ENFORCEMENT: `lib/__tests__/categoryRegistry.test.tsx` renders the same
category across BudgetRow, RecentActivity and Category analysis and asserts one
icon and one capitalization, and scans component sources for any file
re-deriving an icon or colour. A component that bypasses the registry fails
that test — which is how the 14 sites missed in the first migration pass were
found.

--------------------------------------------------
CATEGORY ICON INVENTORY  (components/settings/iconLibrary.ts)
--------------------------------------------------

153 selectable emoji across 14 groups, plus a 14-icon "Line icons" vector set
that is offered to INCOME SOURCES only (category pickers pass vectors={false}
— a category icon prints as raw text in Recharts axis labels and <option>
elements, where a vector key would render as the literal string "wallet").

Every option carries a label and search keywords; the picker filters on both,
so an icon is reachable by concept as well as by name ("tithe" finds Church,
"okada" finds Bike delivery).

Food & dining  (17)
  🛒 Groceries  ·  🧺 Basket  ·  🍎 Fruit  ·  🥦 Vegetables  ·  🍞 Bakery  ·  🥩 Meat  ·  🐟 Fish  ·  🍽️ Dining out  ·  🍕 Pizza  ·  🍔 Fast food  ·  🍜 Noodles  ·  🍱 Takeaway  ·  ☕ Coffee  ·  🥗 Salad  ·  🥤 Soft drink  ·  🍺 Bar  ·  🍷 Wine

Housing  (10)
  🏠 House  ·  🏘️ Housing  ·  🏢 Apartment  ·  🔑 Rent  ·  🏦 Mortgage  ·  🔨 Repairs  ·  🛋️ Furniture  ·  🛏️ Bedroom  ·  🧹 Cleaning  ·  🪴 Houseplants

Utilities  (7)
  💡 Electricity  ·  ⚡ Energy  ·  💧 Water  ·  🚰 Water supply  ·  🔥 Gas  ·  🗑️ Waste  ·  🌊 Waves

Connectivity  (6)
  🌐 Internet  ·  📶 Airtime  ·  📱 Phone  ·  ☎️ Calls  ·  📡 Satellite  ·  📺 Streaming

Transport  (11)
  🚗 Car  ·  ⛽ Fuel  ·  🚌 Bus  ·  🚆 Train  ·  🚕 Taxi  ·  🛵 Bike delivery  ·  🚲 Bicycle  ·  🅿️ Parking  ·  🔧 Servicing  ·  ✈️ Flights  ·  🚢 Ferry

Financial  (14)
  💰 Savings  ·  💵 Cash  ·  💳 Card  ·  🏧 ATM  ·  🪙 Coins  ·  💱 Exchange  ·  📈 Investment  ·  📉 Loss  ·  💸 Loan repayment  ·  🧾 Bills  ·  🔁 Transfers  ·  🛡️ Insurance  ·  💎 Crypto  ·  📊 Reports

Health  (11)
  🏥 Hospital  ·  ⚕️ Medical  ·  🩺 Check-up  ·  💊 Pharmacy  ·  🩹 First aid  ·  🦷 Dental  ·  🚑 Emergency  ·  🧘 Therapy  ·  🏋️ Gym  ·  💪 Fitness  ·  🧴 Toiletries

Family & education  (9)
  👶 Childcare  ·  🍼 Baby supplies  ·  🧸 Kids  ·  🎓 School fees  ·  📚 Books  ·  🎒 School supplies  ·  👨‍👩‍👧 Family  ·  🧑‍🦳 Elderly care  ·  🐾 Pets

Lifestyle & shopping  (25)
  🛍️ Shopping  ·  🏪 Store  ·  👕 Clothing  ·  👟 Shoes  ·  👜 Accessories  ·  🕶️ Eyewear  ·  💇 Hair  ·  💅 Beauty  ·  🎬 Cinema  ·  🎮 Gaming  ·  🎧 Audio  ·  🎨 Hobbies  ·  ⚽ Sport  ·  🎲 Games  ·  ♟️ Chess  ·  🎯 Goals  ·  🎵 Music note  ·  🎶 Songs  ·  🎼 Sheet music  ·  🎤 Microphone  ·  🎹 Piano  ·  🎸 Guitar  ·  🎷 Saxophone  ·  🎺 Trumpet  ·  🥁 Drums

Work & business  (12)
  💼 Business  ·  💻 Laptop  ·  🖥️ Desktop  ·  ⌨️ Keyboard  ·  🖱️ Mouse  ·  🖨️ Printing  ·  📎 Office supplies  ·  ✏️ Stationery  ·  📇 Contacts  ·  📅 Scheduling  ·  📷 Photography  ·  📹 Video

Giving  (9)
  🎁 Gifts  ·  🤝 Charity  ·  ❤️ Donations  ·  🎗️ Causes  ·  ⛪ Church  ·  🕌 Mosque  ·  🕊️ Faith  ·  🎉 Celebrations  ·  🎂 Birthday

Travel  (7)
  🧳 Luggage  ·  🏨 Hotel  ·  🗺️ Trips  ·  🛂 Visa  ·  🏖️ Holiday  ·  🏔️ Mountains  ·  🏕️ Camping

Nature & outdoors  (7)
  🌿 Plants  ·  🌸 Flowers  ·  🌲 Trees  ·  🦋 Butterfly  ·  🐞 Ladybug  ·  ☀️ Sunny  ·  🌧️ Rain

Other  (8)
  📦 Miscellaneous  ·  🗂️ Folder  ·  🔖 Label  ·  ⭐ Starred  ·  ❓ Unknown  ·  ➕ Extra  ·  🔔 Reminders  ·  📌 Pinned

Line icons (vector, income sources only, 14) — wallet, chart, trend up,
  trend down, target, calendar, clock, recurring, document, sparkles,
  arrow up-right, arrow down-left, plus, grid

RULES

• Additive only. Never remove an option: a category may already be using
  it, and the picker could then not show that category as selected.
• Any icon a migration or a starter suggestion assigns MUST exist here
  (asserted in iconLibrary.test.ts and onboarding.test.ts).
• Prefer a distinct real-world concept over another near-identical glyph
  for a concept already covered — variety should make picking easier.
• Keep any one group at or below ~30 options so it stays scannable
  (asserted in IconPicker.perf.test.tsx).

