import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// ── Request DTOs ────────────────────────────────────────────

export class PublishVersionDto {
  @ApiPropertyOptional({ description: 'Changelog describing what changed in this version' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  changelog?: string;
}

// ── Response DTOs ───────────────────────────────────────────

export class CourseVersionListItemDto {
  @ApiProperty({ description: 'Version UUID' })
  id!: string;

  @ApiProperty({ description: 'Version number' })
  versionNumber!: number;

  @ApiPropertyOptional({ description: 'Changelog', nullable: true })
  changelog!: string | null;

  @ApiProperty({ description: 'Published at timestamp' })
  publishedAt!: Date;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;
}

export class CourseVersionDetailDto extends CourseVersionListItemDto {
  @ApiProperty({ description: 'Course UUID' })
  courseId!: string;

  @ApiPropertyOptional({ description: 'Lesson mapping snapshot', nullable: true })
  lessonMapping!: unknown;
}

export class ForceUpdateResultDto {
  @ApiProperty({ description: 'Number of enrollments updated' })
  updatedCount!: number;

  @ApiProperty({ description: 'New version number applied' })
  versionNumber!: number;
}
