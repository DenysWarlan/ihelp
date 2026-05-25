import { Module } from '@nestjs/common';

import { CrisisService } from './crisis.service.js';

@Module({
  providers: [CrisisService],
  exports: [CrisisService],
})
export class CrisisModule {}
