import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { SlaDashboardResponse, SlaTimerResponse } from './sla.model.js';
import { SlaDashboardService } from './sla-dashboard.service.js';
import { SlaService } from './sla.service.js';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('cases')
export class SlaController {
  constructor(
    private readonly slaService: SlaService,
    private readonly dashboardService: SlaDashboardService,
  ) {}

  @Get(':caseId/sla')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Get the SLA timer for a case',
    description:
      'Returns the current SLA timer state including escalation level and status.',
  })
  @ApiOkResponse({ description: 'SLA timer details' })
  @ApiNotFoundResponse({ description: 'No SLA timer found for this case' })
  async getSlaTimer(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<SlaTimerResponse> {
    return this.slaService.getTimer(caseId);
  }
}

/**
 * Dedicated controller for the SLA dashboard (S-E07-05).
 * Mounted at /sla/dashboard to avoid path conflicts with the case-scoped routes.
 */
@ApiTags('sla')
@ApiBearerAuth()
@Controller('sla')
export class SlaDashboardController {
  constructor(private readonly dashboardService: SlaDashboardService) {}

  @Get('dashboard')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'SLA dashboard — all active timers',
    description:
      'Returns all active, paused, and escalated SLA timers with case info, ' +
      'consultant name, elapsed time, and colour indicator (green/yellow/red).',
  })
  @ApiOkResponse({ description: 'SLA dashboard data' })
  async getDashboard(): Promise<SlaDashboardResponse> {
    return this.dashboardService.getDashboard();
  }
}
