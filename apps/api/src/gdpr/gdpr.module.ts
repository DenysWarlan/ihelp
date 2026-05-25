import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import {
  GDPR_DELETION_QUEUE,
  GDPR_EXPORT_QUEUE,
  GDPR_RETENTION_QUEUE,
} from './gdpr.const.js';
import { GdprController, GdprAdminController } from './gdpr.controller.js';
import {
  GdprDeletionProcessor,
  GdprExportProcessor,
  GdprRetentionProcessor,
} from './gdpr.processor.js';
import { GdprRetentionScheduler } from './gdpr-retention.scheduler.js';
import { GdprService } from './gdpr.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: GDPR_DELETION_QUEUE },
      { name: GDPR_EXPORT_QUEUE },
      { name: GDPR_RETENTION_QUEUE },
    ),
  ],
  controllers: [GdprController, GdprAdminController],
  providers: [
    GdprService,
    GdprDeletionProcessor,
    GdprExportProcessor,
    GdprRetentionProcessor,
    GdprRetentionScheduler,
  ],
  exports: [GdprService],
})
export class GdprModule {}
