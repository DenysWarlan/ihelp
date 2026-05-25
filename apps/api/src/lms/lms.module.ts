import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller.js';
import { AdminCoursesController } from './admin-courses.controller.js';
import { ProgressController } from './progress.controller.js';
import { PersonProgressController } from './person-progress.controller.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { ProgressService } from './progress.service.js';
import { StrugglingService } from './struggling.service.js';

@Module({
  controllers: [
    CoursesController,
    AdminCoursesController,
    ProgressController,
    PersonProgressController,
  ],
  providers: [
    CoursesService,
    LessonsService,
    EnrollmentService,
    ProgressService,
    StrugglingService,
  ],
})
export class LmsModule {}
