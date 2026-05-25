import { Module } from '@nestjs/common';

import { CaseAuditModule } from './audit/case-audit.module.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { NotesModule } from './notes/notes.module.js';

@Module({
  imports: [NotesModule, CaseAuditModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
