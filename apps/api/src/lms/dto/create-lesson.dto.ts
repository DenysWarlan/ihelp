import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, IsBoolean, Min, MaxLength } from 'class-validator';
import { LessonContentType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ description: 'Lesson title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Lesson content (text/HTML)' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ description: 'Content type', enum: LessonContentType, default: LessonContentType.TEXT })
  @IsEnum(LessonContentType)
  contentType!: LessonContentType;

  @ApiPropertyOptional({ description: 'Video URL (for VIDEO or MIXED types)' })
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Sort position within course' })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether lesson has trigger warning', default: false })
  @IsBoolean()
  @IsOptional()
  hasTriggerWarning?: boolean;
}
