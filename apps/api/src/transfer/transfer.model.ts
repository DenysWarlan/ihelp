import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransferStatus, TransferType } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs — Vacation transfer (S-E10-01)
// ---------------------------------------------------------------------------

/**
 * DTO for initiating a vacation (temporary) transfer.
 */
export class InitiateVacationTransferDto {
  @ApiProperty({
    description: 'User ID of the consultant going on vacation',
  })
  @IsUUID()
  consultantUserId!: string;

  @ApiProperty({
    description: 'Vacation start date (ISO 8601)',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsDateString()
  vacationStart!: string;

  @ApiProperty({
    description: 'Vacation end date (ISO 8601)',
    example: '2026-07-15T00:00:00.000Z',
  })
  @IsDateString()
  vacationEnd!: string;

  @ApiPropertyOptional({ description: 'Reason for transfer' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Permanent transfer (S-E10-02)
// ---------------------------------------------------------------------------

/**
 * DTO for initiating a permanent transfer (consultant leaving).
 */
export class InitiatePermanentTransferDto {
  @ApiProperty({
    description: 'User ID of the consultant leaving',
  })
  @IsUUID()
  consultantUserId!: string;

  @ApiPropertyOptional({ description: 'Reason for leaving' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Accept/override match (S-E10-03)
// ---------------------------------------------------------------------------

/**
 * DTO for accepting or overriding a proposed transfer match.
 */
export class AcceptTransferMatchDto {
  @ApiPropertyOptional({
    description:
      'Override the proposed consultant with a specific user ID. ' +
      'If omitted, accepts the auto-matched consultant.',
  })
  @IsOptional()
  @IsUUID()
  overrideConsultantUserId?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Return cases after vacation (S-E10-08)
// ---------------------------------------------------------------------------

/**
 * DTO for returning cases after vacation ends.
 */
export class ReturnCasesDto {
  @ApiProperty({
    description: 'List of transfer IDs to return',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  transferIds!: string[];
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

/**
 * Proposed match for a single case in a transfer.
 */
export interface TransferMatchProposal {
  readonly transferId: string;
  readonly caseId: string;
  readonly caseTopic: string | null;
  readonly caseLanguage: string | null;
  readonly proposedConsultantUserId: string | null;
  readonly proposedConsultantName: string | null;
  readonly matchScore: number | null;
  readonly status: TransferStatus;
}

/**
 * Result of initiating a transfer (vacation or permanent).
 */
export interface TransferInitiationResult {
  readonly transferType: TransferType;
  readonly consultantUserId: string;
  readonly totalCasesTransferred: number;
  readonly matches: TransferMatchProposal[];
  readonly unmatchedCases: number;
}

/**
 * A returnable transfer record (S-E10-08).
 */
export interface ReturnableTransfer {
  readonly transferId: string;
  readonly caseId: string;
  readonly caseTopic: string | null;
  readonly caseLanguage: string | null;
  readonly currentConsultantName: string | null;
  readonly vacationEnd: Date | null;
}

/**
 * Result of returning cases after vacation.
 */
export interface ReturnCasesResult {
  readonly returnedCount: number;
  readonly failedCount: number;
  readonly returned: string[];
  readonly failed: Array<{ readonly transferId: string; readonly reason: string }>;
}

/**
 * Transfer history entry for a case (S-E10-06).
 */
export interface TransferHistoryEntry {
  readonly id: string;
  readonly transferType: TransferType;
  readonly status: TransferStatus;
  readonly fromConsultantName: string | null;
  readonly toConsultantName: string | null;
  readonly reason: string | null;
  readonly vacationStart: Date | null;
  readonly vacationEnd: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

/**
 * Active case blocking consultant deactivation (S-E10-07).
 */
export interface BlockingCase {
  readonly caseId: string;
  readonly topic: string;
  readonly status: string;
  readonly personName: string | null;
}
