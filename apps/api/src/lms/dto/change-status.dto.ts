import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class ChangeStatusDto {
  @ApiProperty({ description: 'Target course status', enum: CourseStatus })
  @IsEnum(CourseStatus)
  status!: CourseStatus;
}
