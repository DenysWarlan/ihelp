import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength, IsEnum } from 'class-validator';
import { CourseVisibility } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({ description: 'Course title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Course description' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ description: 'Course language (e.g. "uk", "en")' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Course tags', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Course visibility: PUBLIC (for persons) or STAFF (for consultants)', enum: CourseVisibility })
  @IsEnum(CourseVisibility)
  @IsOptional()
  visibility?: CourseVisibility;
}
