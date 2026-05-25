import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrisisLevel, CrisisRiskLevel, MessageChannel } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// ---------------------------------------------------------------------------
// Default keyword entry (used by seed data in crisis.const.ts)
// ---------------------------------------------------------------------------

export interface DefaultKeywordEntry {
  readonly keyword: string;
  readonly language: string;
  readonly riskLevel: CrisisRiskLevel;
}

// ---------------------------------------------------------------------------
// Keyword scan result
// ---------------------------------------------------------------------------

export interface KeywordMatch {
  readonly keyword: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly language: string;
}

export interface CrisisScanResult {
  /** Whether any crisis keywords were detected. */
  readonly detected: boolean;

  /** Matched keywords with their risk levels. */
  readonly matches: readonly KeywordMatch[];

  /** Highest risk level among all matches, or null if none detected. */
  readonly highestRiskLevel: CrisisRiskLevel | null;

  /** The crisis level to set on the case (mapped from highest risk). */
  readonly crisisLevel: CrisisLevel;
}

// ---------------------------------------------------------------------------
// Escalation context
// ---------------------------------------------------------------------------

export interface EscalationContext {
  readonly caseId: string;
  readonly messageId: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly matchedKeywords: readonly string[];
  readonly crisisLevel: CrisisLevel;
}

// ---------------------------------------------------------------------------
// Auto-reply context
// ---------------------------------------------------------------------------

export interface AutoReplyContext {
  readonly caseId: string;
  readonly messageId: string;
  readonly channel: MessageChannel;
  readonly language: string;
}

// ---------------------------------------------------------------------------
// Scan input (message content + optional attachment metadata)
// ---------------------------------------------------------------------------

export interface CrisisScanInput {
  readonly content: string | null;
  readonly attachments?: AttachmentScanMeta[] | null;
}

export interface AttachmentScanMeta {
  readonly fileName?: string;
  readonly altText?: string;
}

// ---------------------------------------------------------------------------
// S-E08-06: Crisis keyword CRUD DTOs
// ---------------------------------------------------------------------------

export class CreateCrisisKeywordDto {
  @ApiProperty({ description: 'The keyword text to detect' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  readonly keyword!: string;

  @ApiPropertyOptional({ description: 'Language code (default: uk)', default: 'uk' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  readonly language?: string;

  @ApiPropertyOptional({ description: 'Risk level', enum: CrisisRiskLevel, default: CrisisRiskLevel.HIGH })
  @IsEnum(CrisisRiskLevel)
  @IsOptional()
  readonly riskLevel?: CrisisRiskLevel;

  @ApiPropertyOptional({ description: 'Whether the keyword is active', default: true })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

export class UpdateCrisisKeywordDto {
  @ApiPropertyOptional({ description: 'The keyword text' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  readonly keyword?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  readonly language?: string;

  @ApiPropertyOptional({ description: 'Risk level', enum: CrisisRiskLevel })
  @IsEnum(CrisisRiskLevel)
  @IsOptional()
  readonly riskLevel?: CrisisRiskLevel;

  @ApiPropertyOptional({ description: 'Whether the keyword is active' })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

// ---------------------------------------------------------------------------
// S-E08-06: Crisis auto-reply CRUD DTOs
// ---------------------------------------------------------------------------

export class CreateCrisisAutoReplyDto {
  @ApiProperty({ description: 'Language code for this template' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  readonly language!: string;

  @ApiProperty({ description: 'Auto-reply template text' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  readonly template!: string;

  @ApiPropertyOptional({ description: 'Whether the template is active', default: true })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

export class UpdateCrisisAutoReplyDto {
  @ApiPropertyOptional({ description: 'Auto-reply template text' })
  @IsString()
  @IsOptional()
  @MinLength(10)
  @MaxLength(2000)
  readonly template?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active' })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

// ---------------------------------------------------------------------------
// S-E08-07: Duty schedule DTOs
// ---------------------------------------------------------------------------

export class CreateDutyScheduleDto {
  @ApiProperty({ description: 'User ID of the duty person' })
  @IsUUID()
  @IsNotEmpty()
  readonly userId!: string;

  @ApiProperty({ description: 'Duty shift start time (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  readonly startTime!: string;

  @ApiProperty({ description: 'Duty shift end time (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  readonly endTime!: string;

  @ApiPropertyOptional({ description: 'Whether the schedule entry is active', default: true })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

export class UpdateDutyScheduleDto {
  @ApiPropertyOptional({ description: 'User ID of the duty person' })
  @IsUUID()
  @IsOptional()
  readonly userId?: string;

  @ApiPropertyOptional({ description: 'Duty shift start time (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  readonly startTime?: string;

  @ApiPropertyOptional({ description: 'Duty shift end time (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  readonly endTime?: string;

  @ApiPropertyOptional({ description: 'Whether the schedule entry is active' })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface CrisisKeywordResponse {
  readonly id: string;
  readonly keyword: string;
  readonly language: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CrisisAutoReplyResponse {
  readonly id: string;
  readonly language: string;
  readonly template: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CrisisAlertResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly messageId: string;
  readonly riskLevel: CrisisRiskLevel;
  readonly matchedKeywords: string[];
  readonly acknowledgedAt: Date | null;
  readonly acknowledgedBy: string | null;
  readonly autoReplySent: boolean;
  readonly createdAt: Date;
}

export interface DutyScheduleResponse {
  readonly id: string;
  readonly userId: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DutyGap {
  readonly start: Date;
  readonly end: Date;
}
