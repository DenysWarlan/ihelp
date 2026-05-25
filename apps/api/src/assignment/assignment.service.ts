import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, ConsultantStatus, CrisisLevel } from '@prisma/client';

import {
  AUDIT_ACTION_AUTO_ASSIGN,
  AUDIT_ACTION_AUTO_ASSIGN_FALLBACK,
  AUDIT_ACTION_MANUAL_ASSIGN,
  AUDIT_ACTION_REASSIGN,
  CRISIS_LEVELS,
  CRISIS_LIMIT_EXCEEDED_MESSAGE,
  ELIGIBLE_STATUSES,
  FALLBACK_PERSON_MESSAGE,
  FallbackReason,
  NOTIFICATION_ASSIGNED_TO_PERSON,
  NOTIFICATION_NEW_CASE_TO_CONSULTANT,
  NOTIFICATION_QUEUED_TO_PERSON,
} from './assignment.const.js';
import {
  AssignmentResult,
  EligibleConsultant,
  ManualAssignResult,
  ReassignResult,
  ScoredConsultant,
} from './assignment.model.js';

/**
 * Implements the auto-assignment algorithm for care cases (S-E06-01..04).
 *
 * Priority criteria (in order):
 *   1. Specialization match (case topic in consultant specializations)
 *   2. Language match
 *   3. Availability (status = AVAILABLE scores higher than BUSY)
 *   4. Minimum workload (most free slots = maxCases - currentCases)
 *
 * Assignment is atomic: uses a Prisma transaction with an optimistic
 * WHERE guard (currentCases < maxCases) to prevent race conditions.
 */
