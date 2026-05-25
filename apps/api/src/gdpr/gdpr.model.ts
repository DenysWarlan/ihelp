import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

// ---------------------------------------------------------------------------
// Deletion request DTOs (S-E12-03)
// ---------------------------------------------------------------------------

export class CreateDeletionRequestDto {
  @ApiPropertyOptional({
    description: 'Optional reason for requesting data deletion',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Data export DTOs (S-E12-05)
// ---------------------------------------------------------------------------

export class CreateExportRequestDto {
  @ApiPropertyOptional({
    description: 'Optional format preference (default: json)',
  })
  @IsOptional()
  @IsString()
  readonly format?: string;
}

// ---------------------------------------------------------------------------
// Data access approval DTOs (S-E12-10)
// ---------------------------------------------------------------------------

export class CreateAccessRequestDto {
  @ApiProperty({ description: 'UUID of the target user whose data is requested' })
  @IsNotEmpty()
  @IsUUID()
  readonly targetUserId!: string;

  @ApiProperty({ description: 'Reason for requesting access to personal data' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  readonly reason!: string;
}

export class RejectAccessRequestDto {
  @ApiPropertyOptional({ description: 'Optional rejection reason' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// SAR keyword DTOs (S-E12-07)
// ---------------------------------------------------------------------------

export class CreateSarKeywordDto {
  @ApiProperty({ description: 'SAR keyword or phrase to detect' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  readonly keyword!: string;

  @ApiPropertyOptional({ description: 'Language code (default: uk)', default: 'uk' })
  @IsOptional()
  @IsString()
  readonly language?: string;
}

export class UpdateSarKeywordDto {
  @ApiPropertyOptional({ description: 'Active status of the keyword' })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Retention policy DTOs (S-E12-09)
// ---------------------------------------------------------------------------

export class CreateRetentionPolicyDto {
  @ApiProperty({ description: 'Entity type (e.g., CareCase, Message, Enrollment)' })
  @IsNotEmpty()
  @IsString()
  readonly entityType!: string;

  @ApiProperty({ description: 'Number of days to retain data' })
  @IsInt()
  @Min(1)
  readonly retentionDays!: number;

  @ApiPropertyOptional({ description: 'Description of the retention policy' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly description?: string;
}

export class UpdateRetentionPolicyDto {
  @ApiPropertyOptional({ description: 'Number of days to retain data' })
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly retentionDays?: number;

  @ApiPropertyOptional({ description: 'Active status of the policy' })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description of the retention policy' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// Audit log query DTOs (S-E12-10)
// ---------------------------------------------------------------------------

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsOptional()
  @IsString()
  readonly action?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  readonly userId?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  readonly to?: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface DeletionRequestResponse {
  readonly id: string;
  readonly status: string;
  readonly reason: string | null;
  readonly scheduledAt: Date;
  readonly deferredUntil: Date | null;
  readonly createdAt: Date;
}

export interface ExportRequestResponse {
  readonly id: string;
  readonly status: string;
  readonly fileUrl: string | null;
  readonly fileSize: number | null;
  readonly expiresAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

export interface DataAccessApprovalResponse {
  readonly id: string;
  readonly requesterId: string;
  readonly approverId: string | null;
  readonly targetUserId: string;
  readonly reason: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}

export interface SarKeywordResponse {
  readonly id: string;
  readonly keyword: string;
  readonly language: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

export interface RetentionPolicyResponse {
  readonly id: string;
  readonly entityType: string;
  readonly retentionDays: number;
  readonly isActive: boolean;
  readonly description: string | null;
  readonly createdAt: Date;
}

export interface AuditLogResponse {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly details: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}

export interface PiiScanResult {
  readonly hasPii: boolean;
  readonly warnings: string[];
}

export interface SarDetectionResult {
  readonly isSar: boolean;
  readonly matchedKeywords: string[];
}

// ---------------------------------------------------------------------------
// Job payloads
// ---------------------------------------------------------------------------

export interface DeletionJobPayload {
  readonly deletionRequestId: string;
  readonly userId: string;
}

export interface ExportJobPayload {
  readonly exportRequestId: string;
  readonly userId: string;
}

export interface RetentionCheckPayload {
  readonly triggeredAt: string;
}
