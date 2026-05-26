import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CasePriority, CaseSource, CaseStatus, CrisisLevel } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs — Create
// ---------------------------------------------------------------------------

export class CreateCaseDto {
  @ApiPropertyOptional({ description: 'Person ID (defaults to JWT sub if PERSON role)' })
  @IsOptional()
  @IsUUID()
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
  @IsUUID()
  sourceCourseId?: string;

  @ApiPropertyOptional({ description: 'Optional lesson reference when source=COURSE' })
  @IsOptional()
  @IsUUID()
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
  @IsUUID()
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

export interface CaseListResponse {
  readonly data: CaseResponse[];
  readonly total: number;
}
