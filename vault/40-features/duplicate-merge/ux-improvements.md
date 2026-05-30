---
title: "Duplicate Merge UX Improvements"
type: task
status: done
created: 2026-05-29
feature: "vault/40-features/duplicate-merge/feature.md"
assignee: Dev
---

# UX Improvements: Duplicate Merge Screens

## Context

Post-implementation UX review identified 6 issues with the duplicate-list and duplicate-review screens.

## What was fixed

### 1. Design System Token Migration (Critical)
All SCSS changed from non-existent `--sai-*` variables to `--ihelp-*` design tokens from `_tokens.scss`. This aligns colors, spacing, typography, radii, and shadows with the rest of the application.

### 2. List Screen — Visual Hierarchy
- Added card structure with distinct header (background `--ihelp-bg`) and body sections
- Added user avatar initials (circle with first letter) for scannability
- Made "Review" button `variant="primary"` with Eye icon, "Dismiss" stays `variant="secondary"`
- Added proper empty state with icon, title, and hint text

### 3. Review Screen — Merge Direction Visual
- Added merge direction arrow between side-by-side cards (ArrowRight icon + "merge" label)
- Primary card has solid green border, Secondary has dashed orange border
- Each card has a header with role badge (Primary/Secondary) clearly labeled
- User avatars with initials added

### 4. Merge Confirmation Modal — Flow Redesign
- Changed from vertical stacked boxes to horizontal flow: Secondary → arrow → Primary
- Added "merge into" label on the arrow for clarity
- Secondary box uses dashed orange border, Primary uses solid green
- Swap button moved below the flow for cleaner layout

### 5. Action Safety — Danger Styling
- Merge button on review page changed from `variant="primary"` to `variant="danger"` with Merge icon
- Merge confirmation button also uses `variant="danger"`
- This visually distinguishes the irreversible merge action from normal save/submit actions

### 6. Success State — Stat Cards
- Merge success view now shows stats in a 2x2 grid of cards (cases, messages, enrollments, meetings) with large numbers
- More scannable than the previous inline text

## Files Changed

| File | Change |
|---|---|
| `libs/staff/components/duplicate-list/duplicate-list.component.html` | Restructured cards, added avatars, empty state, Eye icon |
| `libs/staff/components/duplicate-list/duplicate-list.component.scss` | Full rewrite with `--ihelp-*` tokens |
| `libs/staff/components/duplicate-list/duplicate-list.component.ts` | Removed unused CardComponent import |
| `libs/staff/components/duplicate-review/duplicate-review.component.html` | Merge direction arrow, card headers, danger buttons, flow modal |
| `libs/staff/components/duplicate-review/duplicate-review.component.scss` | Full rewrite with `--ihelp-*` tokens |
| `apps/web/src/assets/i18n/en.json` | Added `duplicatesEmptyHint`, `duplicatesUsers` |
| `apps/web/src/assets/i18n/uk.json` | Added `duplicatesEmptyHint`, `duplicatesUsers` |
