---
title: "Duplicate Person Detection & Merge"
type: feature-spec
status: approved
created: 2026-05-29
epic: "vault/30-bmad/epics/E13-admin.md"
story: "vault/30-bmad/stories/E13-admin/S-E13-05.md"
author: Architect
baseline_commit: 6f0a9fa
context:
  - "vault/30-bmad/prd.md"
  - "vault/30-bmad/architecture/architecture.md"
  - "vault/30-bmad/analysis/duplicate-merge-analysis.md"
---

# Duplicate Person Detection & Merge

## 1. Context

Refer to `vault/30-bmad/analysis/duplicate-merge-analysis.md` for the complete problem analysis, including how duplicates arise from multi-channel intake (web, Telegram, manual creation), the current O(n^2) detection algorithm, and the gap analysis showing that review/merge UI is entirely missing.

### What exists today

| Component | Location | Status |
|-----------|----------|--------|
| Backend `findDuplicates()` | `apps/api/src/admin/admin.service.ts` | Flat pair matching on exact email + exact name. No ProviderLink, no grouping. |
| Frontend banner | `libs/staff/components/users-manage/` | Dismissible `ui-alert-banner` showing duplicate count. No navigation to review. |
| Admin duplicate data layer | `libs/staff/data-access/` | `DuplicateAccount` interface, `getDuplicates()` HTTP call, `loadDuplicates` store method — all return flat count only. |

### Key architectural decision: separate domain vs extend admin

The duplicate detection and merge feature introduces significant new domain logic (clustering, transactional merge with conflict resolution, audit trail). Rather than overloading the existing `AdminService` (already 430 lines), this feature introduces a dedicated `DuplicateDetectionService` and `UserMergeService` within the admin module. The controller endpoints remain under `/admin/duplicates` since this is admin-only functionality.

On the frontend, the duplicate feature gets its own data-access layer (`duplicate.model.ts`, `duplicate.service.ts`, `duplicate.store.ts`, `duplicate-facade.service.ts`) separate from the admin data-access, to avoid bloating `AdminStore` and keep concerns isolated.

---

## 2. Task

Build the complete duplicate person detection and merge feature:

1. Enhanced detection algorithm that uses ProviderLink cross-referencing and groups duplicates into clusters (Union-Find) instead of flat pairs.
2. Database models (`UserMerge`, `DuplicateDismissal`) to track merge history and dismissed groups.
3. Six REST API endpoints for listing, reviewing, merging, dismissing, and auditing duplicates.
4. Frontend data layer (model, service, store, facade) following the project's established pattern.
5. Two new pages: Duplicate Groups List and Merge Review (side-by-side comparison).
6. Routing integration under `/staff/duplicates` and `/staff/duplicates/:groupId`.

---

## 3. Technical Plan

### 3.1 New Prisma Models

Add to `libs/prisma-client/prisma/schema.prisma`:

```prisma
// ============================================================
// USER MERGE (S-E13-05 — duplicate account merge audit trail)
// ============================================================

model UserMerge {
  id              String    @id @default(uuid()) @db.Uuid
  primaryUserId   String    @map("primary_user_id") @db.Uuid
  secondaryUserId String    @map("secondary_user_id") @db.Uuid
  performedBy     String    @map("performed_by") @db.Uuid
  mergeDetails    Json      @map("merge_details")
  isReverted      Boolean   @default(false) @map("is_reverted")
  revertedAt      DateTime? @map("reverted_at")
  revertedBy      String?   @map("reverted_by") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([primaryUserId])
  @@index([secondaryUserId])
  @@index([performedBy])
  @@map("user_merges")
}

// ============================================================
// DUPLICATE DISMISSAL (S-E13-05 — admin-dismissed duplicate groups)
// ============================================================

model DuplicateDismissal {
  id          String   @id @default(uuid()) @db.Uuid
  userIdA     String   @map("user_id_a") @db.Uuid
  userIdB     String   @map("user_id_b") @db.Uuid
  dismissedBy String   @map("dismissed_by") @db.Uuid
  reason      String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@unique([userIdA, userIdB])
  @@index([userIdA])
  @@index([userIdB])
  @@map("duplicate_dismissals")
}
```

**Design notes:**

- `UserMerge.mergeDetails` stores a JSON snapshot of every entity migration performed (counts per table, conflict resolutions, original field values on secondary). This enables manual reversal without an automated unmerge system.
- `DuplicateDismissal` stores sorted user ID pairs (`userIdA < userIdB`) to avoid duplicate dismissal entries. The unique constraint ensures idempotency.
- Neither model has a foreign key to `User` because the secondary user gets deactivated and its email renamed post-merge — we do not want cascading deletes to destroy merge history.

