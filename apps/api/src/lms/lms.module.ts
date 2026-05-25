import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller.js';
import { AdminCoursesController } from './admin-courses.controller.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { EnrollmentService } from './enrollment.service.js';

@Module({
  controllers: [CoursesController, AdminCoursesController],
  providers: [CoursesService, LessonsService, EnrollmentService],
})
export class LmsModule {}