@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run the full auto-assignment pipeline for a case.
   *
   * 1. Validate case exists and is in NEW status
   * 2. Find eligible consultants (status filter)
   * 3. Prioritize candidates
   * 4. Try atomic assignment for each candidate in priority order
   * 5. Fall back to coordinator if no assignment succeeds
   */
  async autoAssign(caseId: string, actorId: string): Promise<AssignmentResult> {
    // 1. Load the case
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        language: true,
        topic: true,
        version: true,
        crisisLevel: true,
      },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    if (careCase.status !== CaseStatus.NEW) {
      const result = await this.handleFallback(
        caseId,
        actorId,
        FallbackReason.INVALID_CASE_STATUS,
      );
      return result;
    }

    // 2. Find eligible consultants
    const isCrisis = this.isCrisisCase(careCase.crisisLevel);
    const candidates = await this.findEligibleConsultants(
      careCase.language ?? undefined,
      careCase.topic ?? undefined,
      isCrisis,
    );

    if (candidates.length === 0) {
      return this.handleFallback(
        caseId,
        actorId,
        FallbackReason.NO_ELIGIBLE_CONSULTANTS,
      );
    }

    // 3. Prioritize
    const ranked = this.prioritize(
      candidates,
      careCase.language ?? undefined,
      careCase.topic ?? undefined,
    );

    // 4. Try atomic assignment in priority order
    for (const scored of ranked) {
      const success = await this.tryAtomicAssign(
        scored.consultant,
        caseId,
        careCase.version,
        actorId,
        isCrisis,
      );

      if (success) {
        this.logger.log(
          `Auto-assigned case ${caseId} to consultant userId=${scored.consultant.userId}`,
        );
        return {
          assigned: true,
          caseId,
          consultantUserId: scored.consultant.userId,
          consultantProfileId: scored.consultant.id,
          fallbackReason: null,
        };
      }
    }

    // 5. All candidates failed (race condition / at capacity)
    return this.handleFallback(
      caseId,
      actorId,
      FallbackReason.ASSIGNMENT_RACE_FAILED,
    );
  }

  // ---------------------------------------------------------------------------
  // Step 2: Find eligible consultants
  // ---------------------------------------------------------------------------

  /**
   * Query ConsultantProfile rows that are eligible for assignment.
   * Filters:
   *   - status IN (AVAILABLE, BUSY)
   *   - currentCases < maxCases
   *   - If crisis case: also currentCrisis < maxCrisisCases
   */
  async findEligibleConsultants(
    _language?: string,
    _specialization?: string,
    isCrisis = false,
  ): Promise<EligibleConsultant[]> {
    // We fetch all eligible consultants and do fine-grained
    // prioritization in-memory. This is safe for the expected
    // consultant pool size (< 1 000).
    const profiles = await this.prisma.consultantProfile.findMany({
      where: {
        status: { in: [...ELIGIBLE_STATUSES] },
        // Raw filter: currentCases < maxCases
        // Prisma doesn't support column-vs-column in where, so we
        // use a raw filter via $queryRaw or post-filter.
      },
      orderBy: { currentCases: 'asc' },
    });

    // Post-filter: only consultants with capacity
    return profiles.filter((p) => {
      if (p.currentCases >= p.maxCases) {
        return false;
      }

      // For crisis cases, also enforce crisis capacity limit
      if (isCrisis && p.currentCrisis >= p.maxCrisisCases) {
        return false;
      }

      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Step 3: Prioritize candidates
  // ---------------------------------------------------------------------------

  /**
   * Score and sort candidates by:
   *   +3  specialization match (topic found in specializations[])
   *   +2  language match
   *   +1  AVAILABLE status (vs BUSY)
   *   tiebreaker: most free slots (maxCases - currentCases) DESC
   */
  prioritize(
    candidates: EligibleConsultant[],
    caseLanguage?: string,
    caseTopic?: string,
  ): ScoredConsultant[] {
    const scored: ScoredConsultant[] = candidates.map((c) => {
      let score = 0;

      // Specialization match
      if (
        caseTopic &&
        c.specializations.some(
          (s) => s.toLowerCase() === caseTopic.toLowerCase(),
        )
      ) {
        score += 3;
      }

      // Language match
      if (
        caseLanguage &&
        c.languages.some(
          (l) => l.toLowerCase() === caseLanguage.toLowerCase(),
        )
      ) {
        score += 2;
      }

      // Availability bonus
      if (c.status === 'AVAILABLE') {
        score += 1;
      }

      const freeSlots = c.maxCases - c.currentCases;

      return { consultant: c, score, freeSlots };
    });

    // Sort: highest score first, then most free slots
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.freeSlots - a.freeSlots;
    });

    return scored;
  }

  // ---------------------------------------------------------------------------
  // Step 4: Atomic assignment (race-condition safe)
  // ---------------------------------------------------------------------------

  /**
   * Atomically assign a case to a consultant inside a serializable
   * transaction. The consultant's currentCases is incremented only if
   * it is still below maxCases (optimistic guard). For crisis cases,
   * currentCrisis is also atomically incremented with its own guard.
   *
   * Returns true if the assignment succeeded, false otherwise.
   */
  async tryAtomicAssign(
    consultant: EligibleConsultant,
    caseId: string,
    caseVersion: number,
    actorId: string,
    isCrisis = false,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (isCrisis) {
          // Atomic increment: both currentCases and currentCrisis must
          // be under their respective limits.
          const rowsUpdated = await tx.$executeRaw`
            UPDATE consultant_profiles
            SET current_cases = current_cases + 1,
                current_crisis = current_crisis + 1,
                updated_at = NOW()
            WHERE id = ${consultant.id}::uuid
              AND current_cases < max_cases
              AND current_crisis < max_crisis_cases
          `;

          if (rowsUpdated === 0) {
            throw new Error('CAPACITY_EXCEEDED');
          }
        } else {
          // Non-crisis: only check total case capacity.
          const rowsUpdated = await tx.$executeRaw`
            UPDATE consultant_profiles
            SET current_cases = current_cases + 1,
                updated_at = NOW()
            WHERE id = ${consultant.id}::uuid
              AND current_cases < max_cases
          `;

          if (rowsUpdated === 0) {
            throw new Error('CAPACITY_EXCEEDED');
          }
        }

        // Assign the case
        await tx.careCase.update({
          where: { id: caseId, version: caseVersion },
          data: {
            consultantId: consultant.userId,
            status: CaseStatus.ASSIGNED,
            version: { increment: 1 },
          },
        });

        // Audit entry
        await tx.caseAuditEntry.create({
          data: {
            careCaseId: caseId,
            actorId,
            action: AUDIT_ACTION_AUTO_ASSIGN,
            details: {
              consultantUserId: consultant.userId,
              consultantProfileId: consultant.id,
              algorithm: 'auto-assign-v1',
              isCrisis,
            },
          },
        });
      });

      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      if (message === 'CAPACITY_EXCEEDED') {
        this.logger.debug(
          `Consultant ${consultant.userId} at capacity${isCrisis ? ' (crisis limit)' : ''}, trying next candidate`,
        );
        return false;
      }

      // Prisma P2025 = record not found (version mismatch on case)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        this.logger.warn(
          `Case ${caseId} version mismatch during auto-assign (concurrent modification)`,
        );
        return false;
      }

      this.logger.error(
        `Unexpected error during atomic assign for case ${caseId}: ${message}`,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Fallback to coordinator
  // ---------------------------------------------------------------------------

  /**
   * Handle fallback when no consultant can be assigned.
   * - Case stays in NEW status
   * - Coordinator is notified (log for MVP)
   * - Person gets the fallback message
   */
  async handleFallback(
    caseId: string,
    actorId: string,
    reason: FallbackReason,
  ): Promise<AssignmentResult> {
    this.logger.warn(
      `Auto-assignment fallback for case ${caseId}: ${reason}. ` +
        `Coordinator notification required. Person message: "${FALLBACK_PERSON_MESSAGE}"`,
    );

    // Audit the fallback
    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId: caseId,
        actorId,
        action: AUDIT_ACTION_AUTO_ASSIGN_FALLBACK,
        details: {
          reason,
          personMessage: FALLBACK_PERSON_MESSAGE,
        },
      },
    });

    return {
      assigned: false,
      caseId,
      consultantUserId: null,
      consultantProfileId: null,
      fallbackReason: reason,
    };
  }

  // ---------------------------------------------------------------------------
  // Manual assignment (S-E06-05)
  // ---------------------------------------------------------------------------

  /**
   * Manually assign a consultant to an unassigned case.
   * Returns warnings (not errors) when the consultant is unavailable
   * or over total capacity.
   * Crisis limit is a HARD limit — throws BadRequestException if exceeded.
   */
  async manualAssign(
    caseId: string,
    consultantUserId: string,
    actorId: string,
  ): Promise<ManualAssignResult> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        consultantId: true,
        version: true,
        crisisLevel: true,
      },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    if (careCase.consultantId) {
      throw new BadRequestException(
        'Case is already assigned. Use reassign endpoint instead.',
      );
    }

    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId: consultantUserId },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${consultantUserId}`,
      );
    }

    const isCrisis = this.isCrisisCase(careCase.crisisLevel);

    // Crisis limit is a HARD block — never allow exceeding it
    if (isCrisis && profile.currentCrisis >= profile.maxCrisisCases) {
      throw new BadRequestException(
        `${CRISIS_LIMIT_EXCEEDED_MESSAGE} (${profile.currentCrisis}/${profile.maxCrisisCases})`,
      );
    }

    // Collect warnings (non-blocking)
    const warnings: string[] = [];

    if (profile.status !== ConsultantStatus.AVAILABLE && profile.status !== ConsultantStatus.BUSY) {
      warnings.push(
        `Consultant status is ${profile.status} — not typically available for assignment`,
      );
    }

    if (profile.currentCases >= profile.maxCases) {
      warnings.push(
        `Consultant is at or over capacity (${profile.currentCases}/${profile.maxCases} cases)`,
      );
    }

    // Perform assignment in a transaction
    await this.prisma.$transaction(async (tx) => {
      if (isCrisis) {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              current_crisis = current_crisis + 1,
              updated_at = NOW()
          WHERE user_id = ${consultantUserId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              updated_at = NOW()
          WHERE user_id = ${consultantUserId}::uuid
        `;
      }

      await tx.careCase.update({
        where: { id: caseId, version: careCase.version },
        data: {
          consultantId: consultantUserId,
          status: CaseStatus.ASSIGNED,
          version: { increment: 1 },
        },
      });

      await tx.caseAuditEntry.create({
        data: {
          careCaseId: caseId,
          actorId,
          action: AUDIT_ACTION_MANUAL_ASSIGN,
          details: {
            consultantUserId,
            warnings,
          },
        },
      });
    });

    // MVP notifications (log-based)
    this.logger.log(
      `[MVP NOTIFICATION] Person notification for case ${caseId}: ${NOTIFICATION_ASSIGNED_TO_PERSON}`,
    );
    this.logger.log(
      `[MVP NOTIFICATION] Consultant ${consultantUserId} notification: ${NOTIFICATION_NEW_CASE_TO_CONSULTANT}`,
    );

    return {
      assigned: true,
      caseId,
      consultantUserId,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // Reassignment (S-E06-05)
  // ---------------------------------------------------------------------------

  /**
   * Reassign a case from one consultant to another.
   * Decrements old consultant's currentCases (and currentCrisis if crisis),
   * increments new one's. Crisis limit is a HARD block.
   */
  async reassign(
    caseId: string,
    newConsultantUserId: string,
    actorId: string,
  ): Promise<ReassignResult> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        consultantId: true,
        version: true,
        crisisLevel: true,
      },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    const previousConsultantUserId = careCase.consultantId;

    if (previousConsultantUserId === newConsultantUserId) {
      throw new BadRequestException(
        'New consultant is the same as the current consultant',
      );
    }

    const newProfile = await this.prisma.consultantProfile.findUnique({
      where: { userId: newConsultantUserId },
    });

    if (!newProfile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${newConsultantUserId}`,
      );
    }

    const isCrisis = this.isCrisisCase(careCase.crisisLevel);

    // Crisis limit is a HARD block — never allow exceeding it
    if (isCrisis && newProfile.currentCrisis >= newProfile.maxCrisisCases) {
      throw new BadRequestException(
        `${CRISIS_LIMIT_EXCEEDED_MESSAGE} (${newProfile.currentCrisis}/${newProfile.maxCrisisCases})`,
      );
    }

    const warnings: string[] = [];

    if (newProfile.status !== ConsultantStatus.AVAILABLE && newProfile.status !== ConsultantStatus.BUSY) {
      warnings.push(
        `New consultant status is ${newProfile.status} — not typically available for assignment`,
      );
    }

    if (newProfile.currentCases >= newProfile.maxCases) {
      warnings.push(
        `New consultant is at or over capacity (${newProfile.currentCases}/${newProfile.maxCases} cases)`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Decrement old consultant
      if (previousConsultantUserId) {
        if (isCrisis) {
          await tx.$executeRaw`
            UPDATE consultant_profiles
            SET current_cases = GREATEST(current_cases - 1, 0),
                current_crisis = GREATEST(current_crisis - 1, 0),
                updated_at = NOW()
            WHERE user_id = ${previousConsultantUserId}::uuid
          `;
        } else {
          await tx.$executeRaw`
            UPDATE consultant_profiles
            SET current_cases = GREATEST(current_cases - 1, 0),
                updated_at = NOW()
            WHERE user_id = ${previousConsultantUserId}::uuid
          `;
        }
      }

      // Increment new consultant
      if (isCrisis) {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              current_crisis = current_crisis + 1,
              updated_at = NOW()
          WHERE user_id = ${newConsultantUserId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = current_cases + 1,
              updated_at = NOW()
          WHERE user_id = ${newConsultantUserId}::uuid
        `;
      }

      // Update case
      await tx.careCase.update({
        where: { id: caseId, version: careCase.version },
        data: {
          consultantId: newConsultantUserId,
          status: CaseStatus.ASSIGNED,
          version: { increment: 1 },
        },
      });

      // Audit
      await tx.caseAuditEntry.create({
        data: {
          careCaseId: caseId,
          actorId,
          action: AUDIT_ACTION_REASSIGN,
          details: {
            previousConsultantUserId,
            newConsultantUserId,
            warnings,
          },
        },
      });
    });

    // MVP notifications (log-based)
    this.logger.log(
      `[MVP NOTIFICATION] Consultant ${newConsultantUserId} notification: ${NOTIFICATION_NEW_CASE_TO_CONSULTANT}`,
    );
    this.logger.log(
      `[MVP NOTIFICATION] Person notification for case ${caseId}: ${NOTIFICATION_ASSIGNED_TO_PERSON}`,
    );

    return {
      assigned: true,
      caseId,
      previousConsultantUserId,
      newConsultantUserId,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // Queue processing (S-E06-07, S-E06-08)
  // ---------------------------------------------------------------------------

  /**
   * Process the queue of unassigned cases (FIFO by createdAt).
   * Attempts auto-assignment for each case in order.
   */
  async processQueue(): Promise<void> {
    const unassignedCases = await this.prisma.careCase.findMany({
      where: {
        status: CaseStatus.NEW,
        consultantId: null,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (unassignedCases.length === 0) {
      this.logger.debug('No unassigned cases in queue');
      return;
    }

    this.logger.log(
      `Processing queue: ${unassignedCases.length} unassigned case(s)`,
    );

    // Log queued status for persons waiting
    for (const c of unassignedCases) {
      this.logger.debug(
        `[MVP NOTIFICATION] Person status update for case ${c.id}: ${NOTIFICATION_QUEUED_TO_PERSON}`,
      );
    }

    for (const { id } of unassignedCases) {
      const result = await this.autoAssign(id, 'system');

      if (result.assigned) {
        this.logger.log(
          `Queue: assigned case ${id} to consultant ${result.consultantUserId}`,
        );
      } else {
        // No more eligible consultants, stop processing
        this.logger.debug(
          `Queue: could not assign case ${id} (${result.fallbackReason}). Stopping queue processing.`,
        );
        break;
      }
    }
  }

  /**
   * Handle case completion: free up the consultant slot (and crisis slot
   * if applicable) and process queue.
   */
  async onCaseCompleted(caseId: string): Promise<void> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { consultantId: true, crisisLevel: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    if (careCase.consultantId) {
      const isCrisis = this.isCrisisCase(careCase.crisisLevel);

      if (isCrisis) {
        await this.prisma.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = GREATEST(current_cases - 1, 0),
              current_crisis = GREATEST(current_crisis - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${careCase.consultantId}::uuid
        `;
      } else {
        await this.prisma.$executeRaw`
          UPDATE consultant_profiles
          SET current_cases = GREATEST(current_cases - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${careCase.consultantId}::uuid
        `;
      }

      this.logger.log(
        `Decremented currentCases${isCrisis ? ' and currentCrisis' : ''} for consultant ${careCase.consultantId} after case ${caseId} completed`,
      );
    }

    // Re-run auto-assign on the queue
    await this.processQueue();
  }

  /**
   * Handle consultant becoming available: process queue for pending cases.
   */
  async onConsultantAvailable(userId: string): Promise<void> {
    this.logger.log(
      `Consultant ${userId} became available. Processing queue.`,
    );
    await this.processQueue();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine whether a case qualifies as a crisis case.
   * Crisis cases are those with crisisLevel HIGH or CRITICAL.
   */
  private isCrisisCase(crisisLevel: CrisisLevel): boolean {
    return CRISIS_LEVELS.includes(crisisLevel);
  }
}
