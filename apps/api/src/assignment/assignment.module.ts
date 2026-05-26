import { Module, forwardRef } from '@nestjs/common';

import { SlaModule } from '../sla/sla.module.js';
import { WorkloadModule } from '../workload/workload.module.js';
import { AssignmentController } from './assignment.controller.js';
import { AssignmentSuggestionsController } from './assignment-suggestions.controller.js';
import { AssignmentService } from './assignment.service.js';
import { ConsultantProfileController } from './consultant-profile/consultant-profile.controller.js';
import { ConsultantProfileService } from './consultant-profile/consultant-profile.service.js';

@Module({
  imports: [forwardRef(() => SlaModule), forwardRef(() => WorkloadModule)],
  controllers: [AssignmentController, AssignmentSuggestionsController, ConsultantProfileController],
  providers: [AssignmentService, ConsultantProfileService],
  exports: [AssignmentService, ConsultantProfileService],
})
export class AssignmentModule {}
