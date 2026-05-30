---
title: "Duplicate Person Detection & Merge Analysis"
type: analysis
status: complete
created: 2026-05-29
author: Analyst
story: S-E13-05
---

# Duplicate Person Detection & Merge Analysis

## 1. Context

The ihelp platform is a care coordination CRM where people seeking help (role=PERSON) can arrive via multiple channels: web registration (email/Google OAuth), Telegram bot, and potentially Instagram/Viber. Each channel creates a separate User record. When the same real person uses different channels, duplicate User records accumulate, fragmenting their care history across multiple identities.

### What exists today

| Component | Status | Details |
|-----------|--------|---------|
| Backend `findDuplicates()` | Implemented | O(n^2) loop, matches on exact email (case-insensitive) and exact name (case-insensitive). Returns flat list. |
| Frontend banner | Implemented | Dismissible `ui-alert-banner` showing duplicate count on users-manage page. No drill-down. |
| Admin review/merge UI | Not implemented | AC2 of S-E13-05 is entirely missing. |
| Telegram-to-web matching | Partial | `auth.service.ts` attempts to match Telegram users to existing users via `contactValue` in CareCase, but only at first login. No retroactive detection. |
| ProviderLink cross-reference | Not used | `findDuplicates()` does not check ProviderLink data at all. |

### Why this matters

- A person who registered via web and later contacts via Telegram gets two User records, two separate case histories, two message threads. Consultants see an incomplete picture.
- Enrollment and lesson progress are per-user, so a merged person's course progress could be split across identities.
- Reporting (analytics snapshots, caseload counts) is inflated.

---

## 2. Process Analysis

### AS-IS: How duplicates are created

```
Person registers via web (email/Google)
  -> User record created (email: person@example.com, provider: google)
  -> ProviderLink: { provider: 'google', providerAccountId: '12345' }

Same person contacts via Telegram bot
  -> No email provided by Telegram
  -> Synthetic email generated: {telegramId}@telegram.user
  -> auth.service.ts checks contactValue in CareCase for Telegram username match
  -> IF match found: links to existing user (happy path, no duplicate)
  -> IF no match (person never provided Telegram username in a case, or different username):
     -> New User record created (email: 987654@telegram.user)
     -> ProviderLink: { provider: 'telegram', providerAccountId: '987654' }
     -> DUPLICATE CREATED
```

**Other duplicate scenarios:**
1. Same person registers with two different email addresses (personal + work)
2. Name typos during intake: "Olena Kovalenko" vs "Olena Kovalenko " (trailing space) — currently caught by trim, but "Olena" vs "Helena" is not
3. Admin manually creates a User record for a person who later self-registers
4. Person uses Google OAuth with one email, then later uses email/password with a different email

### AS-IS: What the admin sees

1. Navigate to Users Management page
2. See a warning banner: "3 potential duplicates detected"
3. No way to view which users are duplicates
4. No way to act on them

### TO-BE: Target flow

```
1. Admin navigates to Users Management page
2. Banner shows: "3 potential duplicate groups detected — Review"
3. Admin clicks "Review" -> navigates to Duplicate Review page
4. Sees a list of duplicate groups (not flat pairs):
   Group 1: [User A, User B] — reason: same name "Olena Kovalenko"
   Group 2: [User C, User D, User E] — reasons: same Telegram contact, similar name
5. Admin clicks a group -> side-by-side comparison view
6. Admin selects primary record (which survives)
7. Admin clicks "Merge" -> confirmation dialog showing what will happen
8. System executes merge in a transaction
9. Audit log entry created
10. Secondary user deactivated (soft delete), not hard deleted
```

---

## 3. Detection Rules

### Current rules (keep, improve)

| Rule | Current | Improvement |
|------|---------|-------------|
| Exact email match | Case-insensitive `a.email === b.email` | Already good, but email is `@unique` in Prisma — this should only trigger for case differences, which Postgres treats as different in unique constraints |
| Exact name match | Case-insensitive, trimmed | Add normalization: collapse multiple spaces, strip diacritics for Latin names. Keep Cyrillic as-is for now. |

### New rules to add

