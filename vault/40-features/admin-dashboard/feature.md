---
title: "Admin Dashboard — Live Data + Navigation"
type: feature-spec
status: in-progress
created: 2026-05-30
epic: "N/A"
story: "N/A"
author: Dev
baseline_commit: 6f0a9fa
context:
  - "vault/30-bmad/architecture/architecture.md"
---

# Feature: Admin Dashboard — Live Data + Navigation

## Context

The admin dashboard currently shows only 6 navigation cards. Admin needs at-a-glance metrics, alerts, and recent activity alongside navigation.

## Task

Add live data blocks to the admin dashboard: stats row, conditional alert banners, and a recent audit feed. Keep the existing 6 navigation cards.

## Layout (top to bottom)

1. **Alert banners** (conditional) — crisis alerts (error), duplicate suspects (warning)
2. **Stats row** (4 cards) — Total Users, Active Cases, Pending Invites, SLA Breaches
3. **Navigation cards** (3x2 grid) — Users, Courses, Settings, Analytics, Audit Log, GDPR
4. **Recent audit log** (last 8 entries) — user, action, timestamp

## Technical Plan

### API Endpoint (new)

`GET /admin/dashboard` → returns:
```json
{
  "stats": {
    "totalUsers": 142,
    "usersByRole": { "person": 127, "consultant": 12, "supervisor": 3 },
    "activeCases": 24,
    "pendingInvites": 3,
    "slaBreaches": 1
  },
  "alerts": {
    "crisisAlerts": 0,
    "duplicateSuspects": 4
  },
  "recentAudit": [
    { "id": "...", "action": "USER_CREATED", "performedByName": "Admin", "entityType": "User", "createdAt": "..." }
  ]
}
```

### Files to create/change

| File | Action | Description |
|---|---|---|
| `apps/api/src/admin/admin.controller.ts` | Modify | Add GET /admin/dashboard endpoint |
| `apps/api/src/admin/admin.service.ts` | Modify | Add getDashboardStats() method |
| `libs/staff/data-access/model/admin.model.ts` | Create | AdminDashboard interfaces |
| `libs/staff/data-access/service/admin.service.ts` | Create | HTTP service for admin dashboard |
| `libs/staff/data-access/store/admin.store.ts` | Create | Signal store for admin dashboard |
| `libs/staff/data-access/service/admin-facade.service.ts` | Create | Facade for admin dashboard |
| `libs/staff/components/admin/admin.component.ts` | Modify | Inject facade, load data |
| `libs/staff/components/admin/admin.component.html` | Modify | Add stats, alerts, audit sections |
| `libs/staff/components/admin/admin.component.scss` | Modify | Add stats, audit, alert styles |
| `apps/web/src/assets/i18n/en.json` | Modify | Add dashboard i18n keys |
| `apps/web/src/assets/i18n/uk.json` | Modify | Add dashboard i18n keys |

### UI Design

- **Stat cards**: icon in 40px accent-light circle, large number (28px bold), label (14px secondary), SLA uses error color when > 0
- **Nav cards**: keep existing 3x2 grid with icon circles (already done)
- **Audit feed**: white card list, each item: avatar circle + action text + relative time
- **Alert banners**: ui-alert-banner component, error/warning variants

## Tasks & Acceptance

- [x] Task 1: Analyst — define data blocks (7 blocks from existing Prisma models)
- [x] Task 2: UX Designer — layout spec (4-section vertical layout)
- [x] Task 3: Backend — add GET /admin/dashboard endpoint with Prisma queries
- [x] Task 4: Frontend data layer — model, service, store, facade
- [x] Task 5: Frontend UI — admin component rewrite with all sections
- [x] Task 6: i18n — add EN/UK keys for dashboard
