import { ConsultantStatus } from '@prisma/client';

/**
 * Consultant statuses eligible for auto-assignment.
 * AVAILABLE: fully open for new cases.
 * BUSY: working but may still accept cases if under maxCases.
 */
export const ELIGIBLE_STATUSES: ConsultantStatus[] = [
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
 * Audit action for auto-assignment events.
 */
export const AUDIT_ACTION_AUTO_ASSIGN = 'AUTO_ASSIGN' as const;
export const AUDIT_ACTION_AUTO_ASSIGN_FALLBACK = 'AUTO_ASSIGN_FALLBACK' as const;
