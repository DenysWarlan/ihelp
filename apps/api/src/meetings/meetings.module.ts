import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { MEETINGS_QUEUE } from './meetings.const.js';
import { MeetingsController } from './meetings.controller.js';
import { MeetingsProcessor } from './meetings.processor.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: MEETINGS_QUEUE })],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsProcessor],
  exports: [MeetingsService],
})
export class MeetingsModule {}
