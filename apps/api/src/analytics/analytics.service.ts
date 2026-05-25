import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import {
  CaseStatus,
  ConsultantStatus,
  CrisisLevel,
  EnrollmentStatus,
  MeetingStatus,
  SlaStatus,
} from '@prisma/client';

import {
  DEFAULT_INACTIVE_THRESHOLD_DAYS,
  METRIC_TYPE_CONSULTANT_SUMMARY,
  METRIC_TYPE_PLATFORM_CASES,
  METRIC_TYPE_PLATFORM_COURSES,
  METRIC_TYPE_PLATFORM_MEETINGS,
  METRIC_TYPE_TREND_ACTIVE_CASES,
  METRIC_TYPE_TREND_AVG_RESPONSE_TIME,
  METRIC_TYPE_TREND_COMPLETED_CASES,
  METRIC_TYPE_TREND_NEW_CASES,
  MVP_NOTIFICATION_PREFIX,
  VALID_TREND_METRIC_TYPES,
} from './analytics.const.js';
import {
  ConsultantDetailedMetrics,
  ConsultantMetricsListResponse,
  ConsultantMetricsSummary,
  InactiveCaseEntry,
  InactiveCasesResponse,
  LastUpdatedResponse,
  PlatformCasesMetrics,
  PlatformCoursesMetrics,
  PlatformMeetingsMetrics,
  TrendDataPoint,
  TrendResponse,
} from './analytics.model.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePeriodRange(
  period: string,
  from?: string,
  to?: string,
): { start: Date; end: Date } {
  const now = new Date();
  const end = to ? new Date(to) : now;
  let start: Date;

  switch (period) {
    case 'week':
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      break;
    case 'custom':
      if (!from) {
        throw new BadRequestException(
          'Custom period requires "from" date parameter',
        );
      }
      start = new Date(from);
      break;
    default:
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
  }

  return { start, end };
}

