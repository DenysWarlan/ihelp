import { ConsultantStatus } from '@prisma/client';

import { FallbackReason } from './assignment.const.js';

/**
 * Represents a consultant eligible for case assignment.
 */
export interface EligibleConsultant {
  readonly id: string;
  readonly userId: string;
  readonly specializations: string[];
  readonly languages: string[];
  readonly maxCases: number;
  readonly currentCases: number;
  readonly maxCrisisCases: number;
  readonly currentCrisis: number;
  readonly status: ConsultantStatus;
}

/**
 * Result of the auto-assignment algorithm.
 */
export interface AssignmentResult {
  /** Whether assignment succeeded. */
  readonly assigned: boolean;
  /** ID of the CareCase. */
  readonly caseId: string;
  /** User ID of the assigned consultant (null if fallback). */
  readonly consultantUserId: string | null;
  /** ConsultantProfile ID (null if fallback). */
  readonly consultantProfileId: string | null;
  /** Fallback reason if assignment failed. */
  readonly fallbackReason: FallbackReason | null;
}

/**
 * Internal scoring used during prioritization.
 */
export interface ScoredConsultant {
  readonly consultant: EligibleConsultant;
  /** Higher = better match. */
  readonly score: number;
  /** Available capacity: maxCases - currentCases. */
  readonly freeSlots: number;
}
