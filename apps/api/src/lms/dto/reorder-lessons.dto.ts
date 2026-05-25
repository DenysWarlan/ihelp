import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderLessonsDto {
  @ApiProperty({ description: 'Ordered list of lesson IDs representing the new sort order', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  lessonIds!: string[];
}
