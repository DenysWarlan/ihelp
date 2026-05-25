import { CaseStatus } from '@prisma/client';

/**
 * State-machine: allowed status transitions for CareCase.
 * Key = current status, value = list of statuses it can transition to.
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.NEW]: [CaseStatus.ASSIGNED],
  [CaseStatus.ASSIGNED]: [CaseStatus.IN_PROGRESS, CaseStatus.TRANSFERRED],
  [CaseStatus.IN_PROGRESS]: [
    CaseStatus.MEETING_SCHEDULED,
    CaseStatus.ON_HOLD,
    CaseStatus.COMPLETED,
    CaseStatus.TRANSFERRED,
  ],
  [CaseStatus.MEETING_SCHEDULED]: [
    CaseStatus.IN_PROGRESS,
    CaseStatus.ON_HOLD,
    CaseStatus.COMPLETED,
  ],
  [CaseStatus.ON_HOLD]: [CaseStatus.IN_PROGRESS, CaseStatus.CLOSED],
  [CaseStatus.TRANSFERRED]: [CaseStatus.ASSIGNED],
  [CaseStatus.COMPLETED]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};

/** Statuses that indicate the case is no longer active. */
export const TERMINAL_STATUSES: CaseStatus[] = [
  CaseStatus.COMPLETED,
  CaseStatus.CLOSED,
];

/** Roles allowed to assign consultants. */
export const ASSIGN_ROLES = ['COORDINATOR', 'ADMIN'] as const;

/** Roles that are considered staff (can see notes, etc.). */
export const STAFF_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

/** Roles that can view audit logs. */
export const AUDIT_VIEW_ROLES = ['SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

/** Roles with elevated transition privileges (ON_HOLD -> IN_PROGRESS exception). */
export const ELEVATED_TRANSITION_ROLES = ['COORDINATOR', 'ADMIN'] as const;

/** Audit action constants */
export const AUDIT_ACTION_STATUS_CHANGE = 'STATUS_CHANGE' as const;
export const AUDIT_ACTION_ASSIGNMENT = 'ASSIGNMENT' as const;
export const AUDIT_ACTION_CASE_CREATED = 'CASE_CREATED' as const;
