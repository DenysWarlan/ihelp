import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { COURSE_EXPORT_QUEUE } from './lms.const.js';
import { CourseImportExportService } from './course-import-export.service.js';

interface ExportJobPayload {
  readonly courseId: string;
}

@Processor(COURSE_EXPORT_QUEUE)
export class CourseExportProcessor extends WorkerHost {
  private readonly logger = new Logger(CourseExportProcessor.name);

  constructor(
    private readonly importExportService: CourseImportExportService,
  ) {
    super();
  }

  async process(job: Job<ExportJobPayload>) {
    this.logger.log(`Processing export job ${job.id} for course ${job.data.courseId}`);

    const bundle = await this.importExportService.buildExportBundleById(
      job.data.courseId,
    );

    // In a real implementation this would write to object storage.
    // For MVP we log success and return the bundle as the job result.
    this.logger.log(
      `Export job ${job.id} completed for course "${bundle.title}" ` +
        `(${bundle.lessons.length} lessons)`,
    );

    return bundle;
  }
}
