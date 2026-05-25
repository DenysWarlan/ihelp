import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { GDPR_DELETION_QUEUE } from './gdpr.const.js';
import { GdprController } from './gdpr.controller.js';
import { GdprDeletionProcessor } from './gdpr.processor.js';
import { GdprService } from './gdpr.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: GDPR_DELETION_QUEUE }),
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprDeletionProcessor],
  exports: [GdprService],
})
export class GdprModule {}
