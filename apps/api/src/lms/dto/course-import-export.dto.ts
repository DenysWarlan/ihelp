import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Export bundle shape ─────────────────────────────────────

export class ExportLessonDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  contentType!: string;

  @ApiPropertyOptional({ nullable: true })
  videoUrl!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  hasTriggerWarning!: boolean;
}

export class CourseExportBundleDto {
  @ApiProperty({ description: 'Export format version' })
  formatVersion!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({ nullable: true })
  language!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: [ExportLessonDto] })
  lessons!: ExportLessonDto[];

  @ApiProperty({ description: 'ISO timestamp of export' })
  exportedAt!: string;
}

// ── Import response ─────────────────────────────────────────

export class CourseImportResultDto {
  @ApiProperty({ description: 'Newly created course UUID' })
  courseId!: string;

  @ApiProperty({ description: 'Number of lessons imported' })
  lessonCount!: number;
}

// ── Async export response ───────────────────────────────────

export class AsyncExportResponseDto {
  @ApiProperty({ description: 'Whether the export is being processed asynchronously' })
  async!: boolean;

  @ApiPropertyOptional({ description: 'Job ID for async export', nullable: true })
  jobId?: string;

  @ApiPropertyOptional({ description: 'Message' })
  message?: string;
}
