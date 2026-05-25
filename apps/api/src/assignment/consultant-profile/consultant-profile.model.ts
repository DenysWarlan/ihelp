import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ConsultantStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// DTOs — Create
// ---------------------------------------------------------------------------

export class CreateConsultantProfileDto {
  @ApiProperty({ description: 'User ID to create the profile for' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({
    description: 'List of specialization topics',
    type: [String],
    example: ['trauma', 'grief', 'anxiety'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional({
    description: 'Languages the consultant speaks',
    type: [String],
    example: ['uk', 'en', 'de'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({
    description: 'Maximum concurrent cases',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCases?: number;

  @ApiPropertyOptional({
    description: 'Maximum concurrent crisis cases',
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCrisisCases?: number;
}

// ---------------------------------------------------------------------------
// DTOs — Update
// ---------------------------------------------------------------------------

export class UpdateConsultantProfileDto {
  @ApiPropertyOptional({
    description: 'List of specialization topics',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional({
    description: 'Languages the consultant speaks',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ description: 'Maximum concurrent cases' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCases?: number;

  @ApiPropertyOptional({ description: 'Maximum concurrent crisis cases' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCrisisCases?: number;

  @ApiPropertyOptional({
    description: 'Consultant availability status',
    enum: ConsultantStatus,
  })
  @IsOptional()
  @IsEnum(ConsultantStatus)
  status?: ConsultantStatus;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export interface ConsultantProfileResponse {
  readonly id: string;
  readonly userId: string;
  readonly specializations: string[];
  readonly languages: string[];
  readonly maxCases: number;
  readonly currentCases: number;
  readonly maxCrisisCases: number;
  readonly currentCrisis: number;
  readonly status: ConsultantStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
