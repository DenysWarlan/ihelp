import { Module } from '@nestjs/common';

import { TeamMeetingsController } from './team-meetings.controller.js';
import { TeamMeetingsService } from './team-meetings.service.js';

@Module({
  controllers: [TeamMeetingsController],
  providers: [TeamMeetingsService],
  exports: [TeamMeetingsService],
})
export class TeamMeetingsModule {}
