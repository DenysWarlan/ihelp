import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { SlaStatus } from '@prisma/client';
import { Queue } from 'bullmq';

import {
  AUDIT_ACTION_SLA_PAUSED,
  AUDIT_ACTION_SLA_RESET,
  AUDIT_ACTION_SLA_RESOLVED,
  AUDIT_ACTION_SLA_RESUMED,
  AUDIT_ACTION_SLA_STARTED,
  ESCALATION_LEVELS,
  SLA_QUEUE,
  slaJobId,
} from './sla.const.js';
import { SlaEscalationJobData, SlaTimerResponse } from './sla.model.js';

/**
 * Manages SLA timer lifecycle: start, pause, resume, resolve, reset.
 *
 * Each timer schedules Bull delayed jobs for every escalation level.
 * When the timer is resolved (consultant responded) or reset
 * (reassignment at 24h), all pending jobs are removed.
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Start timer
  // ---------------------------------------------------------------------------

  /**
   * Create an SLA timer for a case and schedule all escalation jobs.
   *
   * @param caseId   CareCase ID
   * @param startedAt  Original message timestamp (defaults to now)
   */
  async startTimer(
    caseId: string,
    startedAt?: Date,
  ): Promise<SlaTimerResponse> {
    const start = startedAt ?? new Date();

    const timer = await this.prisma.slaTimer.create({
      data: {
        careCaseId: caseId,
        startedAt: start,
        status: SlaStatus.ACTIVE,
        currentLevel: 0,
      },
    });

    await this.scheduleEscalationJobs(caseId, start);

    this.logger.log(
      `SLA timer started for case ${caseId}, startedAt=${start.toISOString()}`,
    );

    // Audit
    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_STARTED,
        details: { startedAt: start.toISOString() },
      },
    });

    return timer;
  }

  // ---------------------------------------------------------------------------
  // Resolve timer (consultant responded)
  // ---------------------------------------------------------------------------

  async resolveTimer(caseId: string): Promise<SlaTimerResponse> {
    const timer = await this.findActiveTimer(caseId);

    const updated = await this.prisma.slaTimer.update({
      where: { id: timer.id },
      data: {
        status: SlaStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    await this.removeEscalationJobs(caseId);

    this.logger.log(`SLA timer resolved for case ${caseId}`);

    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_RESOLVED,
        details: { resolvedAt: updated.resolvedAt?.toISOString() ?? null },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------

  async pauseTimer(caseId: string): Promise<SlaTimerResponse> {
    const timer = await this.findActiveTimer(caseId);

    const updated = await this.prisma.slaTimer.update({
      where: { id: timer.id },
      data: {
        status: SlaStatus.PAUSED,
        pausedAt: new Date(),
      },
    });

    await this.removeEscalationJobs(caseId);

    this.logger.log(`SLA timer paused for case ${caseId}`);

    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_PAUSED,
        details: {},
      },
    });

    return updated;
  }

  async resumeTimer(caseId: string): Promise<SlaTimerResponse> {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer || timer.status !== SlaStatus.PAUSED) {
      throw new NotFoundException(
        `No paused SLA timer found for case ${caseId}`,
      );
    }

    // Calculate elapsed time before pause and adjust start accordingly
    const now = new Date();
    if (!timer.pausedAt) {
      throw new BadRequestException(`Timer for case ${caseId} is PAUSED but has no pausedAt timestamp`);
    }
    const pausedAt = timer.pausedAt;
    const pauseDuration = now.getTime() - pausedAt.getTime();
    const adjustedStart = new Date(timer.startedAt.getTime() + pauseDuration);

    const updated = await this.prisma.slaTimer.update({
      where: { id: timer.id },
      data: {
        status: SlaStatus.ACTIVE,
        startedAt: adjustedStart,
        pausedAt: null,
      },
    });

    await this.scheduleEscalationJobs(caseId, adjustedStart);

    this.logger.log(`SLA timer resumed for case ${caseId}`);

    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_RESUMED,
        details: { adjustedStart: adjustedStart.toISOString() },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Reset timer (reassignment at 24h)
  // ---------------------------------------------------------------------------

  async resetTimer(caseId: string): Promise<SlaTimerResponse> {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer) {
      throw new NotFoundException(
        `No SLA timer found for case ${caseId}`,
      );
    }

    await this.removeEscalationJobs(caseId);

    const now = new Date();

    const updated = await this.prisma.slaTimer.update({
      where: { id: timer.id },
      data: {
        status: SlaStatus.ACTIVE,
        startedAt: now,
        pausedAt: null,
        resolvedAt: null,
        currentLevel: 0,
        lastEscalatedAt: null,
      },
    });

    await this.scheduleEscalationJobs(caseId, now);

    this.logger.log(`SLA timer reset for case ${caseId}`);

    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_RESET,
        details: { resetAt: now.toISOString() },
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async getTimer(caseId: string): Promise<SlaTimerResponse> {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer) {
      throw new NotFoundException(
        `No SLA timer found for case ${caseId}`,
      );
    }

    return timer;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async findActiveTimer(caseId: string) {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer || timer.status !== SlaStatus.ACTIVE) {
      throw new NotFoundException(
        `No active SLA timer found for case ${caseId}`,
      );
    }

    return timer;
  }

  /**
   * Schedule delayed Bull jobs for all escalation levels whose
   * deadline has not yet passed.
   */
  private async scheduleEscalationJobs(
    caseId: string,
    startedAt: Date,
  ): Promise<void> {
    const now = Date.now();

    for (const level of ESCALATION_LEVELS) {
      const fireAt = startedAt.getTime() + level.delayMs;
      const delay = fireAt - now;

      // Skip levels that have already passed
      if (delay <= 0) {
        continue;
      }

      const jobData: SlaEscalationJobData = {
        caseId,
        level: level.level,
        action: level.action,
        description: level.description,
      };

      await this.slaQueue.add('escalation', jobData, {
        jobId: slaJobId(caseId, level.level),
        delay,
        removeOnComplete: true,
        removeOnFail: false,
      });
    }
  }

  /**
   * Remove all pending escalation jobs for a case.
   */
  private async removeEscalationJobs(caseId: string): Promise<void> {
    for (const level of ESCALATION_LEVELS) {
      const jobId = slaJobId(caseId, level.level);
      try {
        const job = await this.slaQueue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch (error) {
        this.logger.debug(
          `Could not remove SLA job ${jobId}: ${error}`,
        );
      }
    }
  }
}