### 3.2 API Endpoints

All endpoints live under the existing `AdminController` (`apps/api/src/admin/admin.controller.ts`) and are protected by the admin auth guard.

#### 3.2.1 `GET /admin/duplicates`

**Purpose:** Return grouped duplicate clusters with summary data. Replaces the current flat `GET /admin/users/duplicates`.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `confidence` | `'HIGH' \| 'MEDIUM' \| 'LOW'` | all | Filter by minimum confidence level |

**Response:**
```typescript
{
  groups: DuplicateGroupSummary[];
  total: number;
}

interface DuplicateGroupSummary {
  groupId: string;             // deterministic hash of sorted user IDs
  users: DuplicateGroupUser[];
  matchReasons: MatchReason[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedPrimaryId: string;
}

interface DuplicateGroupUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  providerCount: number;
  caseCount: number;
}

type MatchReason = 'EXACT_EMAIL' | 'EXACT_NAME' | 'SAME_TELEGRAM_PROVIDER' | 'TELEGRAM_CONTACT_MATCH' | 'SHARED_REAL_EMAIL';
```

**Service:** `DuplicateDetectionService.findGroupedDuplicates()`

**Implementation notes:**
- Query all active users with `providerLinks` and aggregate case counts.
- Apply detection rules (see section 3.3).
- Build Union-Find structure to cluster transitively-connected users.
- Exclude pairs present in `DuplicateDismissal` table.
- Exclude pairs already merged (secondary `isActive = false` with matching `UserMerge` record).
- Compute confidence: HIGH if ProviderLink match or email match, MEDIUM if name match with corroborating signal, LOW if name-only match.
- Compute `suggestedPrimaryId` using scoring: real email > has password > more providers > more cases > earlier creation > currently active.
- `groupId` is a deterministic string derived from sorted user IDs (e.g., `sha256(ids.sort().join(':'))`), allowing the frontend to reference groups without server-side state.

#### 3.2.2 `GET /admin/duplicates/:groupId`

**Purpose:** Return detailed data for a single duplicate group, including full user profiles with entity counts.

**Response:**
```typescript
{
  groupId: string;
  users: DuplicateGroupUserDetail[];
  matchReasons: MatchReason[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedPrimaryId: string;
  mergePreview: MergePreview | null;
}

interface DuplicateGroupUserDetail extends DuplicateGroupUser {
  avatarUrl: string | null;
  providers: { provider: string; providerAccountId: string }[];
  hasPassword: boolean;
  cases: { id: string; topic: string; status: string; createdAt: string }[];
  enrollments: { courseId: string; courseTitle: string; status: string; progressPercent: number }[];
  messageCount: number;
  meetingCount: number;
  hasActiveDeletionRequest: boolean;
}

interface MergePreview {
  casesToMigrate: number;
  messagesToMigrate: number;
  enrollmentsToMerge: number;
  enrollmentConflicts: number;
  progressRecordsToMerge: number;
  progressConflicts: number;
  providerLinksToMigrate: number;
  meetingsToMigrate: number;
  sessionsToRevoke: number;
}
```

**Service:** `DuplicateDetectionService.getGroupDetail(groupId)`

**Implementation notes:**
- Re-runs detection to find the group matching `groupId`. This is stateless — no server-side group storage.
- For groups with 2 users (the common case), `MergePreview` pre-computes what a merge would do. For groups with 3+ users, `mergePreview` is `null` (admin must pick a pair first).

#### 3.2.3 `POST /admin/duplicates/:groupId/merge`

**Purpose:** Execute a merge of two users within a duplicate group.

**Request body:**
```typescript
class ExecuteMergeDto {
  @IsUUID() primaryUserId: string;
  @IsUUID() secondaryUserId: string;
}
```

**Response:**
```typescript
{
  mergeId: string;
  primaryUserId: string;
  secondaryUserId: string;
  mergeDetails: MergeExecutionResult;
}

interface MergeExecutionResult {
  casesMigrated: number;
  notesMigrated: number;
  messagesMigrated: number;
  enrollmentsMigrated: number;
  enrollmentConflictsResolved: number;
  progressRecordsMigrated: number;
  progressConflictsResolved: number;
  providerLinksMigrated: number;
  meetingsMigrated: number;
  sessionsRevoked: number;
  consentsMigrated: number;
  secondaryEmailRenamed: string;
}
```

**Service:** `UserMergeService.executeMerge(primaryUserId, secondaryUserId, performedBy)`

