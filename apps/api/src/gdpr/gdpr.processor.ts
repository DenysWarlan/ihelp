import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  GDPR_DELETION_QUEUE,
  GDPR_EXPORT_QUEUE,
  GDPR_RETENTION_QUEUE,
  DELETION_JOB_NAME,
  EXPORT_JOB_NAME,
  RETENTION_CHECK_JOB_NAME,
} from './gdpr.const.js';
import {
  DeletionJobPayload,
  ExportJobPayload,
  RetentionCheckPayload,
} from './gdpr.model.js';
import { GdprService } from './gdpr.service.js';

@Processor(GDPR_DELETION_QUEUE)
export class GdprDeletionProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprDeletionProcessor.name);

  constructor(private readonly gdprService: GdprService) {
    super();
  }

  async process(job: Job<DeletionJobPayload>): Promise<void> {
    this.logger.log(
      `Processing deletion job ${job.id} for request ${job.data.deletionRequestId}`,
    );

    await this.gdprService.executeDeletion(job.data);

    this.logger.log(`Deletion job ${job.id} completed`);
  }
}

@Processor(GDPR_EXPORT_QUEUE)
export class GdprExportProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprExportProcessor.name);

  constructor(private readonly gdprService: GdprService) {
    super();
  }

  async process(job: Job<ExportJobPayload>): Promise<void> {
    this.logger.log(
      `Processing export job ${job.id} for request ${job.data.exportRequestId}`,
    );

    await this.gdprService.executeExport(job.data);

    this.logger.log(`Export job ${job.id} completed`);
  }
}

@Processor(GDPR_RETENTION_QUEUE)
export class GdprRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprRetentionProcessor.name);

  constructor(private readonly gdprService: GdprService) {
    super();
  }

  async process(job: Job<RetentionCheckPayload>): Promise<void> {
    this.logger.log(
      `Processing retention check job ${job.id} triggered at ${job.data.triggeredAt}`,
    );

    await this.gdprService.executeRetentionCheck();

    this.logger.log(`Retention check job ${job.id} completed`);
  }
}
