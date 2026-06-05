import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { IsUuidFormat } from '../../common/pipes/uuid-format.validator.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateTagDto {
  @ApiProperty({ description: 'Unique tag name' })
  @IsNotEmpty()
  @IsString()
  name!: string;
}

export class AddTagDto {
  @ApiProperty({ description: 'Tag ID to add to the case' })
  @IsUuidFormat()
  tagId!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface TagResponse {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

export interface CaseTagResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly tagId: string;
  readonly createdAt: Date;
  readonly tag: TagResponse;
}
