import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { SlaStatus } from '@prisma/client';

import {
  SLA_COLOR_GREEN_MAX_MS,
  SLA_COLOR_YELLOW_MAX_MS,
} from './sla.const.js';
import {
  SlaColorIndicator,
  SlaDashboardEntry,
  SlaDashboardResponse,
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

    this.logger.debug(`Dashboard queried: ${entries.length} active SLA timers`);

    return {
      timers: entries,
      total: entries.length,
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