**Validation rules (throw `BadRequestException`):**
- Both users must exist and be active.
- Both users must have the same role (PERSON-PERSON or CONSULTANT-CONSULTANT). Cross-role merge is blocked.
- Secondary user must not have an active `DeletionRequest` (status PENDING or PROCESSING).
- Primary and secondary must be different users.

**Implementation notes:**
- Entire merge runs inside `prisma.$transaction()`.
- See section 3.4 for detailed merge logic per entity.

#### 3.2.4 `POST /admin/duplicates/:groupId/dismiss`

**Purpose:** Mark a pair of users as "not duplicates" so they no longer appear in detection results.

**Request body:**
```typescript
class DismissDuplicateDto {
  @IsUUID() userIdA: string;
  @IsUUID() userIdB: string;
  @IsOptional() @IsString() reason?: string;
}
```

**Response:** `{ id: string }` (dismissal record ID)

**Service:** `DuplicateDetectionService.dismissDuplicate()`

**Implementation notes:**
- Sort `userIdA` and `userIdB` before storing to enforce the unique constraint.
- If the pair is already dismissed, return the existing dismissal (idempotent, no 409).

#### 3.2.5 `GET /admin/duplicates/history`

**Purpose:** List past merge operations for audit purposes.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |

**Response:**
```typescript
{
  data: MergeHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MergeHistoryEntry {
  id: string;
  primaryUserName: string;
  primaryUserEmail: string;
  secondaryUserName: string;
  secondaryUserEmail: string;
  performedByName: string;
  isReverted: boolean;
  createdAt: string;
}
```

#### 3.2.6 `GET /admin/duplicates/history/:mergeId`

**Purpose:** Return full details of a specific merge operation.

**Response:**
```typescript
{
  id: string;
  primaryUserId: string;
  secondaryUserId: string;
  performedBy: string;
  mergeDetails: MergeExecutionResult;
  isReverted: boolean;
  revertedAt: string | null;
  revertedBy: string | null;
  createdAt: string;
}
```

### 3.3 Backend Service Design

#### 3.3.1 `DuplicateDetectionService`

**Location:** `apps/api/src/admin/duplicate-detection.service.ts`

**Responsibility:** Enhanced duplicate detection with ProviderLink cross-referencing and Union-Find clustering.

**Detection rules (ordered by priority):**

| Priority | Rule | Match Logic | Confidence |
|----------|------|-------------|------------|
| P0 | Same Telegram ProviderLink | Two users with `provider='telegram'` and same `providerAccountId` | HIGH |
| P0 | Telegram contact match | User A has `providerLink.provider='telegram'`, User B has `careCase.contactMethod='telegram'` with matching `contactValue` | HIGH |
| P1 | Shared real email | User A has email `x@gmail.com`, User B has synthetic email but `careCase.contactValue='x@gmail.com'` and `contactMethod='email'` | HIGH |
| P1 | Exact email match | `lower(a.email) = lower(b.email)` (case collision edge case) | HIGH |
| P2 | Exact name match | `lower(trim(a.name)) = lower(trim(b.name))` with normalization (collapse whitespace, strip Latin diacritics) | MEDIUM if corroborated, LOW if alone |

**Clustering (Union-Find):**

```
class UnionFind {
  parent: Map<string, string>  // userId -> root userId
  rank: Map<string, number>

  find(x: string): string      // path compression
  union(x: string, y: string): void  // union by rank
  groups(): Map<string, string[]>    // root -> members
}
```

When a detection rule fires for users A and B, call `union(A, B)`. After all rules have been evaluated, call `groups()` to get the clusters. Each cluster becomes a `DuplicateGroupSummary`.

**groupId generation:**

```typescript
function computeGroupId(userIds: string[]): string {
  const sorted = [...userIds].sort();
  return createHash('sha256').update(sorted.join(':')).digest('hex').slice(0, 16);
}
```

Using a truncated hash (16 hex chars) is sufficient for uniqueness within reasonable user counts and keeps URLs clean.

**Suggested primary scoring:**

```typescript
function scorePrimaryCandidate(user: UserWithDetails): number {
  let score = 0;
  if (!user.email.endsWith('@telegram.user')) score += 100;  // real email
  if (user.passwordHash) score += 50;                         // has password
  score += user.providerLinks.length * 20;                    // more providers
  score += user.caseCount * 10;                               // more cases
  if (user.isActive) score += 30;                             // currently active
  score += (Date.now() - user.createdAt.getTime()) / 86400000; // older = slightly better
  return score;
}
```

