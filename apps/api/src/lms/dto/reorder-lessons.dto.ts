import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

import { IsUuidFormat } from '../../common/pipes/uuid-format.validator.js';

export class ReorderLessonsDto {
  @ApiProperty({ description: 'Ordered list of lesson IDs representing the new sort order', type: [String] })
  @IsArray()
  @IsUuidFormat({ each: true })
  lessonIds!: string[];
}
