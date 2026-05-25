import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import {
  DUTY_CHECK_QUEUE,
  MVP_NOTIFICATION_PREFIX,
} from './crisis.const.js';
import { DutyService } from './duty.service.js';

/**
 * S-E08-08: Daily processor that checks for duty schedule gaps
 * in the next 48 hours and alerts admin (MVP: log-based).
 */
@Processor(DUTY_CHECK_QUEUE)
export class DutyCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(DutyCheckProcessor.name);

  constructor(private readonly dutyService: DutyService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing duty gap check job: ${job.id}`);

    const gaps = await this.dutyService.checkDutyGaps();

    if (gaps.length > 0) {
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} DUTY GAP ALERT: ` +
          `${gaps.length} gap(s) detected in next 48 hours. ` +
          `Admin notification required.`,
      );

      for (const gap of gaps) {
        this.logger.warn(
          `${MVP_NOTIFICATION_PREFIX} Admin alert — duty gap: ` +
            `${gap.start.toISOString()} to ${gap.end.toISOString()}`,
        );
      }
    } else {
      this.logger.log(
        'Duty gap check completed: no gaps found in next 48 hours',
      );
    }
  }
}
