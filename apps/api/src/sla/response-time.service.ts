import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import { ResponseTimeLogEntry } from './sla.model.js';

/**
 * Tracks response times between person messages and consultant replies (S-E07-03).
 *
 * When a person sends a message an "open" ResponseTimeLog entry is created.
 * When the consultant replies, the first open entry for that case is closed
 * with the calculated response time.
 */
@Injectable()
export class ResponseTimeService {
  private readonly logger = new Logger(ResponseTimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Open entry (person message received)
  // ---------------------------------------------------------------------------

  /**
   * Record a new open response-time entry when a person sends a message.
   * Only creates an entry if there is no existing open entry for the case
   * (prevents duplicate tracking for rapid consecutive person messages).
   */
  async openEntry(
    caseId: string,
    personMessageId: string,
    personSentAt: Date,
  ): Promise<ResponseTimeLogEntry> {
    // Check for an existing open entry — if one exists, skip
    const existing = await this.prisma.responseTimeLog.findFirst({
      where: {
        careCaseId: caseId,
        consultantRepliedAt: null,
      },
    });

    if (existing) {
      this.logger.debug(
        `Open response-time entry already exists for case ${caseId}, skipping`,
      );
      return existing;
    }

    const entry = await this.prisma.responseTimeLog.create({
      data: {
        careCaseId: caseId,
        personMessageId,
        personSentAt,
      },
    });

    this.logger.log(
      `Response time tracking opened for case ${caseId}, personMessage=${personMessageId}`,
    );

    return entry;
  }

  // ---------------------------------------------------------------------------
  // Close entry (consultant replied)
  // ---------------------------------------------------------------------------

  /**
   * Close the oldest open response-time entry for a case when the
   * consultant replies. Calculates elapsed response time in ms.
   *
   * @returns The closed entry, or null if no open entry existed.
   */
  async closeEntry(
    caseId: string,
    consultantMessageId: string,
    consultantId: string,
    repliedAt: Date,
  ): Promise<ResponseTimeLogEntry | null> {
    const openEntry = await this.prisma.responseTimeLog.findFirst({
      where: {
        careCaseId: caseId,
        consultantRepliedAt: null,
      },
      orderBy: { personSentAt: 'asc' },
    });

    if (!openEntry) {
      this.logger.debug(
        `No open response-time entry for case ${caseId} — nothing to close`,
      );
      return null;
    }

    const responseTimeMs = repliedAt.getTime() - openEntry.personSentAt.getTime();

    const closed = await this.prisma.responseTimeLog.update({
      where: { id: openEntry.id },
      data: {
        consultantMessageId,
        consultantId,
        consultantRepliedAt: repliedAt,
        responseTimeMs,
      },
    });

    this.logger.log(
      `Response time closed for case ${caseId}: ${responseTimeMs}ms ` +
        `(consultant=${consultantId}, message=${consultantMessageId})`,
    );

    return closed;
  }
}
