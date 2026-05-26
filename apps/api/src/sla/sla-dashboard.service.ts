import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { SlaStatus } from '@prisma/client';

import {
  SLA_COLOR_GREEN_MAX_MS,
  SLA_COLOR_YELLOW_MAX_MS,
} from './sla.const.js';
import { CRISIS_LEVEL_PRIORITY } from '../crisis/crisis.const.js';
import {
  SlaColorIndicator,
  SlaDashboardEntry,
  SlaDashboardResponse,
  SlaOverviewResponse,
  SlaOverviewTimer,
} from './sla.model.js';

/**
 * Provides SLA dashboard data for coordinators (S-E07-05).
 *
 * Aggregates all active/paused/escalated SLA timers with
 * case metadata, consultant name, elapsed time, and colour indicator.
 */
@Injectable()
export class SlaDashboardService {
  private readonly logger = new Logger(SlaDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Dashboard query
  // ---------------------------------------------------------------------------

  async getDashboard(): Promise<SlaDashboardResponse> {
    const timers = await this.prisma.slaTimer.findMany({
      where: {
        status: {
          in: [SlaStatus.ACTIVE, SlaStatus.PAUSED, SlaStatus.ESCALATED],
        },
      },
      include: {
        careCase: {
          select: {
            id: true,
            crisisLevel: true,
            consultant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const now = Date.now();

    const entries: SlaDashboardEntry[] = timers.map((timer) => {
      const elapsedMs = this.calculateElapsedMs(timer, now);
      const consultantName = timer.careCase.consultant?.name ?? null;

      return {
        caseId: timer.careCaseId,
        consultantName,
        currentLevel: timer.currentLevel,
        status: timer.status,
        elapsedMs,
        color: this.getColor(elapsedMs),
        startedAt: timer.startedAt,
        pausedAt: timer.pausedAt,
      };
    });

    // S-E08-05: Sort crisis cases to the top
    entries.sort((a, b) => {
      const timerA = timers.find((t) => t.careCaseId === a.caseId);
      const timerB = timers.find((t) => t.careCaseId === b.caseId);
      const crisisA = CRISIS_LEVEL_PRIORITY[timerA?.careCase.crisisLevel ?? 'NONE'] ?? 0;
      const crisisB = CRISIS_LEVEL_PRIORITY[timerB?.careCase.crisisLevel ?? 'NONE'] ?? 0;

      if (crisisA !== crisisB) {
        return crisisB - crisisA; // Higher crisis level first
      }
      return a.startedAt.getTime() - b.startedAt.getTime(); // Then by time
    });

    this.logger.debug(`Dashboard queried: ${entries.length} active SLA timers`);

    return {
      timers: entries,
      total: entries.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Overview (coordinator widget)
  // ---------------------------------------------------------------------------

  async getOverview(): Promise<SlaOverviewResponse> {
    const timers = await this.prisma.slaTimer.findMany({
      where: {
        status: {
          in: [SlaStatus.ACTIVE, SlaStatus.PAUSED, SlaStatus.ESCALATED],
        },
      },
      include: {
        careCase: {
          select: {
            id: true,
            topic: true,
            person: { select: { name: true } },
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const now = Date.now();

    const overviewTimers: SlaOverviewTimer[] = timers.map((timer) => {
      const elapsedMs = this.calculateElapsedMs(timer, now);
      const color = this.getColor(elapsedMs);
      const status: SlaOverviewTimer['status'] =
        color === 'red' ? 'BREACHED' : color === 'yellow' ? 'AT_RISK' : 'ON_TRACK';

      // Estimate deadline based on the next escalation threshold
      const nextThresholdMs =
        color === 'green'
          ? SLA_COLOR_GREEN_MAX_MS
          : color === 'yellow'
            ? SLA_COLOR_YELLOW_MAX_MS
            : SLA_COLOR_YELLOW_MAX_MS; // already breached
      const remainingMs = Math.max(0, nextThresholdMs - elapsedMs);

      return {
        id: timer.id,
        caseId: timer.careCaseId,
        personName: timer.careCase.person?.name ?? 'Unknown',
        type: timer.careCase.topic ?? 'General',
        deadline: new Date(timer.startedAt.getTime() + nextThresholdMs).toISOString(),
        remainingMinutes: Math.round(remainingMs / 60000),
        status,
      };
    });

    return {
      totalActive: overviewTimers.length,
      atRisk: overviewTimers.filter((t) => t.status === 'AT_RISK').length,
      breached: overviewTimers.filter((t) => t.status === 'BREACHED').length,
      onTrack: overviewTimers.filter((t) => t.status === 'ON_TRACK').length,
      timers: overviewTimers,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate real elapsed time accounting for paused state.
   * If paused, elapsed = pausedAt - startedAt (freeze at pause moment).
   * If active/escalated, elapsed = now - startedAt.
   */
  private calculateElapsedMs(
    timer: { startedAt: Date; pausedAt: Date | null; status: SlaStatus },
    nowMs: number,
  ): number {
    if (timer.status === SlaStatus.PAUSED && timer.pausedAt) {
      return timer.pausedAt.getTime() - timer.startedAt.getTime();
    }
    return nowMs - timer.startedAt.getTime();
  }

  /** Map elapsed time to a colour indicator. */
  private getColor(elapsedMs: number): SlaColorIndicator {
    if (elapsedMs < SLA_COLOR_GREEN_MAX_MS) return 'green';
    if (elapsedMs < SLA_COLOR_YELLOW_MAX_MS) return 'yellow';
    return 'red';
  }
}
