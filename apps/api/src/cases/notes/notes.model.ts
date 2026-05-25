import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateNoteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Mark as supervisor-only note' })
  @IsOptional()
  @IsBoolean()
  isSupervisorNote?: boolean;
}

export class UpdateNoteDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  content!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface NoteResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly authorId: string;
  readonly content: string;
  readonly isSupervisorNote: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly role: string;
  };
}