The user with the highest score is `suggestedPrimaryId`.

#### 3.3.2 `UserMergeService`

**Location:** `apps/api/src/admin/user-merge.service.ts`

**Responsibility:** Execute the merge transaction, handle all entity migrations with conflict resolution, and create the audit trail.

**Transaction flow (all inside `prisma.$transaction`):**

```
1. Validate preconditions (roles match, no active deletion request, both active)
2. Snapshot secondary user's data for mergeDetails
3. Migrate ProviderLinks          (re-parent userId)
4. Migrate CareCases as person    (re-parent personId)
5. Migrate CareCases as consultant (re-parent consultantId) — staff merge only
6. Migrate CaseNotes              (re-parent authorId)
7. Migrate Messages               (re-parent senderId)
8. Merge Enrollments              (with conflict resolution)
9. Merge LessonProgress           (with conflict resolution)
10. Migrate ProgressResets         (re-parent personId)
11. Migrate Meetings as person    (re-parent personId)
12. Migrate Meetings as consultant (re-parent consultantId) — staff merge only
13. Migrate Consents              (re-parent userId)
14. Migrate DataExportRequests    (re-parent userId)
15. Migrate DuplicateDismissal    (update references)
16. Migrate CaseTransfers         (re-parent fromConsultantId/toConsultantId) — staff merge only
17. Merge ConsultantProfile       — staff merge only
18. Migrate Invites               (re-parent inviterId)
19. Revoke all Sessions of secondary
20. Deactivate secondary user (isActive = false)
21. Rename secondary email to `merged_{originalEmail}_{timestamp}`
22. Create UserMerge audit record
23. Create AuditLog entry
```

**Enrollment conflict resolution:**

When both primary and secondary are enrolled in the same course (`@@unique([personId, courseId])`):

1. Compare enrollment status: COMPLETED > ACTIVE > DROPPED. Keep the better status on primary.
2. Migrate all LessonProgress from secondary for that course.
3. For progress conflicts (`@@unique([personId, lessonId])`): keep completed over incomplete, keep earlier `completedAt` if both completed.
4. Delete secondary's enrollment record after migrating progress.

```typescript
// Pseudocode for enrollment conflict resolution
for each conflicting enrollment (same courseId):
  primaryEnrollment = findOne(personId: primary, courseId)
  secondaryEnrollment = findOne(personId: secondary, courseId)

  // Upgrade primary enrollment status if secondary is further along
  if (secondaryEnrollment.status === 'COMPLETED' && primaryEnrollment.status !== 'COMPLETED'):
    update primaryEnrollment.status = 'COMPLETED'

  // Merge lesson progress
  for each secondaryProgress in secondaryEnrollment.lessonProgress:
    primaryProgress = findOne(personId: primary, lessonId: secondaryProgress.lessonId)
    if (primaryProgress exists):
      // Conflict: pick the better progress
      if (secondaryProgress.isCompleted && !primaryProgress.isCompleted):
        update primaryProgress = { isCompleted: true, completedAt: secondaryProgress.completedAt }
      elif (both completed):
        keep earlier completedAt
      // else: primary already better, no change
    else:
      // No conflict: re-parent
      update secondaryProgress.personId = primary

  delete secondaryEnrollment
```

**ConsultantProfile merge (staff merge only):**

```typescript
if (both have ConsultantProfile):
  primary.maxCases = max(primary.maxCases, secondary.maxCases)
  primary.maxCrisisCases = max(primary.maxCrisisCases, secondary.maxCrisisCases)
  primary.currentCases = primary.currentCases + secondary.currentCases
  primary.currentCrisis = primary.currentCrisis + secondary.currentCrisis
  primary.specializations = deduplicate([...primary.specializations, ...secondary.specializations])
  primary.languages = deduplicate([...primary.languages, ...secondary.languages])
  delete secondary.ConsultantProfile
```

### 3.4 Backend DTOs

**Location:** `apps/api/src/admin/duplicate.model.ts`

New DTOs with `class-validator` decorators and Swagger annotations, following the pattern established in `admin.model.ts`:

