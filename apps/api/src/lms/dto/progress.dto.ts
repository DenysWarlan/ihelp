import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Response DTOs ────────────────────────────────────────────

export class LessonProgressDto {
  @ApiProperty({ description: 'Lesson UUID' })
  lessonId!: string;

  @ApiProperty({ description: 'Lesson title' })
  title!: string;

  @ApiProperty({ description: 'Sort position within course' })
  sortOrder!: number;

  @ApiProperty({ description: 'Whether the lesson is completed' })
  isCompleted!: boolean;

  @ApiProperty({ description: 'Whether the lesson was skipped (trigger warning)' })
  isSkipped!: boolean;

  @ApiProperty({ description: 'Whether the lesson has a trigger warning' })
  hasTriggerWarning!: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp', type: String, nullable: true })
  completedAt!: Date | null;
}

export class CourseProgressDto {
  @ApiProperty({ description: 'Enrollment UUID' })
  enrollmentId!: string;

  @ApiProperty({ description: 'Course UUID' })
  courseId!: string;

  @ApiProperty({ description: 'Course title' })
  courseTitle!: string;

  @ApiProperty({ description: 'Enrollment status' })
  status!: string;

  @ApiProperty({ description: 'Total number of lessons in the course' })
  totalLessons!: number;

  @ApiProperty({ description: 'Number of completed lessons' })
  completedLessons!: number;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercent!: number;

  @ApiProperty({ description: 'Per-lesson progress details', type: [LessonProgressDto] })
  lessons!: LessonProgressDto[];
}

export class PersonProgressDto {
  @ApiProperty({ description: 'Person UUID' })
  personId!: string;

  @ApiProperty({ description: 'Person name', nullable: true })
  personName!: string | null;

  @ApiProperty({ description: 'Enrollments with progress', type: [CourseProgressDto] })
  enrollments!: CourseProgressDto[];
}

export class StrugglingResponseDto {
  @ApiProperty({ description: 'Care case UUID' })
  caseId!: string;

  @ApiProperty({ description: 'Whether this is a newly created case' })
  isNew!: boolean;
}

export class ProgressResetResponseDto {
  @ApiProperty({ description: 'Number of resets used after this operation' })
  resetsUsed!: number;

  @ApiProperty({ description: 'Maximum resets allowed' })
  resetsAllowed!: number;
}
