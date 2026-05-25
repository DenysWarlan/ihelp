import { Module } from '@nestjs/common';

import { WorkloadController } from './workload.controller.js';
import { WorkloadService } from './workload.service.js';

@Module({
  controllers: [WorkloadController],
  providers: [WorkloadService],
  exports: [WorkloadService],
})
export class WorkloadModule {}
