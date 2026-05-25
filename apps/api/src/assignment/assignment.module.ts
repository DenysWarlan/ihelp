import { Module } from '@nestjs/common';

import { AssignmentController } from './assignment.controller.js';
import { AssignmentService } from './assignment.service.js';
import { ConsultantProfileController } from './consultant-profile/consultant-profile.controller.js';
import { ConsultantProfileService } from './consultant-profile/consultant-profile.service.js';

@Module({
  controllers: [AssignmentController, ConsultantProfileController],
  providers: [AssignmentService, ConsultantProfileService],
  exports: [AssignmentService, ConsultantProfileService],
})
export class AssignmentModule {}
