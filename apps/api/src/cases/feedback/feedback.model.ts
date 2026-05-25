import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Rating from 1 to 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Optional feedback comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface FeedbackResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: Date;
}
