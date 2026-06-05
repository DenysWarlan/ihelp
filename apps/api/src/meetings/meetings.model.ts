import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';
import { MeetingStatus } from '@prisma/client';

import {
  DEFAULT_DURATION,
  MAX_MEETING_DURATION,
  MIN_MEETING_DURATION,
} from './meetings.const.js';

// ---------------------------------------------------------------------------
// DTOs — Create
// ---------------------------------------------------------------------------

export class CreateMeetingDto {
  @ApiProperty({ description: 'Care case ID to link the meeting to' })
  @IsUuidFormat()
  careCaseId!: string;

  @ApiProperty({ description: 'Scheduled date/time in ISO 8601 format (must be in the future)' })
  @IsNotEmpty()
  @IsString()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: `Duration in minutes (${MIN_MEETING_DURATION}–${MAX_MEETING_DURATION})`,
    default: DEFAULT_DURATION,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_MEETING_DURATION)
  @Max(MAX_MEETING_DURATION)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Optional notes for the meeting' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Update
// ---------------------------------------------------------------------------

export class UpdateMeetingDto {
  @ApiPropertyOptional({ description: 'New scheduled date/time in ISO 8601 format (must be in the future)' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: `Duration in minutes (${MIN_MEETING_DURATION}–${MAX_MEETING_DURATION})`,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_MEETING_DURATION)
  @Max(MAX_MEETING_DURATION)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Optional notes for the meeting' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Cancel
// ---------------------------------------------------------------------------

export class CancelMeetingDto {
  @ApiProperty({ description: 'Reason for cancelling the meeting' })
  @IsNotEmpty()
  @IsString()
  cancelReason!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface MeetingResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly consultantId: string;
  readonly personId: string;
  readonly status: MeetingStatus;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly personTz: string;
  readonly consultantTz: string;
  readonly meetingUrl: string | null;
  readonly notes: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly personTzTime: string;
  readonly consultantTzTime: string;
  readonly personName: string | null;
  readonly topic: string | null;
}
