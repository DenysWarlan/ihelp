import { ApiProperty } from '@nestjs/swagger';

export class LessonListItemDto {
  @ApiProperty({ description: 'Lesson UUID' })
  id!: string;

  @ApiProperty({ description: 'Lesson title' })
  title!: string;

  @ApiProperty({ description: 'Sort position within course' })
  sortOrder!: number;
}

export class CourseListItemDto {
  @ApiProperty({ description: 'Course UUID' })
  id!: string;

  @ApiProperty({ description: 'Course title' })
  title!: string;

  @ApiProperty({ description: 'Course description' })
  description!: string;

  @ApiProperty({ description: 'Tags', type: [String] })
  tags!: string[];

  @ApiProperty({ description: 'Number of lessons' })
  lessonCount!: number;

  @ApiProperty({ description: 'Cover image URL', required: false, nullable: true })
  imageUrl!: string | null;
}

export class CourseDetailDto {
  @ApiProperty({ description: 'Course UUID' })
  id!: string;

  @ApiProperty({ description: 'Course title' })
  title!: string;

  @ApiProperty({ description: 'Course description' })
  description!: string;

  @ApiProperty({ description: 'Tags', type: [String] })
  tags!: string[];

  @ApiProperty({ description: 'Number of lessons' })
  lessonCount!: number;

  @ApiProperty({ description: 'Cover image URL', required: false, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Lessons in this course', type: [LessonListItemDto] })
  lessons!: LessonListItemDto[];
}
