import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AUTO_ASSIGN_ROLES } from './assignment.const.js';
import { AssignmentResult } from './assignment.model.js';
import { AssignmentService } from './assignment.service.js';

@ApiTags('assignment')
@ApiBearerAuth()
@Controller('cases')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post(':id/auto-assign')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Trigger auto-assignment algorithm for a case',
    description:
      'Finds the best-matching consultant and atomically assigns them. ' +
      'Falls back to coordinator notification if no consultant is available.',
  })
  @ApiResponse({ status: 201, description: 'Assignment result (success or fallback)' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async autoAssign(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AssignmentResult> {
    const actor = req.user as JwtPayload;
    return this.assignmentService.autoAssign(id, actor.sub);
  }
}
