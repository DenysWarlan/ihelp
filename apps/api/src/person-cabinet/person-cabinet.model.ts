import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';
import { EnrollmentStatus, ExportStatus, DeletionStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Dashboard (S-E15-01)
// ---------------------------------------------------------------------------

export interface DashboardCareCaseDto {
  readonly id: string;
  readonly status: string;
  readonly consultantName: string | null;
  readonly consultantAvatarUrl: string | null;
  readonly topic: string;
}

export interface DashboardMeetingDto {
  readonly id: string;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly consultantName: string;
}

export interface DashboardCourseDto {
  readonly id: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly totalLessons: number;
  readonly completedLessons: number;
  readonly progressPercent: number;
}

export interface PersonDashboardResponse {
  readonly careCase: DashboardCareCaseDto | null;
  readonly canChat: boolean;
  readonly nextMeeting: DashboardMeetingDto | null;
  readonly courses: DashboardCourseDto[];
}

// ---------------------------------------------------------------------------
// Courses (S-E15-02)
// ---------------------------------------------------------------------------

export interface PersonCourseDto {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly lessonCount: number;
  readonly completedCount: number;
  readonly progressPercent: number;
  readonly enrollmentStatus: EnrollmentStatus;
}

export interface PersonCoursesResponse {
  readonly active: PersonCourseDto[];
  readonly recommended: PersonCourseDto[];
}

// ---------------------------------------------------------------------------
// Chat (S-E15-03)
// ---------------------------------------------------------------------------

export class PersonChatQueryDto {
  @ApiPropertyOptional({ description: 'Cursor: message ID to start after' })
  @IsOptional()
  @IsUuidFormat()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size (default 50, max 100)',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

// ---------------------------------------------------------------------------
// Profile (S-E15-05)
// ---------------------------------------------------------------------------

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'Europe/Kyiv',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export interface PersonProfileResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly timezone: string;
  readonly hasPassword: boolean;
  readonly createdAt: Date;
}

export interface ProviderLinkDto {
  readonly id: string;
  readonly provider: string;
  readonly providerAccountId: string;
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// GDPR Data Export (S-E15-06)
// ---------------------------------------------------------------------------

export class RequestDataExportDto {
  // No fields needed — export is always for the authenticated user
}

export interface DataExportResponse {
  readonly id: string;
  readonly status: ExportStatus;
  readonly fileUrl: string | null;
  readonly fileSize: number | null;
  readonly expiresAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// GDPR Deletion (S-E15-07)
// ---------------------------------------------------------------------------

export class RequestDeletionDto {
  @ApiPropertyOptional({ description: 'Reason for account deletion' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export interface DeletionRequestResponse {
  readonly id: string;
  readonly status: DeletionStatus;
  readonly reason: string | null;
  readonly scheduledAt: Date;
  readonly deferredUntil: Date | null;
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// Meetings (S-E15-09)
// ---------------------------------------------------------------------------

export interface PersonMeetingDto {
  readonly id: string;
  readonly careCaseId: string;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly status: string;
  readonly personTz: string;
  readonly personTzTime: string;
  readonly consultantName: string;
}

// ---------------------------------------------------------------------------
// Conversations (chat)
// ---------------------------------------------------------------------------

export interface PersonConversationDto {
  readonly id: string;
  readonly consultantName: string;
  readonly lastMessage: string | null;
  readonly lastMessageAt: Date | null;
  readonly unreadCount: number;
}
