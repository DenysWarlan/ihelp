import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignment/assignment.module.js';
import { TransferController } from './transfer.controller.js';
import { TransferService } from './transfer.service.js';

@Module({
  imports: [AssignmentModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
