import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  AGGREGATION_CRON,
  AGGREGATION_JOB_NAME,
  ANALYTICS_QUEUE,
} from './analytics.const.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsAggregationProcessor } from './analytics-aggregation.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsAggregationProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule implements OnModuleInit {
  constructor(
    @InjectQueue(ANALYTICS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Register the 15-minute repeatable aggregation job
    await this.queue.add(
      AGGREGATION_JOB_NAME,
      {},
      {
        repeat: { pattern: AGGREGATION_CRON },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );
  }
}
