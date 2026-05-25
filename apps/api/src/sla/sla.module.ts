import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AssignmentModule } from '../assignment/assignment.module.js';
import { SLA_QUEUE } from './sla.const.js';
import { SlaController } from './sla.controller.js';
import { SlaProcessor } from './sla.processor.js';
import { SlaService } from './sla.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: SLA_QUEUE }),
    forwardRef(() => AssignmentModule),
  ],
  controllers: [SlaController],
  providers: [SlaService, SlaProcessor],
  exports: [SlaService],
})
export class SlaModule {}