| Rule | Logic | Confidence | Priority |
|------|-------|------------|----------|
| **Same Telegram ID via ProviderLink** | Two users with ProviderLink where `provider='telegram'` and same `providerAccountId` | Very High | P0 — should not happen due to unique constraint, but check for data integrity |
| **Telegram username in CareCase** | User A has `providerLink.provider='telegram'`, User B has `careCase.contactMethod='telegram'` and `contactValue` matches User A's Telegram username | High | P0 |
| **Shared real email** | User A has email `person@gmail.com`, User B has `{telegramId}@telegram.user` but a CareCase with `contactValue='person@gmail.com'` and `contactMethod='email'` | High | P1 |
| **Phone number match** | If contactValue contains a phone number that matches across two users' cases | Medium | P2 (future) |
| **Fuzzy name match** | Levenshtein distance <= 2 for names > 5 chars, combined with other signals (same country, same language) | Low alone, Medium with corroboration | P2 (future) |

### Grouping logic

Current implementation returns flat pairs. This is problematic when A matches B and B matches C — the admin sees two separate pairs instead of one group {A, B, C}.

**Recommendation:** Use Union-Find (disjoint set) to group all transitively-connected duplicates into clusters. Return clusters, not pairs.

### Performance

Current O(n^2) approach loads all users into memory. For MVP scale (hundreds to low thousands of users) this is acceptable. If the platform grows beyond ~5,000 users:
- Move to SQL-based detection: `GROUP BY lower(name)` with `HAVING count(*) > 1`
- Add a scheduled job (BullMQ) that runs detection nightly and caches results
- Index: `CREATE INDEX idx_users_lower_name ON users (lower(name))` and `CREATE INDEX idx_users_lower_email ON users (lower(email))`

**For MVP:** Keep in-memory approach but add ProviderLink join to the query and add the new cross-channel rules.

---

## 4. Merge Logic

### 4.1 Primary record selection

The admin picks the primary (surviving) record. The system should suggest the better candidate based on:

| Factor | Preferred as primary |
|--------|---------------------|
| Has real email (not `@telegram.user`) | Yes |
| Has password set | Yes |
| Has more ProviderLinks | Yes |
| Has more cases | Yes |
| Created earlier | Yes (original identity) |
| Is currently active | Yes |

The system suggests but the admin decides.

### 4.2 Data migration per entity

All operations must run inside a single Prisma `$transaction`.

| Entity | Relation field | Merge action | Notes |
|--------|---------------|--------------|-------|
| **ProviderLink** | `userId` | Move all from secondary to primary | Check for conflicts: if both have `provider='google'` with different `providerAccountId`, keep both (a person can have multiple Google accounts) |
| **CareCase (as person)** | `personId` | Update `personId` to primary | All cases now belong to primary |
| **CareCase (as consultant)** | `consultantId` | Update `consultantId` to primary | Only relevant if merging staff (see 4.3) |
| **CaseNote** | `authorId` | Update `authorId` to primary | Preserves note history |
| **Message** | `senderId` | Update `senderId` to primary | Messages now attributed to primary |
| **Enrollment** | `personId` | Merge with conflict check | If both enrolled in same course: keep the one with more progress, or keep both if different status |
| **LessonProgress** | `personId` | Merge with conflict check | `@@unique([personId, lessonId])` — if both have progress on same lesson, keep the completed one. If both completed, keep earlier completion date. |
| **ProgressReset** | `personId` | Move all to primary | Simple re-parent |
| **Meeting (as person)** | `personId` | Update to primary | |
| **Meeting (as consultant)** | `consultantId` | Update to primary | Only if staff merge |
| **Session** | `userId` | Revoke all sessions of secondary | Force re-login. Do NOT move sessions — token payloads reference the old user ID. |
| **Consent** | `userId` | Move all to primary | Keep full consent history |
| **DataExportRequest** | `userId` | Move to primary | |
| **DeletionRequest** | `userId` | Move to primary. If secondary has active deletion request, flag for admin review. | |
| **DutySchedule** | `userId` | Move to primary (staff merge only) | |
| **CaseTransfer** | `fromConsultantId` / `toConsultantId` | Update references to primary (staff merge only) | |
| **ConsultantProfile** | `userId` (`@@unique`) | Merge fields: take max of `maxCases`, sum `currentCases`. Keep primary's specializations + secondary's unique ones. | Only for staff merge |
| **Invite** | `inviterId` | Update to primary | |

### 4.3 Role conflicts

