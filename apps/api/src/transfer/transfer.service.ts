import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import {
  CaseStatus,
  ConsultantStatus,
  CrisisLevel,
  MeetingStatus,
  TransferStatus,
  TransferType,
} from '@prisma/client';

import { AssignmentService } from '../assignment/assignment.service.js';
import { CRISIS_LEVELS } from '../assignment/assignment.const.js';
import { MEETING_LINK_BASE_URL } from '../meetings/meetings.const.js';
import {
  AUDIT_ACTION_MEETING_CANCELLED_TRANSFER,
  AUDIT_ACTION_MEETING_REASSIGNED_TRANSFER,
  AUDIT_ACTION_PERMANENT_TRANSFER,
  AUDIT_ACTION_PERSON_NOTIFIED_TRANSFER,
  AUDIT_ACTION_TRANSFER_COMPLETED,
  AUDIT_ACTION_TRANSFER_HISTORY_CREATED,
  AUDIT_ACTION_VACATION_RETURN,
  AUDIT_ACTION_VACATION_TRANSFER,
  ERROR_CONSULTANT_HAS_ACTIVE_CASES,
  ERROR_CRISIS_CASE_BLOCKS_PERMANENT,
  ERROR_NO_ACTIVE_CASES,
  ERROR_WORKLOAD_LIMIT_EXCEEDED,
  MEETING_CANCEL_REASON_TRANSFER,
  MEETING_CANCEL_THRESHOLD_MS,
  MVP_NOTIFICATION_PREFIX,
  NOTIFICATION_NEW_CASE_TO_CONSULTANT_TRANSFER,
  NOTIFICATION_PERMANENT_TRANSFER_TO_PERSON,
  NOTIFICATION_VACATION_RETURN_TO_PERSON,
  NOTIFICATION_VACATION_TRANSFER_TO_PERSON,
  TRANSFERABLE_CASE_STATUSES,
} from './transfer.const.js';
import {
  AcceptTransferMatchDto,
  BlockingCase,
  InitiatePermanentTransferDto,
  InitiateVacationTransferDto,
  ReturnableTransfer,
  ReturnCasesDto,
  ReturnCasesResult,
  TransferHistoryEntry,
  TransferInitiationResult,
  TransferMatchProposal,
} from './transfer.model.js';

/**
 * Transfer orchestration service (S-E10-01..03).
 *
 * Handles:
 * - Vacation (temporary) transfers with auto-return
 * - Permanent transfers for departing consultants
 * - Auto-matching replacements using the assignment algorithm
 */