```typescript
// --- Request DTOs ---

export class ListDuplicatesDto {
  @ApiPropertyOptional({ description: 'Minimum confidence level', enum: ['HIGH', 'MEDIUM', 'LOW'] })
  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  readonly confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class ExecuteMergeDto {
  @ApiProperty({ description: 'ID of the user to keep as primary' })
  @IsUUID()
  @IsNotEmpty()
  readonly primaryUserId!: string;

  @ApiProperty({ description: 'ID of the user to merge into primary and deactivate' })
  @IsUUID()
  @IsNotEmpty()
  readonly secondaryUserId!: string;
}

export class DismissDuplicateDto {
  @ApiProperty({ description: 'First user ID of the pair' })
  @IsUUID()
  @IsNotEmpty()
  readonly userIdA!: string;

  @ApiProperty({ description: 'Second user ID of the pair' })
  @IsUUID()
  @IsNotEmpty()
  readonly userIdB!: string;

  @ApiPropertyOptional({ description: 'Reason for dismissal' })
  @IsOptional()
  @IsString()
  readonly reason?: string;
}

export class ListMergeHistoryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly pageSize?: number;
}

// --- Response Interfaces ---

export interface DuplicateGroupSummary { ... }  // as defined in 3.2.1
export interface DuplicateGroupUserDetail { ... } // as defined in 3.2.2
export interface MergePreview { ... }             // as defined in 3.2.2
export interface MergeExecutionResult { ... }     // as defined in 3.2.3
export interface MergeHistoryEntry { ... }        // as defined in 3.2.5
```

**Constants:** `apps/api/src/admin/duplicate.const.ts`

```typescript
export const DUPLICATE_CONFIDENCE_HIGH = 'HIGH' as const;
export const DUPLICATE_CONFIDENCE_MEDIUM = 'MEDIUM' as const;
export const DUPLICATE_CONFIDENCE_LOW = 'LOW' as const;

export const MATCH_REASON_EXACT_EMAIL = 'EXACT_EMAIL' as const;
export const MATCH_REASON_EXACT_NAME = 'EXACT_NAME' as const;
export const MATCH_REASON_SAME_TELEGRAM_PROVIDER = 'SAME_TELEGRAM_PROVIDER' as const;
export const MATCH_REASON_TELEGRAM_CONTACT_MATCH = 'TELEGRAM_CONTACT_MATCH' as const;
export const MATCH_REASON_SHARED_REAL_EMAIL = 'SHARED_REAL_EMAIL' as const;

export const SYNTHETIC_EMAIL_SUFFIX = '@telegram.user' as const;
export const MERGED_EMAIL_PREFIX = 'merged_' as const;

export const GROUP_ID_HASH_LENGTH = 16;

export const MERGE_BLOCKED_CROSS_ROLE = 'Cannot merge users with different roles' as const;
export const MERGE_BLOCKED_DELETION_REQUEST = 'Cannot merge user with active deletion request' as const;
export const MERGE_BLOCKED_INACTIVE = 'Both users must be active to merge' as const;
export const MERGE_BLOCKED_SAME_USER = 'Cannot merge a user with itself' as const;

export const AUDIT_ACTION_MERGE = 'ADMIN_USER_MERGE' as const;
export const AUDIT_ACTION_DISMISS_DUPLICATE = 'ADMIN_DUPLICATE_DISMISSED' as const;
```

### 3.5 Frontend Components

#### 3.5.1 Data Layer

**Model:** `libs/staff/data-access/model/duplicate.model.ts`

