import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import {
  CRISIS_OVERFLOW_ESCALATION_CHAIN,
  MVP_NOTIFICATION_PREFIX,
  OUT_OF_BAND_CHANNELS,
  UTILIZATION_THRESHOLD_GREEN,
  UTILIZATION_THRESHOLD_YELLOW,
} from './workload.const.js';
import {
  ConsultantWorkloadEntry,
  CrisisOverflowEscalationResult,
  EscalationStep,
  UpdateConsultantLimitsDto,
  UtilizationColor,
  WorkloadDashboardResponse,
} from './workload.model.js';

/**
 * Workload management service.
 *
 * Handles:
 * - Dashboard data aggregation (S-E09-05)
 * - Crisis overflow escalation chain (S-E09-03, S-E09-04)
 * - Admin configurable limits (S-E09-06)
 */
@Injectable()
export class WorkloadService {
  private readonly logger = new Logger(WorkloadService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Dashboard (S-E09-05)
  // ---------------------------------------------------------------------------

  /**
   * Build the workload dashboard data for all consultants.
   */
  async getDashboard(): Promise<WorkloadDashboardResponse> {
    const profiles = await this.prisma.consultantProfile.findMany({
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { currentCases: 'desc' },
    });

    const consultants: ConsultantWorkloadEntry[] = profiles.map((p) => {
      const utilizationPercent =
        p.maxCases > 0
          ? Math.round((p.currentCases / p.maxCases) * 100)
          : 0;

      return {
        userId: p.userId,
        name: p.user?.name ?? null,
        currentCases: p.currentCases,
        maxCases: p.maxCases,
        currentCrisis: p.currentCrisis,
        maxCrisisCases: p.maxCrisisCases,
        status: p.status,
        utilizationPercent,
        utilizationColor: this.getUtilizationColor(utilizationPercent),
      };
    });

    const totalConsultants = consultants.length;
    const totalActiveCases = consultants.reduce(
      (sum, c) => sum + c.currentCases,
      0,
    );
    const totalCapacity = consultants.reduce(
      (sum, c) => sum + c.maxCases,
      0,
    );
    const overallUtilizationPercent =
      totalCapacity > 0
        ? Math.round((totalActiveCases / totalCapacity) * 100)
        : 0;

    return {
      consultants,
      totalConsultants,
      totalActiveCases,
      totalCapacity,
      overallUtilizationPercent,
    };
  }

  // ---------------------------------------------------------------------------
  // Crisis overflow escalation (S-E09-03, S-E09-04)
  // ---------------------------------------------------------------------------

  /**
   * Trigger the escalation chain when all crisis slots are exhausted.
   * MVP: all notifications are log-based.
   *
   * Chain: coordinator (immediate) -> supervisors (10 min) -> admin (15 min)
   * Out-of-band channels (S-E09-04): SMS, EMAIL, PHONE (all log-based for MVP)
   */
  async triggerCrisisOverflowEscalation(
    caseId: string,
  ): Promise<CrisisOverflowEscalationResult> {
    this.logger.warn(
      `Crisis overflow escalation triggered for case ${caseId} — all crisis slots exhausted`,
    );

    const escalationSteps: EscalationStep[] = [];

    for (const step of CRISIS_OVERFLOW_ESCALATION_CHAIN) {
      // MVP: log-based notification
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} [CRISIS OVERFLOW] ` +
          `Notifying ${step.role} via ${step.channel} ` +
          `(delay: ${step.delayMinutes}min) for case ${caseId}`,
      );

      // S-E09-04: Out-of-band escalation channels
      if (step.delayMinutes > 0) {
        for (const channel of OUT_OF_BAND_CHANNELS) {
          this.logger.warn(
            `${MVP_NOTIFICATION_PREFIX} [OUT-OF-BAND] ` +
              `${channel} notification to ${step.role} for case ${caseId}`,
          );
        }
      }

      escalationSteps.push({
        role: step.role,
        delayMinutes: step.delayMinutes,
        channel: step.channel,
        notified: true,
      });
    }

    return {
      caseId,
      escalationSteps,
      timestamp: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Admin configurable limits (S-E09-06)
  // ---------------------------------------------------------------------------

  /**
   * Update a consultant's maxCases and maxCrisisCases limits.
   * Validates that maxCrisisCases <= maxCases.
   * Changes take effect immediately for new assignments.
   */
  async updateConsultantLimits(
    userId: string,
    dto: UpdateConsultantLimitsDto,
  ): Promise<ConsultantWorkloadEntry> {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${userId}`,
      );
    }

    // Validate: maxCrisisCases must not exceed maxCases
    if (dto.maxCrisisCases > dto.maxCases) {
      throw new BadRequestException(
        `maxCrisisCases (${dto.maxCrisisCases}) cannot exceed maxCases (${dto.maxCases})`,
      );
    }

    const updated = await this.prisma.consultantProfile.update({
      where: { userId },
      data: {
        maxCases: dto.maxCases,
        maxCrisisCases: dto.maxCrisisCases,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    this.logger.log(
      `Updated limits for consultant userId=${userId}: ` +
        `maxCases=${dto.maxCases}, maxCrisisCases=${dto.maxCrisisCases}`,
    );

    const utilizationPercent =
      updated.maxCases > 0
        ? Math.round((updated.currentCases / updated.maxCases) * 100)
        : 0;

    return {
      userId: updated.userId,
      name: updated.user?.name ?? null,
      currentCases: updated.currentCases,
      maxCases: updated.maxCases,
      currentCrisis: updated.currentCrisis,
      maxCrisisCases: updated.maxCrisisCases,
      status: updated.status,
      utilizationPercent,
      utilizationColor: this.getUtilizationColor(utilizationPercent),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getUtilizationColor(percent: number): UtilizationColor {
    if (percent < UTILIZATION_THRESHOLD_GREEN) {
      return 'green';
    }
    if (percent < UTILIZATION_THRESHOLD_YELLOW) {
      return 'yellow';
    }
    return 'red';
  }
}
