---
title: "Duplicate Person Detection & Merge — Task Breakdown"
type: tasks
status: approved
created: 2026-05-29
feature: "vault/40-features/duplicate-merge/feature.md"
author: Architect
---

# Duplicate Person Detection & Merge — Tasks

## Task 1: DB Migration (Prisma Models)

**Description:** Add `UserMerge` and `DuplicateDismissal` models to the Prisma schema and generate the migration.

**Complexity:** S (Small)

**Dependencies:** None

**Files to create/modify:**
- `libs/prisma-client/prisma/schema.prisma` — add `UserMerge` and `DuplicateDismissal` models
- `libs/prisma-client/prisma/migrations/YYYYMMDDHHMMSS_add_user_merge_and_duplicate_dismissal/migration.sql` — auto-generated

**Details:**

`UserMerge` model:
- `id` (UUID, PK)
- `primaryUserId` (UUID, indexed)
- `secondaryUserId` (UUID, indexed)
- `performedBy` (UUID, indexed)
- `mergeDetails` (Json) — snapshot of all migration operations performed
- `isReverted` (Boolean, default false)
- `revertedAt` (DateTime, nullable)
- `revertedBy` (UUID, nullable)
- `createdAt` (DateTime, default now)
- Table name: `user_merges`

`DuplicateDismissal` model:
- `id` (UUID, PK)
- `userIdA` (UUID, indexed) — always the lexically smaller UUID of the pair
- `userIdB` (UUID, indexed) — always the lexically larger UUID of the pair
- `dismissedBy` (UUID)
- `reason` (String, nullable)
- `createdAt` (DateTime, default now)
- Unique constraint on `[userIdA, userIdB]`
- Table name: `duplicate_dismissals`

No foreign keys to `User` table (intentional — secondary user gets deactivated and email renamed; we do not want cascade behavior to affect merge history).

**Acceptance criteria:**
- [ ] `npx prisma migrate dev` runs without errors on a fresh database
- [ ] `npx prisma migrate dev` runs without errors on existing database with data
- [ ] `npx prisma generate` produces correct TypeScript types for both models
- [ ] Indexes exist on `primary_user_id`, `secondary_user_id`, `performed_by` for `user_merges`
- [ ] Unique constraint on `(user_id_a, user_id_b)` for `duplicate_dismissals`
- [ ] Column mappings use snake_case (`primary_user_id`, not `primaryUserId`)

---

## Task 2: Enhanced Detection Service

**Description:** Create `DuplicateDetectionService` with ProviderLink cross-referencing, Union-Find clustering, and the new grouped API endpoints (`GET /admin/duplicates`, `GET /admin/duplicates/:groupId`, `POST /admin/duplicates/:groupId/dismiss`).

**Complexity:** M (Medium)

**Dependencies:** Task 1 (needs `DuplicateDismissal` model)

**Files to create:**
- `apps/api/src/admin/duplicate-detection.service.ts` — detection logic with Union-Find, grouping, scoring
- `apps/api/src/admin/duplicate.model.ts` — DTOs: `ListDuplicatesDto`, `DismissDuplicateDto`, response interfaces
- `apps/api/src/admin/duplicate.const.ts` — constants: match reasons, confidence levels, synthetic email suffix, error messages

**Files to modify:**
- `apps/api/src/admin/admin.controller.ts` — add 3 new endpoints: `GET /admin/duplicates`, `GET /admin/duplicates/:groupId`, `POST /admin/duplicates/:groupId/dismiss`
- `apps/api/src/admin/admin.module.ts` — register `DuplicateDetectionService` as provider

**Details:**

