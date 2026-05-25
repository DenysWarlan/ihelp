/**
 * Transfer module constants (S-E10-01..03).
 */

import { CaseStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const TRANSFER_ROLES = ['CONSULTANT', 'COORDINATOR', 'ADMIN'] as const;

// ---------------------------------------------------------------------------
// Case statuses eligible for transfer
// ---------------------------------------------------------------------------

/**
 * Only cases in these statuses can be transferred.
 * ASSIGNED, IN_PROGRESS, ON_HOLD, MEETING_SCHEDULED are active case states.
 */
export const TRANSFERABLE_CASE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.ON_HOLD,
  CaseStatus.MEETING_SCHEDULED,
] as const;

// ---------------------------------------------------------------------------
// MVP notification prefix
// ---------------------------------------------------------------------------

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]' as const;

// ---------------------------------------------------------------------------
// Audit actions
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_VACATION_TRANSFER = 'VACATION_TRANSFER' as const;
export const AUDIT_ACTION_PERMANENT_TRANSFER = 'PERMANENT_TRANSFER' as const;
export const AUDIT_ACTION_TRANSFER_COMPLETED = 'TRANSFER_COMPLETED' as const;

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

export const ERROR_CRISIS_CASE_BLOCKS_PERMANENT =
  'Cannot initiate permanent transfer while crisis cases are active. ' +
  'Reassign or resolve crisis cases first.' as const;

export const ERROR_NO_ACTIVE_CASES =
  'No active cases found for this consultant to transfer.' as const;

export const ERROR_NO_MATCH_FOUND =
  'No eligible replacement consultant found for this case. Coordinator notified.' as const;