```typescript
// --- API Response Types ---

export interface DuplicateGroupSummary {
  readonly groupId: string;
  readonly users: readonly DuplicateGroupUser[];
  readonly matchReasons: readonly MatchReason[];
  readonly confidence: DuplicateConfidence;
  readonly suggestedPrimaryId: string;
}

export interface DuplicateGroupUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly providerCount: number;
  readonly caseCount: number;
}

export interface DuplicateGroupUserDetail extends DuplicateGroupUser {
  readonly avatarUrl: string | null;
  readonly providers: readonly ProviderInfo[];
  readonly hasPassword: boolean;
  readonly cases: readonly CaseSummary[];
  readonly enrollments: readonly EnrollmentSummary[];
  readonly messageCount: number;
  readonly meetingCount: number;
  readonly hasActiveDeletionRequest: boolean;
}

export interface ProviderInfo {
  readonly provider: string;
  readonly providerAccountId: string;
}

export interface CaseSummary {
  readonly id: string;
  readonly topic: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface EnrollmentSummary {
  readonly courseId: string;
  readonly courseTitle: string;
  readonly status: string;
  readonly progressPercent: number;
}

export interface MergePreview {
  readonly casesToMigrate: number;
  readonly messagesToMigrate: number;
  readonly enrollmentsToMerge: number;
  readonly enrollmentConflicts: number;
  readonly progressRecordsToMerge: number;
  readonly progressConflicts: number;
  readonly providerLinksToMigrate: number;
  readonly meetingsToMigrate: number;
  readonly sessionsToRevoke: number;
}

export interface DuplicateGroupDetail {
  readonly groupId: string;
  readonly users: readonly DuplicateGroupUserDetail[];
  readonly matchReasons: readonly MatchReason[];
  readonly confidence: DuplicateConfidence;
  readonly suggestedPrimaryId: string;
  readonly mergePreview: MergePreview | null;
}

export interface DuplicateGroupsResponse {
  readonly groups: readonly DuplicateGroupSummary[];
  readonly total: number;
}

export interface MergeExecutionResult {
  readonly mergeId: string;
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
  readonly mergeDetails: MergeDetails;
}

export interface MergeDetails {
  readonly casesMigrated: number;
  readonly notesMigrated: number;
  readonly messagesMigrated: number;
  readonly enrollmentsMigrated: number;
  readonly enrollmentConflictsResolved: number;
  readonly progressRecordsMigrated: number;
  readonly progressConflictsResolved: number;
  readonly providerLinksMigrated: number;
  readonly meetingsMigrated: number;
  readonly sessionsRevoked: number;
  readonly consentsMigrated: number;
  readonly secondaryEmailRenamed: string;
}

export interface MergeHistoryEntry {
  readonly id: string;
  readonly primaryUserName: string;
  readonly primaryUserEmail: string;
  readonly secondaryUserName: string;
  readonly secondaryUserEmail: string;
  readonly performedByName: string;
  readonly isReverted: boolean;
  readonly createdAt: string;
}

export interface MergeHistoryResponse {
  readonly data: readonly MergeHistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface ExecuteMergeRequest {
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
}

export interface DismissDuplicateRequest {
  readonly userIdA: string;
  readonly userIdB: string;
  readonly reason?: string;
}

export type MatchReason = 'EXACT_EMAIL' | 'EXACT_NAME' | 'SAME_TELEGRAM_PROVIDER' | 'TELEGRAM_CONTACT_MATCH' | 'SHARED_REAL_EMAIL';

export type DuplicateConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// --- Form Models ---

export interface MergeFormModel {
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
}
```

**HTTP Service:** `libs/staff/data-access/service/duplicate.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class DuplicateService {
  private readonly http: HttpClient = inject(HttpClient);

  getGroups(confidence?: DuplicateConfidence): Observable<DuplicateGroupsResponse>;
  getGroupDetail(groupId: string): Observable<DuplicateGroupDetail>;
  executeMerge(groupId: string, dto: ExecuteMergeRequest): Observable<MergeExecutionResult>;
  dismissDuplicate(groupId: string, dto: DismissDuplicateRequest): Observable<{ id: string }>;
  getMergeHistory(page?: number, pageSize?: number): Observable<MergeHistoryResponse>;
  getMergeDetail(mergeId: string): Observable<MergeHistoryEntry>;
}
```

All methods return `Observable<T>`. No state, no signals, no `tap` mutations — pure HTTP layer following project conventions.

**Signal Store:** `libs/staff/data-access/store/duplicate.store.ts`

```typescript
interface DuplicateState {
  groups: DuplicateGroupSummary[];
  groupsTotal: number;
  selectedGroup: DuplicateGroupDetail | null;
  mergeHistory: MergeHistoryEntry[];
  mergeHistoryTotal: number;
  mergeHistoryPage: number;
  confidenceFilter: DuplicateConfidence | null;
  isLoading: boolean;
  isMerging: boolean;
  error: string | null;
  mergeSuccess: boolean;
}
```

Store methods using `rxMethod`:
- `loadGroups: rxMethod<DuplicateConfidence | null>` — calls `getGroups()`, patches `groups` + `groupsTotal`
- `loadGroupDetail: rxMethod<string>` — calls `getGroupDetail(groupId)`, patches `selectedGroup`
- `executeMerge: rxMethod<{ groupId: string; dto: ExecuteMergeRequest }>` — calls `executeMerge()`, patches `mergeSuccess`, removes merged group from `groups`
- `dismissDuplicate: rxMethod<{ groupId: string; dto: DismissDuplicateRequest }>` — calls `dismissDuplicate()`, removes dismissed group from `groups`
- `loadMergeHistory: rxMethod<{ page?: number; pageSize?: number }>` — calls `getMergeHistory()`
- `clearSelectedGroup` — resets `selectedGroup` to `null`
- `clearMergeSuccess` — resets `mergeSuccess` to `false`

