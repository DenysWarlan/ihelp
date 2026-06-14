import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TeamMeetingStatus, TeamParticipantStatus } from '@prisma/client';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';
import {
  DEFAULT_TEAM_MEETING_DURATION,
  MAX_TEAM_MEETING_DURATION,
  MAX_TEAM_MEETING_PARTICIPANTS,
  MIN_TEAM_MEETING_DURATION,
} from './team-meetings.const.js';

// ---------------------------------------------------------------------------
// DTOs — Create
// ---------------------------------------------------------------------------

export class CreateTeamMeetingDto {
  @ApiProperty({ description: 'Meeting title' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Scheduled date/time in ISO 8601 format (must be in the future)' })
  @IsNotEmpty()
  @IsString()
  scheduledAt!: string;

  @ApiProperty({
    description: 'IDs of staff users to invite as participants',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_TEAM_MEETING_PARTICIPANTS)
  @IsUuidFormat({ each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description: `Duration in minutes (${MIN_TEAM_MEETING_DURATION}–${MAX_TEAM_MEETING_DURATION})`,
    default: DEFAULT_TEAM_MEETING_DURATION,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_TEAM_MEETING_DURATION)
  @Max(MAX_TEAM_MEETING_DURATION)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Optional notes / agenda for the meeting' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ---------------------------------------------------------------------------
// DTOs — Respond (participant accepts / declines)
// ---------------------------------------------------------------------------

export class RespondTeamMeetingDto {
  @ApiProperty({
    description: 'Participant response',
    enum: [TeamParticipantStatus.ACCEPTED, TeamParticipantStatus.DECLINED],
  })
  @IsIn([TeamParticipantStatus.ACCEPTED, TeamParticipantStatus.DECLINED])
  status!: 'ACCEPTED' | 'DECLINED';
}

// ---------------------------------------------------------------------------
// DTOs — Cancel
// ---------------------------------------------------------------------------

export class CancelTeamMeetingDto {
  @ApiPropertyOptional({ description: 'Optional reason for cancelling the meeting' })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface TeamMeetingParticipantResponse {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly status: TeamParticipantStatus;
}

export interface TeamMeetingResponse {
  readonly id: string;
  readonly organizerId: string;
  readonly organizerName: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly notes: string | null;
  readonly status: TeamMeetingStatus;
  readonly cancelledAt: Date | null;
  readonly cancelReason: string | null;
  readonly createdAt: Date;
  readonly participants: TeamMeetingParticipantResponse[];
  /** Whether the requesting user is the organizer. */
  readonly isOrganizer: boolean;
  /** The requesting user's own participant status, if they are an invitee. */
  readonly myStatus: TeamParticipantStatus | null;
}

export interface StaffUserResponse {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}
