import { Module } from '@nestjs/common';

import { GdprModule } from '../../gdpr/gdpr.module.js';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [GdprModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
