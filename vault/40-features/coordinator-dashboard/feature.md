---
title: "Coordinator Dashboard — Redesign with Live Data"
type: feature-spec
status: complete
created: 2026-05-30
epic: "N/A"
story: "N/A"
author: Dev
baseline_commit: 6f0a9fa
context:
  - "vault/30-bmad/architecture/architecture.md"
---

# Feature: Coordinator Dashboard — Redesign with Live Data

## Context

The coordinator dashboard was a generic stats view shared with consultants. It needed meaningful coordinator-specific data: SLA overview, new assignment requests table, crisis alert count, and at-risk case warnings.

## Task

Redesign the coordinator dashboard to match the Pencil design (node tEIIK), replacing generic stat cards with coordinator-specific metrics, adding a new requests table, and a conditional SLA alert banner.

## Technical Plan

### Files changed

| File | Action | Description |
|---|---|---|
| `libs/staff/components/coordinator/coordinator.component.html` | Rewrite | New layout: header, 4 stat cards, requests table, alert banner |
| `libs/staff/components/coordinator/coordinator.component.ts` | Modify | Add IconComponent import, add isUrgentWait() method, remove unused AlertBannerComponent |
| `libs/staff/components/coordinator/coordinator.component.scss` | Rewrite | Surface-colored stat cards, Geist Mono values, white table card, custom alert banner |
| `apps/web/src/assets/i18n/en.json` | Modify | Add coordinator dashboard i18n keys |
| `apps/web/src/assets/i18n/uk.json` | Modify | Add coordinator dashboard i18n keys |

### UI Components

- **Stat cards** (4): New Requests, Active Cases, SLA Breaches, Crisis Cases — surface background, Geist Mono 32px values, 13px labels, crisis value red when > 0
- **New Requests table**: white card with surface-colored header, columns: Name, Topic, Priority (badge), Wait Time (red when urgent), Status
- **Alert banner**: conditional red banner when at-risk cases > 0, with triangle-alert icon and review button

## Tasks & Acceptance

- [x] Task 1: Analyst — identify coordinator-specific data blocks from existing API endpoints
- [x] Task 2: UX Designer — layout spec matching Pencil design
- [x] Task 3: Frontend UI — rewrite HTML template with stats, table, alert
- [x] Task 4: Frontend TS — add IconComponent, isUrgentWait() method
- [x] Task 5: Frontend SCSS — match Pencil design tokens
- [x] Task 6: i18n — add EN/UK keys for coordinator dashboard
- [x] Task 7: Build verification — clean build with no errors
