import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, SlaStatus } from '@prisma/client';
import { Job } from 'bullmq';

import { AssignmentService } from '../assignment/assignment.service.js';
import {
  AUDIT_ACTION_SLA_ESCALATION,
  EscalationAction,
  SLA_QUEUE,
} from './sla.const.js';
import { SlaEscalationJobData } from './sla.model.js';
import { SlaService } from './sla.service.js';

/**
 * Processes SLA escalation jobs from the sla-timers Bull queue.
 *
 * Each job fires at a specific escalation level for a case.
 * Actions are logged for MVP; level 3 also triggers auto-reassignment.
 */
@Processor(SLA_QUEUE)
export class SlaProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AssignmentService)) private readonly assignmentService: AssignmentService,
    private readonly slaService: SlaService,
  ) {
    super();
  }

  async process(job: Job<SlaEscalationJobData>): Promise<void> {
    const { caseId, level, action, description } = job.data;

    this.logger.warn(
      `SLA escalation triggered: case=${caseId}, level=${level}, action=${action} — ${description}`,
    );

    // Verify timer is still active (may have been resolved in the meantime)
    const timer = await this.prisma.slaTimer.findUnique({
      where: { careCaseId: caseId },
    });

    if (!timer || timer.status !== SlaStatus.ACTIVE) {
      this.logger.log(
        `SLA timer for case ${caseId} is no longer active (status=${timer?.status}). Skipping escalation.`,
      );
      return;
    }

    // Update timer level
    await this.prisma.slaTimer.update({
      where: { id: timer.id },
      data: {
        currentLevel: level,
        status:
          level >= 3 ? SlaStatus.ESCALATED : SlaStatus.ACTIVE,
        lastEscalatedAt: new Date(),
      },
    });

    // Audit the escalation
    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId: null,
        action: AUDIT_ACTION_SLA_ESCALATION,
        details: { level, action, description },
      },
    });

    // Execute action based on escalation level
    switch (action) {
      case EscalationAction.PUSH_CONSULTANT:
        await this.notifyConsultant(caseId, level);
        break;

      case EscalationAction.PUSH_EMAIL_CONSULTANT:
        await this.notifyConsultantWithEmail(caseId, level);
        break;

      case EscalationAction.ESCALATE_COORDINATOR_REASSIGN:
        await this.escalateAndReassign(caseId);
        break;

      case EscalationAction.ESCALATE_ADMIN:
        await this.notifyAdmin(caseId);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Level-specific handlers (MVP: log-based notifications)
  // ---------------------------------------------------------------------------

  private async notifyConsultant(
    caseId: string,
    level: number,
  ): Promise<void> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { consultantId: true },
    });

    this.logger.warn(
      `[MVP NOTIFICATION] Push to consultant ${careCase?.consultantId ?? 'N/A'} ` +
        `for case ${caseId} (SLA level ${level}): Case awaiting response`,
    );
  }

  private async notifyConsultantWithEmail(
    caseId: string,
    level: number,
  ): Promise<void> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { consultantId: true },
    });

    this.logger.warn(
      `[MVP NOTIFICATION] Push + Email to consultant ${careCase?.consultantId ?? 'N/A'} ` +
        `for case ${caseId} (SLA level ${level}): Urgent — case still awaiting response`,
    );
  }

  private async escalateAndReassign(caseId: string): Promise<void> {
    this.logger.warn(
      `[MVP NOTIFICATION] Escalation to coordinator for case ${caseId}: ` +
        `SLA breached at 24h. Triggering auto-reassignment.`,
    );

    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { consultantId: true, version: true },
    });

    if (!careCase) {
      this.logger.error(`Case ${caseId} not found during reassignment`);
      return;
    }

    // Free up the old consultant's slot and reset case atomically
    if (careCase.consultantId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = GREATEST(current_cases - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${careCase.consultantId}::uuid
        `;

        await tx.careCase.update({
          where: { id: caseId },
          data: {
            status: CaseStatus.NEW,
            consultantId: null,
            version: { increment: 1 },
          },
        });
      });
    }

    // Reset the SLA timer for the new consultant
    await this.slaService.resetTimer(caseId);

    // Attempt auto-assignment with system actor
    const result = await this.assignmentService.autoAssign(
      caseId,
      'system',
    );

    if (result.assigned) {
      this.logger.log(
        `Case ${caseId} reassigned to consultant ${result.consultantUserId} after SLA breach`,
      );
    } else {
      this.logger.warn(
        `Case ${caseId} could not be reassigned after SLA breach: ${result.fallbackReason}`,
      );
    }
  }

  private async notifyAdmin(caseId: string): Promise<void> {
    this.logger.warn(
      `[MVP NOTIFICATION] Admin escalation for case ${caseId}: ` +
        `SLA breached at 48h. Immediate attention required.`,
    );
  }
}