@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentService: AssignmentService,
  ) {}

  // ---------------------------------------------------------------------------
  // Vacation transfer (S-E10-01)
  // ---------------------------------------------------------------------------

  /**
   * Initiate a vacation transfer for all active cases of a consultant.
   * Creates CaseTransfer records and sets consultant status to ON_VACATION.
   */
  async initiateVacationTransfer(
    dto: InitiateVacationTransferDto,
    actorId: string,
  ): Promise<TransferInitiationResult> {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId: dto.consultantUserId },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${dto.consultantUserId}`,
      );
    }

    // Find all active cases for this consultant
    const activeCases = await this.findActiveCases(dto.consultantUserId);

    if (activeCases.length === 0) {
      throw new BadRequestException(ERROR_NO_ACTIVE_CASES);
    }

    const vacationStart = new Date(dto.vacationStart);
    const vacationEnd = new Date(dto.vacationEnd);

    // Create transfer records and find matches
    const matches: TransferMatchProposal[] = [];
    let unmatchedCases = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const careCase of activeCases) {
        // Auto-match replacement (S-E10-03)
        const match = await this.findBestReplacement(careCase);

        const transfer = await tx.caseTransfer.create({
          data: {
            careCaseId: careCase.id,
            fromConsultantId: dto.consultantUserId,
            toConsultantId: match?.consultantUserId ?? null,
            transferType: TransferType.VACATION,
            status: match
              ? TransferStatus.PENDING
              : TransferStatus.PENDING,
            vacationStart,
            vacationEnd,
            reason: dto.reason ?? null,
          },
        });

        if (match) {
          matches.push({
            transferId: transfer.id,
            caseId: careCase.id,
            caseTopic: careCase.topic,
            caseLanguage: careCase.language,
            proposedConsultantUserId: match.consultantUserId,
            proposedConsultantName: match.consultantName,
            matchScore: match.score,
            status: TransferStatus.PENDING,
          });
        } else {
          unmatchedCases++;
          matches.push({
            transferId: transfer.id,
            caseId: careCase.id,
            caseTopic: careCase.topic,
            caseLanguage: careCase.language,
            proposedConsultantUserId: null,
            proposedConsultantName: null,
            matchScore: null,
            status: TransferStatus.PENDING,
          });

          // Notify coordinator for unmatched cases
          this.logger.warn(
            `${MVP_NOTIFICATION_PREFIX} [TRANSFER] No match found for case ${careCase.id}. ` +
              `Coordinator must manually assign a replacement.`,
          );
        }

        // Audit entry for each case transfer
        await tx.caseAuditEntry.create({
          data: {
            careCaseId: careCase.id,
            actorId,
            action: AUDIT_ACTION_VACATION_TRANSFER,
            details: {
              transferId: transfer.id,
              fromConsultantId: dto.consultantUserId,
              toConsultantId: match?.consultantUserId ?? null,
              vacationStart: dto.vacationStart,
              vacationEnd: dto.vacationEnd,
            },
          },
        });
      }

      // Update consultant status to ON_VACATION
      await tx.consultantProfile.update({
        where: { userId: dto.consultantUserId },
        data: { status: ConsultantStatus.ON_VACATION },
      });
    });

    this.logger.log(
      `Vacation transfer initiated for consultant ${dto.consultantUserId}: ` +
        `${activeCases.length} cases, ${unmatchedCases} unmatched`,
    );

    return {
      transferType: TransferType.VACATION,
      consultantUserId: dto.consultantUserId,
      totalCasesTransferred: activeCases.length,
      matches,
      unmatchedCases,
    };
  }

  // ---------------------------------------------------------------------------
  // Permanent transfer (S-E10-02)
  // ---------------------------------------------------------------------------

  /**
   * Initiate a permanent transfer for a consultant leaving.
   * BLOCKED if any active crisis case exists.
   * After all cases transferred, consultant status -> DEACTIVATED.
   */
  async initiatePermanentTransfer(
    dto: InitiatePermanentTransferDto,
    actorId: string,
  ): Promise<TransferInitiationResult> {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId: dto.consultantUserId },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${dto.consultantUserId}`,
      );
    }

    // Find all active cases for this consultant
    const activeCases = await this.findActiveCases(dto.consultantUserId);

    if (activeCases.length === 0) {
      // No active cases — just deactivate
      await this.prisma.consultantProfile.update({
        where: { userId: dto.consultantUserId },
        data: { status: ConsultantStatus.DEACTIVATED },
      });

      this.logger.log(
        `Permanent transfer for consultant ${dto.consultantUserId}: ` +
          `no active cases, consultant deactivated immediately`,
      );

      return {
        transferType: TransferType.PERMANENT,
        consultantUserId: dto.consultantUserId,
        totalCasesTransferred: 0,
        matches: [],
        unmatchedCases: 0,
      };
    }

    // Check for crisis cases — HARD BLOCK
    const hasCrisisCase = activeCases.some((c) =>
      CRISIS_LEVELS.includes(c.crisisLevel),
    );

    if (hasCrisisCase) {
      throw new BadRequestException(ERROR_CRISIS_CASE_BLOCKS_PERMANENT);
    }

    // Create transfer records and find matches
    const matches: TransferMatchProposal[] = [];
    let unmatchedCases = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const careCase of activeCases) {
        // Auto-match replacement (S-E10-03)
        const match = await this.findBestReplacement(careCase);

        const transfer = await tx.caseTransfer.create({
          data: {
            careCaseId: careCase.id,
            fromConsultantId: dto.consultantUserId,
            toConsultantId: match?.consultantUserId ?? null,
            transferType: TransferType.PERMANENT,
            status: match
              ? TransferStatus.PENDING
              : TransferStatus.PENDING,
            reason: dto.reason ?? null,
          },
        });

        if (match) {
          matches.push({
            transferId: transfer.id,
            caseId: careCase.id,
            caseTopic: careCase.topic,
            caseLanguage: careCase.language,
            proposedConsultantUserId: match.consultantUserId,
            proposedConsultantName: match.consultantName,
            matchScore: match.score,
            status: TransferStatus.PENDING,
          });
        } else {
          unmatchedCases++;
          matches.push({
            transferId: transfer.id,
            caseId: careCase.id,
            caseTopic: careCase.topic,
            caseLanguage: careCase.language,
            proposedConsultantUserId: null,
            proposedConsultantName: null,
            matchScore: null,
            status: TransferStatus.PENDING,
          });

          this.logger.warn(
            `${MVP_NOTIFICATION_PREFIX} [TRANSFER] No match found for case ${careCase.id}. ` +
              `Coordinator must manually assign a replacement.`,
          );
        }

        await tx.caseAuditEntry.create({
          data: {
            careCaseId: careCase.id,
            actorId,
            action: AUDIT_ACTION_PERMANENT_TRANSFER,
            details: {
              transferId: transfer.id,
              fromConsultantId: dto.consultantUserId,
              toConsultantId: match?.consultantUserId ?? null,
            },
          },
        });
      }

      // Set consultant status to LEAVING until all transfers complete
      await tx.consultantProfile.update({
        where: { userId: dto.consultantUserId },
        data: { status: ConsultantStatus.LEAVING },
      });
    });

    this.logger.log(
      `Permanent transfer initiated for consultant ${dto.consultantUserId}: ` +
        `${activeCases.length} cases, ${unmatchedCases} unmatched`,
    );

    return {
      transferType: TransferType.PERMANENT,
      consultantUserId: dto.consultantUserId,
      totalCasesTransferred: activeCases.length,
      matches,
      unmatchedCases,
    };
  }

  // ---------------------------------------------------------------------------
  // Accept/override match (S-E10-03)
  // ---------------------------------------------------------------------------

  /**
   * Accept a proposed transfer match or override with a specific consultant.
   * Completes the transfer: reassigns the case and updates counters.
   */
  async acceptTransferMatch(
    transferId: string,
    dto: AcceptTransferMatchDto,
    actorId: string,
  ): Promise<TransferMatchProposal> {
    const transfer = await this.prisma.caseTransfer.findUnique({
      where: { id: transferId },
      include: {
        careCase: {
          select: {
            id: true,
            topic: true,
            language: true,
            version: true,
            crisisLevel: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer is not in PENDING status (current: ${transfer.status})`,
      );
    }

    // Determine the target consultant
    const targetUserId =
      dto.overrideConsultantUserId ?? transfer.toConsultantId;

    if (!targetUserId) {
      throw new BadRequestException(
        'No proposed consultant and no override provided. ' +
          'Please specify overrideConsultantUserId.',
      );
    }

    // Verify target consultant exists and has capacity
    const targetProfile = await this.prisma.consultantProfile.findUnique({
      where: { userId: targetUserId },
      include: { user: { select: { name: true } } },
    });

    if (!targetProfile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${targetUserId}`,
      );
    }

    const isCrisis = CRISIS_LEVELS.includes(transfer.careCase.crisisLevel);

    await this.prisma.$transaction(async (tx) => {
      // Increment target consultant's counters
      if (isCrisis) {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              current_crisis = current_crisis + 1,
              updated_at = NOW()
          WHERE user_id = ${targetUserId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              updated_at = NOW()
          WHERE user_id = ${targetUserId}::uuid
        `;
      }

      // Decrement source consultant's counters
      if (isCrisis) {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = GREATEST(current_cases - 1, 0),
              current_crisis = GREATEST(current_crisis - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${transfer.fromConsultantId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = GREATEST(current_cases - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${transfer.fromConsultantId}::uuid
        `;
      }

      // Update the case assignment
      await tx.careCase.update({
        where: {
          id: transfer.careCaseId,
          version: transfer.careCase.version,
        },
        data: {
          consultantId: targetUserId,
          status: CaseStatus.ASSIGNED,
          version: { increment: 1 },
        },
      });

      // Mark transfer as completed
      await tx.caseTransfer.update({
        where: { id: transferId },
        data: {
          toConsultantId: targetUserId,
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Audit entry
      await tx.caseAuditEntry.create({
        data: {
          careCaseId: transfer.careCaseId,
          actorId,
          action: AUDIT_ACTION_TRANSFER_COMPLETED,
          details: {
            transferId,
            fromConsultantId: transfer.fromConsultantId,
            toConsultantId: targetUserId,
            transferType: transfer.transferType,
            wasOverride: !!dto.overrideConsultantUserId,
          },
        },
      });
    });

    // S-E10-04: Handle meeting rescheduling
    await this.handleMeetingTransfer(transfer.careCaseId, targetUserId, actorId);

    // S-E10-05: Notify person about consultant change
    await this.notifyPersonAboutTransfer(
      transfer.careCaseId,
      transfer.transferType,
      actorId,
    );

    // S-E10-06: Notify new consultant about the case
    await this.notifyNewConsultant(transfer.careCaseId, targetUserId);

    // Check if all transfers for a permanent transfer are complete
    if (transfer.transferType === TransferType.PERMANENT) {
      await this.checkAndDeactivateIfAllComplete(transfer.fromConsultantId);
    }

    this.logger.log(
      `${MVP_NOTIFICATION_PREFIX} Transfer ${transferId} completed: ` +
        `case ${transfer.careCaseId} assigned to ${targetUserId}`,
    );

    return {
      transferId,
      caseId: transfer.careCaseId,
      caseTopic: transfer.careCase.topic ?? null,
      caseLanguage: transfer.careCase.language,
      proposedConsultantUserId: targetUserId,
      proposedConsultantName: targetProfile.user?.name ?? null,
      matchScore: null,
      status: TransferStatus.COMPLETED,
    };
  }

  // ---------------------------------------------------------------------------
  // List transfers for a consultant
  // ---------------------------------------------------------------------------

  /**
   * Get all pending transfers for a consultant.
   */
  async getPendingTransfers(
    consultantUserId: string,
  ): Promise<TransferMatchProposal[]> {
    const transfers = await this.prisma.caseTransfer.findMany({
      where: {
        fromConsultantId: consultantUserId,
        status: TransferStatus.PENDING,
      },
      include: {
        careCase: {
          select: { id: true, topic: true, language: true },
        },
        toConsultant: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return transfers.map((t) => ({
      transferId: t.id,
      caseId: t.careCaseId,
      caseTopic: t.careCase.topic ?? null,
      caseLanguage: t.careCase.language,
      proposedConsultantUserId: t.toConsultantId,
      proposedConsultantName: t.toConsultant?.name ?? null,
      matchScore: null,
      status: t.status,
    }));
  }

  // ---------------------------------------------------------------------------
  // S-E10-04: Meeting rescheduling on transfer
  // ---------------------------------------------------------------------------

  /**
   * Handle meetings when a case is transferred to a new consultant.
   * - Meetings <24h away: cancel with notification
   * - Meetings >=24h away: reassign to new consultant, regenerate URL
   */
  async handleMeetingTransfer(
    caseId: string,
    newConsultantId: string,
    actorId?: string,
  ): Promise<void> {
    const now = new Date();
    const threshold = new Date(now.getTime() + MEETING_CANCEL_THRESHOLD_MS);

    // Find all pending meetings for this case
    const pendingMeetings = await this.prisma.meeting.findMany({
      where: {
        careCaseId: caseId,
        status: {
          in: [MeetingStatus.SCHEDULED, MeetingStatus.CONFIRMED],
        },
        scheduledAt: { gte: now },
      },
    });

    for (const meeting of pendingMeetings) {
      if (meeting.scheduledAt < threshold) {
        // Cancel meetings less than 24h away
        await this.prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: MeetingStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: MEETING_CANCEL_REASON_TRANSFER,
          },
        });

        this.logger.warn(
          `${MVP_NOTIFICATION_PREFIX} Meeting ${meeting.id} cancelled (<24h) ` +
            `due to case ${caseId} transfer. Person ${meeting.personId} notified.`,
        );

        if (actorId) {
          await this.prisma.caseAuditEntry.create({
            data: {
              careCaseId: caseId,
              actorId,
              action: AUDIT_ACTION_MEETING_CANCELLED_TRANSFER,
              details: {
                meetingId: meeting.id,
                scheduledAt: meeting.scheduledAt.toISOString(),
                reason: 'Meeting within 24h of transfer',
              },
            },
          });
        }
      } else {
        // Reassign meetings >=24h away to new consultant
        const newUrl = `${MEETING_LINK_BASE_URL}/${meeting.id}`;

        // Fetch new consultant timezone
        const newConsultant = await this.prisma.user.findUnique({
          where: { id: newConsultantId },
          select: { timezone: true },
        });

        await this.prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            consultantId: newConsultantId,
            consultantTz: newConsultant?.timezone ?? 'UTC',
            meetingUrl: newUrl,
          },
        });

        this.logger.log(
          `Meeting ${meeting.id} reassigned to consultant ${newConsultantId} ` +
            `for case ${caseId}. New URL: ${newUrl}`,
        );

        if (actorId) {
          await this.prisma.caseAuditEntry.create({
            data: {
              careCaseId: caseId,
              actorId,
              action: AUDIT_ACTION_MEETING_REASSIGNED_TRANSFER,
              details: {
                meetingId: meeting.id,
                newConsultantId,
                newMeetingUrl: newUrl,
              },
            },
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // S-E10-05: Notify person about consultant change
  // ---------------------------------------------------------------------------

  /**
   * Notify the person about a consultant change.
   * Different message templates for vacation vs permanent.
   */
  async notifyPersonAboutTransfer(
    caseId: string,
    transferType: TransferType,
    actorId?: string,
  ): Promise<void> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { id: true, personId: true, contactMethod: true },
    });

    if (!careCase) {
      return;
    }

    const message =
      transferType === TransferType.VACATION
        ? NOTIFICATION_VACATION_TRANSFER_TO_PERSON
        : NOTIFICATION_PERMANENT_TRANSFER_TO_PERSON;

    // MVP: log-based notification
    this.logger.warn(
      `${MVP_NOTIFICATION_PREFIX} [TRANSFER→PERSON] ` +
        `Person ${careCase.personId} (case ${caseId}): "${message}" ` +
        `via ${careCase.contactMethod ?? 'WEB'}`,
    );

    if (actorId) {
      await this.prisma.caseAuditEntry.create({
        data: {
          careCaseId: caseId,
          actorId,
          action: AUDIT_ACTION_PERSON_NOTIFIED_TRANSFER,
          details: {
            personId: careCase.personId,
            transferType,
            message,
          },
        },
      });
    }
  }

  /**
   * Notify the new consultant about a transferred case (S-E10-06).
   */
  async notifyNewConsultant(
    caseId: string,
    newConsultantId: string,
  ): Promise<void> {
    this.logger.warn(
      `${MVP_NOTIFICATION_PREFIX} [TRANSFER→CONSULTANT] ` +
        `Consultant ${newConsultantId} assigned case ${caseId}: ` +
        `"${NOTIFICATION_NEW_CASE_TO_CONSULTANT_TRANSFER}"`,
    );
  }

  // ---------------------------------------------------------------------------
  // S-E10-06: Transfer history for a case
  // ---------------------------------------------------------------------------

  /**
   * Get transfer history for a care case.
   */
  async getTransferHistory(caseId: string): Promise<TransferHistoryEntry[]> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException(`Care case ${caseId} not found`);
    }

    const transfers = await this.prisma.caseTransfer.findMany({
      where: { careCaseId: caseId },
      include: {
        fromConsultant: { select: { name: true } },
        toConsultant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      transferType: t.transferType,
      status: t.status,
      fromConsultantName: t.fromConsultant?.name ?? null,
      toConsultantName: t.toConsultant?.name ?? null,
      reason: t.reason,
      vacationStart: t.vacationStart,
      vacationEnd: t.vacationEnd,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // S-E10-07: Block consultant deletion with active cases
  // ---------------------------------------------------------------------------

  /**
   * Check if a consultant has active cases that block deactivation.
   * If active cases exist, throws ConflictException with the list of blocking cases.
   */
  async validateConsultantDeactivation(
    consultantUserId: string,
  ): Promise<void> {
    const activeCases = await this.prisma.careCase.findMany({
      where: {
        consultantId: consultantUserId,
        status: { in: [...TRANSFERABLE_CASE_STATUSES] },
      },
      select: {
        id: true,
        topic: true,
        status: true,
        person: { select: { name: true } },
      },
    });

    if (activeCases.length > 0) {
      const blockingCases: BlockingCase[] = activeCases.map((c) => ({
        caseId: c.id,
        topic: c.topic,
        status: c.status,
        personName: c.person?.name ?? null,
      }));

      throw new ConflictException({
        message: ERROR_CONSULTANT_HAS_ACTIVE_CASES,
        blockingCases,
        count: blockingCases.length,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // S-E10-08: Return cases after vacation
  // ---------------------------------------------------------------------------

  /**
   * List transfers that can be returned after vacation ends.
   */
  async getReturnableTransfers(
    consultantUserId: string,
  ): Promise<ReturnableTransfer[]> {
    const transfers = await this.prisma.caseTransfer.findMany({
      where: {
        fromConsultantId: consultantUserId,
        transferType: TransferType.VACATION,
        status: TransferStatus.COMPLETED,
      },
      include: {
        careCase: {
          select: {
            id: true,
            topic: true,
            language: true,
            status: true,
          },
        },
        toConsultant: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Only include transfers where the case is still active
    return transfers
      .filter((t) =>
        TRANSFERABLE_CASE_STATUSES.includes(t.careCase.status as CaseStatus),
      )
      .map((t) => ({
        transferId: t.id,
        caseId: t.careCaseId,
        caseTopic: t.careCase.topic ?? null,
        caseLanguage: t.careCase.language,
        currentConsultantName: t.toConsultant?.name ?? null,
        vacationEnd: t.vacationEnd,
      }));
  }

  /**
   * Return selected cases back to the original consultant after vacation.
   * Validates workload limits before returning.
   */
  async returnCases(
    dto: ReturnCasesDto,
    actorId: string,
  ): Promise<ReturnCasesResult> {
    const transfers = await this.prisma.caseTransfer.findMany({
      where: {
        id: { in: dto.transferIds },
        transferType: TransferType.VACATION,
        status: TransferStatus.COMPLETED,
      },
      include: {
        careCase: {
          select: {
            id: true,
            version: true,
            crisisLevel: true,
            status: true,
          },
        },
      },
    });

    if (transfers.length === 0) {
      throw new NotFoundException('No eligible transfers found');
    }

    // All transfers must be from the same consultant
    const fromConsultantId = transfers[0].fromConsultantId;

    // Verify workload limits
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId: fromConsultantId },
    });

    if (!profile) {
      throw new NotFoundException('Original consultant profile not found');
    }

    // Count how many cases would be returned
    const activeTransfers = transfers.filter((t) =>
      TRANSFERABLE_CASE_STATUSES.includes(t.careCase.status as CaseStatus),
    );

    if (profile.currentCases + activeTransfers.length > profile.maxCases) {
      throw new BadRequestException(ERROR_WORKLOAD_LIMIT_EXCEEDED);
    }

    const returned: string[] = [];
    const failed: Array<{ transferId: string; reason: string }> = [];

    for (const transfer of activeTransfers) {
      try {
        const isCrisis = CRISIS_LEVELS.includes(transfer.careCase.crisisLevel);

        await this.prisma.$transaction(async (tx) => {
          // Return case to original consultant
          await tx.careCase.update({
            where: {
              id: transfer.careCaseId,
              version: transfer.careCase.version,
            },
            data: {
              consultantId: fromConsultantId,
              version: { increment: 1 },
            },
          });

          // Mark transfer as RETURNED
          await tx.caseTransfer.update({
            where: { id: transfer.id },
            data: { status: TransferStatus.RETURNED },
          });

          // Increment original consultant's counters
          if (isCrisis) {
            await tx.$executeRaw`
              UPDATE consultant_profiles
              SET current_cases = current_cases + 1,
                  current_crisis = current_crisis + 1,
                  updated_at = NOW()
              WHERE user_id = ${fromConsultantId}::uuid
            `;
          } else {
            await tx.$executeRaw`
              UPDATE consultant_profiles
              SET current_cases = current_cases + 1,
                  updated_at = NOW()
              WHERE user_id = ${fromConsultantId}::uuid
            `;
          }

          // Decrement temporary consultant's counters
          if (transfer.toConsultantId) {
            if (isCrisis) {
              await tx.$executeRaw`
                UPDATE consultant_profiles
                SET current_cases = GREATEST(current_cases - 1, 0),
                    current_crisis = GREATEST(current_crisis - 1, 0),
                    updated_at = NOW()
                WHERE user_id = ${transfer.toConsultantId}::uuid
              `;
            } else {
              await tx.$executeRaw`
                UPDATE consultant_profiles
                SET current_cases = GREATEST(current_cases - 1, 0),
                    updated_at = NOW()
                WHERE user_id = ${transfer.toConsultantId}::uuid
              `;
            }
          }

          // Audit entry
          await tx.caseAuditEntry.create({
            data: {
              careCaseId: transfer.careCaseId,
              actorId,
              action: AUDIT_ACTION_VACATION_RETURN,
              details: {
                transferId: transfer.id,
                fromConsultantId,
                toConsultantId: transfer.toConsultantId,
              },
            },
          });
        });

        // Handle meeting reassignment back
        await this.handleMeetingTransfer(
          transfer.careCaseId,
          fromConsultantId,
          actorId,
        );

        // Notify person about consultant return
        this.logger.warn(
          `${MVP_NOTIFICATION_PREFIX} [VACATION_RETURN→PERSON] ` +
            `Case ${transfer.careCaseId}: "${NOTIFICATION_VACATION_RETURN_TO_PERSON}"`,
        );

        returned.push(transfer.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        failed.push({ transferId: transfer.id, reason: message });
        this.logger.error(
          `Failed to return transfer ${transfer.id}: ${message}`,
        );
      }
    }

    // Update consultant status back to AVAILABLE
    if (returned.length > 0) {
      await this.prisma.consultantProfile.update({
        where: { userId: fromConsultantId },
        data: { status: ConsultantStatus.AVAILABLE },
      });
    }

    return {
      returnedCount: returned.length,
      failedCount: failed.length,
      returned,
      failed,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Find all active cases assigned to a consultant.
   */
  private async findActiveCases(consultantUserId: string) {
    return this.prisma.careCase.findMany({
      where: {
        consultantId: consultantUserId,
        status: {
          in: [...TRANSFERABLE_CASE_STATUSES],
        },
      },
      select: {
        id: true,
        topic: true,
        language: true,
        crisisLevel: true,
        version: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Use the assignment algorithm to find the best replacement consultant
   * for a given case (S-E10-03).
   */
  private async findBestReplacement(careCase: {
    id: string;
    topic: string;
    language: string | null;
    crisisLevel: CrisisLevel;
  }): Promise<{
    consultantUserId: string;
    consultantName: string | null;
    score: number;
  } | null> {
    const isCrisis = CRISIS_LEVELS.includes(careCase.crisisLevel);

    const candidates = await this.assignmentService.findEligibleConsultants(
      careCase.language ?? undefined,
      careCase.topic ?? undefined,
      isCrisis,
    );

    if (candidates.length === 0) {
      return null;
    }

    const ranked = this.assignmentService.prioritize(
      candidates,
      careCase.language ?? undefined,
      careCase.topic ?? undefined,
    );

    if (ranked.length === 0) {
      return null;
    }

    const best = ranked[0];

    // Fetch the user's name for display
    const user = await this.prisma.user.findUnique({
      where: { id: best.consultant.userId },
      select: { name: true },
    });

    return {
      consultantUserId: best.consultant.userId,
      consultantName: user?.name ?? null,
      score: best.score,
    };
  }

  /**
   * After completing a transfer, check if all permanent transfers for a
   * consultant are done. If so, deactivate the consultant.
   */
  private async checkAndDeactivateIfAllComplete(
    consultantUserId: string,
  ): Promise<void> {
    const pendingCount = await this.prisma.caseTransfer.count({
      where: {
        fromConsultantId: consultantUserId,
        transferType: TransferType.PERMANENT,
        status: TransferStatus.PENDING,
      },
    });

    if (pendingCount === 0) {
      await this.prisma.consultantProfile.update({
        where: { userId: consultantUserId },
        data: { status: ConsultantStatus.DEACTIVATED },
      });

      this.logger.log(
        `${MVP_NOTIFICATION_PREFIX} All permanent transfers complete for consultant ` +
          `${consultantUserId}. Status set to DEACTIVATED.`,
      );
    }
  }
}
