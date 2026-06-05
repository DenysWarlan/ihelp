import { ApiProperty } from '@nestjs/swagger';
import { ConsultantStatus } from '@prisma/client';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

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

// ---------------------------------------------------------------------------
// Confirm auto-assignment suggestion
// ---------------------------------------------------------------------------

export class ConfirmAssignmentDto {
  @ApiProperty({ description: 'User ID of the consultant to assign' })
  @IsUuidFormat()
  consultantId!: string;
}

// ---------------------------------------------------------------------------
// Manual assignment / reassignment DTOs
// ---------------------------------------------------------------------------

/**
 * DTO for manual consultant assignment to a case.
 */
export class ManualAssignDto {
  @ApiProperty({ description: 'User ID of the consultant to assign' })
  @IsUuidFormat()
  consultantUserId!: string;
}

/**
 * DTO for reassigning a case to a different consultant.
 */
export class ReassignDto {
  @ApiProperty({ description: 'User ID of the new consultant to assign' })
  @IsUuidFormat()
  consultantUserId!: string;
}

/**
 * Result of a manual assignment including any non-blocking warnings.
 */
export interface ManualAssignResult {
  /** Whether the assignment succeeded. */
  readonly assigned: boolean;
  /** ID of the CareCase. */
  readonly caseId: string;
  /** User ID of the assigned consultant. */
  readonly consultantUserId: string;
  /** Non-blocking warnings (e.g., consultant unavailable or over capacity). */
  readonly warnings: string[];
}

/**
 * Result of reassignment including info about old and new consultant.
 */
export interface ReassignResult {
  /** Whether the reassignment succeeded. */
  readonly assigned: boolean;
  /** ID of the CareCase. */
  readonly caseId: string;
  /** User ID of the previous consultant (null if unassigned). */
  readonly previousConsultantUserId: string | null;
  /** User ID of the new consultant. */
  readonly newConsultantUserId: string;
  /** Non-blocking warnings. */
  readonly warnings: string[];
}
