import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CasePriority, CaseSource, CaseStatus, CrisisLevel } from '@prisma/client';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

// ---------------------------------------------------------------------------
// DTOs — Create
// ---------------------------------------------------------------------------

export class CreateCaseDto {
  @ApiPropertyOptional({ description: 'Person ID (defaults to JWT sub if PERSON role)' })
  @IsOptional()
  @IsUuidFormat()
  personId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactValue?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  topic!: string;

  @ApiPropertyOptional({ description: 'Initial message from intake form (maps to description)' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'GDPR data processing consent' })
  @IsOptional()
  @IsBoolean()
  consentData?: boolean;

  @ApiPropertyOptional({ description: 'Sensitive data processing consent' })
  @IsOptional()
  @IsBoolean()
  consentSensitive?: boolean;

  @ApiPropertyOptional({ enum: CaseSource })
  @IsOptional()
  @IsEnum(CaseSource)
  source?: CaseSource;

  @ApiPropertyOptional({ description: 'Required when source=COURSE' })
  @IsOptional()
  @IsUuidFormat()
  sourceCourseId?: string;

  @ApiPropertyOptional({ description: 'Optional lesson reference when source=COURSE' })
  @IsOptional()
  @IsUuidFormat()
  sourceLessonId?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Status change
// ---------------------------------------------------------------------------

export class ChangeStatusDto {
  @ApiProperty({ enum: CaseStatus })
  @IsEnum(CaseStatus)
  status!: CaseStatus;

  @ApiProperty({ description: 'Optimistic lock version' })
  @IsInt()
  @Min(1)
  version!: number;
}

// ---------------------------------------------------------------------------
// DTOs — Assign consultant
// ---------------------------------------------------------------------------

export class AssignConsultantDto {
  @ApiProperty()
  @IsUuidFormat()
  consultantId!: string;

  @ApiProperty({ description: 'Optimistic lock version' })
  @IsInt()
  @Min(1)
  version!: number;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface CaseResponse {
  readonly id: string;
  readonly personId: string;
  readonly consultantId: string | null;
  readonly status: CaseStatus;
  readonly priority: CasePriority;
  readonly crisisLevel: CrisisLevel;
  readonly source: CaseSource;
  readonly topic: string;
  readonly description: string | null;
  readonly name: string | null;
  readonly country: string | null;
  readonly language: string | null;
  readonly contactMethod: string | null;
  readonly contactValue: string | null;
  readonly sourceCourseId: string | null;
  readonly sourceLessonId: string | null;
  readonly firstResponseAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly closedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly personName?: string | null;
  readonly consultantName?: string | null;
  readonly sourceCourse?: { id: string; title: string } | null;
  readonly sourceLesson?: { id: string; title: string } | null;
}

export interface CaseDetailNote {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly isSupervisorNote: boolean;
  readonly createdAt: Date;
}

export interface CaseDetailMessage {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly senderRole: string;
  readonly channel: string;
  readonly isFromStaff: boolean;
  readonly createdAt: Date;
}

export interface CaseDetailMeeting {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly consultantName: string | null;
}

export interface CaseDetailTag {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
}

export interface CaseDetailFeedback {
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: Date;
}

export interface CaseDetailSla {
  readonly status: string;
  readonly currentLevel: number;
  readonly startedAt: Date;
  readonly lastEscalatedAt: Date | null;
}

export interface CaseDetailResponse extends CaseResponse {
  readonly personEmail: string | null;
  readonly personPhone: string | null;
  readonly notes: CaseDetailNote[];
  readonly messages: CaseDetailMessage[];
  readonly meetings: CaseDetailMeeting[];
  readonly tags: CaseDetailTag[];
  readonly feedback: CaseDetailFeedback | null;
  readonly sla: CaseDetailSla | null;
}

export interface CaseListResponse {
  readonly data: CaseResponse[];
  readonly total: number;
}
