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
  CaseDetailResponse,
  CaseResponse,
  ChangeStatusDto,
  CreateCaseDto,
} from './cases.model.js';

/** Prisma select for sourced lesson (manual join since sourceLessonId is not a relation). */
const CASE_INCLUDE = {
  person: { select: { name: true } },
  consultant: { select: { name: true } },
  sourceCourse: { select: { id: true, title: true } },
} as const;

/** Extended include for single-case detail view. */
const CASE_DETAIL_INCLUDE = {
  person: { select: { name: true, email: true, phone: true } },
  consultant: { select: { name: true } },
  sourceCourse: { select: { id: true, title: true } },
  notes: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { select: { name: true } } },
  },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    take: 50,
    include: { sender: { select: { name: true } } },
  },
  meetings: {
    orderBy: { scheduledAt: 'desc' as const },
    include: { consultant: { select: { name: true } } },
  },
  tags: {
    include: { tag: { select: { id: true, name: true } } },
  },
  feedback: true,
  slaTimer: true,
} as const;

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreateCaseDto, actor?: JwtPayload): Promise<CaseResponse> {
    let personId = dto.personId ?? actor?.sub;

    // Public intake: find or create the person by contact email
    if (!personId) {
      if (!dto.contactValue) {
        throw new BadRequestException(
          'contactValue (email) is required for public intake',
        );
      }

      const existing = await this.prisma.user.findUnique({
        where: { email: dto.contactValue },
        select: { id: true },
      });

      if (existing) {
        personId = existing.id;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            email: dto.contactValue,
            name: dto.name ?? dto.contactValue,
            role: 'PERSON',
            dataConsentAt: dto.consentData ? new Date() : undefined,
            sensitiveDataConsentAt: dto.consentSensitive ? new Date() : undefined,
          },
        });
        personId = newUser.id;
      }
    }

    // GDPR consent update for existing users
    if (dto.consentData || dto.consentSensitive) {
      await this.prisma.user.update({
        where: { id: personId },
        data: {
          ...(dto.consentData ? { dataConsentAt: new Date() } : {}),
          ...(dto.consentSensitive ? { sensitiveDataConsentAt: new Date() } : {}),
        },
      });
    }

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

    // If person already has an active case, return it instead of blocking
    const activeCase = await this.prisma.careCase.findFirst({
      where: {
        personId,
        status: { notIn: TERMINAL_STATUSES },
      },
    });

    if (activeCase) {
      return activeCase;
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
        description: dto.message ?? dto.description,
        source: dto.source ?? CaseSource.WEBSITE_FORM,
        sourceCourseId: dto.sourceCourseId,
        sourceLessonId: dto.sourceLessonId,
        status: CaseStatus.NEW,
      },
      include: CASE_INCLUDE,
    });

    // Audit: case created
    await this.createAuditEntry(careCase.id, personId, AUDIT_ACTION_CASE_CREATED, {
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

  async findOne(id: string, actor: JwtPayload): Promise<CaseDetailResponse> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id },
      include: CASE_DETAIL_INCLUDE,
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

    return this.enrichDetailResponse(careCase, actor);
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
      select: { id: true, status: true, version: true, consultantId: true, crisisLevel: true },
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

    // Decrement consultant counters on terminal status
    if (['COMPLETED', 'CLOSED'].includes(targetStatus) && careCase.consultantId) {
      await this.prisma.$executeRaw`
        UPDATE consultant_profiles
        SET current_cases = GREATEST(current_cases - 1, 0),
            updated_at = NOW()
        WHERE user_id = ${careCase.consultantId}::uuid
      `;
      if (careCase.crisisLevel !== 'NONE') {
        await this.prisma.$executeRaw`
          UPDATE consultant_profiles
          SET current_crisis = GREATEST(current_crisis - 1, 0),
              updated_at = NOW()
          WHERE user_id = ${careCase.consultantId}::uuid
        `;
      }
    }

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
      select: { id: true, status: true, version: true, crisisLevel: true },
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

    // Increment consultant case counter
    await this.prisma.$executeRaw`
      UPDATE consultant_profiles
      SET current_cases = current_cases + 1,
          updated_at = NOW()
      WHERE user_id = ${dto.consultantId}::uuid
    `;
    if (careCase.crisisLevel !== 'NONE') {
      await this.prisma.$executeRaw`
        UPDATE consultant_profiles
        SET current_crisis = current_crisis + 1,
            updated_at = NOW()
        WHERE user_id = ${dto.consultantId}::uuid
      `;
    }

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
   * Build a full CaseDetailResponse with all relations mapped.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma include types are complex; using `any` with safe access
  private async enrichDetailResponse(
    careCase: any,
    actor?: JwtPayload,
  ): Promise<CaseDetailResponse> {
    const base = await this.enrichWithLesson(careCase);

    const person = careCase.person ?? null;
    const allNotes = careCase.notes ?? [];
    const messages = careCase.messages ?? [];
    const meetings = careCase.meetings ?? [];
    const caseTags = careCase.tags ?? [];
    const feedback = careCase.feedback ?? null;
    const slaTimer = careCase.slaTimer ?? null;

    const staffRoles = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'];

    // Filter notes by role: PERSON sees none, CONSULTANT sees non-supervisor notes only
    let visibleNotes = allNotes;
    if (actor?.role === 'PERSON') {
      visibleNotes = [];
    } else if (actor?.role === 'CONSULTANT') {
      visibleNotes = allNotes.filter((n: any) => !n.isSupervisorNote);
    }

    // Destructure to exclude raw Prisma relation objects from the spread
    const {
      person: _person,
      consultant: _consultant,
      notes: _notes,
      messages: _messages,
      meetings: _meetings,
      tags: _tags,
      feedback: _feedback,
      slaTimer: _slaTimer,
      ...safeBase
    } = base as Record<string, unknown>;

    return {
      ...safeBase,
      personEmail: person?.email ?? null,
      personPhone: person?.phone ?? null,
      notes: visibleNotes.map((n: any) => ({
        id: n.id,
        content: n.content,
        authorName: n.author?.name ?? 'Unknown',
        isSupervisorNote: n.isSupervisorNote ?? false,
        createdAt: n.createdAt,
      })),
      messages: messages.map((m: any) => ({
        id: m.id,
        content: m.content,
        authorName: m.sender?.name ?? 'Unknown',
        senderRole: m.senderRole ?? 'PERSON',
        channel: m.channel ?? 'WEB',
        isFromStaff: staffRoles.includes(m.senderRole ?? ''),
        createdAt: m.createdAt,
      })),
      meetings: meetings.map((mt: any) => ({
        id: mt.id,
        status: mt.status,
        scheduledAt: mt.scheduledAt,
        durationMin: mt.durationMin ?? 30,
        meetingUrl: mt.meetingUrl ?? null,
        consultantName: mt.consultant?.name ?? null,
      })),
      tags: caseTags.map((ct: any) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: null,
      })),
      feedback: feedback
        ? {
            rating: feedback.rating,
            comment: feedback.comment ?? null,
            createdAt: feedback.createdAt,
          }
        : null,
      sla: slaTimer
        ? {
            status: slaTimer.status,
            currentLevel: slaTimer.currentLevel,
            startedAt: slaTimer.startedAt,
            lastEscalatedAt: slaTimer.lastEscalatedAt ?? null,
          }
        : null,
    };
  }

  /**
   * Enrich case with lesson title if sourceLessonId is set.
   * sourceLessonId is not a Prisma relation, so we look it up manually.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async enrichWithLesson(
    careCase: any,
  ): Promise<CaseResponse> {
    const lessonId = careCase.sourceLessonId as string | null;
    let sourceLesson: { id: string; title: string } | null = null;

    if (lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, title: true },
      });
      sourceLesson = lesson;
    }

    return {
      ...careCase,
      personName: careCase.person?.name ?? careCase.name ?? null,
      consultantName: careCase.consultant?.name ?? null,
      sourceLesson,
    };
  }
}
