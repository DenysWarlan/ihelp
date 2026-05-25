import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  VALID_BUCKETS,
  VALID_PERIODS,
  VALID_TREND_METRIC_TYPES,
} from './analytics.const.js';

// ---------------------------------------------------------------------------
// Query DTOs
// ---------------------------------------------------------------------------

export class PeriodQueryDto {
  @ApiPropertyOptional({
    description: 'Period filter',
    enum: ['week', 'month', 'quarter', 'custom'],
    default: 'month',
  })
  @IsOptional()
  @IsIn([...VALID_PERIODS])
  period?: string = 'month';

  @ApiPropertyOptional({ description: 'Custom period start (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Custom period end (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class InactiveCasesQueryDto {
  @ApiPropertyOptional({
    description: 'Inactivity threshold in days',
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  thresholdDays?: number;
}

export class TrendQueryDto {
  @ApiPropertyOptional({
    description: 'Time bucket size',
    enum: ['day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsIn([...VALID_BUCKETS])
  bucket?: string = 'day';

  @ApiPropertyOptional({
    description: 'Period filter',
    enum: ['week', 'month', 'quarter', 'custom'],
    default: 'month',
  })
  @IsOptional()
  @IsIn([...VALID_PERIODS])
  period?: string = 'month';

  @ApiPropertyOptional({ description: 'Custom period start (ISO date)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Custom period end (ISO date)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MetricTypeParamDto {
  @ApiProperty({
    description: 'Metric type for trend data',
    enum: ['new_cases', 'active_cases', 'completed_cases', 'avg_response_time'],
  })
  @IsString()
  @IsIn([...VALID_TREND_METRIC_TYPES])
  metricType!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface ConsultantMetricsSummary {
  readonly consultantId: string;
  readonly consultantName: string;
  readonly avgFirstResponseTimeMs: number | null;
  readonly avgResponseTimeMs: number | null;
  readonly activeCases: number;
  readonly completedCases: number;
  readonly crisisCasesHandled: number;
  readonly medianResponseTimeMs: number | null;
  readonly p95ResponseTimeMs: number | null;
}

export interface ConsultantMetricsListResponse {
  readonly consultants: ConsultantMetricsSummary[];
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface ConsultantDetailedMetrics extends ConsultantMetricsSummary {
  readonly totalCasesEver: number;
  readonly currentStatus: string;
  readonly casesByPriority: Record<string, number>;
}

export interface InactiveCaseEntry {
  readonly caseId: string;
  readonly consultantId: string;
  readonly consultantName: string;
  readonly lastActivityAt: Date | null;
  readonly idleDays: number;
  readonly topic: string;
  readonly status: string;
}

export interface InactiveCasesResponse {
  readonly cases: InactiveCaseEntry[];
  readonly thresholdDays: number;
  readonly totalCount: number;
}

export interface PlatformCasesMetrics {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly newCases: number;
  readonly activeCases: number;
  readonly completedCases: number;
  readonly avgCaseDurationMs: number | null;
  readonly previousPeriod: {
    readonly newCases: number;
    readonly completedCases: number;
  };
}

export interface PlatformMeetingsMetrics {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalMeetings: number;
  readonly completedMeetings: number;
  readonly cancelledMeetings: number;
  readonly noShowMeetings: number;
}

export interface PlatformCoursesMetrics {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly enrollmentsStarted: number;
  readonly enrollmentsCompleted: number;
  readonly enrollmentsDropped: number;
  readonly activeEnrollments: number;
}

export interface TrendDataPoint {
  readonly date: string;
  readonly value: number;
}

export interface TrendResponse {
  readonly metricType: string;
  readonly bucket: string;
  readonly data: TrendDataPoint[];
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface LastUpdatedResponse {
  readonly lastUpdatedAt: Date | null;
}
