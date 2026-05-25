import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import {
  CaseStatus,
  ConsultantStatus,
  CrisisLevel,
  TransferStatus,
  TransferType,
} from '@prisma/client';

import { AssignmentService } from '../assignment/assignment.service.js';
import { CRISIS_LEVELS } from '../assignment/assignment.const.js';
import {
  AUDIT_ACTION_PERMANENT_TRANSFER,
  AUDIT_ACTION_TRANSFER_COMPLETED,
  AUDIT_ACTION_VACATION_TRANSFER,
  ERROR_CRISIS_CASE_BLOCKS_PERMANENT,
  ERROR_NO_ACTIVE_CASES,
  MVP_NOTIFICATION_PREFIX,
  TRANSFERABLE_CASE_STATUSES,
} from './transfer.const.js';
import {
  AcceptTransferMatchDto,
  InitiatePermanentTransferDto,
  InitiateVacationTransferDto,
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
