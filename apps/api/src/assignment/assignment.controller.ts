import {
  Body,
  Controller,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiBadRequestResponse,
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
import {
  AssignmentResult,
  ManualAssignDto,
  ManualAssignResult,
  ReassignDto,
  ReassignResult,
} from './assignment.model.js';
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
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<AssignmentResult> {
    const actor = req.user as JwtPayload;
    return this.assignmentService.autoAssign(id, actor.sub);
  }

  @Post(':id/manual-assign')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Manually assign a consultant to a case',
    description:
      'Assigns the specified consultant to an unassigned case. ' +
      'Returns warnings (non-blocking) if the consultant is unavailable or over capacity.',
  })
  @ApiResponse({ status: 201, description: 'Manual assignment result with warnings' })
  @ApiNotFoundResponse({ description: 'Case or consultant not found' })
  @ApiBadRequestResponse({ description: 'Case is already assigned' })
  async manualAssign(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ManualAssignDto,
    @Req() req: Request,
  ): Promise<ManualAssignResult> {
    const actor = req.user as JwtPayload;
    return this.assignmentService.manualAssign(
      id,
      dto.consultantUserId,
      actor.sub,
    );
  }

  @Post(':id/reassign')
  @Roles(...AUTO_ASSIGN_ROLES)
  @ApiOperation({
    summary: 'Reassign a case to a different consultant',
    description:
      'Changes the assigned consultant. Decrements old consultant capacity, ' +
      'increments new consultant capacity. Returns warnings if applicable.',
  })
  @ApiResponse({ status: 201, description: 'Reassignment result with warnings' })
  @ApiNotFoundResponse({ description: 'Case or consultant not found' })
  @ApiBadRequestResponse({ description: 'Same consultant or invalid state' })
  async reassign(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ReassignDto,
    @Req() req: Request,
  ): Promise<ReassignResult> {
    const actor = req.user as JwtPayload;
    return this.assignmentService.reassign(
      id,
      dto.consultantUserId,
      actor.sub,
    );
  }
}