Detection rules (ordered by evaluation priority):
1. Same Telegram ProviderLink (same providerAccountId where provider='telegram') -> HIGH confidence
2. Telegram contact match (User A has telegram ProviderLink, User B has CareCase with contactMethod='telegram' and matching contactValue) -> HIGH confidence
3. Shared real email (User A has real email, User B has synthetic email but a CareCase contactValue matching User A's email) -> HIGH confidence
4. Exact email match, case-insensitive -> HIGH confidence
5. Exact name match, case-insensitive, normalized (trimmed, collapsed whitespace) -> LOW confidence (MEDIUM if corroborated by another rule)

Union-Find implementation:
- `find(x)` with path compression
- `union(x, y)` with union by rank
- `groups()` returns `Map<rootId, memberIds[]>`

Group ID: `sha256(sortedUserIds.join(':')).slice(0, 16)` — deterministic, no server-side state needed.

Primary suggestion scoring: real email (+100), has password (+50), provider count (x20), case count (x10), is active (+30), age in days (+1/day).

The `POST /admin/duplicates/:groupId/dismiss` endpoint stores sorted user ID pairs and is idempotent (returns existing dismissal if already dismissed).

**Acceptance criteria:**
- [ ] `GET /admin/duplicates` returns grouped duplicates with `groupId`, `users`, `matchReasons`, `confidence`, `suggestedPrimaryId`
- [ ] Groups are clusters (transitive: if A matches B and B matches C, group is {A, B, C})
- [ ] Dismissed pairs do not appear in results
- [ ] Already-merged users (secondary inactive with UserMerge record) do not appear
- [ ] `GET /admin/duplicates/:groupId` returns full detail including entity counts, provider info, merge preview
- [ ] `POST /admin/duplicates/:groupId/dismiss` stores dismissal and is idempotent
- [ ] All endpoints have Swagger decorators
- [ ] DTOs use class-validator
- [ ] Detection correctly identifies cross-channel duplicates (web + Telegram)
- [ ] Unit tests cover all 5 detection rules, Union-Find clustering, dismissal exclusion, and primary scoring

---

## Task 3: Merge Backend Service

**Description:** Create `UserMergeService` with transactional merge logic for all entity types, conflict resolution for enrollments and lesson progress, and the merge/history API endpoints.

**Complexity:** L (Large)

**Dependencies:** Task 1 (needs `UserMerge` model), Task 2 (needs detection service for validation)

**Files to create:**
- `apps/api/src/admin/user-merge.service.ts` — merge transaction logic, entity migration, conflict resolution

**Files to modify:**
- `apps/api/src/admin/admin.controller.ts` — add 3 new endpoints: `POST /admin/duplicates/:groupId/merge`, `GET /admin/duplicates/history`, `GET /admin/duplicates/history/:mergeId`
- `apps/api/src/admin/admin.module.ts` — register `UserMergeService` as provider
- `apps/api/src/admin/admin.const.ts` — add `AUDIT_ACTIONS.USER_MERGE` and `AUDIT_ACTIONS.DUPLICATE_DISMISSED`
- `apps/api/src/admin/duplicate.model.ts` — add `ExecuteMergeDto`, `ListMergeHistoryDto`, merge response interfaces

**Details:**

The merge method `executeMerge(primaryUserId, secondaryUserId, performedBy)` performs these operations inside a single `prisma.$transaction()`:

Pre-validation:
- Both users exist and are active (throw `NotFoundException` / `BadRequestException`)
- Same role (throw `BadRequestException` with `MERGE_BLOCKED_CROSS_ROLE`)
- No active DeletionRequest on secondary (throw `BadRequestException` with `MERGE_BLOCKED_DELETION_REQUEST`)
- Primary != secondary (throw `BadRequestException` with `MERGE_BLOCKED_SAME_USER`)

Entity migration (in order):
1. **ProviderLink** — `updateMany({ where: { userId: secondary }, data: { userId: primary } })`
2. **CareCase (person)** — `updateMany({ where: { personId: secondary }, data: { personId: primary } })`
3. **CareCase (consultant)** — `updateMany({ where: { consultantId: secondary }, data: { consultantId: primary } })` (staff merge only: both have role CONSULTANT, SUPERVISOR, COORDINATOR, or ADMIN)
4. **CaseNote** — `updateMany({ where: { authorId: secondary }, data: { authorId: primary } })`
5. **Message** — `updateMany({ where: { senderId: secondary }, data: { senderId: primary } })`
6. **Enrollment** — merge with conflict resolution (see feature.md section 3.4)
7. **LessonProgress** — merge with conflict resolution (see feature.md section 3.4)
8. **ProgressReset** — `updateMany({ where: { personId: secondary }, data: { personId: primary } })`
9. **Meeting (person)** — `updateMany({ where: { personId: secondary }, data: { personId: primary } })`
10. **Meeting (consultant)** — `updateMany({ where: { consultantId: secondary }, data: { consultantId: primary } })` (staff merge only)
11. **Consent** — `updateMany({ where: { userId: secondary }, data: { userId: primary } })`
12. **DataExportRequest** — `updateMany({ where: { userId: secondary }, data: { userId: primary } })`
13. **DeletionRequest** — `updateMany({ where: { userId: secondary }, data: { userId: primary } })`
14. **CaseTransfer (from)** — `updateMany({ where: { fromConsultantId: secondary }, data: { fromConsultantId: primary } })` (staff merge only)
15. **CaseTransfer (to)** — `updateMany({ where: { toConsultantId: secondary }, data: { toConsultantId: primary } })` (staff merge only)
16. **ConsultantProfile** — merge fields if both exist (staff merge only)
17. **Invite** — `updateMany({ where: { inviterId: secondary }, data: { inviterId: primary } })`
18. **Session** — `updateMany({ where: { userId: secondary }, data: { isRevoked: true } })`
19. **DuplicateDismissal** — delete any dismissals involving secondary user ID
20. Deactivate secondary: `update({ where: { id: secondary }, data: { isActive: false } })`
21. Rename secondary email: `update({ data: { email: 'merged_{original}_{timestamp}' } })`
22. Create `UserMerge` record with full `mergeDetails` JSON
23. Create `AuditLog` entry

Enrollment conflict resolution algorithm:
- Find overlapping enrollments: same `courseId` for both primary and secondary
- For each conflict: upgrade primary status if secondary is further along (COMPLETED > ACTIVE > DROPPED)
- Migrate non-conflicting LessonProgress records (re-parent `personId`)
- For conflicting LessonProgress (same `lessonId`): completed wins; if both completed, keep earlier `completedAt`
- Delete conflicting secondary LessonProgress records after merging values
- Delete secondary Enrollment after migrating everything

**Acceptance criteria:**
- [ ] `POST /admin/duplicates/:groupId/merge` executes merge in single transaction
- [ ] All 17+ entity types are migrated correctly
- [ ] Enrollment conflict resolution: completed status wins, progress merged correctly
- [ ] LessonProgress conflict resolution: completed wins, earlier completedAt wins
- [ ] ConsultantProfile merged correctly for staff merges (max of maxCases, sum of currentCases, deduplicated specializations)
- [ ] Secondary user deactivated, email renamed to `merged_{email}_{timestamp}`
- [ ] All secondary sessions revoked
- [ ] `UserMerge` record created with correct `mergeDetails` snapshot
- [ ] `AuditLog` entry created with `ADMIN_USER_MERGE` action
- [ ] Cross-role merge returns 400 with clear error
- [ ] Active deletion request returns 400 with clear error
- [ ] Transaction rolls back completely on any failure
- [ ] `GET /admin/duplicates/history` returns paginated merge history
- [ ] `GET /admin/duplicates/history/:mergeId` returns full merge detail
- [ ] All endpoints have Swagger decorators
- [ ] Unit tests cover: simple merge, enrollment conflicts, progress conflicts, role blocking, deletion request blocking, consultant profile merge, session revocation, atomic rollback

---

## Task 4: Frontend Data Layer

**Description:** Create the frontend model, HTTP service, Signal Store, and facade for the duplicate detection and merge feature.

**Complexity:** M (Medium)

**Dependencies:** Task 2 and Task 3 (API contracts must be defined; implementation can proceed in parallel if contracts are agreed)

**Files to create:**
- `libs/staff/data-access/model/duplicate.model.ts` — all interfaces and types
- `libs/staff/data-access/service/duplicate.service.ts` — pure HTTP service
- `libs/staff/data-access/store/duplicate.store.ts` — NgRx Signal Store
- `libs/staff/data-access/service/duplicate-facade.service.ts` — facade with form state and orchestration

**Files to modify:**
- `libs/staff/data-access/index.ts` — add exports for all new types, service, store, facade

**Details:**

Model file contains all interfaces as specified in feature.md section 3.5.1. All properties are `readonly`. Types use string literal unions, not enums.

HTTP Service methods (all return `Observable<T>`):
- `getGroups(confidence?: DuplicateConfidence): Observable<DuplicateGroupsResponse>`
- `getGroupDetail(groupId: string): Observable<DuplicateGroupDetail>`
- `executeMerge(groupId: string, dto: ExecuteMergeRequest): Observable<MergeExecutionResult>`
- `dismissDuplicate(groupId: string, dto: DismissDuplicateRequest): Observable<{ id: string }>`
- `getMergeHistory(page?: number, pageSize?: number): Observable<MergeHistoryResponse>`
- `getMergeDetail(mergeId: string): Observable<MergeHistoryEntry>`

API base paths:
- `/api/admin/duplicates` for groups
- `/api/admin/duplicates/history` for merge history

Store state shape:
```
groups, groupsTotal, selectedGroup, mergeHistory, mergeHistoryTotal,
mergeHistoryPage, confidenceFilter, isLoading, isMerging, error, mergeSuccess
```

Store methods: `loadGroups`, `loadGroupDetail`, `executeMerge`, `dismissDuplicate`, `loadMergeHistory`, `clearSelectedGroup`, `clearMergeSuccess`.

Facade signals (all explicitly typed):
- From store: `groups`, `groupsTotal`, `selectedGroup`, `mergeHistory`, `isLoading`, `isMerging`, `error`, `mergeSuccess`
- Form state: `mergeModel: WritableSignal<MergeFormModel>`, `showMergeConfirmation: WritableSignal<boolean>`, `confidenceFilter: WritableSignal<DuplicateConfidence | null>`, `activeTab: WritableSignal<'groups' | 'history'>`

Facade methods: `loadGroups`, `loadGroupDetail`, `selectPrimary`, `openMergeConfirmation`, `closeMergeConfirmation`, `confirmMerge`, `dismissGroup`, `loadMergeHistory`, `setConfidenceFilter`, `navigateToGroup`, `navigateToList`.

Facade helper methods: `getConfidenceBadgeVariant`, `getMatchReasonLabel`, `formatMergeImpact`.

**Acceptance criteria:**
- [ ] All interfaces in `duplicate.model.ts` — no inline interfaces in service/store/facade
- [ ] HTTP service is pure (no signals, no state, no tap mutations)
- [ ] HTTP service returns `Observable<T>` only, with `catchError`
- [ ] Store uses `signalStore` with `withState`, `withMethods`
- [ ] Store uses `rxMethod` for all async operations
- [ ] Store uses `patchState` for mutations, `catchError(() => EMPTY)` for error handling
- [ ] Facade owns all form state as explicitly typed `WritableSignal<T>`
- [ ] Facade injects store + service + Router
- [ ] No `async/await`, no `Promise`, no `firstValueFrom` anywhere
- [ ] All new exports added to `libs/staff/data-access/index.ts`
- [ ] `providedIn: 'root'` on service, store, and facade
- [ ] Unit tests for store methods (loading, error states, merge success removing group from list)

---

## Task 5: Duplicate List UI

**Description:** Create the Duplicate Groups List page with tabs for active duplicates and merge history, confidence filter, and navigation to review page. Add routing entries.

**Complexity:** M (Medium)

**Dependencies:** Task 4 (needs facade and store)

**Files to create:**
- `libs/staff/components/duplicate-list/duplicate-list.component.ts`
- `libs/staff/components/duplicate-list/duplicate-list.component.html`
- `libs/staff/components/duplicate-list/duplicate-list.component.scss`

**Files to modify:**
- `libs/staff/components/staff.routes.ts` — add `duplicates` route
- `libs/staff/components/users-manage/users-manage.component.html` — update banner to include "Review Duplicates" link navigating to `/staff/duplicates`

**Details:**

Component structure:
- Standalone component with `ChangeDetectionStrategy.OnPush`
- Injects `DuplicateFacade` only (dumb component)
- Two tabs: "Active Duplicates" (default) and "Merge History"

Active Duplicates tab:
- Confidence filter dropdown: All / High / Medium / Low
- Table/card list of groups showing:
  - Group number (auto-numbered)
  - User names and emails (2-3 per group)
  - Match reason badges (using `BadgeComponent`)
  - Confidence badge (color-coded: HIGH=error/red, MEDIUM=warning/yellow, LOW=info/blue)
  - "Review" button navigating to `/staff/duplicates/:groupId`
- Sorted by confidence (HIGH first), then by group size (larger first)
- Empty state message when no duplicates found

Merge History tab:
- Paginated table showing: primary user, secondary user, performed by, date, reverted status
- Pagination using `PaginationComponent`

Banner update in users-manage:
- Change text from "X potential duplicates detected" to "X duplicate groups detected"
- Add a "Review Duplicates" link/button that calls `router.navigate(['/staff/duplicates'])`

Route entry in staff.routes.ts:
```typescript
{
  path: 'duplicates',
  loadComponent: () =>
    import('./duplicate-list/duplicate-list.component').then(
      (m) => m.DuplicateListComponent,
    ),
},
```

SCSS must use CSS custom properties only (no hardcoded colors). Reference `_theme.scss` variables.

**Acceptance criteria:**
- [ ] Component is standalone with `ChangeDetectionStrategy.OnPush`
- [ ] Component injects facade only — no direct service/store/router injection
- [ ] No `subscribe()` in component
- [ ] Two tabs switch between active duplicates and merge history
- [ ] Confidence filter dropdown filters the list
- [ ] Each group row shows users, match reasons, confidence, and Review button
- [ ] Review button navigates to `/staff/duplicates/:groupId`
- [ ] Merge History tab shows paginated past merges
- [ ] Empty state displayed when no groups exist
- [ ] Banner on users-manage page links to `/staff/duplicates`
- [ ] Route added as lazy-loaded `loadComponent`
- [ ] All SCSS uses CSS custom properties from `_theme.scss`
- [ ] Template has `*transloco` directive for i18n support
- [ ] No inline styles, no inline HTML

---

## Task 6: Merge Review UI

**Description:** Create the side-by-side comparison and merge execution page with confirmation dialog.

**Complexity:** L (Large)

**Dependencies:** Task 4 (needs facade), Task 5 (for routing and navigation back to list)

**Files to create:**
- `libs/staff/components/duplicate-review/duplicate-review.component.ts`
- `libs/staff/components/duplicate-review/duplicate-review.component.html`
- `libs/staff/components/duplicate-review/duplicate-review.component.scss`

**Files to modify:**
- `libs/staff/components/staff.routes.ts` — add `duplicates/:groupId` route

**Details:**

Component structure:
- Standalone component with `ChangeDetectionStrategy.OnPush`
- Injects `DuplicateFacade` only
- Reads `:groupId` from `ActivatedRoute` params (via facade method that uses Router)

Layout:
- Back link: "Back to Duplicate Groups" navigating to `/staff/duplicates`
- Match reasons displayed as badges at top
- Side-by-side two-column layout (for 2-user groups)

Per-user column:
- Header: avatar placeholder, name, email, role badge, active status badge, created date
- Provider links list (e.g., "Google: account123", "Telegram: user456")
- Has password indicator
- System recommendation highlight (border or label on suggested primary)

Collapsible data sections per user:
- Cases: count + list of topics with status badges
- Enrollments: course name, status, progress bar (percentage)
- Messages: total count
- Meetings: total count

Action bar (fixed at bottom or sticky):
- Radio button group: "Keep [User A name] as primary" / "Keep [User B name] as primary"
- System suggestion indicated with "(Recommended)" label
- "Merge" button — enabled only when a primary is selected, disabled during merge
- "Not a Duplicate -- Dismiss" button
- Loading spinner on merge button while `isMerging` is true

Merge confirmation modal (using `ModalComponent`):
- Title: "Confirm Account Merge"
- Primary user summary (name, email)
- Secondary user summary (name, email)
- Impact list from `MergePreview`:
  - "X care cases will be reassigned"
  - "X messages will be re-attributed"
  - "X enrollments will be merged (Y conflicts)"
  - "X provider links will be added"
  - "X sessions will be revoked"
  - "Secondary account will be deactivated"
- Warning text: "This action can be partially reversed by an admin."
- Cancel and Confirm buttons

Post-merge behavior:
- On success: close modal, show success toast, navigate to `/staff/duplicates`
- On error: close modal, show error message via facade error signal

Route entry:
```typescript
{
  path: 'duplicates/:groupId',
  loadComponent: () =>
    import('./duplicate-review/duplicate-review.component').then(
      (m) => m.DuplicateReviewComponent,
    ),
},
```

**Acceptance criteria:**
- [ ] Component is standalone with `ChangeDetectionStrategy.OnPush`
- [ ] Component injects facade only
- [ ] No `subscribe()` in component
- [ ] Side-by-side comparison shows all user fields: name, email, role, status, created, providers, password indicator
- [ ] Collapsible sections show cases, enrollments (with progress), messages, meetings
- [ ] Radio buttons for primary selection, with system recommendation highlighted
- [ ] Merge button disabled until primary selected
- [ ] Merge button shows loading state during merge execution
- [ ] Confirmation modal shows merge preview impact summary
- [ ] Dismiss button creates dismissal and navigates back to list
- [ ] Success navigates back to list with groups refreshed
- [ ] Error displayed from facade error signal
- [ ] Route added as lazy-loaded `loadComponent`
- [ ] All SCSS uses CSS custom properties from `_theme.scss`
- [ ] Template has `*transloco` directive for i18n support
- [ ] No inline styles, no inline HTML
- [ ] Accessible: radio buttons have proper labels, modal traps focus
