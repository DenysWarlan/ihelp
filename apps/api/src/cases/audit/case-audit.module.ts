import { Module } from '@nestjs/common';

import { CaseAuditController } from './case-audit.controller.js';
import { CaseAuditService } from './case-audit.service.js';

@Module({
  controllers: [CaseAuditController],
  providers: [CaseAuditService],
})
export class CaseAuditModule {}
