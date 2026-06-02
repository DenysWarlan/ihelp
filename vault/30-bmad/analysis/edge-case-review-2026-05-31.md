# Edge Case Review — Platform-Wide Audit (2026-05-31)

> Automated exhaustive path analysis across 10 critical subsystems.
> Total findings: **78 unhandled edge cases** (12 CRITICAL, 28 HIGH, 30 MEDIUM, 8 LOW)

---

## 1. Auth Flows (41 findings)

### 1.1 OAuth (5 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 1 | auth.controller.ts:66-71 | `req.user` undefined after Passport failure | Uncaught TypeError on cast to OAuthProfile |
| 2 | auth.controller.ts:351 | OAuth profile missing `providerId` field | Null reference on provider link creation |
| 3 | auth.controller.ts:141-158 | Telegram hash validation bypass via direct call | Auth bypass without hash verification |
| 4 | auth.controller.ts:177,281,348 | `FRONTEND_URL` env not validated | Open redirect to phishing sites |
| 5 | auth.service.ts (handleOAuthLogin) | user.update succeeds but providerLink.create fails | Inconsistent state, no rollback |

### 1.2 Token Rotation (4 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 6 | auth.service.ts:229-287 | Two concurrent refresh with same token | Both succeed, creating duplicate sessions |
| 7 | auth.service.ts:448-475 | First login has no tokenFamily | Compromised first session can't be family-revoked |
| 8 | auth.service.ts:255-270 | Crisis session exactly at 24h boundary | Off-by-one on rotation window |
| 9 | auth.service.ts:465-472 | Unique constraint on duplicate session create | Token returned before DB insert confirmed |

### 1.3 Invites (5 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 10 | invite.service.ts:59-74 | Two concurrent claim requests | Both pass `claimedAt` null check, race to create |
| 11 | invite.service.ts:78-94 | Two invites for same email | Second claim fails, invite marked claimed but no user |
| 12 | invite.service.ts:72 | Server clock drift (NTP) | Valid invites expire early or expired ones accepted |
| 13 | invite.service.ts:106-119 | Resend creates new token, old still valid | Two valid tokens exist simultaneously |
| 14 | invite.service.ts:95-98 | No role/email logged on claim | Forensics impossible for fraudulent claims |

### 1.4 MFA (7 MEDIUM)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 15 | mfa.service.ts:133 | User clock >90s off | TOTP fails silently, no helpful error |
| 16 | mfa.service.ts:88-94,133 | No rate limiting on TOTP attempts | Brute-force 1M combinations feasible |
| 17 | mfa.service.ts:139-170 | All 8 backup codes exhausted | User locked out with no recovery path |
| 18 | mfa.service.ts:150-165 | Variable-time bcrypt iteration | Timing attack reveals remaining code count |
| 19 | mfa.service.ts:53 | DB leak | MFA secrets stored in plaintext |
| 20 | mfa.service.ts:117-118 | User loses backup codes | No regeneration without disable/re-enable MFA |
| 21 | mfa.service.ts:88-94 | Non-numeric or >10 char input | otplib may fail unexpectedly |

### 1.5 MFA Login Flow (3 MEDIUM)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 22 | auth.service.ts:347-353 | MFA required but verify doesn't create session | User must re-login after TOTP verify |
| 23 | — (not implemented) | Staff login with backup code | No backup code fallback during login |
| 24 | — (not implemented) | User wants to disable MFA | No disable flow; only admin reset |

### 1.6 Break-Glass (6 CRITICAL)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 25 | break-glass.controller.ts:20-25 | No rate limiting, endpoint is @Public | Brute-force feasible |
| 26 | break-glass.service.ts:98-125 | Audit service fails | Login succeeds without audit trail |
| 27 | break-glass.service.ts:147 | 7-day refresh token, no single-use | Emergency access persists indefinitely |
| 28 | — (not in code) | Actions after break-glass login | No forensic distinction from normal actions |
| 29 | break-glass.service.ts:46 | Container/env compromise | Password stored in plaintext in env |
| 30 | break-glass.service.ts (OnModuleInit) | DB down at startup | Break-glass unavailable when most needed |

