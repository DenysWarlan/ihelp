import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  GDPR_RETENTION_QUEUE,
  RETENTION_CHECK_JOB_NAME,
  RETENTION_CRON_EXPRESSION,
} from './gdpr.const.js';

/**
 * Schedules a repeating BullMQ job for retention policy checks.
 * Runs daily at 2 AM (configurable via RETENTION_CRON_EXPRESSION).
 */
@Injectable()
export class GdprRetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(GdprRetentionScheduler.name);

  constructor(
    @InjectQueue(GDPR_RETENTION_QUEUE) private readonly retentionQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove existing repeatable job to avoid duplicates on restart
    const existingJobs = await this.retentionQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.name === RETENTION_CHECK_JOB_NAME) {
        await this.retentionQueue.removeRepeatableByKey(job.key);
      }
    }

    // Add a repeating job
    await this.retentionQueue.add(
      RETENTION_CHECK_JOB_NAME,
      { triggeredAt: new Date().toISOString() },
      {
        repeat: { pattern: RETENTION_CRON_EXPRESSION },
        jobId: 'retention-check-repeatable',
      },
    );

    this.logger.log(
      `Retention check scheduled with cron: ${RETENTION_CRON_EXPRESSION}`,
    );
  }
}
