# Budget Planner Desktop
# UI Redesign Implementation Guide v2.0

This document defines exactly how the redesign must be implemented.

The objective is to transform the application's visual presentation while preserving every existing feature, calculation and workflow.

This document is mandatory.

Do not skip steps.

--------------------------------------------------
PRIMARY OBJECTIVE
--------------------------------------------------

Rebuild the presentation layer.

Do NOT rebuild the application.

The application's functionality is already complete.

The redesign should only affect:

• Layout
• Styling
• Components
• Motion
• Typography
• Colors
• Spacing
• Charts

Business logic must remain unchanged.

--------------------------------------------------
DO NOT TOUCH
--------------------------------------------------

Never modify:

Business logic

Selectors

Calculations

Persistence

Electron configuration

Data models

State management

Storage

Routing

Hooks

Validation

Budget calculations

Reports calculations

Timeline calculations

Income calculations

Upcoming expense calculations

Only presentation.

--------------------------------------------------
IMPLEMENTATION ORDER
--------------------------------------------------

Implement in this order.

Phase 1

Design Tokens

↓

Phase 2

Global Theme

↓

Phase 3

Reusable Components

↓

Phase 4

Planner

↓

Phase 5

Reports

↓

Phase 6

Timeline

↓

Phase 7

Settings

↓

Phase 8

Dialogs

↓

Phase 9

Animations

↓

Phase 10

Final Polish

Never redesign everything simultaneously.

--------------------------------------------------
PHASE 1
DESIGN TOKENS
--------------------------------------------------

Create a centralized design token system.

Include

Colors

Spacing

Typography

Border Radius

Shadows

Animation Durations

Transitions

Breakpoints

Icon Sizes

Z-index

Opacity

No hardcoded values inside components.

--------------------------------------------------
PHASE 2
GLOBAL THEME
--------------------------------------------------

Replace every hardcoded color.

Replace every hardcoded radius.

Replace every hardcoded shadow.

Replace every hardcoded spacing value.

Everything should reference the design system.

--------------------------------------------------
PHASE 3
COMPONENT LIBRARY
--------------------------------------------------

Refactor reusable components first.

Examples

Button

Card

Input

Select

Dialog

Drawer

Badge

Progress

Tooltip

Accordion

Sidebar

Top Bar

Metric Card

Recommendation Card

Needs Funding Row

Timeline Card

Only after reusable components are complete should pages be redesigned.

--------------------------------------------------
PHASE 4
PLANNER
--------------------------------------------------

Redesign only the Planner.

Do not touch Reports.

Do not touch Timeline.

Verify functionality after each section.

Checklist

Hero

Recommendations

Summary Cards

Month At A Glance

Needs Funding

Budget Health

Allocation

Expense Breakdown

Recent Activity

Test after every section.

--------------------------------------------------
PHASE 5
REPORTS
--------------------------------------------------

Redesign Reports.

Replace chart presentation.

Improve analytics layout.

Never modify calculations.

Verify charts match existing data.

--------------------------------------------------
PHASE 6
TIMELINE
--------------------------------------------------

Replace table-like presentation.

Convert transactions into premium activity cards.

Maintain:

Search

Filters

Sorting

Editing

Deleting

No regressions.

--------------------------------------------------
PHASE 7
SETTINGS
--------------------------------------------------

Redesign settings using reusable components.

Improve category management.

Improve icon picker.

Improve dialogs.

Do not modify storage.

--------------------------------------------------
PHASE 8
DIALOGS
--------------------------------------------------

Normalize every dialog.

Every dialog must use:

Common spacing

Common typography

Common buttons

Common animations

Responsive sizing

Scrollable content

Fixed footer actions

--------------------------------------------------
PHASE 9
ANIMATIONS
--------------------------------------------------

Apply motion system.

Never animate layout unnecessarily.

Every animation should reinforce interaction.

Respect reduced-motion preferences.

--------------------------------------------------
PHASE 10
FINAL POLISH
--------------------------------------------------

Audit entire application.

Look for:

Misaligned cards

Incorrect spacing

Wrong typography

Wrong colors

Duplicate styles

Inconsistent hover effects

Inconsistent shadows

Inconsistent icon sizes

Inconsistent button heights

Remove all visual inconsistencies.

--------------------------------------------------
TEST AFTER EVERY PHASE
--------------------------------------------------

Run

Lint

↓

Typecheck

↓

Build

↓

Launch Electron

↓

Manual QA

Never continue if the current phase introduces regressions.

--------------------------------------------------
QA CHECKLIST
--------------------------------------------------

Planner

Reports

Timeline

Settings

Dialogs

Dark Mode

Light Mode

Electron Build

Animations

Responsive Layout

Import

Export

Persistence

Needs Funding

Fund Button

Upcoming Expenses

Reports Accuracy

Category Management

Income Management

All must pass before completion.

--------------------------------------------------
PERFORMANCE
--------------------------------------------------

Do not introduce unnecessary re-renders.

Memoize expensive calculations.

Lazy-load heavy visualizations if needed.

Avoid unnecessary animations.

Maintain desktop responsiveness.

--------------------------------------------------
ACCESSIBILITY
--------------------------------------------------

Maintain keyboard navigation.

Visible focus states.

Proper contrast.

Semantic HTML.

ARIA where appropriate.

Dialogs trap focus.

Escape closes dialogs.

--------------------------------------------------
COMPLETION CRITERIA
--------------------------------------------------

The redesign is complete only when:

• Every document in the docs folder has been implemented.
• No functionality has changed.
• No regressions exist.
• The desktop application builds successfully.
• Light mode and dark mode both match the design language.
• The UI feels handcrafted rather than AI-generated.
• Every screen follows one consistent visual language.
• The application resembles a polished commercial desktop finance application.

--------------------------------------------------
FINAL REVIEW
--------------------------------------------------

Before marking the redesign complete:

Review every screen side-by-side.

Ask:

Would this look at home beside:

• Copilot Money
• Monarch Money
• Arc Browser
• Linear
• Notion Calendar

If the answer is "no" for any screen, continue refining until it reaches the required standard.