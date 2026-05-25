import { Module, forwardRef } from '@nestjs/common';

import { SlaModule } from '../sla/sla.module.js';
import { AssignmentController } from './assignment.controller.js';
import { AssignmentService } from './assignment.service.js';
import { ConsultantProfileController } from './consultant-profile/consultant-profile.controller.js';
import { ConsultantProfileService } from './consultant-profile/consultant-profile.service.js';

@Module({
  imports: [forwardRef(() => SlaModule)],
  controllers: [AssignmentController, ConsultantProfileController],
  providers: [AssignmentService, ConsultantProfileService],
  exports: [AssignmentService, ConsultantProfileService],
})
export class AssignmentModule {}
