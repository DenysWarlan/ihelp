import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

export interface DeletionRequestResponse {
  readonly id: string;
  readonly status: string;
  readonly reason: string | null;
  readonly scheduledAt: Date;
  readonly deferredUntil: Date | null;
  readonly createdAt: Date;
}

export interface DeletionJobPayload {
  readonly deletionRequestId: string;
  readonly userId: string;
}
