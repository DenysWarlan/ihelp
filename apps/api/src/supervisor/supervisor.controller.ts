import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  AddCommentResponse,
  AddSupervisorCommentDto,
  CaseListItem,
  CrisisHistoryItem,
  SupervisorCaseDetail,
} from './supervisor.model.js';
import { SupervisorService } from './supervisor.service.js';

@ApiTags('supervisor')
@ApiBearerAuth()
@Controller('supervisor')
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  @Get('cases')
  @Roles('SUPERVISOR')
  @ApiOperation({ summary: 'List all cases with consultant names' })
  @ApiResponse({ status: 200, description: 'List of cases' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — SUPERVISOR role required' })
  async getCases(): Promise<CaseListItem[]> {
    return this.supervisorService.getCases();
  }

  @Get('cases/:id')
  @Roles('SUPERVISOR')
  @ApiOperation({ summary: 'Get case detail for supervisor read-only view' })
  @ApiResponse({ status: 200, description: 'Case detail with messages and notes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — SUPERVISOR role required' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async getCaseDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupervisorCaseDetail> {
    return this.supervisorService.getCaseDetail(id);
  }

  @Post('cases/:id/comment')
  @Roles('SUPERVISOR')
  @ApiOperation({ summary: 'Add a supervisor comment to a case' })
  @ApiResponse({ status: 201, description: 'Comment added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — SUPERVISOR role required' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async addComment(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: AddSupervisorCommentDto,
  ): Promise<AddCommentResponse> {
    const actor = req.user as JwtPayload;
    return this.supervisorService.addComment(id, actor.sub, dto.comment);
  }

  @Get('crisis-history')
  @Roles('SUPERVISOR')
  @ApiOperation({ summary: 'Get crisis alert history' })
  @ApiResponse({ status: 200, description: 'List of crisis alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — SUPERVISOR role required' })
  async getCrisisHistory(): Promise<CrisisHistoryItem[]> {
    return this.supervisorService.getCrisisHistory();
  }
}
