import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseSource, CaseStatus, Prisma } from '@prisma/client';

import { JwtPayload } from '../auth/auth.model.js';
import {
  ALLOWED_TRANSITIONS,
  AUDIT_ACTION_ASSIGNMENT,
  AUDIT_ACTION_CASE_CREATED,
  AUDIT_ACTION_STATUS_CHANGE,
  ELEVATED_TRANSITION_ROLES,
  TERMINAL_STATUSES,
} from './cases.const.js';
import {
  AssignConsultantDto,
  CaseResponse,
  ChangeStatusDto,
  CreateCaseDto,
} from './cases.model.js';

/** Prisma select for sourced lesson (manual join since sourceLessonId is not a relation). */
const CASE_INCLUDE = {
  sourceCourse: { select: { id: true, title: true } },
} as const;

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateCaseDto, actor: JwtPayload): Promise<CaseResponse> {
    const personId = dto.personId ?? actor.sub;

    // GDPR check
    const person = await this.prisma.user.findUnique({
      where: { id: personId },
      select: { id: true, dataConsentAt: true },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    if (!person.dataConsentAt) {
      throw new BadRequestException(
        'GDPR data consent is required before creating a case',
      );
    }

    // Only one active case per person
    const activeCase = await this.prisma.careCase.findFirst({
      where: {
        personId,
        status: { notIn: TERMINAL_STATUSES },
      },
      select: { id: true },
    });

    if (activeCase) {
      throw new ConflictException(
        'Person already has an active case. Complete or close the existing case first.',
      );
    }

    // Validate course reference when source=COURSE
    if (dto.source === CaseSource.COURSE && !dto.sourceCourseId) {
      throw new BadRequestException(
        'sourceCourseId is required when source is COURSE',
      );
    }

    const careCase = await this.prisma.careCase.create({
      data: {
        personId,
        name: dto.name,
        country: dto.country,
        language: dto.language,
        contactMethod: dto.contactMethod,
        contactValue: dto.contactValue,
        topic: dto.topic,
        description: dto.description,
        source: dto.source,
        sourceCourseId: dto.sourceCourseId,
        sourceLessonId: dto.sourceLessonId,
        status: CaseStatus.NEW,
      },
      include: CASE_INCLUDE,
    });

    // Audit: case created
    await this.createAuditEntry(careCase.id, actor.sub, AUDIT_ACTION_CASE_CREATED, {
      status: CaseStatus.NEW,
    });

    return this.enrichWithLesson(careCase);
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard(actor: JwtPayload) {
    let consultantFilter: Prisma.CareCaseWhereInput = {};
    if (actor.role === 'CONSULTANT') {
      consultantFilter = { consultantId: actor.sub };
    }

    const [activeCases, pendingCases, resolvedThisWeek, todayMeetings] =
      await Promise.all([
        this.prisma.careCase.count({
          where: {
            ...consultantFilter,
            status: { notIn: TERMINAL_STATUSES },
          },
        }),
        this.prisma.careCase.count({
          where: {
            ...consultantFilter,
            status: { in: [CaseStatus.NEW, CaseStatus.ON_HOLD] },
          },
        }),
        this.prisma.careCase.count({
          where: {
            ...consultantFilter,
            status: CaseStatus.COMPLETED,
            resolvedAt: { gte: this.startOfWeek() },
          },
        }),
        this.prisma.meeting.count({
          where: {
            ...(actor.role === 'CONSULTANT'
              ? { consultantId: actor.sub }
              : {}),
            scheduledAt: {
              gte: this.startOfDay(),
              lt: this.endOfDay(),
            },
          },
        }),
      ]);

    return { activeCases, pendingCases, todayMeetings, resolvedThisWeek };
  }

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfWeek(): Date {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findAll(actor: JwtPayload, tagId?: string): Promise<CaseResponse[]> {
    let where: Prisma.CareCaseWhereInput = {};

    if (actor.role === 'PERSON') {
      where = { personId: actor.sub };
    } else if (actor.role === 'CONSULTANT') {
      where = { consultantId: actor.sub };
    }
    // COORDINATOR and ADMIN see all

    // Filter by tag if provided
    if (tagId) {
      where = {
        ...where,
        tags: { some: { tagId } },
      };
    }

    // S-E08-05: Crisis cases on top — sort by crisisLevel desc first, then by time
    const cases = await this.prisma.careCase.findMany({
      where,
      include: CASE_INCLUDE,
      orderBy: [{ crisisLevel: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(cases.map((c) => this.enrichWithLesson(c)));
  }

  async findOne(id: string, actor: JwtPayload): Promise<CaseResponse> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id },
      include: CASE_INCLUDE,
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // Access control
    if (actor.role === 'PERSON' && careCase.personId !== actor.sub) {
      throw new NotFoundException('Case not found');
    }
    if (actor.role === 'CONSULTANT' && careCase.consultantId !== actor.sub) {
      throw new NotFoundException('Case not found');
    }

    return this.enrichWithLesson(careCase);
  }

  // ---------------------------------------------------------------------------
  // Status change (state machine)
  // ---------------------------------------------------------------------------

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actor: JwtPayload,
  ): Promise<CaseResponse> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // Optimistic locking
    if (careCase.version !== dto.version) {
      throw new ConflictException(
        `Version mismatch: expected ${careCase.version}, received ${dto.version}. The case was modified by another user.`,
      );
    }

    const currentStatus = careCase.status;
    const targetStatus = dto.status;

    // Check state machine
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    const isAllowed = allowed.includes(targetStatus);

    if (!isAllowed) {
      throw new BadRequestException(
        `Transition from ${currentStatus} to ${targetStatus} is not allowed`,
      );
    }

    // Build timestamp updates
    const timestamps: Prisma.CareCaseUpdateInput = {};
    if (targetStatus === CaseStatus.COMPLETED) {
      timestamps.resolvedAt = new Date();
    }
    if (targetStatus === CaseStatus.CLOSED) {
      timestamps.closedAt = new Date();
    }

    const updated = await this.prisma.careCase.update({
      where: { id, version: dto.version },
      data: {
        status: targetStatus,
        version: { increment: 1 },
        ...timestamps,
      },
      include: CASE_INCLUDE,
    });

    // Audit: status change
    await this.createAuditEntry(id, actor.sub, AUDIT_ACTION_STATUS_CHANGE, {
      from: currentStatus,
      to: targetStatus,
    });

    return this.enrichWithLesson(updated);
  }

  // ---------------------------------------------------------------------------
  // Assign consultant
  // ---------------------------------------------------------------------------

  async assignConsultant(
    id: string,
    dto: AssignConsultantDto,
    actor: JwtPayload,
  ): Promise<CaseResponse> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // Optimistic locking
    if (careCase.version !== dto.version) {
      throw new ConflictException(
        `Version mismatch: expected ${careCase.version}, received ${dto.version}. The case was modified by another user.`,
      );
    }

    // Verify consultant exists and has the right role
    const consultant = await this.prisma.user.findUnique({
      where: { id: dto.consultantId },
      select: { id: true, role: true, isActive: true },
    });

    if (!consultant || !consultant.isActive) {
      throw new NotFoundException('Consultant not found');
    }

    if (consultant.role !== 'CONSULTANT' && consultant.role !== 'SUPERVISOR') {
      throw new BadRequestException(
        'The specified user is not a consultant or supervisor',
      );
    }

    const updated = await this.prisma.careCase.update({
      where: { id, version: dto.version },
      data: {
        consultantId: dto.consultantId,
        status: CaseStatus.ASSIGNED,
        version: { increment: 1 },
      },
      include: CASE_INCLUDE,
    });

    // Audit: assignment
    await this.createAuditEntry(id, actor.sub, AUDIT_ACTION_ASSIGNMENT, {
      consultantId: dto.consultantId,
      previousStatus: careCase.status,
      newStatus: CaseStatus.ASSIGNED,
    });

    return this.enrichWithLesson(updated);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async createAuditEntry(
    careCaseId: string,
    actorId: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId,
        actorId,
        action,
        details: details as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Enrich case with lesson title if sourceLessonId is set.
   * sourceLessonId is not a Prisma relation, so we look it up manually.
   */
  private async enrichWithLesson(
    careCase: Record<string, unknown>,
  ): Promise<CaseResponse> {
    const lessonId = careCase['sourceLessonId'] as string | null;
    let sourceLesson: { id: string; title: string } | null = null;

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, title: true },
      });
      sourceLesson = lesson;
    }

    return {
      ...(careCase as unknown as CaseResponse),
      sourceLesson,
    };
  }
}
