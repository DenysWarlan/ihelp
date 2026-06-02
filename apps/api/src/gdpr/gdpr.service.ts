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
import {
  ApprovalStatus,
  CrisisLevel,
  DeletionStatus,
  ExportStatus,
} from '@prisma/client';

import { AuditService } from '../common/audit/audit.service.js';
import {
  ANONYMIZED_CASE_NAME,
  ANONYMIZED_TEXT,
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_JOB_NAME,
  EXPORT_JOB_NAME,
  EXPORT_FILE_EXPIRY_DAYS,
  EXPORT_ADVISORY_LOCK_ID,
  ANONYMIZATION_ADVISORY_LOCK_ID,
  GDPR_DELETION_QUEUE,
  GDPR_EXPORT_QUEUE,
  SAR_RESPONSE_TIMEFRAME_DAYS,
  ACCESS_APPROVAL_EXPIRY_HOURS,
  PII_EMAIL_REGEX,
  PII_PHONE_REGEX,
  RETENTION_NOTIFICATION_DAYS_BEFORE,
  AUDIT_ACTION_PII_VIEW,
  AUDIT_ACTION_PII_EXPORT,
  AUDIT_ACTION_PII_DELETE,
  AUDIT_ACTION_DATA_ACCESS_REQUEST,
  AUDIT_ACTION_DATA_ACCESS_APPROVE,
  AUDIT_ACTION_DATA_ACCESS_REJECT,
  AUDIT_ACTION_SAR_DETECTED,
} from './gdpr.const.js';
import {
  CreateAccessRequestDto,
  CreateDeletionRequestDto,
  CreateExportRequestDto,
  CreateRetentionPolicyDto,
  CreateSarKeywordDto,
  DataAccessApprovalResponse,
  DeletionJobPayload,
  DeletionRequestResponse,
  ExportJobPayload,
  ExportRequestResponse,
  PiiScanResult,
  RetentionPolicyResponse,
  SarDetectionResult,
  SarKeywordResponse,
  UpdateRetentionPolicyDto,
  UpdateSarKeywordDto,
} from './gdpr.model.js';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectQueue(GDPR_DELETION_QUEUE) private readonly deletionQueue: Queue,
    @InjectQueue(GDPR_EXPORT_QUEUE) private readonly exportQueue: Queue,
  ) {}

  // ===========================================================================
  // S-E12-03: Create deletion request
  // ===========================================================================

  async createDeletionRequest(
    userId: string,
    dto: CreateDeletionRequestDto,
  ): Promise<DeletionRequestResponse> {
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
      throw new ConflictException('A deletion request is already in progress');
    }

    // S-E12-06: Check advisory lock — cannot start deletion while export is running
    const isExportLocked = await this.tryAdvisoryLock(EXPORT_ADVISORY_LOCK_ID);
    if (!isExportLocked) {
      throw new ConflictException(
        'A data export is currently in progress. Please wait until it completes before requesting deletion.',
      );
    }
    await this.releaseAdvisoryLock(EXPORT_ADVISORY_LOCK_ID);

    // S-E12-04: Check for active crisis case
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

    await this.auditService.log(
      AUDIT_ACTION_PII_DELETE,
      userId,
      `Deletion request created: ${deletionRequest.id}`,
    );

    return this.toDeletionResponse(deletionRequest);
  }

  // ===========================================================================
  // S-E12-03: Get deletion request status
  // ===========================================================================

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

  // ===========================================================================
  // S-E12-03: Cancel deletion request
  // ===========================================================================

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
      throw new NotFoundException('No cancellable deletion request found');
    }

    await this.prisma.deletionRequest.update({
      where: { id: request.id },
      data: { status: DeletionStatus.CANCELLED },
    });

    const job = await this.deletionQueue.getJob(`deletion-${request.id}`);
    if (job) {
      await job.remove();
    }

    this.logger.log(
      `Deletion request ${request.id} cancelled by user ${userId}`,
    );
  }

  // ===========================================================================
  // S-E12-04: Crisis case resolved — check for deferred deletions
  // ===========================================================================

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

  // ===========================================================================
  // S-E12-03/04: Execute deletion (called by BullMQ processor)
  // ===========================================================================

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

    // S-E12-06: Acquire advisory lock — prevent simultaneous export
    const lockAcquired = await this.tryAdvisoryLock(ANONYMIZATION_ADVISORY_LOCK_ID);
    if (!lockAcquired) {
      this.logger.warn(
        `[MVP NOTIFICATION] Deletion ${deletionRequestId} blocked by advisory lock — retrying later`,
      );
      // Re-queue with short delay
      await this.deletionQueue.add(DELETION_JOB_NAME, payload, {
        delay: 60_000,
        jobId: `deletion-retry-${deletionRequestId}`,
      });
      return;
    }

    try {
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

      await this.prisma.deletionRequest.update({
        where: { id: deletionRequestId },
        data: { status: DeletionStatus.PROCESSING },
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({ where: { senderId: userId } });
        await tx.caseNote.deleteMany({ where: { authorId: userId } });
        await tx.lessonProgress.deleteMany({ where: { personId: userId } });
        await tx.enrollment.deleteMany({ where: { personId: userId } });
        await tx.progressReset.deleteMany({ where: { personId: userId } });
        await tx.meeting.deleteMany({ where: { personId: userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.providerLink.deleteMany({ where: { userId } });
        await tx.consent.deleteMany({ where: { userId } });
        await tx.dataExportRequest.deleteMany({ where: { userId } });

        // Anonymize care cases
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

      await this.auditService.log(
        AUDIT_ACTION_PII_DELETE,
        userId,
        `Deletion executed: ${deletionRequestId}`,
      );
    } finally {
      await this.releaseAdvisoryLock(ANONYMIZATION_ADVISORY_LOCK_ID);
    }
  }

  // ===========================================================================
  // S-E12-05: Data export request (Art. 20 Portability)
  // ===========================================================================

  async createExportRequest(
    userId: string,
    _dto: CreateExportRequestDto,
  ): Promise<ExportRequestResponse> {
    // Check for an existing pending/processing export
    const existing = await this.prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: {
          in: [ExportStatus.PENDING, ExportStatus.PROCESSING],
        },
      },
    });

    if (existing) {
      throw new ConflictException('A data export request is already in progress');
    }

    // S-E12-06: Check advisory lock — cannot start export while deletion is running
    const isDeletionLocked = await this.tryAdvisoryLock(ANONYMIZATION_ADVISORY_LOCK_ID);
    if (!isDeletionLocked) {
      throw new ConflictException(
        'A data deletion is currently in progress. Please wait until it completes before requesting an export.',
      );
    }
    await this.releaseAdvisoryLock(ANONYMIZATION_ADVISORY_LOCK_ID);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPORT_FILE_EXPIRY_DAYS);

    const exportRequest = await this.prisma.dataExportRequest.create({
      data: {
        userId,
        status: ExportStatus.PENDING,
        expiresAt,
      },
    });

    const jobPayload: ExportJobPayload = {
      exportRequestId: exportRequest.id,
      userId,
    };

    await this.exportQueue.add(EXPORT_JOB_NAME, jobPayload, {
      jobId: `export-${exportRequest.id}`,
    });

    this.logger.log(`Data export request ${exportRequest.id} created for user ${userId}`);

    await this.auditService.log(
      AUDIT_ACTION_PII_EXPORT,
      userId,
      `Data export requested: ${exportRequest.id}`,
    );

    return this.toExportResponse(exportRequest);
  }

  async getExportRequest(userId: string): Promise<ExportRequestResponse> {
    const request = await this.prisma.dataExportRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      throw new NotFoundException('No data export request found');
    }

    return this.toExportResponse(request);
  }

  // ===========================================================================
  // S-E12-05: Execute data export (called by BullMQ processor)
  // ===========================================================================

  async executeExport(payload: ExportJobPayload): Promise<void> {
    const { exportRequestId, userId } = payload;

    const request = await this.prisma.dataExportRequest.findUnique({
      where: { id: exportRequestId },
    });

    if (!request || request.status !== ExportStatus.PENDING) {
      this.logger.log(
        `Export request ${exportRequestId} not pending — skipping`,
      );
      return;
    }

    // S-E12-06: Acquire advisory lock
    const lockAcquired = await this.tryAdvisoryLock(EXPORT_ADVISORY_LOCK_ID);
    if (!lockAcquired) {
      this.logger.warn(
        `Export ${exportRequestId} blocked by advisory lock — retrying later`,
      );
      await this.exportQueue.add(EXPORT_JOB_NAME, payload, {
        delay: 60_000,
        jobId: `export-retry-${exportRequestId}`,
      });
      return;
    }

    try {
      await this.prisma.dataExportRequest.update({
        where: { id: exportRequestId },
        data: { status: ExportStatus.PROCESSING },
      });

      // Gather user data — exclude private consultant notes (isSupervisorNote = true)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          timezone: true,
          createdAt: true,
          dataConsentAt: true,
          sensitiveDataConsentAt: true,
        },
      });

      if (!user) {
        await this.prisma.dataExportRequest.update({
          where: { id: exportRequestId },
          data: {
            status: ExportStatus.FAILED,
            errorMessage: 'User not found',
          },
        });
        return;
      }

      // GDPR Art.7: Verify consent is still active before exporting personal data
      if (!user.dataConsentAt) {
        await this.prisma.dataExportRequest.update({
          where: { id: exportRequestId },
          data: {
            status: ExportStatus.FAILED,
            errorMessage: 'Data consent has been withdrawn — export cancelled',
          },
        });
        this.logger.warn(
          `Export ${exportRequestId} cancelled: user ${userId} consent withdrawn before export execution`,
        );
        return;
      }

      // Chat history (messages where user is sender or in user's cases)
      const userCases = await this.prisma.careCase.findMany({
        where: { personId: userId },
        select: {
          id: true,
          name: true,
          topic: true,
          status: true,
          createdAt: true,
          closedAt: true,
        },
      });

      const caseIds = userCases.map((c) => c.id);

      const messages = await this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { careCaseId: { in: caseIds } },
          ],
        },
        select: {
          id: true,
          content: true,
          channel: true,
          senderRole: true,
          createdAt: true,
          isEdited: true,
          isDeleted: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Course progress
      const enrollments = await this.prisma.enrollment.findMany({
        where: { personId: userId },
        include: {
          course: { select: { id: true, title: true } },
        },
      });

      const lessonProgress = await this.prisma.lessonProgress.findMany({
        where: { personId: userId },
        include: {
          lesson: { select: { id: true, title: true } },
        },
      });

      // Consents
      const consents = await this.prisma.consent.findMany({
        where: { userId },
        select: {
          id: true,
          consentType: true,
          grantedAt: true,
          withdrawnAt: true,
          ipAddress: true,
        },
      });

      // Build the export data structure with watermark
      const anonymizedPersonId = `PID-${userId.substring(0, 8)}`;
      const exportTimestamp = new Date().toISOString();

      const exportData = {
        _watermark: {
          personId: anonymizedPersonId,
          exportedAt: exportTimestamp,
          format: 'ihelp-gdpr-export-v1',
        },
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          timezone: user.timezone,
          createdAt: user.createdAt,
          dataConsentAt: user.dataConsentAt,
          sensitiveDataConsentAt: user.sensitiveDataConsentAt,
        },
        cases: userCases,
        chatHistory: messages,
        courseProgress: {
          enrollments: enrollments.map((e) => ({
            id: e.id,
            courseId: e.courseId,
            courseTitle: e.course.title,
            status: e.status,
            createdAt: e.createdAt,
          })),
          lessons: lessonProgress.map((lp) => ({
            id: lp.id,
            lessonId: lp.lessonId,
            lessonTitle: lp.lesson.title,
            courseId: lp.courseId,
            isCompleted: lp.isCompleted,
            isSkipped: lp.isSkipped,
            completedAt: lp.completedAt,
          })),
        },
        consents,
      };

      // In MVP, we serialize to JSON and store a reference.
      // A full ZIP with attached files would use a storage service.
      const jsonContent = JSON.stringify(exportData, null, 2);
      const fileSize = Buffer.byteLength(jsonContent, 'utf-8');

      // MVP: Store as a virtual file URL (in production, upload to S3/GCS)
      const fileUrl = `/gdpr/exports/${exportRequestId}/download`;

      await this.prisma.dataExportRequest.update({
        where: { id: exportRequestId },
        data: {
          status: ExportStatus.COMPLETED,
          fileUrl,
          fileSize,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Data export ${exportRequestId} completed for user ${userId} (${fileSize} bytes)`,
      );
      this.logger.warn(
        `[MVP NOTIFICATION] Data export ready for user ${userId} — export ${exportRequestId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.dataExportRequest.update({
        where: { id: exportRequestId },
        data: {
          status: ExportStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.error(
        `Data export ${exportRequestId} failed: ${errorMessage}`,
      );
    } finally {
      await this.releaseAdvisoryLock(EXPORT_ADVISORY_LOCK_ID);
    }
  }

  // ===========================================================================
  // S-E12-07: SAR Recognition in Chat (Art. 15)
  // ===========================================================================

  async scanForSar(
    content: string,
    senderId: string,
    caseId: string,
  ): Promise<SarDetectionResult> {
    if (!content || content.trim().length === 0) {
      return { isSar: false, matchedKeywords: [] };
    }

    const activeKeywords = await this.prisma.sarKeyword.findMany({
      where: { isActive: true },
      select: { keyword: true },
    });

    const lowerContent = content.toLowerCase();
    const matchedKeywords: string[] = [];

    for (const kw of activeKeywords) {
      if (lowerContent.includes(kw.keyword.toLowerCase())) {
        matchedKeywords.push(kw.keyword);
      }
    }

    if (matchedKeywords.length === 0) {
      return { isSar: false, matchedKeywords: [] };
    }

    // SAR detected — notify admin/DPO
    this.logger.warn(
      `[MVP NOTIFICATION] SAR detected from user ${senderId} in case ${caseId}. ` +
        `Matched keywords: ${matchedKeywords.join(', ')}. ` +
        `Response required within ${SAR_RESPONSE_TIMEFRAME_DAYS} days.`,
    );

    // Confirmation message for the person
    this.logger.warn(
      `[MVP NOTIFICATION] SAR confirmation to user ${senderId}: ` +
        `Your data access request has been received. ` +
        `We will respond within ${SAR_RESPONSE_TIMEFRAME_DAYS} days as required by GDPR Art. 15.`,
    );

    await this.auditService.log(
      AUDIT_ACTION_SAR_DETECTED,
      senderId,
      `SAR detected in case ${caseId}. Keywords: ${matchedKeywords.join(', ')}`,
    );

    return { isSar: true, matchedKeywords };
  }

  // SAR keyword CRUD (admin)

  async getSarKeywords(): Promise<SarKeywordResponse[]> {
    return this.prisma.sarKeyword.findMany({
      orderBy: [{ language: 'asc' }, { keyword: 'asc' }],
    });
  }

  async createSarKeyword(dto: CreateSarKeywordDto): Promise<SarKeywordResponse> {
    const existing = await this.prisma.sarKeyword.findFirst({
      where: {
        keyword: dto.keyword,
        language: dto.language ?? 'uk',
      },
    });

    if (existing) {
      throw new ConflictException('This keyword already exists for the specified language');
    }

    return this.prisma.sarKeyword.create({
      data: {
        keyword: dto.keyword,
        language: dto.language ?? 'uk',
      },
    });
  }

  async updateSarKeyword(
    id: string,
    dto: UpdateSarKeywordDto,
  ): Promise<SarKeywordResponse> {
    const keyword = await this.prisma.sarKeyword.findUnique({
      where: { id },
    });

    if (!keyword) {
      throw new NotFoundException('SAR keyword not found');
    }

    return this.prisma.sarKeyword.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteSarKeyword(id: string): Promise<void> {
    const keyword = await this.prisma.sarKeyword.findUnique({
      where: { id },
    });

    if (!keyword) {
      throw new NotFoundException('SAR keyword not found');
    }

    await this.prisma.sarKeyword.delete({ where: { id } });
  }

  async seedDefaultSarKeywords(): Promise<number> {
    const { DEFAULT_SAR_KEYWORDS } = await import('./gdpr.const.js');
    let count = 0;

    for (const kw of DEFAULT_SAR_KEYWORDS) {
      const existing = await this.prisma.sarKeyword.findFirst({
        where: { keyword: kw.keyword, language: kw.language },
      });

      if (!existing) {
        await this.prisma.sarKeyword.create({
          data: { keyword: kw.keyword, language: kw.language },
        });
        count++;
      }
    }

    this.logger.log(`Seeded ${count} default SAR keywords`);
    return count;
  }

  // ===========================================================================
  // S-E12-08: PII Filtering in Private Notes
  // ===========================================================================

  async scanForPii(content: string): Promise<PiiScanResult> {
    const warnings: string[] = [];

    // Check for email patterns
    const emailMatches = content.match(PII_EMAIL_REGEX);
    if (emailMatches && emailMatches.length > 0) {
      warnings.push(
        `Potential email address detected: ${emailMatches.map((e) => e.substring(0, 3) + '***').join(', ')}`,
      );
    }

    // Check for phone patterns
    const phoneMatches = content.match(PII_PHONE_REGEX);
    if (phoneMatches && phoneMatches.length > 0) {
      warnings.push(
        `Potential phone number detected: ${phoneMatches.map((p) => p.substring(0, 4) + '***').join(', ')}`,
      );
    }

    // Check against person names in DB
    const personNames = await this.prisma.user.findMany({
      where: { role: 'PERSON', isActive: true },
      select: { name: true },
    });

    const lowerContent = content.toLowerCase();
    const matchedNames: string[] = [];

    for (const person of personNames) {
      if (
        person.name.length >= 3 &&
        lowerContent.includes(person.name.toLowerCase())
      ) {
        matchedNames.push(person.name);
      }
    }

    if (matchedNames.length > 0) {
      warnings.push(
        `Content may contain person name(s): ${matchedNames.map((n) => n.substring(0, 2) + '***').join(', ')}`,
      );
    }

    return {
      hasPii: warnings.length > 0,
      warnings,
    };
  }

  // ===========================================================================
  // S-E12-09: Retention Policy
  // ===========================================================================

  async getRetentionPolicies(): Promise<RetentionPolicyResponse[]> {
    return this.prisma.retentionPolicy.findMany({
      orderBy: { entityType: 'asc' },
    });
  }

  async createRetentionPolicy(
    dto: CreateRetentionPolicyDto,
  ): Promise<RetentionPolicyResponse> {
    const existing = await this.prisma.retentionPolicy.findFirst({
      where: { entityType: dto.entityType },
    });

    if (existing) {
      throw new ConflictException(
        `Retention policy for entity type "${dto.entityType}" already exists`,
      );
    }

    return this.prisma.retentionPolicy.create({
      data: {
        entityType: dto.entityType,
        retentionDays: dto.retentionDays,
        description: dto.description ?? null,
      },
    });
  }

  async updateRetentionPolicy(
    id: string,
    dto: UpdateRetentionPolicyDto,
  ): Promise<RetentionPolicyResponse> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Retention policy not found');
    }

    return this.prisma.retentionPolicy.update({
      where: { id },
      data: {
        ...(dto.retentionDays !== undefined && {
          retentionDays: dto.retentionDays,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
      },
    });
  }

  async deleteRetentionPolicy(id: string): Promise<void> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Retention policy not found');
    }

    await this.prisma.retentionPolicy.delete({ where: { id } });
  }

  /**
   * Check all retention policies and identify data approaching or past retention.
   * Called by the retention cron job processor.
   */
  async executeRetentionCheck(): Promise<void> {
    const activePolicies = await this.prisma.retentionPolicy.findMany({
      where: { isActive: true },
    });

    if (activePolicies.length === 0) {
      this.logger.log('No active retention policies — skipping retention check');
      return;
    }

    const now = new Date();

    for (const policy of activePolicies) {
      const retentionCutoff = new Date();
      retentionCutoff.setDate(now.getDate() - policy.retentionDays);

      const notificationCutoff = new Date();
      notificationCutoff.setDate(
        now.getDate() - policy.retentionDays + RETENTION_NOTIFICATION_DAYS_BEFORE,
      );

      switch (policy.entityType) {
        case 'CareCase':
          await this.checkCareCaseRetention(retentionCutoff, notificationCutoff);
          break;
        case 'Message':
          await this.checkMessageRetention(retentionCutoff, notificationCutoff);
          break;
        case 'LessonProgress':
          await this.checkLessonProgressRetention(retentionCutoff);
          break;
        default:
          this.logger.warn(
            `Retention policy for unknown entity type: ${policy.entityType}`,
          );
      }
    }

    this.logger.log('Retention check completed');
  }

  private async checkCareCaseRetention(
    retentionCutoff: Date,
    notificationCutoff: Date,
  ): Promise<void> {
    // Notify about cases approaching retention
    const approachingRetention = await this.prisma.careCase.count({
      where: {
        closedAt: {
          gte: retentionCutoff,
          lte: notificationCutoff,
        },
      },
    });

    if (approachingRetention > 0) {
      this.logger.warn(
        `[MVP NOTIFICATION] ${approachingRetention} closed care case(s) approaching retention limit. ` +
          'Data will be anonymized in 30 days.',
      );
    }

    // Count cases past retention for logging (actual deletion deferred to admin decision)
    const pastRetention = await this.prisma.careCase.count({
      where: {
        closedAt: { lt: retentionCutoff },
        name: { not: ANONYMIZED_CASE_NAME },
      },
    });

    if (pastRetention > 0) {
      this.logger.warn(
        `[MVP NOTIFICATION] ${pastRetention} closed care case(s) past retention limit. ` +
          'Review and approve anonymization.',
      );
    }
  }

  private async checkMessageRetention(
    retentionCutoff: Date,
    notificationCutoff: Date,
  ): Promise<void> {
    const approachingRetention = await this.prisma.message.count({
      where: {
        createdAt: {
          gte: retentionCutoff,
          lte: notificationCutoff,
        },
        isDeleted: false,
      },
    });

    if (approachingRetention > 0) {
      this.logger.warn(
        `[MVP NOTIFICATION] ${approachingRetention} message(s) approaching retention limit. ` +
          'Messages will be eligible for deletion in 30 days.',
      );
    }
  }

  private async checkLessonProgressRetention(
    retentionCutoff: Date,
  ): Promise<void> {
    const pastRetention = await this.prisma.lessonProgress.count({
      where: {
        createdAt: { lt: retentionCutoff },
      },
    });

    if (pastRetention > 0) {
      this.logger.warn(
        `[MVP NOTIFICATION] ${pastRetention} lesson progress record(s) past retention limit.`,
      );
    }
  }

  // ===========================================================================
  // S-E12-10: Four-Eyes Principle — Data Access Requests
  // ===========================================================================

  async createAccessRequest(
    requesterId: string,
    dto: CreateAccessRequestDto,
  ): Promise<DataAccessApprovalResponse> {
    // Cannot request access to own data
    if (requesterId === dto.targetUserId) {
      throw new BadRequestException('Cannot request access to your own data');
    }

    // Check target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Check for existing pending request
    const existing = await this.prisma.dataAccessApproval.findFirst({
      where: {
        requesterId,
        targetUserId: dto.targetUserId,
        status: ApprovalStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A pending access request already exists for this user',
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ACCESS_APPROVAL_EXPIRY_HOURS);

    const approval = await this.prisma.dataAccessApproval.create({
      data: {
        requesterId,
        targetUserId: dto.targetUserId,
        reason: dto.reason,
        status: ApprovalStatus.PENDING,
        expiresAt,
      },
    });

    this.logger.warn(
      `[MVP NOTIFICATION] Data access request ${approval.id} created by admin ${requesterId} ` +
        `for user ${dto.targetUserId}. Requires another admin's approval.`,
    );

    await this.auditService.log(
      AUDIT_ACTION_DATA_ACCESS_REQUEST,
      requesterId,
      `Access request for user ${dto.targetUserId}: ${dto.reason}`,
    );

    return approval;
  }

  async approveAccessRequest(
    approvalId: string,
    approverId: string,
  ): Promise<DataAccessApprovalResponse> {
    const approval = await this.prisma.dataAccessApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Access request not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Access request is already ${approval.status.toLowerCase()}`,
      );
    }

    // Four-eyes: approver must be different from requester
    if (approval.requesterId === approverId) {
      throw new BadRequestException(
        'The approver must be a different admin than the requester (four-eyes principle)',
      );
    }

    // Check expiration
    if (new Date() > approval.expiresAt) {
      await this.prisma.dataAccessApproval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.EXPIRED },
      });
      throw new BadRequestException('Access request has expired');
    }

    const updated = await this.prisma.dataAccessApproval.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(
      `Data access request ${approvalId} approved by ${approverId}`,
    );

    await this.auditService.log(
      AUDIT_ACTION_DATA_ACCESS_APPROVE,
      approverId,
      `Approved access request ${approvalId} for user ${approval.targetUserId}`,
    );

    return updated;
  }

  async rejectAccessRequest(
    approvalId: string,
    rejecterId: string,
    reason?: string,
  ): Promise<DataAccessApprovalResponse> {
    const approval = await this.prisma.dataAccessApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new NotFoundException('Access request not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Access request is already ${approval.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.dataAccessApproval.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.REJECTED,
        approverId: rejecterId,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(
      `Data access request ${approvalId} rejected by ${rejecterId}${reason ? `: ${reason}` : ''}`,
    );

    await this.auditService.log(
      AUDIT_ACTION_DATA_ACCESS_REJECT,
      rejecterId,
      `Rejected access request ${approvalId} for user ${approval.targetUserId}${reason ? `. Reason: ${reason}` : ''}`,
    );

    return updated;
  }

  async getAccessRequests(
    status?: string,
  ): Promise<DataAccessApprovalResponse[]> {
    const where = status
      ? { status: status as ApprovalStatus }
      : {};

    return this.prisma.dataAccessApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===========================================================================
  // S-E12-10: Audit Log for PII Access
  // ===========================================================================

  async getAuditLog(filters: {
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
  }): Promise<{ id: string; userId: string | null; action: string; details: string | null; ipAddress: string | null; createdAt: Date }[]> {
    const where: Record<string, unknown> = {};

    if (filters.action) {
      where['action'] = filters.action;
    }

    if (filters.userId) {
      where['userId'] = filters.userId;
    }

    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) {
        createdAt['gte'] = new Date(filters.from);
      }
      if (filters.to) {
        createdAt['lte'] = new Date(filters.to);
      }
      where['createdAt'] = createdAt;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Log PII view access. Called when admin views personal data.
   */
  async logPiiAccess(
    userId: string,
    targetUserId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.auditService.log(
      AUDIT_ACTION_PII_VIEW,
      userId,
      `Viewed PII for user ${targetUserId}`,
      ipAddress,
    );
  }

  // ===========================================================================
  // S-E12-06: PostgreSQL Advisory Locks
  // ===========================================================================

  private async tryAdvisoryLock(lockId: number): Promise<boolean> {
    const result = await this.prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
      SELECT pg_try_advisory_lock(${lockId})
    `;
    return result[0]?.pg_try_advisory_lock ?? false;
  }

  private async releaseAdvisoryLock(lockId: number): Promise<void> {
    await this.prisma.$queryRaw`
      SELECT pg_advisory_unlock(${lockId})
    `;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

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

  private toExportResponse(
    request: {
      id: string;
      status: ExportStatus;
      fileUrl: string | null;
      fileSize: number | null;
      expiresAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
    },
  ): ExportRequestResponse {
    return {
      id: request.id,
      status: request.status,
      fileUrl: request.fileUrl,
      fileSize: request.fileSize,
      expiresAt: request.expiresAt,
      completedAt: request.completedAt,
      createdAt: request.createdAt,
    };
  }
}
