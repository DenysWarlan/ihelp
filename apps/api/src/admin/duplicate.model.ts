import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { CONFIDENCE_LEVELS, type ConfidenceLevel, type MatchReason } from './duplicate.const.js';
import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

// ---------------------------------------------------------------------------
// Detection DTOs
// ---------------------------------------------------------------------------

export class ListDuplicatesDto {
  @ApiPropertyOptional({
    description: 'Filter by confidence level',
    enum: Object.values(CONFIDENCE_LEVELS),
  })
  @IsOptional()
  @IsEnum(CONFIDENCE_LEVELS)
  readonly confidence?: ConfidenceLevel;
}

export class DismissDuplicateDto {
  @ApiPropertyOptional({ description: 'Reason for dismissal' })
  @IsOptional()
  @IsString()
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Merge DTOs
// ---------------------------------------------------------------------------

export class ExecuteMergeDto {
  @ApiProperty({ description: 'ID of the primary (surviving) user' })
  @IsUuidFormat()
  @IsNotEmpty()
  readonly primaryUserId!: string;

  @ApiProperty({ description: 'ID of the secondary (absorbed) user' })
  @IsUuidFormat()
  @IsNotEmpty()
  readonly secondaryUserId!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface DuplicateUserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly hasPassword: boolean;
  readonly providers: string[];
  readonly caseCount: number;
  readonly enrollmentCount: number;
  readonly messageCount: number;
  readonly meetingCount: number;
  readonly score: number;
}

export interface DuplicateGroup {
  readonly groupId: string;
  readonly users: DuplicateUserSummary[];
  readonly matchReasons: MatchReason[];
  readonly confidence: ConfidenceLevel;
  readonly suggestedPrimaryId: string;
}

export interface DuplicateGroupsResponse {
  readonly groups: DuplicateGroup[];
  readonly total: number;
}

export interface MergePreview {
  readonly casesReassigned: number;
  readonly messagesReattributed: number;
  readonly enrollmentsMerged: number;
  readonly enrollmentConflicts: number;
  readonly providerLinksMoved: number;
  readonly sessionsRevoked: number;
  readonly meetingsReassigned: number;
}

export interface MergeExecutionResult {
  readonly mergeId: string;
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
  readonly preview: MergePreview;
}

export interface MergeHistoryEntry {
  readonly id: string;
  readonly primaryUserId: string;
  readonly primaryUserName: string;
  readonly primaryUserEmail: string;
  readonly secondaryUserId: string;
  readonly secondaryUserName: string;
  readonly secondaryUserEmail: string;
  readonly performedBy: string;
  readonly performedByName: string;
  readonly mergeDetails: MergePreview;
  readonly isReverted: boolean;
  readonly createdAt: Date;
}

export interface MergeHistoryResponse {
  readonly data: MergeHistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}