| Primary role | Secondary role | Action |
|-------------|----------------|--------|
| PERSON | PERSON | Simple merge, keep PERSON |
| PERSON | CONSULTANT/SUPERVISOR/etc | **Block merge.** These are fundamentally different user types. Admin must resolve manually (deactivate one, or change role first). |
| CONSULTANT | CONSULTANT | Allowed but warn: consultant profiles must be merged, caseloads combined. |
| ADMIN | ADMIN | Allowed, merge admin-specific data. |
| Any staff | Any different staff | **Block merge.** Same rationale as PERSON + staff. |

**Rule:** Only merge users with the same role, or explicitly require the admin to pick which role survives (with full understanding of consequences).

### 4.4 Post-merge cleanup

1. Deactivate secondary user (`isActive = false`)
2. Set secondary email to `merged_{originalEmail}_{timestamp}` to free up the unique constraint if needed
3. Revoke all sessions of secondary user
4. Create audit log entry with full merge details (both user IDs, which fields moved, admin who performed merge)
5. Store merge record for potential unmerge (see section 5)

### 4.5 Merge record (new table)

```prisma
model UserMerge {
  id              String   @id @default(uuid()) @db.Uuid
  primaryUserId   String   @map("primary_user_id") @db.Uuid
  secondaryUserId String   @map("secondary_user_id") @db.Uuid
  performedBy     String   @map("performed_by") @db.Uuid
  mergeDetails    Json     // snapshot of what was moved
  isReverted      Boolean  @default(false) @map("is_reverted")
  revertedAt      DateTime? @map("reverted_at")
  revertedBy      String?  @map("reverted_by") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([primaryUserId])
  @@index([secondaryUserId])
  @@map("user_merges")
}
```

---

## 5. Edge Cases & Risks

### 5.1 Wrong merge (data corruption)

**Risk:** Admin merges two people who are actually different individuals with the same name.

**Mitigations:**
- Show comprehensive side-by-side comparison before merge (cases, messages, providers, enrollment)
- Require confirmation dialog with explicit typing of secondary user's name
- Store complete merge snapshot in `UserMerge.mergeDetails` for potential reversal
- Soft-delete secondary (do not hard delete) — data remains recoverable

### 5.2 Unmerge capability

**Analysis:** Full automated unmerge is complex and error-prone — new data may have been created on the primary after merge (new messages, new cases referencing primary ID). Automated reversal could break these.

**Recommendation for MVP:** Do NOT implement automated unmerge. Instead:
- Keep secondary user record (deactivated) with original data snapshot in `UserMerge`
- Admin can manually re-activate secondary and re-assign specific records
- Add a "Merge History" view showing all past merges with details

### 5.3 Active sessions during merge

**Risk:** Secondary user is actively using the platform during merge. Their session references the old user ID.

**Mitigation:** Revoke all sessions of secondary user immediately in the merge transaction. If they are connected via WebSocket (Socket.io), emit a `force-logout` event.

### 5.4 In-flight cases

**Risk:** A consultant is actively messaging in a case that belongs to the secondary user being merged. The senderId changes mid-conversation.

**Mitigation:** Merge should be blocked if secondary user has cases with status `IN_PROGRESS` or `MEETING_SCHEDULED` where someone is currently the assigned consultant. Alternatively, warn the admin and let them decide.

**Recommendation for MVP:** Warn but allow. The messages already sent keep their original senderId (which now points to primary), so the history is preserved.

### 5.5 GDPR implications

- If secondary user had granted consent, those consent records move to primary — preserving the audit trail
- If secondary user had an active deletion request, the merge must be blocked or the deletion request must be resolved first
- Merge itself should be logged as a data processing activity

### 5.6 Enrollment conflicts

**Scenario:** Both users enrolled in Course X. Primary completed 5/10 lessons, secondary completed 8/10 lessons.

**Resolution:** Keep the maximum progress. For each lesson, if either user completed it, mark as completed on primary. Use the earlier `completedAt` date. The `@@unique([personId, courseId])` constraint on Enrollment means we must delete the secondary's enrollment after migrating progress.

### 5.7 Telegram synthetic email uniqueness

**Scenario:** Secondary has email `987654@telegram.user`. After merge, this email must remain unique or be modified.

**Resolution:** Rename secondary email to `merged_987654@telegram.user` as part of cleanup. This frees the synthetic email in case it needs to be reused (it should not, but prevents constraint violations).

---

## 6. UI Flow

### 6.1 Entry point: Users Management page

Current banner already exists. Enhance it:

```
Before: "3 potential duplicates detected"
After:  "3 duplicate groups detected — [Review Duplicates]"
```

