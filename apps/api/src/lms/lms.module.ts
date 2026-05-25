import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';

import { CoursesController } from './courses.controller.js';
import { AdminCoursesController } from './admin-courses.controller.js';
import { ProgressController } from './progress.controller.js';
import { PersonProgressController } from './person-progress.controller.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { ProgressService } from './progress.service.js';
import { StrugglingService } from './struggling.service.js';
import { CourseVersionService } from './course-version.service.js';
import { CourseImportExportService } from './course-import-export.service.js';
import { CourseExportProcessor } from './course-export.processor.js';
import { COURSE_EXPORT_QUEUE, IMPORT_MAX_FILE_SIZE_BYTES } from './lms.const.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: COURSE_EXPORT_QUEUE }),
    MulterModule.register({ limits: { fileSize: IMPORT_MAX_FILE_SIZE_BYTES } }),
  ],
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
    CourseVersionService,
    CourseImportExportService,
    CourseExportProcessor,
  ],
  exports: [CourseVersionService],
})
export class LmsModule {}
