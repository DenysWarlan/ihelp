import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, Prisma } from '@prisma/client';
import { Job } from 'bullmq';

import { ALLOWED_TRANSITIONS } from '../cases.const.js';
import {
  AUDIT_ACTION_AUTO_PAUSE,
  AUTO_PAUSE_QUEUE,
  INACTIVITY_DAYS,
} from './auto-pause.const.js';

@Processor(AUTO_PAUSE_QUEUE)
export class AutoPauseProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoPauseProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Starting auto-pause inactivity check');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVITY_DAYS);

    // Find IN_PROGRESS cases with no activity for > INACTIVITY_DAYS
    const staleCases = await this.prisma.careCase.findMany({
      where: {
        status: CaseStatus.IN_PROGRESS,
        updatedAt: { lt: cutoff },
      },
      select: { id: true, version: true, updatedAt: true },
    });

    this.logger.log(`Found ${staleCases.length} stale case(s) to auto-pause`);

    // Verify the state machine allows IN_PROGRESS -> ON_HOLD
    const allowed = ALLOWED_TRANSITIONS[CaseStatus.IN_PROGRESS] ?? [];
    if (!allowed.includes(CaseStatus.ON_HOLD)) {
      this.logger.warn(
        'State machine does not allow IN_PROGRESS -> ON_HOLD. Skipping.',
      );
      return;
    }

    let paused = 0;
    let skipped = 0;

    for (const staleCase of staleCases) {
      try {
        // Check for recent activity: messages, notes, or audit entries since cutoff
        const [messageCount, noteCount, auditCount] = await Promise.all([
          this.prisma.message.count({
            where: { careCaseId: staleCase.id, createdAt: { gte: cutoff } },
          }),
          this.prisma.caseNote.count({
            where: { careCaseId: staleCase.id, createdAt: { gte: cutoff } },
          }),
          this.prisma.caseAuditEntry.count({
            where: { careCaseId: staleCase.id, createdAt: { gte: cutoff } },
          }),
        ]);

        if (messageCount > 0 || noteCount > 0 || auditCount > 0) {
          skipped++;
          continue;
        }

        // Optimistic locking: only update if version hasn't changed
        const updated = await this.prisma.careCase.updateMany({
          where: {
            id: staleCase.id,
            version: staleCase.version,
            status: CaseStatus.IN_PROGRESS,
          },
          data: {
            status: CaseStatus.ON_HOLD,
            version: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          // Race condition: case was modified between check and transition
          skipped++;
          this.logger.debug(
            `Skipped case ${staleCase.id} due to version mismatch (race condition)`,
          );
          continue;
        }

        // Log audit entry with actorId=null (system action)
        await this.prisma.caseAuditEntry.create({
          data: {
            careCaseId: staleCase.id,
            actorId: null,
            action: AUDIT_ACTION_AUTO_PAUSE,
            details: {
              from: CaseStatus.IN_PROGRESS,
              to: CaseStatus.ON_HOLD,
              reason: `No activity for ${INACTIVITY_DAYS} days`,
            } as Prisma.InputJsonValue,
          },
        });

        paused++;
      } catch (error) {
        this.logger.error(
          `Failed to auto-pause case ${staleCase.id}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Auto-pause complete: ${paused} paused, ${skipped} skipped`,
    );
  }
}