**Facade:** `libs/staff/data-access/service/duplicate-facade.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class DuplicateFacade {
  // --- Signals from store ---
  readonly groups: Signal<DuplicateGroupSummary[]>;
  readonly groupsTotal: Signal<number>;
  readonly selectedGroup: Signal<DuplicateGroupDetail | null>;
  readonly mergeHistory: Signal<MergeHistoryEntry[]>;
  readonly isLoading: Signal<boolean>;
  readonly isMerging: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly mergeSuccess: Signal<boolean>;

  // --- Form state ---
  readonly mergeModel: WritableSignal<MergeFormModel>;
  readonly showMergeConfirmation: WritableSignal<boolean>;
  readonly confidenceFilter: WritableSignal<DuplicateConfidence | null>;
  readonly activeTab: WritableSignal<'groups' | 'history'>;

  // --- Methods ---
  loadGroups(): void;
  loadGroupDetail(groupId: string): void;
  selectPrimary(userId: string): void;
  openMergeConfirmation(): void;
  closeMergeConfirmation(): void;
  confirmMerge(groupId: string): void;
  dismissGroup(groupId: string, userIdA: string, userIdB: string, reason?: string): void;
  loadMergeHistory(): void;
  setConfidenceFilter(confidence: DuplicateConfidence | null): void;
  navigateToGroup(groupId: string): void;
  navigateToList(): void;

  // --- Helper methods ---
  getConfidenceBadgeVariant(confidence: DuplicateConfidence): 'success' | 'warning' | 'error';
  getMatchReasonLabel(reason: MatchReason): string;
  formatMergeImpact(preview: MergePreview): string[];
}
```

#### 3.5.2 Duplicate List Page

**Location:** `libs/staff/components/duplicate-list/`

**Files:**
- `duplicate-list.component.ts`
- `duplicate-list.component.html`
- `duplicate-list.component.scss`

**Behavior:**
- Two tabs: "Active Duplicates" and "Merge History"
- Active Duplicates tab: table/card list of `DuplicateGroupSummary[]` sorted by confidence (HIGH first)
- Each row shows: group number, user names/emails, match reason badges, confidence badge, "Review" button
- Confidence filter dropdown (All / High / Medium / Low)
- Merge History tab: paginated table of past merges from `MergeHistoryEntry[]`
- Empty state when no duplicates found

**Component is dumb:** injects only `DuplicateFacade`, exposes signals, calls facade methods on user interaction.

#### 3.5.3 Merge Review Page

**Location:** `libs/staff/components/duplicate-review/`

**Files:**
- `duplicate-review.component.ts`
- `duplicate-review.component.html`
- `duplicate-review.component.scss`

**Behavior:**
- Reads `:groupId` from route params
- Side-by-side comparison layout (two columns for 2-user groups)
- Header section: name, email, role, status, created date, providers
- Data section (collapsible panels): cases list, enrollments with progress, message count, meeting count
- Radio buttons to select primary (system suggestion highlighted)
- "Merge" button (disabled until primary selected) and "Not a duplicate -- Dismiss" button
- Merge confirmation modal showing merge preview impact summary
- After merge: success toast, navigate back to list
- Back navigation link to duplicate list

#### 3.5.4 Banner Enhancement

Update the existing banner in `libs/staff/components/users-manage/users-manage.component.html` to include a "Review Duplicates" link that navigates to `/staff/duplicates`.

### 3.6 Routing

Add two new routes to `libs/staff/components/staff.routes.ts` inside the authenticated children array:

```typescript
{
  path: 'duplicates',
  loadComponent: () =>
    import('./duplicate-list/duplicate-list.component').then(
      (m) => m.DuplicateListComponent,
    ),
},
{
  path: 'duplicates/:groupId',
  loadComponent: () =>
    import('./duplicate-review/duplicate-review.component').then(
      (m) => m.DuplicateReviewComponent,
    ),
},
```

### 3.7 Data-Access Index Exports

Add to `libs/staff/data-access/index.ts`:

```typescript
// Duplicate Models
export type {
  DuplicateGroupSummary,
  DuplicateGroupUser,
  DuplicateGroupUserDetail,
  DuplicateGroupDetail,
  DuplicateGroupsResponse,
  MergePreview,
  MergeExecutionResult,
  MergeDetails,
  MergeHistoryEntry,
  MergeHistoryResponse,
  ExecuteMergeRequest,
  DismissDuplicateRequest,
  MatchReason,
  DuplicateConfidence,
  MergeFormModel,
} from './model/duplicate.model';

// Duplicate Services
export { DuplicateService } from './service/duplicate.service';
export { DuplicateFacade } from './service/duplicate-facade.service';

// Duplicate Stores
export { DuplicateStore } from './store/duplicate.store';
```

