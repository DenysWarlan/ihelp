import { Module } from '@nestjs/common';

import { AutoPauseModule } from './auto-pause/auto-pause.module.js';
import { CaseAuditModule } from './audit/case-audit.module.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { FeedbackModule } from './feedback/feedback.module.js';
import { NotesModule } from './notes/notes.module.js';
import { TagsModule } from './tags/tags.module.js';

@Module({
  imports: [NotesModule, CaseAuditModule, AutoPauseModule, FeedbackModule, TagsModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
