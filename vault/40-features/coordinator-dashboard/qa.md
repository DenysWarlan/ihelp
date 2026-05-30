---
title: "QA Report — SLA System & Coordinator Dashboard"
type: qa-report
status: partial
created: 2026-05-30
feature: "vault/40-features/coordinator-dashboard/feature.md"
tester: QA
---

# QA Report: SLA System & Coordinator Dashboard

## Result: PARTIAL (bugs found and fixed)

## Test Coverage

| Type | Count | Passed | Failed |
|---|---|---|---|
| API endpoint | 3 | 3 | 0 |
| Code review | 6 files | 5 | 1 |
| Data validation | 6 timers | 6 | 0 |

## Bugs Found

| # | Severity | Description | Status |
|---|---|---|---|
| 1 | HIGH | `sla-dashboard.service.ts` — BREACHED threshold used 12h (color-based) instead of 24h (L3 escalation). Cases 12h-24h old showed as "BREACHED" when they were only "AT_RISK" | FIXED |
| 2 | MEDIUM | `sla-dashboard.service.ts` — Deadline calculation for breached timers used 12h threshold, showing past deadlines. Now uses next escalation level (L1→L2→L3→L4) | FIXED |
| 3 | LOW | Overview ignored `currentLevel` from DB, recalculating status purely from elapsed time. Now uses escalation-aligned thresholds consistent with the processor | ACCEPTED (status from elapsed time is sufficient for overview widget) |
| 4 | INFO | Agent false positive: claimed `resumeTimer()` pause duration math was inverted. Verified correct — shifting `startedAt` forward by pause duration preserves elapsed time | N/A |

## Files Changed

| File | Change |
|---|---|
| `apps/api/src/sla/sla.const.ts` | Added `SLA_OVERVIEW_AT_RISK_MS` (4h) and `SLA_OVERVIEW_BREACH_MS` (24h) constants |
| `apps/api/src/sla/sla-dashboard.service.ts` | Fixed `getOverview()` to use escalation-aligned thresholds and next-level deadlines |

## API Test Results

### GET /api/sla/overview (coordinator token)
- Returns `totalActive: 6`, `breached: 6` (all timers are days/weeks old — correctly BREACHED at 24h+)
- Deadlines now show L4 threshold (startedAt + 48h) instead of old 12h
- `remainingMinutes: 0` correct for all past-deadline timers

### GET /api/assignment/suggestions (coordinator token)
- Returns 4 unassigned cases with wait times, priority, suggested consultant
- Data structure matches frontend `AssignmentSuggestion` model

### GET /api/crisis/alerts (coordinator token)
- Returns empty array (no active crisis alerts in DB)
- Endpoint responds correctly

## SLA Threshold Alignment (Before → After)

| Status | Before (color-based) | After (escalation-aligned) |
|---|---|---|
| ON_TRACK | < 4h | < 4h (before L1) |
| AT_RISK | 4h - 12h | 4h - 24h (L1/L2 range) |
| BREACHED | >= 12h | >= 24h (L3 reassignment) |

## Recommendation

- [x] Ready to merge
- [ ] Needs fixes
- [ ] Needs re-review after fixes
