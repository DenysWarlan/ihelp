import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  WORKLOAD_ADMIN_ROLES,
  WORKLOAD_DASHBOARD_ROLES,
} from './workload.const.js';
import {
  UpdateConsultantLimitsDto,
} from './workload.model.js';
import { WorkloadService } from './workload.service.js';

@ApiTags('workload')
@ApiBearerAuth()
@Controller('workload')
export class WorkloadController {
  constructor(private readonly workloadService: WorkloadService) {}

  @Get()
  @Roles(...WORKLOAD_DASHBOARD_ROLES)
  @ApiOperation({
    summary: 'Get workload entries for all consultants',
    description: 'Returns a flat list of consultant workload entries.',
  })
  @ApiResponse({ status: 200, description: 'Workload entries' })
  async getWorkload() {
    const dashboard = await this.workloadService.getDashboard();
    return dashboard.consultants.map((c) => ({
      consultantId: c.userId,
      consultantName: c.name ?? '',
      activeCases: c.currentCases,
      maxCases: c.maxCases,
      utilizationPercent: c.utilizationPercent,
      status: c.utilizationColor === 'green'
        ? 'AVAILABLE'
        : c.utilizationColor === 'yellow'
          ? 'AT_CAPACITY'
          : 'OVERLOADED',
    }));
  }

  @Get('dashboard')
  @Roles(...WORKLOAD_DASHBOARD_ROLES)
  @ApiOperation({
    summary: 'Get workload dashboard',
    description:
      'Returns all consultants with current/max cases, utilization percentage, ' +
      'and color indicator (green <70%, yellow 70-90%, red >90%).',
  })
  @ApiResponse({ status: 200, description: 'Workload dashboard data' })
  async getDashboard() {
    return this.workloadService.getDashboard();
  }

  @Get('consultants/:userId/cases')
  @Roles(...WORKLOAD_DASHBOARD_ROLES)
  @ApiOperation({
    summary: 'Get cases assigned to a consultant',
    description: 'Returns consultant profile info and their active cases.',
  })
  @ApiResponse({ status: 200, description: 'Consultant cases' })
  @ApiNotFoundResponse({ description: 'Consultant profile not found' })
  async getConsultantCases(
    @Param('userId', ParseUuidPipe) userId: string,
  ) {
    return this.workloadService.getConsultantCases(userId);
  }

  @Patch('consultants/:userId/limits')
  @Roles(...WORKLOAD_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Update consultant case limits',
    description:
      'Update maxCases and maxCrisisCases for a consultant. ' +
      'Validates maxCrisisCases <= maxCases. Changes are immediate for new assignments.',
  })
  @ApiResponse({ status: 200, description: 'Updated consultant workload entry' })
  @ApiNotFoundResponse({ description: 'Consultant profile not found' })
  @ApiBadRequestResponse({
    description: 'maxCrisisCases exceeds maxCases',
  })
  async updateLimits(
    @Param('userId', ParseUuidPipe) userId: string,
    @Body() dto: UpdateConsultantLimitsDto,
  ) {
    return this.workloadService.updateConsultantLimits(userId, dto);
  }
}
