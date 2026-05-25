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

// ---------------------------------------------------------------------------
// S-E10-04: Meeting rescheduling on transfer
// ---------------------------------------------------------------------------

/** Threshold in milliseconds — meetings less than this from now are cancelled. */
export const MEETING_CANCEL_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const MEETING_CANCEL_REASON_TRANSFER =
  'Зустріч скасовано через передачу справи іншому консультанту.' as const;

export const AUDIT_ACTION_MEETING_CANCELLED_TRANSFER =
  'MEETING_CANCELLED_TRANSFER' as const;

export const AUDIT_ACTION_MEETING_REASSIGNED_TRANSFER =
  'MEETING_REASSIGNED_TRANSFER' as const;

// ---------------------------------------------------------------------------
// S-E10-05: Notify person about consultant change
// ---------------------------------------------------------------------------

export const NOTIFICATION_VACATION_TRANSFER_TO_PERSON =
  'Ваш консультант тимчасово відсутній. Ваша справа передана іншому спеціалісту, який продовжить роботу з вами.' as const;

export const NOTIFICATION_PERMANENT_TRANSFER_TO_PERSON =
  'Ваш консультант змінився. Новий консультант ознайомлений з вашою справою та продовжить роботу з вами.' as const;

export const AUDIT_ACTION_PERSON_NOTIFIED_TRANSFER =
  'PERSON_NOTIFIED_TRANSFER' as const;

// ---------------------------------------------------------------------------
// S-E10-06: Transfer history
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_TRANSFER_HISTORY_CREATED =
  'TRANSFER_HISTORY_CREATED' as const;

export const NOTIFICATION_NEW_CASE_TO_CONSULTANT_TRANSFER =
  'Вам передано справу від іншого консультанта. Ознайомтесь з історією листування.' as const;

// ---------------------------------------------------------------------------
// S-E10-07: Block consultant deletion with active cases
// ---------------------------------------------------------------------------

export const ERROR_CONSULTANT_HAS_ACTIVE_CASES =
  'Cannot deactivate consultant with active cases. Transfer or close the following cases first.' as const;

// ---------------------------------------------------------------------------
// S-E10-08: Return cases after vacation
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_VACATION_RETURN = 'VACATION_RETURN' as const;

export const NOTIFICATION_VACATION_RETURN_TO_PERSON =
  'Ваш постійний консультант повернувся з відпустки та продовжує роботу з вами.' as const;

export const ERROR_WORKLOAD_LIMIT_EXCEEDED =
  'Cannot return cases — consultant workload limit would be exceeded.' as const;
