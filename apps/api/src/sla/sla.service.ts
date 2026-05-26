import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { SlaStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { Server } from 'socket.io';

import {
  AUDIT_ACTION_SLA_PAUSED,
  AUDIT_ACTION_SLA_RESET,
  AUDIT_ACTION_SLA_RESOLVED,
  AUDIT_ACTION_SLA_RESUMED,
  AUDIT_ACTION_SLA_STARTED,
  ESCALATION_LEVELS,
  SLA_EVENTS,
  SLA_QUEUE,
  slaJobId,
} from './sla.const.js';
import { SlaLockService } from './sla-lock.service.js';
import { SlaEscalationJobData, SlaTimerResponse } from './sla.model.js';

/**
 * Manages SLA timer lifecycle: start, pause, resume, resolve, reset.
 *
 * Each timer schedules Bull delayed jobs for every escalation level.
 * When the timer is resolved (consultant responded) or reset
 * (reassignment at 24h), all pending jobs are removed.
 *
 * All mutating operations acquire a distributed Redis lock (S-E07-06)
 * and emit Socket.io events for real-time dashboard updates (S-E07-05).
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  /** Optional Socket.io server reference — set by ChatGateway at init. */
  private ioServer: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
    private readonly lockService: SlaLockService,
  ) {}

  /**
   * Called once by the ChatGateway after init to enable real-time SLA events.
   */
  setIoServer(server: Server): void {
    this.ioServer = server;
    this.logger.log('Socket.io server reference set on SlaService');
  }

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
    const lock = await this.lockService.acquire(caseId);
    if (!lock.acquired) {
      throw new BadRequestException(`Could not acquire SLA lock for case ${caseId}`);
    }

    try {
      const start = startedAt ?? new Date();

      const timer = await this.prisma.slaTimer.upsert({
        where: { careCaseId: caseId },
        create: {
          careCaseId: caseId,
          startedAt: start,
          status: SlaStatus.ACTIVE,
          currentLevel: 0,
        },
        update: {
          startedAt: start,
          status: SlaStatus.ACTIVE,
          currentLevel: 0,
          resolvedAt: null,
          pausedAt: null,
          lastEscalatedAt: null,
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

      this.emitSlaUpdate(caseId, timer);

      return timer;
    } finally {
      await this.lockService.release(caseId, lock.lockValue);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve timer (consultant responded)
  // ---------------------------------------------------------------------------

  async resolveTimer(caseId: string): Promise<SlaTimerResponse> {
    const lock = await this.lockService.acquire(caseId);
    if (!lock.acquired) {
      throw new BadRequestException(`Could not acquire SLA lock for case ${caseId}`);
    }

    try {
      const timer = await this.findResolvableTimer(caseId);

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

      this.emitSlaUpdate(caseId, updated);

      return updated;
    } finally {
      await this.lockService.release(caseId, lock.lockValue);
    }
  }

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------

  async pauseTimer(caseId: string): Promise<SlaTimerResponse> {
    const lock = await this.lockService.acquire(caseId);
    if (!lock.acquired) {
      throw new BadRequestException(`Could not acquire SLA lock for case ${caseId}`);
    }

    try {
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

      this.emitSlaUpdate(caseId, updated);

      return updated;
    } finally {
      await this.lockService.release(caseId, lock.lockValue);
    }
  }

  async resumeTimer(caseId: string): Promise<SlaTimerResponse> {
    const lock = await this.lockService.acquire(caseId);
    if (!lock.acquired) {
      throw new BadRequestException(`Could not acquire SLA lock for case ${caseId}`);
    }

    try {
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

      this.emitSlaUpdate(caseId, updated);

      return updated;
    } finally {
      await this.lockService.release(caseId, lock.lockValue);
    }
  }

  // ---------------------------------------------------------------------------
  // Reset timer (reassignment at 24h)
  // ---------------------------------------------------------------------------

  async resetTimer(caseId: string): Promise<SlaTimerResponse> {
    const lock = await this.lockService.acquire(caseId);
    if (!lock.acquired) {
      throw new BadRequestException(`Could not acquire SLA lock for case ${caseId}`);
    }

    try {
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

      this.emitSlaUpdate(caseId, updated);

      return updated;
    } finally {
      await this.lockService.release(caseId, lock.lockValue);
    }
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
   * Find a timer that can be resolved (ACTIVE, PAUSED, or ESCALATED).
   * Used by resolveTimer — consultant response should resolve regardless of state.
   */
  private async findResolvableTimer(caseId: string) {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer || timer.status === SlaStatus.RESOLVED) {
      throw new NotFoundException(
        `No resolvable SLA timer found for case ${caseId}`,
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
   * Check whether a case has an active or paused SLA timer.
   * Used by MessageService to decide whether to start or resume.
   */
  async hasActiveOrPausedTimer(caseId: string): Promise<{ exists: boolean; isPaused: boolean }> {
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
      select: { status: true },
    });

    if (!timer) return { exists: false, isPaused: false };

    return {
      exists: timer.status === SlaStatus.ACTIVE || timer.status === SlaStatus.PAUSED || timer.status === SlaStatus.ESCALATED,
      isPaused: timer.status === SlaStatus.PAUSED,
    };
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

  /**
   * Emit an SLA update event via Socket.io for real-time dashboard (S-E07-05).
   */
  private emitSlaUpdate(caseId: string, timer: SlaTimerResponse): void {
    if (!this.ioServer) return;

    try {
      this.ioServer.emit(SLA_EVENTS.SLA_UPDATE, {
        caseId,
        status: timer.status,
        currentLevel: timer.currentLevel,
        startedAt: timer.startedAt,
        pausedAt: timer.pausedAt,
        resolvedAt: timer.resolvedAt,
      });
    } catch (error) {
      this.logger.warn(`Failed to emit SLA update: ${error}`);
    }
  }
}
