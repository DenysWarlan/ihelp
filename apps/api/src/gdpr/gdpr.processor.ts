import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { GDPR_DELETION_QUEUE } from './gdpr.const.js';
import { DeletionJobPayload } from './gdpr.model.js';
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

    this.logger.log(
      `Deletion job ${job.id} completed`,
    );
  }
}
