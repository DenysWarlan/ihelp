import { ConsultantStatus, CrisisLevel } from '@prisma/client';

/**
 * Consultant statuses eligible for auto-assignment.
 * AVAILABLE: fully open for new cases.
 * BUSY: working but may still accept cases if under maxCases.
 */
export const ELIGIBLE_STATUSES: readonly ConsultantStatus[] = [
  ConsultantStatus.AVAILABLE,
  ConsultantStatus.BUSY,
] as const;

/**
 * Roles allowed to trigger auto-assignment.
 */
export const AUTO_ASSIGN_ROLES = ['COORDINATOR', 'ADMIN'] as const;

/**
 * Reasons the auto-assignment algorithm can fall back to coordinator.
 */
export enum FallbackReason {
  /** No consultant matches specialization/language criteria. */
  NO_ELIGIBLE_CONSULTANTS = 'NO_ELIGIBLE_CONSULTANTS',
  /** All eligible consultants are at capacity (currentCases >= maxCases). */
  ALL_AT_CAPACITY = 'ALL_AT_CAPACITY',
  /** Atomic assignment failed for every candidate (race condition). */
  ASSIGNMENT_RACE_FAILED = 'ASSIGNMENT_RACE_FAILED',
  /** Case is not in NEW status and cannot be auto-assigned. */
  INVALID_CASE_STATUS = 'INVALID_CASE_STATUS',
}

/**
 * Fallback notification message shown to the person (Ukrainian).
 */
export const FALLBACK_PERSON_MESSAGE =
  'Ваше звернення зареєстровано, з вами зв\'яжуться найближчим часом' as const;

/**
 * Audit action for assignment events.
 */
export const AUDIT_ACTION_AUTO_ASSIGN = 'AUTO_ASSIGN' as const;
export const AUDIT_ACTION_AUTO_ASSIGN_FALLBACK = 'AUTO_ASSIGN_FALLBACK' as const;
export const AUDIT_ACTION_MANUAL_ASSIGN = 'MANUAL_ASSIGN' as const;
export const AUDIT_ACTION_REASSIGN = 'REASSIGN' as const;

/**
 * Notification messages (Ukrainian).
 */
export const NOTIFICATION_ASSIGNED_TO_PERSON =
  'Вашу справу прийнято. Консультант зв\'яжеться з вами найближчим часом.' as const;

export const NOTIFICATION_QUEUED_TO_PERSON =
  'Ваше звернення в черзі. Ми повідомимо вас, коли консультант буде призначений.' as const;

export const NOTIFICATION_NEW_CASE_TO_CONSULTANT =
  'Вам призначено нове звернення.' as const;

/**
 * Crisis levels that count as "crisis" for crisis case limit enforcement.
 * Cases with crisisLevel HIGH or CRITICAL require crisis capacity.
 */
export const CRISIS_LEVELS: readonly CrisisLevel[] = [
  CrisisLevel.HIGH,
  CrisisLevel.CRITICAL,
] as const;

/**
 * Error message when crisis case limit is exceeded (hard limit).
 */
export const CRISIS_LIMIT_EXCEEDED_MESSAGE =
  'Consultant has reached the maximum crisis case limit' as const;
