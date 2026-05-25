/**
 * Analytics module constants (S-E11-01..09).
 */

// ---------------------------------------------------------------------------
// BullMQ queue
// ---------------------------------------------------------------------------

export const ANALYTICS_QUEUE = 'analytics-aggregation' as const;

/** Cron expression: every 15 minutes. */
export const AGGREGATION_CRON = '*/15 * * * *' as const;

/** Bull repeatable job name. */
export const AGGREGATION_JOB_NAME = 'aggregate-metrics' as const;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ANALYTICS_ROLES = ['SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;
export const ANALYTICS_ADMIN_ROLES = ['ADMIN'] as const;

// ---------------------------------------------------------------------------
// Default inactive threshold (days)
// ---------------------------------------------------------------------------

export const DEFAULT_INACTIVE_THRESHOLD_DAYS = 7;

// ---------------------------------------------------------------------------
// Metric types persisted in AnalyticsSnapshot
// ---------------------------------------------------------------------------

export const METRIC_TYPE_CONSULTANT_SUMMARY = 'consultant_summary' as const;
export const METRIC_TYPE_PLATFORM_CASES = 'platform_cases' as const;
export const METRIC_TYPE_PLATFORM_MEETINGS = 'platform_meetings' as const;
export const METRIC_TYPE_PLATFORM_COURSES = 'platform_courses' as const;
export const METRIC_TYPE_TREND_NEW_CASES = 'new_cases' as const;
export const METRIC_TYPE_TREND_ACTIVE_CASES = 'active_cases' as const;
export const METRIC_TYPE_TREND_COMPLETED_CASES = 'completed_cases' as const;
export const METRIC_TYPE_TREND_AVG_RESPONSE_TIME = 'avg_response_time' as const;

export const VALID_TREND_METRIC_TYPES = [
  METRIC_TYPE_TREND_NEW_CASES,
  METRIC_TYPE_TREND_ACTIVE_CASES,
  METRIC_TYPE_TREND_COMPLETED_CASES,
  METRIC_TYPE_TREND_AVG_RESPONSE_TIME,
] as const;

// ---------------------------------------------------------------------------
// Period definitions
// ---------------------------------------------------------------------------

export const VALID_PERIODS = ['week', 'month', 'quarter', 'custom'] as const;
export const VALID_BUCKETS = ['day', 'week', 'month'] as const;

// ---------------------------------------------------------------------------
// MVP notification prefix
// ---------------------------------------------------------------------------

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]' as const;
