import { Module } from '@nestjs/common';

import { AdminAuditService } from './admin-audit.service.js';
import { AdminConfigService } from './admin-config.service.js';
import { AdminDutyService } from './admin-duty.service.js';
import { AdminInviteService } from './admin-invite.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminInviteService,
    AdminConfigService,
    AdminAuditService,
    AdminDutyService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
