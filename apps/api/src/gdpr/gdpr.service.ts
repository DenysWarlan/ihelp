import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@org/prisma-client';
import { CrisisLevel, DeletionStatus, Prisma } from '@prisma/client';

import {
  ANONYMIZED_CASE_NAME,
  ANONYMIZED_TEXT,
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_JOB_NAME,
  GDPR_DELETION_QUEUE,
} from './gdpr.const.js';
import {
  CreateDeletionRequestDto,
  DeletionJobPayload,
  DeletionRequestResponse,
} from './gdpr.model.js';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(GDPR_DELETION_QUEUE) private readonly deletionQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Create deletion request (S-E12-03)
  // ---------------------------------------------------------------------------

  async createDeletionRequest(
    userId: string,
    dto: CreateDeletionRequestDto,
  ): Promise<DeletionRequestResponse> {
    // Check for existing pending/deferred/processing request
    const existing = await this.prisma.deletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: [
            DeletionStatus.PENDING,
            DeletionStatus.DEFERRED_CRISIS,
            DeletionStatus.PROCESSING,
          ],
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A deletion request is already in progress',
      );
    }

    // Check for active crisis case (S-E12-04)
    const activeCrisisCase = await this.prisma.careCase.findFirst({
      where: {
        personId: userId,
        crisisLevel: { not: CrisisLevel.NONE },
        closedAt: null,
      },
    });

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + DELETION_GRACE_PERIOD_DAYS);

    const isDeferredCrisis = !!activeCrisisCase;

    const deletionRequest = await this.prisma.deletionRequest.create({
      data: {
        userId,
        status: isDeferredCrisis
          ? DeletionStatus.DEFERRED_CRISIS
          : DeletionStatus.PENDING,
        reason: dto.reason ?? null,
        scheduledAt,
        deferredUntil: isDeferredCrisis ? null : undefined,
      },
    });

    // Schedule BullMQ job if not deferred by crisis
    if (!isDeferredCrisis) {
      const delayMs = scheduledAt.getTime() - Date.now();
      const payload: DeletionJobPayload = {
        deletionRequestId: deletionRequest.id,
        userId,
      };

      await this.deletionQueue.add(DELETION_JOB_NAME, payload, {
        delay: delayMs,
        jobId: `deletion-${deletionRequest.id}`,
      });

      this.logger.log(
        `Deletion request ${deletionRequest.id} scheduled for ${scheduledAt.toISOString()}`,
      );
    } else {
      this.logger.warn(
        `[MVP NOTIFICATION] Deletion request ${deletionRequest.id} deferred due to active crisis case. ` +
          'Will be executed after crisis resolution.',
      );
    }

    return this.toDeletionResponse(deletionRequest);
  }

  // ---------------------------------------------------------------------------
  // Get deletion request status (S-E12-03)
  // ---------------------------------------------------------------------------

  async getDeletionRequest(userId: string): Promise<DeletionRequestResponse> {
    const request = await this.prisma.deletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: [
            DeletionStatus.PENDING,
            DeletionStatus.DEFERRED_CRISIS,
            DeletionStatus.PROCESSING,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      throw new NotFoundException('No active deletion request found');
    }

    return this.toDeletionResponse(request);
  }

  // ---------------------------------------------------------------------------
  // Cancel deletion request (S-E12-03)
  // ---------------------------------------------------------------------------

  async cancelDeletionRequest(userId: string): Promise<void> {
    const request = await this.prisma.deletionRequest.findFirst({
      where: {
        userId,
        status: {
          in: [DeletionStatus.PENDING, DeletionStatus.DEFERRED_CRISIS],
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        'No cancellable deletion request found',
      );
    }

    await this.prisma.deletionRequest.update({
      where: { id: request.id },
      data: { status: DeletionStatus.CANCELLED },
    });

    // Remove scheduled BullMQ job if it exists
    const job = await this.deletionQueue.getJob(
      `deletion-${request.id}`,
    );
    if (job) {
      await job.remove();
    }

    this.logger.log(
      `Deletion request ${request.id} cancelled by user ${userId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Crisis case resolved — check for deferred deletions (S-E12-04)
  // ---------------------------------------------------------------------------

  async onCrisisResolved(userId: string): Promise<void> {
    const deferredRequests = await this.prisma.deletionRequest.findMany({
      where: {
        userId,
        status: DeletionStatus.DEFERRED_CRISIS,
      },
    });

    if (deferredRequests.length === 0) {
      return;
    }

    // Check if user still has any other active crisis cases
    const remainingCrisis = await this.prisma.careCase.findFirst({
      where: {
        personId: userId,
        crisisLevel: { not: CrisisLevel.NONE },
        closedAt: null,
      },
    });

    if (remainingCrisis) {
      this.logger.log(
        `User ${userId} still has active crisis cases — deletion remains deferred`,
      );
      return;
    }

    for (const request of deferredRequests) {
      const scheduledAt = new Date();
      scheduledAt.setDate(
        scheduledAt.getDate() + DELETION_GRACE_PERIOD_DAYS,
      );

      await this.prisma.deletionRequest.update({
        where: { id: request.id },
        data: {
          status: DeletionStatus.PENDING,
          scheduledAt,
          deferredUntil: null,
        },
      });

      const delayMs = scheduledAt.getTime() - Date.now();
      const payload: DeletionJobPayload = {
        deletionRequestId: request.id,
        userId,
      };

      await this.deletionQueue.add(DELETION_JOB_NAME, payload, {
        delay: delayMs,
        jobId: `deletion-${request.id}`,
      });

      this.logger.log(
        `Deferred deletion request ${request.id} now scheduled for ${scheduledAt.toISOString()}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Execute deletion (called by BullMQ processor)
  // ---------------------------------------------------------------------------

  async executeDeletion(payload: DeletionJobPayload): Promise<void> {
    const { deletionRequestId, userId } = payload;

    const request = await this.prisma.deletionRequest.findUnique({
      where: { id: deletionRequestId },
    });

    if (!request || request.status === DeletionStatus.CANCELLED) {
      this.logger.log(
        `Deletion request ${deletionRequestId} cancelled or not found — skipping`,
      );
      return;
    }

    // Re-check for active crisis cases before proceeding
    const activeCrisis = await this.prisma.careCase.findFirst({
      where: {
        personId: userId,
        crisisLevel: { not: CrisisLevel.NONE },
        closedAt: null,
      },
    });

    if (activeCrisis) {
      await this.prisma.deletionRequest.update({
        where: { id: deletionRequestId },
        data: { status: DeletionStatus.DEFERRED_CRISIS },
      });
      this.logger.warn(
        `[MVP NOTIFICATION] Deletion ${deletionRequestId} re-deferred — new crisis case detected`,
      );
      return;
    }

    // Mark as processing
    await this.prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: { status: DeletionStatus.PROCESSING },
    });

    await this.prisma.$transaction(async (tx) => {
      // Delete messages sent by the user
      await tx.message.deleteMany({
        where: { senderId: userId },
      });

      // Delete case notes authored by the user
      await tx.caseNote.deleteMany({
        where: { authorId: userId },
      });

      // Delete LMS progress
      await tx.lessonProgress.deleteMany({
        where: { personId: userId },
      });
      await tx.enrollment.deleteMany({
        where: { personId: userId },
      });
      await tx.progressReset.deleteMany({
        where: { personId: userId },
      });

      // Delete meetings where user is person
      await tx.meeting.deleteMany({
        where: { personId: userId },
      });

      // Delete sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // Delete provider links
      await tx.providerLink.deleteMany({
        where: { userId },
      });

      // Delete consents
      await tx.consent.deleteMany({
        where: { userId },
      });

      // Delete data export requests
      await tx.dataExportRequest.deleteMany({
        where: { userId },
      });

      // Anonymize care cases (keep for statistics, null out personal references)
      await tx.careCase.updateMany({
        where: { personId: userId },
        data: {
          name: ANONYMIZED_CASE_NAME,
          topic: ANONYMIZED_TEXT,
          description: ANONYMIZED_TEXT,
          contactMethod: null,
          contactValue: null,
          country: null,
          language: null,
        },
      });

      // Deactivate and anonymize the user
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.local`,
          name: ANONYMIZED_CASE_NAME,
          avatarUrl: null,
          passwordHash: null,
          isActive: false,
          dataConsentAt: null,
          sensitiveDataConsentAt: null,
          mfaSecret: null,
          mfaEnabled: false,
          mfaBackupHash: [],
        },
      });

      // Mark deletion request as completed
      await tx.deletionRequest.update({
        where: { id: deletionRequestId },
        data: {
          status: DeletionStatus.COMPLETED,
          executedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Deletion request ${deletionRequestId} executed successfully for user ${userId}`,
    );
    this.logger.warn(
      `[MVP NOTIFICATION] User ${userId} data has been deleted per GDPR Art. 17 request`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toDeletionResponse(
    request: {
      id: string;
      status: DeletionStatus;
      reason: string | null;
      scheduledAt: Date;
      deferredUntil: Date | null;
      createdAt: Date;
    },
  ): DeletionRequestResponse {
    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      scheduledAt: request.scheduledAt,
      deferredUntil: request.deferredUntil,
      createdAt: request.createdAt,
    };
  }
}