### 1.7 Session Invalidation (3 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 31 | auth.service.ts:297-314 | Invalid refresh token on logout | Silent success, misleading response |
| 32 | auth.service.ts:388-421 | Password changed | Existing sessions NOT revoked |
| 33 | auth.service.ts:191-209 | Provider unlinked | Sessions remain valid |

### 1.8 Provider Linking (3 MEDIUM)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 34 | auth.controller.ts:272-298 | OAuth strategy fails on link callback | req.user undefined, no null check |
| 35 | auth.service.ts:163-189 | Provider already linked to different user | Upsert succeeds without unlinking from other user |
| 36 | — (no CSRF protection) | XSS triggers provider link | Attacker links their provider to victim |

### 1.9 Input Validation (4 MEDIUM)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 37 | auth.model.ts:65-68 | Empty string as refresh token | Confusing error instead of validation error |
| 38 | auth.controller.ts:162-163 | Telegram names with whitespace only | User created with name="   " |
| 39 | break-glass.model.ts:4-9 | Empty-after-trim password | Passes validation |
| 40 | mfa.model.ts:4-9 | 10KB string as TOTP token | Passed to otplib without length check |

### 1.10 Guards (1 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 41 | auth.controller.ts:263 | linkProvider uses hardcoded Google guard | Other providers (facebook, telegram) bypass strategy |

---

## 2. Case Lifecycle & Assignment (9 findings)

### 2.1 Status Transitions (2 MEDIUM)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 42 | cases.service.ts:298-305 | ALLOWED_TRANSITIONS misconfiguration | CLOSED cases could be reopened |
| 43 | cases.service.ts:104-113 | Active case returned without consent re-check | GDPR violation for pre-consent cases |

### 2.2 Assignment Algorithm (3 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 44 | assignment.service.ts:105-110 | Zero consultants in DB | Undifferentiated fallback, no system alert |
| 45 | assignment.service.ts:121-142 | All candidates hit capacity between pre-check and atomic assign | No retry with refreshed candidate list |
| 46 | assignment.service.ts:163-194 | DEACTIVATED consultant in eligible query | Case assigned to deactivated consultant |

### 2.3 Transfer (4 HIGH)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 47 | transfer.service.ts:85-93 | Consultant initiates vacation twice | Duplicate vacation transfer records |
| 48 | transfer.service.ts:899-997 | Case manually reassigned during vacation | Return logic decrements wrong consultant's counter |
| 49 | transfer.service.ts:81-196 | Crisis case included in vacation transfer | No crisis validation (unlike permanent transfer) |
| 50 | transfer.service.ts:391-400 | Override to DEACTIVATED consultant | Deactivated consultant receives case |

---

## 3. GDPR & Privacy (5 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 51 | gdpr.service.ts:417-697 | Consent withdrawn mid-export | Export completes with withdrawn-consent data (Art. 7 violation) |
| 52 | gdpr.service.ts:492-697 | Massive data export exceeds BullMQ timeout | Lock deadlock; subsequent requests blocked |
| 53 | gdpr.service.ts:99-105, 305-316 | Deletion starts between export lock release and enqueue | Data partially deleted during export |
| 54 | gdpr.service.ts:317, 409, 695 | pg_advisory_unlock fails (connection drop) | Permanent lock deadlock |
| 55 | gdpr.service.ts:254-284 | Two deferred deletions after crisis resolves | Both attempt same lock, one silently times out |

---

## 4. Crisis Detection (5 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 56 | crisis.service.ts:71-134, 259-309 | Edited message adds crisis keywords | Duplicate CrisisAlert for same message |
| 57 | crisis.service.ts:158-199 | Two messages in same case trigger HIGH simultaneously | Duplicate escalations, alert fatigue |
| 58 | crisis.service.ts:105-113 | Crisis keyword in educational context | False positive escalation |
| 59 | DutyService:102-126 | No one on duty at night | Falls back to ALL supervisors silently |
| 60 | crisis.service.ts:315-326 | New keyword added via admin | Cache not refreshed until restart |