function computePreviousPeriodRange(
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime()),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // S-E11-01: Consultant Metrics — list
  // =========================================================================

  // =========================================================================
  // Team overview (supervisor dashboard)
  // =========================================================================

  async getTeamAnalytics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCasesThisMonth, resolvedCases] = await Promise.all([
      this.prisma.careCase.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.careCase.count({
        where: {
          status: CaseStatus.COMPLETED,
          resolvedAt: { gte: startOfMonth },
        },
      }),
    ]);

    // Avg resolution days for completed cases this month
    const completedCases = await this.prisma.careCase.findMany({
      where: {
        status: CaseStatus.COMPLETED,
        resolvedAt: { gte: startOfMonth },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionDays = 0;
    if (completedCases.length > 0) {
      const totalDays = completedCases.reduce((sum, c) => {
        const diff =
          (c.resolvedAt!.getTime() - c.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgResolutionDays = Math.round((totalDays / completedCases.length) * 10) / 10;
    }

    const members = await this.getTeamMembers();

    return {
      totalCasesThisMonth,
      resolvedCases,
      avgResolutionDays,
      satisfactionScore: 4.2, // placeholder until feedback system is built
      teamMembers: members,
    };
  }

  async getTeamMembers() {
    const consultants = await this.prisma.consultantProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return Promise.all(
      consultants.map(async (cp) => {
        const [activeCases, resolvedThisMonth] = await Promise.all([
          this.prisma.careCase.count({
            where: {
              consultantId: cp.userId,
              status: { notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
            },
          }),
          this.prisma.careCase.count({
            where: {
              consultantId: cp.userId,
              status: CaseStatus.COMPLETED,
              resolvedAt: { gte: startOfMonth },
            },
          }),
        ]);

        return {
          id: cp.userId,
          name: cp.user.name,
          email: cp.user.email,
          role: cp.user.role,
          activeCases,
          resolvedThisMonth,
          avgResponseHours: 0,
        };
      }),
    );
  }

  // =========================================================================
  // S-E11-01: Consultant Metrics
  // =========================================================================

  async getConsultantMetrics(
    period: string,
    from?: string,
    to?: string,
  ): Promise<ConsultantMetricsListResponse> {
    const { start, end } = computePeriodRange(period, from, to);

    const consultants = await this.prisma.consultantProfile.findMany({
      include: { user: { select: { id: true, name: true } } },
    });

    const summaries: ConsultantMetricsSummary[] = await Promise.all(
      consultants.map((cp) =>
        this.buildConsultantSummary(cp.userId, cp.user.name, start, end),
      ),
    );

    return { consultants: summaries, periodStart: start, periodEnd: end };
  }

  // =========================================================================
  // S-E11-01: Consultant Metrics — detail
  // =========================================================================

  async getConsultantDetail(
    consultantId: string,
    period: string,
    from?: string,
    to?: string,
  ): Promise<ConsultantDetailedMetrics> {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId: consultantId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${consultantId}`,
      );
    }

    const { start, end } = computePeriodRange(period, from, to);
    const summary = await this.buildConsultantSummary(
      consultantId,
      profile.user.name,
      start,
      end,
    );

    const totalCasesEver = await this.prisma.careCase.count({
      where: { consultantId },
    });

    const casesByPriority = await this.prisma.careCase.groupBy({
      by: ['priority'],
      where: { consultantId, createdAt: { gte: start, lte: end } },
      _count: true,
    });

    const priorityMap: Record<string, number> = {};
    for (const row of casesByPriority) {
      priorityMap[row.priority] = row._count;
    }

    return {
      ...summary,
      totalCasesEver,
      currentStatus: profile.status,
      casesByPriority: priorityMap,
    };
  }

  // =========================================================================
  // S-E11-03: Inactive Cases
  // =========================================================================

  async getInactiveCases(thresholdDays?: number): Promise<InactiveCasesResponse> {
    const threshold = thresholdDays ?? DEFAULT_INACTIVE_THRESHOLD_DAYS;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - threshold);

    // Find consultants on vacation to exclude
    const vacationConsultants = await this.prisma.consultantProfile.findMany({
      where: { status: ConsultantStatus.ON_VACATION },
      select: { userId: true },
    });
    const vacationUserIds = vacationConsultants.map((c) => c.userId);

    // Active cases with consultant assigned
    const activeCases = await this.prisma.careCase.findMany({
      where: {
        status: {
          in: [
            CaseStatus.ASSIGNED,
            CaseStatus.IN_PROGRESS,
            CaseStatus.MEETING_SCHEDULED,
            CaseStatus.ON_HOLD,
          ],
        },
        consultantId: {
          not: null,
          ...(vacationUserIds.length > 0
            ? { notIn: vacationUserIds }
            : {}),
        },
      },
      include: {
        consultant: { select: { name: true } },
        messages: {
          where: { senderRole: { in: ['CONSULTANT', 'SUPERVISOR'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    const entries: InactiveCaseEntry[] = [];

    for (const c of activeCases) {
      const lastActivity =
        c.messages.length > 0 ? c.messages[0].createdAt : null;

      // Case is inactive if no consultant message or last message is before cutoff
      if (lastActivity === null || lastActivity < cutoff) {
        const now = new Date();
        const idleDays = lastActivity
          ? Math.floor(
              (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
            )
          : Math.floor(
              (now.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
            );

        entries.push({
          caseId: c.id,
          consultantId: c.consultantId!,
          consultantName: c.consultant?.name ?? 'Unknown',
          lastActivityAt: lastActivity,
          idleDays,
          topic: c.topic,
          status: c.status,
        });
      }
    }

    // Sort by idle days descending
    entries.sort((a, b) => b.idleDays - a.idleDays);

    return {
      cases: entries,
      thresholdDays: threshold,
      totalCount: entries.length,
    };
  }

  // =========================================================================
  // S-E11-04: Platform Cases Metrics
  // =========================================================================

  async getPlatformCasesMetrics(
    period: string,
    from?: string,
    to?: string,
  ): Promise<PlatformCasesMetrics> {
    const { start, end } = computePeriodRange(period, from, to);
    const prev = computePreviousPeriodRange(start, end);

    const [newCases, activeCases, completedCases, prevNewCases, prevCompleted] =
      await Promise.all([
        this.prisma.careCase.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        this.prisma.careCase.count({
          where: {
            status: {
              in: [
                CaseStatus.NEW,
                CaseStatus.ASSIGNED,
                CaseStatus.IN_PROGRESS,
                CaseStatus.MEETING_SCHEDULED,
                CaseStatus.ON_HOLD,
              ],
            },
          },
        }),
        this.prisma.careCase.count({
          where: {
            status: { in: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
            resolvedAt: { gte: start, lte: end },
          },
        }),
        this.prisma.careCase.count({
          where: { createdAt: { gte: prev.start, lte: prev.end } },
        }),
        this.prisma.careCase.count({
          where: {
            status: { in: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
            resolvedAt: { gte: prev.start, lte: prev.end },
          },
        }),
      ]);

    // Average case duration for completed cases in period
    const completedInPeriod = await this.prisma.careCase.findMany({
      where: {
        status: { in: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
        resolvedAt: { gte: start, lte: end },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgCaseDurationMs: number | null = null;
    if (completedInPeriod.length > 0) {
      const totalMs = completedInPeriod.reduce((sum, c) => {
        return sum + (c.resolvedAt!.getTime() - c.createdAt.getTime());
      }, 0);
      avgCaseDurationMs = Math.round(totalMs / completedInPeriod.length);
    }

    return {
      periodStart: start,
      periodEnd: end,
      newCases,
      activeCases,
      completedCases,
      avgCaseDurationMs,
      previousPeriod: {
        newCases: prevNewCases,
        completedCases: prevCompleted,
      },
    };
  }

  // =========================================================================
  // S-E11-05: Platform Meetings Metrics
  // =========================================================================

  async getPlatformMeetingsMetrics(
    period: string,
    from?: string,
    to?: string,
  ): Promise<PlatformMeetingsMetrics> {
    const { start, end } = computePeriodRange(period, from, to);

    const grouped = await this.prisma.meeting.groupBy({
      by: ['status'],
      where: { scheduledAt: { gte: start, lte: end } },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const row of grouped) {
      statusCounts[row.status] = row._count;
      total += row._count;
    }

    return {
      periodStart: start,
      periodEnd: end,
      totalMeetings: total,
      completedMeetings: statusCounts[MeetingStatus.COMPLETED] ?? 0,
      cancelledMeetings: statusCounts[MeetingStatus.CANCELLED] ?? 0,
      noShowMeetings:
        (statusCounts[MeetingStatus.NO_SHOW_PERSON] ?? 0) +
        (statusCounts[MeetingStatus.NO_SHOW_CONSULTANT] ?? 0),
    };
  }

  // =========================================================================
  // S-E11-05: Platform Courses Metrics
  // =========================================================================

  async getPlatformCoursesMetrics(
    period: string,
    from?: string,
    to?: string,
  ): Promise<PlatformCoursesMetrics> {
    const { start, end } = computePeriodRange(period, from, to);

    const grouped = await this.prisma.enrollment.groupBy({
      by: ['status'],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    for (const row of grouped) {
      statusCounts[row.status] = row._count;
    }

    const activeEnrollments = await this.prisma.enrollment.count({
      where: { status: EnrollmentStatus.ACTIVE },
    });

    return {
      periodStart: start,
      periodEnd: end,
      enrollmentsStarted:
        (statusCounts[EnrollmentStatus.ACTIVE] ?? 0) +
        (statusCounts[EnrollmentStatus.COMPLETED] ?? 0) +
        (statusCounts[EnrollmentStatus.DROPPED] ?? 0),
      enrollmentsCompleted: statusCounts[EnrollmentStatus.COMPLETED] ?? 0,
      enrollmentsDropped: statusCounts[EnrollmentStatus.DROPPED] ?? 0,
      activeEnrollments,
    };
  }

  // =========================================================================
  // S-E11-06: Last updated timestamp
  // =========================================================================

  async getLastUpdated(): Promise<LastUpdatedResponse> {
    const latest = await this.prisma.analyticsSnapshot.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return { lastUpdatedAt: latest?.createdAt ?? null };
  }

  // =========================================================================
  // S-E11-06: Force refresh — runs aggregation on demand
  // =========================================================================

  async runAggregation(): Promise<void> {
    this.logger.log('Starting analytics aggregation...');
    const now = new Date();
    const periodEnd = now;

    // Aggregate for last month
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - 1);

    await Promise.all([
      this.aggregateConsultantSummaries(periodStart, periodEnd),
      this.aggregatePlatformCases(periodStart, periodEnd),
      this.aggregatePlatformMeetings(periodStart, periodEnd),
      this.aggregatePlatformCourses(periodStart, periodEnd),
      this.aggregateTrends(periodStart, periodEnd),
    ]);

    this.logger.log('Analytics aggregation completed.');
  }

  // =========================================================================
  // S-E11-08: Trends
  // =========================================================================

  async getTrends(
    metricType: string,
    bucket: string,
    period: string,
    from?: string,
    to?: string,
  ): Promise<TrendResponse> {
    if (!VALID_TREND_METRIC_TYPES.includes(metricType as any)) {
      throw new BadRequestException(`Invalid metric type: ${metricType}`);
    }

    const { start, end } = computePeriodRange(period, from, to);
    const data = await this.computeTrendData(metricType, bucket, start, end);

    return {
      metricType,
      bucket,
      data,
      periodStart: start,
      periodEnd: end,
    };
  }

  // =========================================================================
  // Private: Build consultant summary (S-E11-02 + S-E11-09 pause-aware)
  // =========================================================================

  private async buildConsultantSummary(
    consultantId: string,
    consultantName: string,
    start: Date,
    end: Date,
  ): Promise<ConsultantMetricsSummary> {
    // Active cases count (current)
    const activeCases = await this.prisma.careCase.count({
      where: {
        consultantId,
        status: {
          in: [
            CaseStatus.ASSIGNED,
            CaseStatus.IN_PROGRESS,
            CaseStatus.MEETING_SCHEDULED,
            CaseStatus.ON_HOLD,
          ],
        },
      },
    });

    // Completed cases in period
    const completedCases = await this.prisma.careCase.count({
      where: {
        consultantId,
        status: { in: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
        resolvedAt: { gte: start, lte: end },
      },
    });

    // Crisis cases handled in period
    const crisisCasesHandled = await this.prisma.careCase.count({
      where: {
        consultantId,
        crisisLevel: { not: CrisisLevel.NONE },
        createdAt: { gte: start, lte: end },
      },
    });

    // S-E11-02: First response time — time between case creation and first consultant message
    const casesWithFirstResponse = await this.prisma.careCase.findMany({
      where: {
        consultantId,
        firstResponseAt: { not: null },
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, createdAt: true, firstResponseAt: true },
    });

    // S-E11-09: Subtract paused durations from first response times
    const firstResponseTimes: number[] = [];
    for (const c of casesWithFirstResponse) {
      const rawMs = c.firstResponseAt!.getTime() - c.createdAt.getTime();
      const pausedMs = await this.getPausedDuration(
        c.id,
        c.createdAt,
        c.firstResponseAt!,
      );
      firstResponseTimes.push(Math.max(0, rawMs - pausedMs));
    }

    const avgFirstResponseTimeMs =
      firstResponseTimes.length > 0
        ? Math.round(
            firstResponseTimes.reduce((a, b) => a + b, 0) /
              firstResponseTimes.length,
          )
        : null;

    // S-E11-02: General response times from ResponseTimeLog (pause-aware)
    const responseLogs = await this.prisma.responseTimeLog.findMany({
      where: {
        consultantId,
        responseTimeMs: { not: null },
        personSentAt: { gte: start, lte: end },
      },
      select: {
        careCaseId: true,
        personSentAt: true,
        consultantRepliedAt: true,
        responseTimeMs: true,
      },
    });

    // S-E11-09: Adjust response times for paused periods
    const adjustedResponseTimes: number[] = [];
    for (const log of responseLogs) {
      if (log.consultantRepliedAt && log.responseTimeMs) {
        const pausedMs = await this.getPausedDuration(
          log.careCaseId,
          log.personSentAt,
          log.consultantRepliedAt,
        );
        adjustedResponseTimes.push(
          Math.max(0, log.responseTimeMs - pausedMs),
        );
      }
    }

    const avgResponseTimeMs =
      adjustedResponseTimes.length > 0
        ? Math.round(
            adjustedResponseTimes.reduce((a, b) => a + b, 0) /
              adjustedResponseTimes.length,
          )
        : null;

    return {
      consultantId,
      consultantName,
      avgFirstResponseTimeMs,
      avgResponseTimeMs,
      activeCases,
      completedCases,
      crisisCasesHandled,
      medianResponseTimeMs: median(adjustedResponseTimes),
      p95ResponseTimeMs: percentile(adjustedResponseTimes, 95),
    };
  }

  // =========================================================================
  // S-E11-09: Pause-aware duration calculation
  // =========================================================================

  /**
   * Calculates total paused duration (ms) for a case within a time window.
   * Uses SlaTimer pausedAt/resolvedAt to detect pause windows.
   */
  private async getPausedDuration(
    careCaseId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number> {
    const slaTimer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId },
    });

    if (!slaTimer) return 0;

    // If timer was paused during our window, calculate overlap
    if (
      slaTimer.pausedAt &&
      slaTimer.status === SlaStatus.PAUSED
    ) {
      const pauseStart = slaTimer.pausedAt;
      // Paused and not yet resolved — pause is ongoing
      const overlapStart = new Date(
        Math.max(pauseStart.getTime(), windowStart.getTime()),
      );
      const overlapEnd = windowEnd;
      if (overlapStart < overlapEnd) {
        return overlapEnd.getTime() - overlapStart.getTime();
      }
    }

    // If timer was resolved (implying it was unpaused), check if pause fell within window
    if (slaTimer.pausedAt && slaTimer.resolvedAt) {
      const pauseStart = slaTimer.pausedAt;
      const pauseEnd = slaTimer.resolvedAt;
      const overlapStart = new Date(
        Math.max(pauseStart.getTime(), windowStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(pauseEnd.getTime(), windowEnd.getTime()),
      );
      if (overlapStart < overlapEnd) {
        return overlapEnd.getTime() - overlapStart.getTime();
      }
    }

    return 0;
  }

  // =========================================================================
  // Private: Trend computation
  // =========================================================================

  private async computeTrendData(
    metricType: string,
    bucket: string,
    start: Date,
    end: Date,
  ): Promise<TrendDataPoint[]> {
    const buckets = this.generateBuckets(bucket, start, end);
    const data: TrendDataPoint[] = [];

    for (const b of buckets) {
      let value: number;

      switch (metricType) {
        case METRIC_TYPE_TREND_NEW_CASES:
          value = await this.prisma.careCase.count({
            where: { createdAt: { gte: b.start, lt: b.end } },
          });
          break;

        case METRIC_TYPE_TREND_ACTIVE_CASES:
          // Count cases that were active at start of bucket
          value = await this.prisma.careCase.count({
            where: {
              createdAt: { lt: b.end },
              OR: [
                { resolvedAt: null },
                { resolvedAt: { gte: b.start } },
              ],
              status: {
                in: [
                  CaseStatus.NEW,
                  CaseStatus.ASSIGNED,
                  CaseStatus.IN_PROGRESS,
                  CaseStatus.MEETING_SCHEDULED,
                  CaseStatus.ON_HOLD,
                ],
              },
            },
          });
          break;

        case METRIC_TYPE_TREND_COMPLETED_CASES:
          value = await this.prisma.careCase.count({
            where: {
              status: { in: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
              resolvedAt: { gte: b.start, lt: b.end },
            },
          });
          break;

        case METRIC_TYPE_TREND_AVG_RESPONSE_TIME: {
          const logs = await this.prisma.responseTimeLog.findMany({
            where: {
              responseTimeMs: { not: null },
              personSentAt: { gte: b.start, lt: b.end },
            },
            select: { responseTimeMs: true },
          });
          if (logs.length > 0) {
            const total = logs.reduce(
              (sum, l) => sum + (l.responseTimeMs ?? 0),
              0,
            );
            value = Math.round(total / logs.length);
          } else {
            value = 0;
          }
          break;
        }

        default:
          value = 0;
      }

      data.push({ date: b.start.toISOString(), value });
    }

    return data;
  }

  private generateBuckets(
    bucket: string,
    start: Date,
    end: Date,
  ): Array<{ start: Date; end: Date }> {
    const buckets: Array<{ start: Date; end: Date }> = [];
    let current = new Date(start);

    while (current < end) {
      const next = new Date(current);

      switch (bucket) {
        case 'day':
          next.setDate(next.getDate() + 1);
          break;
        case 'week':
          next.setDate(next.getDate() + 7);
          break;
        case 'month':
          next.setMonth(next.getMonth() + 1);
          break;
        default:
          next.setDate(next.getDate() + 1);
      }

      buckets.push({
        start: new Date(current),
        end: next > end ? new Date(end) : next,
      });
      current = next;
    }

    return buckets;
  }

  // =========================================================================
  // Aggregation methods (for BullMQ cron + manual refresh)
  // =========================================================================

  private async aggregateConsultantSummaries(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const consultants = await this.prisma.consultantProfile.findMany({
      include: { user: { select: { id: true, name: true } } },
    });

    for (const cp of consultants) {
      const summary = await this.buildConsultantSummary(
        cp.userId,
        cp.user.name,
        periodStart,
        periodEnd,
      );

      await this.prisma.analyticsSnapshot.create({
        data: {
          metricType: METRIC_TYPE_CONSULTANT_SUMMARY,
          periodStart,
          periodEnd,
          dimensions: { consultantId: cp.userId },
          value: summary as any,
        },
      });
    }
  }

  private async aggregatePlatformCases(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const metrics = await this.getPlatformCasesMetrics(
      'custom',
      periodStart.toISOString(),
      periodEnd.toISOString(),
    );

    await this.prisma.analyticsSnapshot.create({
      data: {
        metricType: METRIC_TYPE_PLATFORM_CASES,
        periodStart,
        periodEnd,
        value: metrics as any,
      },
    });
  }

  private async aggregatePlatformMeetings(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const metrics = await this.getPlatformMeetingsMetrics(
      'custom',
      periodStart.toISOString(),
      periodEnd.toISOString(),
    );

    await this.prisma.analyticsSnapshot.create({
      data: {
        metricType: METRIC_TYPE_PLATFORM_MEETINGS,
        periodStart,
        periodEnd,
        value: metrics as any,
      },
    });
  }

  private async aggregatePlatformCourses(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const metrics = await this.getPlatformCoursesMetrics(
      'custom',
      periodStart.toISOString(),
      periodEnd.toISOString(),
    );

    await this.prisma.analyticsSnapshot.create({
      data: {
        metricType: METRIC_TYPE_PLATFORM_COURSES,
        periodStart,
        periodEnd,
        value: metrics as any,
      },
    });
  }

  private async aggregateTrends(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    for (const metricType of VALID_TREND_METRIC_TYPES) {
      const data = await this.computeTrendData(
        metricType,
        'day',
        periodStart,
        periodEnd,
      );

      await this.prisma.analyticsSnapshot.create({
        data: {
          metricType: `trend_${metricType}`,
          periodStart,
          periodEnd,
          value: data as any,
        },
      });
    }
  }
}