The "Review Duplicates" link navigates to a dedicated route: `/admin/duplicates`.

### 6.2 Duplicate Groups List page (`/admin/duplicates`)

| Column | Content |
|--------|---------|
| Group # | Auto-numbered |
| Users | Names + emails of all users in the group (2-3 typically) |
| Match reasons | Badges: "Same name", "Same email", "Same Telegram" |
| Confidence | High / Medium / Low (based on rule combination) |
| Actions | [Review] button |

Filters: confidence level, match reason. Sorting by confidence (high first).

### 6.3 Side-by-side comparison (`/admin/duplicates/:groupId`)

Two-column layout (or three if group has 3 members):

**Header section:**
| Field | User A | User B |
|-------|--------|--------|
| Name | Olena Kovalenko | Olena Kovalenko |
| Email | olena@gmail.com | 987654@telegram.user |
| Role | PERSON | PERSON |
| Status | Active | Active |
| Created | 2026-01-15 | 2026-03-20 |
| Providers | Google | Telegram |

**Data section (collapsible):**
- Cases: count + list of topics
- Messages: total count
- Enrollments: courses + progress %
- Meetings: count

**Action bar:**
- Radio buttons to select primary: "Keep User A as primary" / "Keep User B as primary"
- System recommendation highlighted (based on scoring from 4.1)
- [Merge] button (disabled until primary selected)
- [Not a duplicate — Dismiss] button

### 6.4 Merge confirmation dialog

```
You are about to merge these accounts:

PRIMARY (keeps):  Olena Kovalenko (olena@gmail.com)
SECONDARY (deactivated): Olena Kovalenko (987654@telegram.user)

What will happen:
  - 2 care cases will be reassigned to the primary account
  - 15 messages will be re-attributed
  - 1 enrollment will be merged (course progress preserved)
  - 1 Telegram provider link will be added to primary account
  - Secondary account will be deactivated

This action can be partially reversed by an admin.

[Cancel]  [Confirm Merge]
```

### 6.5 Post-merge state

- Group disappears from the duplicates list
- Success toast: "Accounts merged successfully"
- Merge appears in Audit Log with full details

---

## 7. Recommendations: Phased Approach

### Phase 1 — Detection Enhancement (1-2 days backend)

**Goal:** Make `findDuplicates()` actually useful.

1. Add ProviderLink data to the detection query (join `providerLinks`)
2. Add cross-channel detection rule: Telegram username in CareCase contactValue
3. Group duplicates into clusters (Union-Find) instead of flat pairs
4. Return richer response: include provider links, case count, created date per user
5. Add `GET /admin/duplicates` endpoint returning grouped duplicates with details

### Phase 2 — Review UI (2-3 days frontend)

**Goal:** Let admin see and evaluate duplicates.

1. Create `/admin/duplicates` route and component
2. Duplicate Groups List page with filters
3. Side-by-side comparison view
4. "Dismiss" action (mark group as reviewed/not-duplicate, persist in DB)
5. Update banner to link to the new page

### Phase 3 — Merge Backend (2-3 days backend)

**Goal:** Implement the actual merge logic.

1. Create `UserMerge` Prisma model + migration
2. Implement `POST /admin/duplicates/merge` endpoint
3. Transaction-based merge logic for all entities (per section 4.2)
4. Enrollment/progress conflict resolution
5. Session revocation + WebSocket force-logout
6. Audit logging
7. Unit tests for merge logic (critical — test every entity type, test conflicts)

### Phase 4 — Merge UI (1-2 days frontend)

**Goal:** Let admin execute merges from the UI.

1. Merge direction picker in comparison view
2. Confirmation dialog with impact summary
3. Merge execution + success/error handling
4. Merge History view (list of past merges from UserMerge table)

### Phase 5 — Hardening (1 day, can be deferred)

1. Scheduled BullMQ job for nightly duplicate detection
2. SQL-based detection for better performance
3. Notification to admin when new duplicates found
4. "Dismiss permanently" for known non-duplicates (store in a `DuplicateDismissal` table)

### Total estimate: 7-11 days of development

### What NOT to build for MVP

- Automated unmerge (too complex, manual recovery sufficient)
- Fuzzy name matching (Levenshtein) — diminishing returns, risk of false positives
- Bulk merge (merge multiple groups at once) — too risky
- Phone number matching — no phone field on User model yet
- AI-based duplicate detection — overkill for current scale
