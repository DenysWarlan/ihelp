import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AssignmentModule } from '../assignment/assignment.module.js';
import { SLA_QUEUE } from './sla.const.js';
import { SlaController, SlaDashboardController } from './sla.controller.js';
import { SlaDashboardService } from './sla-dashboard.service.js';
import { SlaLockService } from './sla-lock.service.js';
import { SlaProcessor } from './sla.processor.js';
import { ResponseTimeService } from './response-time.service.js';
import { SlaService } from './sla.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: SLA_QUEUE }),
    forwardRef(() => AssignmentModule),
  ],
  controllers: [SlaController, SlaDashboardController],
  providers: [
    SlaService,
    SlaProcessor,
    SlaLockService,
    SlaDashboardService,
    ResponseTimeService,
  ],
  exports: [SlaService, ResponseTimeService],
})
export class SlaModule {}