---

## 4. Tasks & Acceptance Criteria

See `vault/40-features/duplicate-merge/tasks.md` for the detailed task breakdown.

**Summary:**

| # | Task | Estimate | Dependencies |
|---|------|----------|-------------|
| 1 | DB Migration (Prisma models) | S | None |
| 2 | Enhanced Detection Service | M | Task 1 |
| 3 | Merge Backend Service | L | Task 1, Task 2 |
| 4 | Frontend Data Layer | M | Task 2, Task 3 (API contracts) |
| 5 | Duplicate List UI | M | Task 4 |
| 6 | Merge Review UI | L | Task 4, Task 5 |

---

## 5. Testing

### 5.1 Unit Tests (Vitest)

**`duplicate-detection.service.spec.ts`:**
- Detection rules fire correctly: exact email, exact name, Telegram ProviderLink, Telegram contact match, shared real email
- Union-Find correctly groups transitive matches (A-B, B-C -> group {A,B,C})
- Dismissed pairs are excluded from results
- Already-merged pairs are excluded
- Confidence scoring is correct
- Primary suggestion scoring works (real email > synthetic, password > no password, etc.)
- Empty user set returns empty groups
- Single user returns no groups
- groupId is deterministic (same inputs always produce same hash)

**`user-merge.service.spec.ts`:**
- Simple PERSON-PERSON merge: all entities migrate correctly
- Enrollment conflict resolution: correct status upgrade and progress merge
- LessonProgress conflict: completed wins over incomplete, earlier completedAt wins
- ProviderLink migration: no unique constraint violation
- Session revocation: all secondary sessions marked revoked
- Secondary user deactivated and email renamed
- Cross-role merge blocked (PERSON + CONSULTANT -> error)
- Active deletion request blocks merge
- Merging inactive user blocked
- UserMerge audit record created with correct snapshot
- CONSULTANT-CONSULTANT merge: ConsultantProfile fields merged correctly
- Merge is atomic (rollback on any failure)

**`duplicate.store.spec.ts`:**
- `loadGroups` patches state correctly
- `executeMerge` removes group from list on success
- `dismissDuplicate` removes group from list on success
- Error states patched on API failure

### 5.2 Integration Tests (Vitest)

**`duplicate-detection.integration.spec.ts`:**
- Seed database with known duplicate scenarios
- Verify API returns correct groups with correct match reasons
- Verify dismiss endpoint removes pair from future detection
- Verify merge endpoint executes correctly end-to-end
- Verify merge history endpoint returns past merges

### 5.3 What NOT to test for MVP

- E2E/Playwright tests for the merge flow (manual QA sufficient for admin-only feature)
- Performance benchmarks for detection algorithm (known O(n^2), acceptable at MVP scale)

---

## 6. Code Review Checklist

- [ ] `UserMerge` and `DuplicateDismissal` Prisma models added with correct indexes and column mappings
- [ ] Migration runs cleanly on a fresh database and on existing data
- [ ] Detection rules produce correct groups for all documented scenarios
- [ ] Union-Find correctly handles transitive closure (3+ user groups)
- [ ] Dismissed pairs excluded from detection results
- [ ] Merge transaction is atomic — partial failure rolls back everything
- [ ] All entity types from section 3.4 are handled in merge (none forgotten)
- [ ] Enrollment/progress conflict resolution follows the specified priority rules
- [ ] Secondary user email renamed to avoid unique constraint issues
- [ ] Secondary user sessions revoked
- [ ] `UserMerge.mergeDetails` snapshot captures all migration counts
- [ ] Cross-role merge blocked with clear error message
- [ ] Active deletion request blocks merge
- [ ] All new endpoints have Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`)
- [ ] All new DTOs use `class-validator` decorators
- [ ] Frontend model interfaces are in `duplicate.model.ts`, not inline
- [ ] Frontend service is pure HTTP (no signals, no state)
- [ ] Frontend store uses `signalStore` + `rxMethod` pattern
- [ ] Frontend facade owns form state as `WritableSignal` with explicit types
- [ ] Components are dumb (inject facade only, no business logic)
- [ ] `ChangeDetectionStrategy.OnPush` on all new components
- [ ] No hardcoded colors — all SCSS uses CSS custom properties
- [ ] Routes lazy-loaded via `loadComponent`
- [ ] Data-access index exports updated
- [ ] No `async/await`, no `Promise`, no `firstValueFrom` in frontend code
- [ ] Audit log entry created for both merge and dismiss actions
- [ ] Unit tests cover all merge conflict resolution scenarios
