import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma, Role } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service.js';
import { AUDIT_ACTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './admin.const.js';
import {
  ERROR_MERGE_CROSS_ROLE,
  ERROR_MERGE_INACTIVE,
  ERROR_MERGE_SAME_USER,
} from './duplicate.const.js';
import type {
  MergeExecutionResult,
  MergeHistoryEntry,
  MergeHistoryResponse,
  MergePreview,
} from './duplicate.model.js';

@Injectable()
export class UserMergeService {
  private readonly logger = new Logger(UserMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Execute Merge
  // ---------------------------------------------------------------------------

  async executeMerge(
    primaryUserId: string,
    secondaryUserId: string,
    performedBy: string,
  ): Promise<MergeExecutionResult> {
    // Pre-validation
    if (primaryUserId === secondaryUserId) {
      throw new BadRequestException(ERROR_MERGE_SAME_USER);
    }

    const [primary, secondary] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: primaryUserId } }),
      this.prisma.user.findUnique({ where: { id: secondaryUserId } }),
    ]);

    if (!primary) throw new NotFoundException('Primary user not found');
    if (!secondary) throw new NotFoundException('Secondary user not found');

    if (!primary.isActive || !secondary.isActive) {
      throw new BadRequestException(ERROR_MERGE_INACTIVE);
    }

    if (primary.role !== secondary.role) {
      throw new BadRequestException(ERROR_MERGE_CROSS_ROLE);
    }

    // Execute merge in a single transaction
    const preview = await this.prisma.$transaction(async (tx) => {
      const stats: MergePreview = await this.migrateEntities(
        tx,
        primaryUserId,
        secondaryUserId,
        primary.role as Role,
      );

      // Deactivate secondary
      await tx.user.update({
        where: { id: secondaryUserId },
        data: {
          isActive: false,
          email: `merged_${secondary.email}_${Date.now()}`,
        },
      });

      // Revoke all secondary sessions
      await tx.session.updateMany({
        where: { userId: secondaryUserId },
        data: { isRevoked: true },
      });

      // Clean up dismissals involving secondary
      await tx.duplicateDismissal.deleteMany({
        where: {
          OR: [
            { userIdA: secondaryUserId },
            { userIdB: secondaryUserId },
          ],
        },
      });

      // Create merge record
      await tx.userMerge.create({
        data: {
          primaryUserId,
          secondaryUserId,
          performedBy,
          mergeDetails: stats as unknown as Prisma.InputJsonValue,
        },
      });

      return stats;
    });

    // Audit log (outside transaction — non-critical)
    await this.auditService.log(
      AUDIT_ACTIONS.USER_MERGE,
      performedBy,
      JSON.stringify({
        primaryUserId,
        secondaryUserId,
        primaryEmail: primary.email,
        secondaryEmail: secondary.email,
        preview,
      }),
    );

    this.logger.log(
      `Users merged: ${secondaryUserId} -> ${primaryUserId} by ${performedBy}`,
    );

    const mergeRecord = await this.prisma.userMerge.findFirst({
      where: { primaryUserId, secondaryUserId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      mergeId: mergeRecord!.id,
      primaryUserId,
      secondaryUserId,
      preview,
    };
  }

  // ---------------------------------------------------------------------------
  // Merge History
  // ---------------------------------------------------------------------------

  async listMergeHistory(
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<MergeHistoryResponse> {
    const take = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const [merges, total] = await this.prisma.$transaction([
      this.prisma.userMerge.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userMerge.count(),
    ]);

    // Load user names for display
    const userIds = new Set<string>();
    for (const m of merges) {
      userIds.add(m.primaryUserId);
      userIds.add(m.secondaryUserId);
      userIds.add(m.performedBy);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data: MergeHistoryEntry[] = merges.map((m) => {
      const primaryUser = userMap.get(m.primaryUserId);
      const secondaryUser = userMap.get(m.secondaryUserId);
      const performer = userMap.get(m.performedBy);

      return {
        id: m.id,
        primaryUserId: m.primaryUserId,
        primaryUserName: primaryUser?.name ?? 'Unknown',
        primaryUserEmail: primaryUser?.email ?? 'Unknown',
        secondaryUserId: m.secondaryUserId,
        secondaryUserName: secondaryUser?.name ?? 'Unknown',
        secondaryUserEmail: secondaryUser?.email ?? 'Unknown',
        performedBy: m.performedBy,
        performedByName: performer?.name ?? 'Unknown',
        mergeDetails: m.mergeDetails as unknown as MergePreview,
        isReverted: m.isReverted,
        createdAt: m.createdAt,
      };
    });

    return {
      data,
      total,
      page,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async getMergeDetail(mergeId: string): Promise<MergeHistoryEntry> {
    const merge = await this.prisma.userMerge.findUnique({
      where: { id: mergeId },
    });

    if (!merge) {
      throw new NotFoundException('Merge record not found');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: [merge.primaryUserId, merge.secondaryUserId, merge.performedBy],
        },
      },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const primaryUser = userMap.get(merge.primaryUserId);
    const secondaryUser = userMap.get(merge.secondaryUserId);
    const performer = userMap.get(merge.performedBy);

    return {
      id: merge.id,
      primaryUserId: merge.primaryUserId,
      primaryUserName: primaryUser?.name ?? 'Unknown',
      primaryUserEmail: primaryUser?.email ?? 'Unknown',
      secondaryUserId: merge.secondaryUserId,
      secondaryUserName: secondaryUser?.name ?? 'Unknown',
      secondaryUserEmail: secondaryUser?.email ?? 'Unknown',
      performedBy: merge.performedBy,
      performedByName: performer?.name ?? 'Unknown',
      mergeDetails: merge.mergeDetails as unknown as MergePreview,
      isReverted: merge.isReverted,
      createdAt: merge.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Entity Migration (inside transaction)
  // ---------------------------------------------------------------------------

  private async migrateEntities(
    tx: Prisma.TransactionClient,
    primaryId: string,
    secondaryId: string,
    role: Role,
  ): Promise<MergePreview> {
    const isStaff = role !== Role.PERSON;

    // 1. Provider links
    const providerLinks = await tx.providerLink.updateMany({
      where: { userId: secondaryId },
      data: { userId: primaryId },
    });

    // 2. Cases (as person)
    const casesAsPerson = await tx.careCase.updateMany({
      where: { personId: secondaryId },
      data: { personId: primaryId },
    });

    // 3. Cases (as consultant) — staff only
    let casesAsConsultant = 0;
    if (isStaff) {
      const result = await tx.careCase.updateMany({
        where: { consultantId: secondaryId },
        data: { consultantId: primaryId },
      });
      casesAsConsultant = result.count;
    }

    // 4. Case notes
    await tx.caseNote.updateMany({
      where: { authorId: secondaryId },
      data: { authorId: primaryId },
    });

    // 5. Messages
    const messages = await tx.message.updateMany({
      where: { senderId: secondaryId },
      data: { senderId: primaryId },
    });

    // 6 & 7. Enrollments + Lesson Progress (with conflict resolution)
    const { enrollmentsMerged, enrollmentConflicts } =
      await this.mergeEnrollments(tx, primaryId, secondaryId);

    // 8. Progress resets
    await tx.progressReset.updateMany({
      where: { personId: secondaryId },
      data: { personId: primaryId },
    });

    // 9. Meetings (as person)
    const meetingsAsPerson = await tx.meeting.updateMany({
      where: { personId: secondaryId },
      data: { personId: primaryId },
    });

    // 10. Meetings (as consultant) — staff only
    if (isStaff) {
      await tx.meeting.updateMany({
        where: { consultantId: secondaryId },
        data: { consultantId: primaryId },
      });
    }

    // 11. Invites
    await tx.invite.updateMany({
      where: { inviterId: secondaryId },
      data: { inviterId: primaryId },
    });

    // 12. Duty schedules — staff only
    if (isStaff) {
      await tx.dutySchedule.updateMany({
        where: { userId: secondaryId },
        data: { userId: primaryId },
      });
    }

    // 13. Sessions — revoke (counted below)
    const sessions = await tx.session.updateMany({
      where: { userId: secondaryId, isRevoked: false },
      data: { isRevoked: true },
    });

    return {
      casesReassigned: casesAsPerson.count + casesAsConsultant,
      messagesReattributed: messages.count,
      enrollmentsMerged,
      enrollmentConflicts,
      providerLinksMoved: providerLinks.count,
      sessionsRevoked: sessions.count,
      meetingsReassigned: meetingsAsPerson.count,
    };
  }

  // ---------------------------------------------------------------------------
  // Enrollment & Lesson Progress Conflict Resolution
  // ---------------------------------------------------------------------------

  private async mergeEnrollments(
    tx: Prisma.TransactionClient,
    primaryId: string,
    secondaryId: string,
  ): Promise<{ enrollmentsMerged: number; enrollmentConflicts: number }> {
    const primaryEnrollments = await tx.enrollment.findMany({
      where: { personId: primaryId },
    });
    const secondaryEnrollments = await tx.enrollment.findMany({
      where: { personId: secondaryId },
    });

    const primaryCourseIds = new Set(primaryEnrollments.map((e) => e.courseId));
    let conflicts = 0;
    let merged = 0;

    for (const secEnrollment of secondaryEnrollments) {
      if (primaryCourseIds.has(secEnrollment.courseId)) {
        // Conflict — same course, resolve progress
        conflicts++;
        await this.resolveLessonProgressConflicts(
          tx,
          primaryId,
          secondaryId,
          secEnrollment.courseId,
        );

        // Delete secondary enrollment (progress already migrated)
        await tx.enrollment.delete({ where: { id: secEnrollment.id } });
      } else {
        // No conflict — re-parent
        await tx.enrollment.update({
          where: { id: secEnrollment.id },
          data: { personId: primaryId },
        });
      }
      merged++;
    }

    // Migrate remaining non-conflicting lesson progress
    await tx.lessonProgress.updateMany({
      where: { personId: secondaryId },
      data: { personId: primaryId },
    });

    return { enrollmentsMerged: merged, enrollmentConflicts: conflicts };
  }

  private async resolveLessonProgressConflicts(
    tx: Prisma.TransactionClient,
    primaryId: string,
    secondaryId: string,
    courseId: string,
  ): Promise<void> {
    const primaryProgress = await tx.lessonProgress.findMany({
      where: { personId: primaryId, courseId },
    });
    const secondaryProgress = await tx.lessonProgress.findMany({
      where: { personId: secondaryId, courseId },
    });

    const primaryLessonMap = new Map(
      primaryProgress.map((p) => [p.lessonId, p]),
    );

    for (const secProgress of secondaryProgress) {
      const priProgress = primaryLessonMap.get(secProgress.lessonId);

      if (priProgress) {
        // Both have progress on same lesson — completed wins
        if (secProgress.isCompleted && !priProgress.isCompleted) {
          await tx.lessonProgress.update({
            where: { id: priProgress.id },
            data: {
              isCompleted: true,
              completedAt: secProgress.completedAt,
            },
          });
        } else if (
          secProgress.isCompleted &&
          priProgress.isCompleted &&
          secProgress.completedAt &&
          priProgress.completedAt &&
          secProgress.completedAt < priProgress.completedAt
        ) {
          // Both completed — keep earlier date
          await tx.lessonProgress.update({
            where: { id: priProgress.id },
            data: { completedAt: secProgress.completedAt },
          });
        }

        // Delete secondary progress (conflict resolved)
        await tx.lessonProgress.delete({ where: { id: secProgress.id } });
      } else {
        // No conflict — re-parent to primary
        await tx.lessonProgress.update({
          where: { id: secProgress.id },
          data: { personId: primaryId },
        });
      }
    }
  }
}
