import { PartialType } from '@nestjs/swagger';
import { CreateLessonDto } from './create-lesson.dto.js';

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
