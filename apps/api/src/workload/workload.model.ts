import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { ConsultantStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Dashboard response interfaces
// ---------------------------------------------------------------------------

/**
 * Color indicator for utilization percentage.
 */
export type UtilizationColor = 'green' | 'yellow' | 'red';

/**
 * Single consultant entry on the workload dashboard.
 */
export interface ConsultantWorkloadEntry {
  readonly userId: string;
  readonly name: string | null;
  readonly currentCases: number;
  readonly maxCases: number;
  readonly currentCrisis: number;
  readonly maxCrisisCases: number;
  readonly status: ConsultantStatus;
  readonly utilizationPercent: number;
  readonly utilizationColor: UtilizationColor;
}

/**
 * Full workload dashboard response.
 */
export interface WorkloadDashboardResponse {
  readonly consultants: ConsultantWorkloadEntry[];
  readonly totalConsultants: number;
  readonly totalActiveCases: number;
  readonly totalCapacity: number;
  readonly overallUtilizationPercent: number;
}

// ---------------------------------------------------------------------------
// Escalation interfaces
// ---------------------------------------------------------------------------

/**
 * Escalation step result.
 */
export interface EscalationStep {
  readonly role: string;
  readonly delayMinutes: number;
  readonly channel: string;
  readonly notified: boolean;
}

/**
 * Result of a crisis overflow escalation.
 */
export interface CrisisOverflowEscalationResult {
  readonly caseId: string;
  readonly escalationSteps: EscalationStep[];
  readonly timestamp: Date;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/**
 * DTO for updating a consultant's case limits (S-E09-06).
 */
export class UpdateConsultantLimitsDto {
  @ApiProperty({ description: 'New maximum concurrent cases', example: 12 })
  @IsInt()
  @Min(1)
  maxCases!: number;

  @ApiPropertyOptional({
    description: 'New maximum concurrent crisis cases',
    example: 4,
  })
  @IsInt()
  @Min(0)
  maxCrisisCases!: number;
}
