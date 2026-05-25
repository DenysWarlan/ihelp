import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { CrisisAdminController } from './crisis-admin.controller.js';
import { CrisisAlertController } from './crisis-alert.controller.js';
import { CrisisService } from './crisis.service.js';
import {
  DUTY_CHECK_CRON,
  DUTY_CHECK_JOB,
  DUTY_CHECK_QUEUE,
} from './crisis.const.js';
import { DutyCheckProcessor } from './duty-check.processor.js';
import { DutyController } from './duty.controller.js';
import { DutyService } from './duty.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: DUTY_CHECK_QUEUE })],
  controllers: [CrisisAdminController, CrisisAlertController, DutyController],
  providers: [CrisisService, DutyService, DutyCheckProcessor],
  exports: [CrisisService, DutyService],
})
export class CrisisModule implements OnModuleInit {
  constructor(
    @InjectQueue(DUTY_CHECK_QUEUE) private readonly dutyCheckQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const repeatableJobs = await this.dutyCheckQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await this.dutyCheckQueue.removeRepeatableByKey(job.key);
    }

    // Register the daily duty gap check job (S-E08-08)
    await this.dutyCheckQueue.add(
      DUTY_CHECK_JOB,
      {},
      {
        repeat: { pattern: DUTY_CHECK_CRON },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );
  }
}
