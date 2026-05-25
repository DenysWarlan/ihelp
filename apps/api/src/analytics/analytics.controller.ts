import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  ANALYTICS_ADMIN_ROLES,
  ANALYTICS_ROLES,
} from './analytics.const.js';
import {
  InactiveCasesQueryDto,
  MetricTypeParamDto,
  PeriodQueryDto,
  TrendQueryDto,
} from './analytics.model.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // =========================================================================
  // S-E11-01: Consultant Metrics
  // =========================================================================

  @Get('consultants')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'List all consultants with key metrics',
    description:
      'Returns aggregated metrics for all consultants: avg first response time, ' +
      'avg response time, active cases, completed cases, crisis cases. ' +
      'Filterable by period (week/month/quarter/custom).',
  })
  @ApiResponse({ status: 200, description: 'Consultant metrics list' })
  @ApiBadRequestResponse({ description: 'Invalid period or missing from date' })
  async getConsultantMetrics(@Query() query: PeriodQueryDto) {
    return this.analyticsService.getConsultantMetrics(
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }

  @Get('consultants/:id')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Get detailed metrics for a specific consultant',
    description:
      'Returns detailed metrics including cases by priority, total cases ever, ' +
      'current status, and all aggregate response time statistics.',
  })
  @ApiParam({ name: 'id', description: 'Consultant user ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Detailed consultant metrics' })
  @ApiNotFoundResponse({ description: 'Consultant profile not found' })
  @ApiBadRequestResponse({ description: 'Invalid period or missing from date' })
  async getConsultantDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PeriodQueryDto,
  ) {
    return this.analyticsService.getConsultantDetail(
      id,
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }

  // =========================================================================
  // S-E11-03: Inactive Cases
  // =========================================================================

  @Get('inactive-cases')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'List cases with no consultant activity beyond threshold',
    description:
      'Returns cases where the consultant has not sent a message within the ' +
      'specified threshold (default: 7 days). Excludes consultants on vacation.',
  })
  @ApiResponse({ status: 200, description: 'Inactive cases list' })
  async getInactiveCases(@Query() query: InactiveCasesQueryDto) {
    return this.analyticsService.getInactiveCases(query.thresholdDays);
  }

  // =========================================================================
  // S-E11-04: Platform Cases Metrics
  // =========================================================================

  @Get('platform/cases')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Aggregate case metrics for the platform',
    description:
      'Returns new cases, active cases, completed cases, avg case duration, ' +
      'and period-over-period comparison.',
  })
  @ApiResponse({ status: 200, description: 'Platform case metrics' })
  @ApiBadRequestResponse({ description: 'Invalid period or missing from date' })
  async getPlatformCases(@Query() query: PeriodQueryDto) {
    return this.analyticsService.getPlatformCasesMetrics(
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }

  // =========================================================================
  // S-E11-05: Platform Meetings Metrics
  // =========================================================================

  @Get('platform/meetings')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Meetings conducted per period',
    description:
      'Returns total, completed, cancelled, and no-show meetings for the given period.',
  })
  @ApiResponse({ status: 200, description: 'Platform meeting metrics' })
  @ApiBadRequestResponse({ description: 'Invalid period or missing from date' })
  async getPlatformMeetings(@Query() query: PeriodQueryDto) {
    return this.analyticsService.getPlatformMeetingsMetrics(
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }

  // =========================================================================
  // S-E11-05: Platform Courses Metrics
  // =========================================================================

  @Get('platform/courses')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Course enrollments per period',
    description:
      'Returns enrollments started, completed, dropped, and currently active for the given period.',
  })
  @ApiResponse({ status: 200, description: 'Platform course metrics' })
  @ApiBadRequestResponse({ description: 'Invalid period or missing from date' })
  async getPlatformCourses(@Query() query: PeriodQueryDto) {
    return this.analyticsService.getPlatformCoursesMetrics(
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }

  // =========================================================================
  // S-E11-06: Last Updated + Force Refresh
  // =========================================================================

  @Get('last-updated')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Get last aggregation timestamp',
    description: 'Returns the timestamp of the most recent analytics aggregation.',
  })
  @ApiResponse({ status: 200, description: 'Last updated timestamp' })
  async getLastUpdated() {
    return this.analyticsService.getLastUpdated();
  }

  @Post('refresh')
  @Roles(...ANALYTICS_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Force refresh analytics aggregation',
    description:
      'Triggers an immediate re-aggregation of all analytics metrics. Admin only.',
  })
  @ApiResponse({ status: 201, description: 'Aggregation triggered' })
  async forceRefresh() {
    await this.analyticsService.runAggregation();
    return { message: 'Analytics aggregation completed' };
  }

  // =========================================================================
  // S-E11-08: Trends
  // =========================================================================

  @Get('trends/:metricType')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({
    summary: 'Get time-bucketed trend data for charting',
    description:
      'Returns an array of { date, value } data points bucketed by day/week/month ' +
      'for the specified metric type. Supported types: new_cases, active_cases, ' +
      'completed_cases, avg_response_time.',
  })
  @ApiParam({
    name: 'metricType',
    description: 'Metric type',
    enum: ['new_cases', 'active_cases', 'completed_cases', 'avg_response_time'],
  })
  @ApiResponse({ status: 200, description: 'Trend data points' })
  @ApiBadRequestResponse({ description: 'Invalid metric type or period' })
  async getTrends(
    @Param() params: MetricTypeParamDto,
    @Query() query: TrendQueryDto,
  ) {
    return this.analyticsService.getTrends(
      params.metricType,
      query.bucket ?? 'day',
      query.period ?? 'month',
      query.from,
      query.to,
    );
  }
}
