import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  AGGREGATION_JOB_NAME,
  ANALYTICS_QUEUE,
  MVP_NOTIFICATION_PREFIX,
} from './analytics.const.js';
import { AnalyticsService } from './analytics.service.js';

/**
 * BullMQ processor for periodic analytics aggregation.
 *
 * Runs every 15 minutes via a repeatable cron job registered in the module.
 * Pre-aggregates metrics into AnalyticsSnapshot for fast dashboard reads.
 */
@Processor(ANALYTICS_QUEUE)
export class AnalyticsAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsAggregationProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== AGGREGATION_JOB_NAME) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    this.logger.log(
      `${MVP_NOTIFICATION_PREFIX} Starting scheduled analytics aggregation (job=${job.id})`,
    );

    try {
      await this.analyticsService.runAggregation();

      this.logger.log(
        `${MVP_NOTIFICATION_PREFIX} Scheduled analytics aggregation completed (job=${job.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Analytics aggregation failed (job=${job.id}): ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
