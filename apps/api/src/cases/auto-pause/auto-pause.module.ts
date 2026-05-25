import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  AUTO_PAUSE_CRON,
  AUTO_PAUSE_JOB,
  AUTO_PAUSE_QUEUE,
} from './auto-pause.const.js';
import { AutoPauseProcessor } from './auto-pause.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: AUTO_PAUSE_QUEUE })],
  providers: [AutoPauseProcessor],
})
export class AutoPauseModule implements OnModuleInit {
  constructor(
    @InjectQueue(AUTO_PAUSE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Register the daily repeatable job
    await this.queue.add(
      AUTO_PAUSE_JOB,
      {},
      {
        repeat: { pattern: AUTO_PAUSE_CRON },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );
  }
}
