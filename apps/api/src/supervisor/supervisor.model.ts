import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class AddSupervisorCommentDto {
  @ApiProperty({ description: 'Supervisor comment text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly comment!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface CaseListItem {
  readonly id: string;
  readonly personName: string;
  readonly topic: string;
  readonly status: string;
  readonly priority: string;
  readonly assignedAt: Date | null;
  readonly lastMessageAt: Date | null;
  readonly consultantName: string | null;
}

export interface SupervisorCaseMessage {
  readonly id: string;
  readonly content: string | null;
  readonly authorName: string;
  readonly authorRole: string;
  readonly createdAt: Date;
}

export interface SupervisorCaseNote {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly createdAt: Date;
}

export interface SupervisorCaseDetail {
  readonly id: string;
  readonly personName: string;
  readonly consultantName: string | null;
  readonly topic: string;
  readonly status: string;
  readonly priority: string;
  readonly createdAt: Date;
  readonly slaDeadline: Date | null;
  readonly messages: SupervisorCaseMessage[];
  readonly consultantNotes: SupervisorCaseNote[];
}

export interface CrisisHistoryItem {
  readonly id: string;
  readonly detectedAt: Date;
  readonly authorName: string;
  readonly consultantName: string | null;
  readonly clientName: string;
  readonly severity: string;
  readonly status: string;
  readonly action: string;
  readonly isEscalated: boolean;
}

export interface AddCommentResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly content: string;
  readonly createdAt: Date;
}
