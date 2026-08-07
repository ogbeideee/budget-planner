# Budget Planner Desktop
# UI Design System v2.0

Version: 2.0

This document is the single source of truth for every visual decision in the application.

Any AI agent or developer modifying the interface MUST follow this specification.

No screen may introduce new styling unless this document is updated.

---

# DESIGN PHILOSOPHY

The application is NOT an admin dashboard.

It is a premium personal finance desktop application.

The experience should feel calm, trustworthy and sophisticated.

The interface should disappear into the background so the user's financial information becomes the focus.

The application should resemble products such as:

• Monarch Money
• Copilot Money
• Arc Browser
• Linear
• Notion Calendar
• Rise Calendar
• Superhuman

Avoid anything that resembles:

• Material UI demos
• Bootstrap dashboards
• Generic admin templates
• AI-generated CRUD applications

---

# DESIGN GOALS

The application should communicate:

Confidence

Clarity

Calmness

Precision

Luxury

Financial discipline

The user should immediately feel:

"This is a polished desktop application."

Not:

"This looks like a website."

---

# OVERALL VISUAL LANGUAGE

The application uses:

Large whitespace

Soft rounded surfaces

Minimal borders

Soft shadows

Moderate typography

Generous spacing

Pastel accent colors

Minimal visual noise

The design should feel effortless.

The type scale follows desktop-productivity conventions (Linear, Raycast,
Notion Calendar, Copilot Money): restrained sizes, tight tracking, and
density that reads as premium rather than marketing-style.

Never busy.

Never cramped.

---

# DESIGN PERSONALITY

Imagine the application is:

A luxury notebook.

Not a spreadsheet.

Information should breathe.

Every interaction should feel intentional.

---

# SURFACE HIERARCHY

There are only four surface levels.

Level 0

Application background

Level 1

Main content

Level 2

Cards

Level 3

Dialogs

Never create additional visual hierarchy unless necessary.

---

# VISUAL DENSITY

Target density:

Medium-Low

There should always be breathing room.

Never allow sections to become crowded.

Desktop applications have space.

Use it.

---

# DESIGN PRINCIPLES

Every screen should satisfy:

Clarity over decoration

Whitespace over borders

Hierarchy over color

Motion over noise

Consistency over creativity

---

# PAGE STRUCTURE

Every page follows:

Large page title

↓

Small description

↓

Primary content

↓

Secondary content

↓

Supporting information

Never begin a page with dense controls.

---

# PAGE WIDTH

Content is centered.

Maximum width:

1600px

Side padding:

40px

Top padding:

32px

Bottom padding:

48px

---

# GRID SYSTEM

12-column grid

24px gutters

Sections align to the grid.

Cards align perfectly.

Nothing should appear randomly placed.

---

# WHITESPACE

Whitespace is a design element.

Never fill empty space just because it exists.

Whitespace communicates importance.

---

# VISUAL RHYTHM

Every page should follow:

Large

Medium

Small

Small

Large

Spacing rhythm.

Avoid equal spacing everywhere.

Equal spacing feels artificial.

---

# CARD PHILOSOPHY

Cards are containers.

Not decoration.

A card exists only when it groups related information.

Avoid card soup.

Never wrap every section inside identical cards.

---

# COLORS

Color communicates meaning.

Not decoration.

Neutral backgrounds dominate.

Accent colors highlight interaction.

Never use saturated colors for large surfaces.

---

# PRIMARY BRAND COLOR

The brand color is Emerald.

It represents:

Growth

Money

Health

Planning

Confidence

It is the only dominant accent color.

---

# SECONDARY COLOR

Deep Indigo

Used sparingly.

Charts

Links

Selections

Secondary metrics

---

# WARNING COLOR

Amber

Never yellow.

---

# DANGER COLOR

Soft Coral Red

Never harsh bright red.

---

# SUCCESS COLOR

Emerald Green

Used for:

Completed goals

Healthy budgets

Positive trends

---

# TYPOGRAPHY PHILOSOPHY

Typography creates hierarchy.

Not font weight alone.

Hierarchy comes from:

Size

Spacing

Weight

Color

Never use ALL CAPS headings.

Never shout.

---

# ICON PHILOSOPHY

Icons support text.

Icons never replace text.

Every icon should sit inside a soft circular background.

Icons should feel friendly.

Never oversized.

---

# ANIMATIONS

Everything moves.

Nothing jumps.

Animations should be:

Subtle

Purposeful

Fast

Elegant

Never playful.

---

# SHADOWS

Shadows create elevation.

Not decoration.

Most components should have:

Very soft shadows.

Never dark shadows.

---

# BORDERS

Borders are almost invisible.

Use borders only to define surfaces.

Never use thick borders.

---

# BUTTONS

Buttons should feel soft.

Never rectangular.

Never harsh.

Primary actions should immediately stand out.

Secondary actions should politely disappear.

---

# INPUTS

Inputs should invite interaction.

Soft borders.

Rounded corners.

Comfortable height.

Never look technical.

---

# CHARTS

Charts should feel editorial.

Large.

Readable.

Minimal grid lines.

Soft colors.

Elegant animations.

Never resemble Excel.

---

# TABLES

Avoid traditional tables whenever possible.

Prefer:

Cards

Rows

Lists

Grouped sections

Only use dense tables when truly necessary.

---

# EMPTY STATES

Empty states should encourage action.

Never simply say:

"No data."

Instead explain:

What happened.

Why.

What the user should do next.

---

# LOADING STATES

Never show spinners unless unavoidable.

Prefer skeleton loading.

Skeletons should match the final layout.

---

# DIALOGS

Dialogs should feel lightweight.

Never exceed approximately 720px width unless absolutely necessary.

Rounded corners.

Comfortable spacing.

Large titles.

Visible actions.

---

# RESPONSIVENESS

Desktop is the primary platform.

Laptop is secondary.

Tablet is supported.

Mobile is graceful but not prioritized.

Never compromise desktop quality for mobile.

---

# CONSISTENCY

Every page should feel like it was designed on the same day by the same designer.

Nothing should feel copied from another library.

No page should have its own visual identity.

There is only one design language.

---

# FINAL RULE

Whenever there is uncertainty between:

More decoration

or

More clarity

Always choose clarity.