---

## 5. SLA Engine (5 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 61 | sla.service.ts:206-260 | Concurrent pause/resume after lock acquire | Timer corruption, manual recovery needed |
| 62 | DutyService:49-91 | DST transition (clock +/- 1h) | SLA timers off by 1 hour |
| 63 | sla.service.ts:68-120, 266-318 | Case transferred without explicit resetTimer call | SLA continues from original start |
| 64 | sla.service.ts:430-444 | job.remove() fails (Redis down) | Ghost escalations fire after resolution |
| 65 | sla.service.ts:224-230 | NTP sync backward during pause | Negative elapsed → premature escalation |

---

## 6. Chat & Omnichannel (3 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 66 | message.service.ts:105-188 | External channel delivery fails | No retry/failure state tracking |
| 67 | message.service.ts:400-424 | Channel disconnected since last message | Delivery to invalid channel |
| 68 | message.service.ts:466-528 | User merge with unread messages | Unread count inconsistent after merge |

---

## 7. LMS (7 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 69 | enrollment.service.ts:18-61 | Enrollment during archive grace period | No special handling for grace period |
| 70 | progress.service.ts:114-165 | Course version upgrade during active enrollment | Lessons may not exist in pinned version |
| 71 | progress.service.ts:114-165 | Reset progress on archived course | Can re-complete unpublished course |
| 72 | progress.service.ts:25-57 | Complete a hard-deleted lesson | Progress references non-existent lesson |
| 73 | lessons.service.ts:66-96 | Lesson deleted with DROPPED enrollments | Orphaned progress records |
| 74 | course-version.service.ts:23-81 | New version published | No re-pin or migration for existing enrollments |
| 75 | course-version.service.ts:216-263 | Lesson deletion reverts COMPLETED status | No notification to person |

---

## 8. Admin — Duplicate Merge (3 findings)

| # | Location | Trigger Condition | Potential Consequence |
|---|----------|-------------------|----------------------|
| 76 | user-merge.service.ts:82-85 | Primary user logged in during merge | Cached session has stale data, no refresh broadcast |
| 77 | user-merge.service.ts:262-275 | Secondary user has pending CaseTransfers | Transfer records orphaned |
| 78 | user-merge.service.ts:37-61 | Both users have active crisis alerts | CrisisAlert records not migrated |

---

## Priority Recommendations

### Immediate (CRITICAL — security/compliance risk)

1. **Break-glass rate limiting** (#25) — Add `@Throttle(3, 300)` to break-glass endpoint
2. **Session invalidation on password change** (#32) — Revoke all sessions in `changePassword()`
3. **Concurrent refresh token race** (#6) — Use atomic `updateMany` with `WHERE isRevoked = false`
4. **GDPR export consent re-verification** (#51) — Check consent before each data section export
5. **MFA brute-force protection** (#16) — Add attempt counter with 5-attempt lockout

### Short-term (HIGH — data integrity risk)

6. **Vacation transfer duplicate prevention** (#47) — Unique constraint on active vacation transfers
7. **Transfer return logic validation** (#48) — Verify current consultantId before decrementing
8. **Crisis keyword cache invalidation** (#60) — Emit event on keyword CRUD → refresh cache
9. **Invite double-claim** (#10) — Use Prisma transaction with `SELECT ... FOR UPDATE`
10. **Assignment deactivated filter** (#46) — Add `status: { not: DEACTIVATED }` to eligible query

### Medium-term (MEDIUM — UX/reliability)

11. Course version enrollment migration strategy
12. SLA timer DST-aware business hours
13. Channel delivery retry with dead-letter queue
14. MFA backup code regeneration flow
15. Merge notification via WebSocket to primary user
