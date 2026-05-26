import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {PrismaService} from '@org/prisma-client';
import {CaseStatus, CourseStatus, DeletionStatus, EnrollmentStatus, ExportStatus,} from '@prisma/client';
import {InjectQueue} from '@nestjs/bullmq';
import {Queue} from 'bullmq';

import {
  DATA_EXPORT_QUEUE,
  DELETION_GRACE_PERIOD_DAYS,
  JOB_PROCESS_DATA_EXPORT,
  MVP_NOTIFICATION_PREFIX,
  PERSON_CHAT_MAX_PAGE_SIZE,
  PERSON_CHAT_PAGE_SIZE,
  UPCOMING_MEETING_STATUSES,
} from './person-cabinet.const.js';
import {
  DashboardCourseDto,
  DataExportResponse,
  DeletionRequestResponse,
  PersonConversationDto,
  PersonCourseDto,
  PersonCoursesResponse,
  PersonDashboardResponse,
  PersonMeetingDto,
  PersonProfileResponse,
  ProviderLinkDto,
  RequestDeletionDto,
  UpdateProfileDto,
} from './person-cabinet.model.js';

const CHAT_ELIGIBLE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.MEETING_SCHEDULED,
  CaseStatus.ON_HOLD,
  CaseStatus.TRANSFERRED,
];

@Injectable()
export class PersonCabinetService {
  private readonly logger = new Logger(PersonCabinetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DATA_EXPORT_QUEUE)
    private readonly dataExportQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Dashboard (S-E15-01)
  // ---------------------------------------------------------------------------

  async getDashboard(personId: string): Promise<PersonDashboardResponse> {
    const [careCase, nextMeeting, courses] = await Promise.all([
      this.getActiveCase(personId),
      this.getNextMeeting(personId),
      this.getEnrolledCourses(personId),
    ]);

    const canChat =
      careCase !== null &&
      CHAT_ELIGIBLE_STATUSES.includes(careCase.status as CaseStatus);

    return {
      careCase: careCase
        ? {
            id: careCase.id,
            status: careCase.status,
            consultantName: careCase.consultant?.name ?? null,
            consultantAvatarUrl: careCase.consultant?.avatarUrl ?? null,
            topic: careCase.topic,
          }
        : null,
      canChat,
      nextMeeting: nextMeeting
        ? {
            id: nextMeeting.id,
            scheduledAt: nextMeeting.scheduledAt,
            durationMin: nextMeeting.durationMin,
            meetingUrl: nextMeeting.meetingUrl,
            consultantName: nextMeeting.consultant.name,
          }
        : null,
      courses,
    };
  }

  // ---------------------------------------------------------------------------
  // S-E15-02: Person's course list
  // ---------------------------------------------------------------------------

  async getCourses(personId: string): Promise<PersonCoursesResponse> {
    // Get active enrollments with progress
    const enrollments = await this.prisma.enrollment.findMany({
      where: { personId, status: EnrollmentStatus.ACTIVE },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            lessonCount: true,
            status: true,
          },
        },
      },
    });

    const enrolledCourseIds = enrollments.map((e) => e.course.id);

    // Get completed lesson counts per course
    const completedCounts = await this.prisma.lessonProgress.groupBy({
      by: ['courseId'],
      where: {
        personId,
        courseId: { in: enrolledCourseIds },
        isCompleted: true,
      },
      _count: { id: true },
    });

    const completedMap = new Map(
      completedCounts.map((c) => [c.courseId, c._count.id]),
    );

    const active: PersonCourseDto[] = enrollments.map((e) => {
      const completed = completedMap.get(e.course.id) ?? 0;
      const total = e.course.lessonCount;
      return {
        id: e.course.id,
        title: e.course.title,
        description: e.course.description,
        imageUrl: e.course.imageUrl,
        lessonCount: total,
        completedCount: completed,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        enrollmentStatus: e.status,
      };
    });

    // Recommended courses: published courses the person is not enrolled in
    const recommended = await this.getRecommendedCourses(
      personId,
      enrolledCourseIds,
    );

    return { active, recommended };
  }

  // ---------------------------------------------------------------------------
  // Course detail + lesson completion
  // ---------------------------------------------------------------------------

  async getCourseDetail(personId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { personId, courseId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) {
      throw new NotFoundException('Course not found or not enrolled');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        description: true,
        lessons: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            sortOrder: true,
            contentType: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const completedLessons = await this.prisma.lessonProgress.findMany({
      where: { personId, courseId, isCompleted: true },
      select: { lessonId: true },
    });

    const completedSet = new Set(completedLessons.map((lp) => lp.lessonId));

    const lessons = course.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      orderIndex: l.sortOrder,
      contentType: l.contentType,
      isCompleted: completedSet.has(l.id),
    }));

    const completedCount = lessons.filter((l) => l.isCompleted).length;
    const progress = lessons.length > 0
      ? Math.round((completedCount / lessons.length) * 100)
      : 0;

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      progress,
      lessons,
    };
  }

  async getLessonDetail(personId: string, courseId: string, lessonId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { personId, courseId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) {
      throw new NotFoundException('Course not found or not enrolled');
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId },
      select: {
        id: true,
        title: true,
        content: true,
        contentType: true,
        videoUrl: true,
        sortOrder: true,
        hasTriggerWarning: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found in this course');
    }

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { personId_lessonId: { personId, lessonId } },
      select: { isCompleted: true, completedAt: true },
    });

    return {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      contentType: lesson.contentType,
      videoUrl: lesson.videoUrl,
      orderIndex: lesson.sortOrder,
      hasTriggerWarning: lesson.hasTriggerWarning,
      isCompleted: progress?.isCompleted ?? false,
      completedAt: progress?.completedAt ?? null,
    };
  }

  async completeLesson(personId: string, courseId: string, lessonId: string) {
    // Verify enrollment
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { personId, courseId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) {
      throw new NotFoundException('Course not found or not enrolled');
    }

    // Verify lesson belongs to course
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found in this course');
    }

    // Upsert lesson progress
    await this.prisma.lessonProgress.upsert({
      where: {
        personId_lessonId: { personId, lessonId },
      },
      update: { isCompleted: true, completedAt: new Date() },
      create: {
        personId,
        courseId,
        lessonId,
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // S-E15-03: Chat messages for person
  // ---------------------------------------------------------------------------

  async getChatMessages(
    personId: string,
    caseId: string,
    cursor?: string,
    limit?: number,
  ) {
    // Verify person owns this case
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { id: true, personId: true },
    });

    if (!careCase) {
      throw new NotFoundException('Care case not found');
    }

    if (careCase.personId !== personId) {
      throw new ForbiddenException('You do not have access to this case');
    }

    const pageSize = Math.min(
      limit ?? PERSON_CHAT_PAGE_SIZE,
      PERSON_CHAT_MAX_PAGE_SIZE,
    );

    // Fetch messages, excluding private consultant notes
    // Private notes are CaseNote records, not Message records.
    // Messages with senderRole != PERSON are consultant messages visible to person.
    const messages = await this.prisma.message.findMany({
      where: {
        careCaseId: caseId,
        isDeleted: false,
      },
      orderBy: [
        { originalTs: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      take: pageSize + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        senderId: true,
        senderRole: true,
        channel: true,
        content: true,
        attachments: true,
        isRead: true,
        isEdited: true,
        createdAt: true,
      },
    });

    const hasMore = messages.length > pageSize;
    const data = hasMore ? messages.slice(0, pageSize) : messages;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor, hasMore };
  }

  // ---------------------------------------------------------------------------
  // S-E15-05: Profile and settings
  // ---------------------------------------------------------------------------

  async getProfile(personId: string): Promise<PersonProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: personId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        timezone: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      hasPassword: !!user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(
    personId: string,
    dto: UpdateProfileDto,
  ): Promise<PersonProfileResponse> {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data['name'] = dto.name;
    }
    if (dto.timezone !== undefined) {
      // Validate timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: dto.timezone });
      } catch {
        throw new BadRequestException(
          `Invalid timezone: "${dto.timezone}"`,
        );
      }
      data['timezone'] = dto.timezone;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const user = await this.prisma.user.update({
      where: { id: personId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        timezone: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      hasPassword: !!user.passwordHash,
      createdAt: user.createdAt,
    };
  }

  async getProviders(personId: string): Promise<ProviderLinkDto[]> {
    return this.prisma.providerLink.findMany({
      where: { userId: personId },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // S-E15-06: GDPR data export
  // ---------------------------------------------------------------------------

  async requestDataExport(personId: string): Promise<DataExportResponse> {
    // Check for existing pending/processing export
    const existing = await this.prisma.dataExportRequest.findFirst({
      where: {
        userId: personId,
        status: { in: [ExportStatus.PENDING, ExportStatus.PROCESSING] },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A data export request is already in progress',
      );
    }

    const request = await this.prisma.dataExportRequest.create({
      data: {
        userId: personId,
        status: ExportStatus.PENDING,
      },
    });

    // Enqueue BullMQ job for async processing
    await this.dataExportQueue.add(
      JOB_PROCESS_DATA_EXPORT,
      {
        exportRequestId: request.id,
        userId: personId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { count: 10 },
      },
    );

    this.logger.log(
      `Data export request ${request.id} created for user ${personId}`,
    );

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

  async getDataExportStatus(
    personId: string,
    exportId: string,
  ): Promise<DataExportResponse> {
    const request = await this.prisma.dataExportRequest.findUnique({
      where: { id: exportId },
    });

    if (!request || request.userId !== personId) {
      throw new NotFoundException('Data export request not found');
    }

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

  // ---------------------------------------------------------------------------
  // S-E15-07: GDPR account deletion
  // ---------------------------------------------------------------------------

  async requestDeletion(
    personId: string,
    dto: RequestDeletionDto,
  ): Promise<DeletionRequestResponse> {
    // Check for existing pending deletion
    const existing = await this.prisma.deletionRequest.findFirst({
      where: {
        userId: personId,
        status: {
          in: [DeletionStatus.PENDING, DeletionStatus.DEFERRED_CRISIS],
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A deletion request is already pending',
      );
    }

    // Check for active crisis cases
    const crisisCase = await this.prisma.careCase.findFirst({
      where: {
        personId,
        status: {
          notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED],
        },
        crisisLevel: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + DELETION_GRACE_PERIOD_DAYS);

    const status = crisisCase
      ? DeletionStatus.DEFERRED_CRISIS
      : DeletionStatus.PENDING;

    const request = await this.prisma.deletionRequest.create({
      data: {
        userId: personId,
        status,
        reason: dto.reason ?? null,
        scheduledAt,
        deferredUntil: crisisCase ? null : undefined,
      },
    });

    if (crisisCase) {
      this.logger.warn(
        `${MVP_NOTIFICATION_PREFIX} Deletion request ${request.id} deferred ` +
          `due to active crisis case ${crisisCase.id} for user ${personId}`,
      );
    } else {
      this.logger.log(
        `Deletion request ${request.id} created for user ${personId}. ` +
          `Scheduled for ${scheduledAt.toISOString()}`,
      );
    }

    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      scheduledAt: request.scheduledAt,
      deferredUntil: request.deferredUntil,
      createdAt: request.createdAt,
    };
  }

  async cancelDeletion(personId: string): Promise<void> {
    const request = await this.prisma.deletionRequest.findFirst({
      where: {
        userId: personId,
        status: {
          in: [DeletionStatus.PENDING, DeletionStatus.DEFERRED_CRISIS],
        },
      },
    });

    if (!request) {
      throw new NotFoundException('No pending deletion request found');
    }

    await this.prisma.deletionRequest.update({
      where: { id: request.id },
      data: { status: DeletionStatus.CANCELLED },
    });

    this.logger.log(
      `Deletion request ${request.id} cancelled for user ${personId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // S-E15-09: Meetings display in cabinet
  // ---------------------------------------------------------------------------

  async getUpcomingMeetings(personId: string): Promise<PersonMeetingDto[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: {
        personId,
        status: { in: [...UPCOMING_MEETING_STATUSES] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        consultant: {
          select: { name: true },
        },
      },
    });

    return meetings.map((m) => ({
      id: m.id,
      careCaseId: m.careCaseId,
      scheduledAt: m.scheduledAt,
      durationMin: m.durationMin,
      meetingUrl: m.meetingUrl,
      status: m.status,
      personTz: m.personTz,
      personTzTime: this.formatInTimezone(m.scheduledAt, m.personTz),
      consultantName: m.consultant.name,
    }));
  }

  // ---------------------------------------------------------------------------
  // Conversations (chat list for person)
  // ---------------------------------------------------------------------------

  async getConversations(personId: string): Promise<PersonConversationDto[]> {
    const cases = await this.prisma.careCase.findMany({
      where: {
        personId,
        status: { in: CHAT_ELIGIBLE_STATUSES },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        consultant: {
          select: { name: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            isRead: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderRole: { not: 'PERSON' },
              },
            },
          },
        },
      },
    });

    return cases.map((c) => ({
      id: c.id,
      consultantName: c.consultant?.name ?? 'Consultant',
      lastMessage: c.messages[0]?.content ?? null,
      lastMessageAt: c.messages[0]?.createdAt ?? null,
      unreadCount: c._count.messages,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getActiveCase(personId: string) {
    return this.prisma.careCase.findFirst({
      where: {
        personId,
        status: {
          notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        topic: true,
        consultant: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  private async getNextMeeting(personId: string) {
    return this.prisma.meeting.findFirst({
      where: {
        personId,
        status: { in: [...UPCOMING_MEETING_STATUSES] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        meetingUrl: true,
        consultant: {
          select: { name: true },
        },
      },
    });
  }

  private async getEnrolledCourses(
    personId: string,
  ): Promise<DashboardCourseDto[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        personId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            lessonCount: true,
          },
        },
      },
    });

    if (enrollments.length === 0) {
      return [];
    }

    const courseIds = enrollments.map((e) => e.course.id);

    const completedCounts = await this.prisma.lessonProgress.groupBy({
      by: ['courseId'],
      where: {
        personId,
        courseId: { in: courseIds },
        isCompleted: true,
      },
      _count: { id: true },
    });

    const completedMap = new Map(
      completedCounts.map((c) => [c.courseId, c._count.id]),
    );

    return enrollments.map((e) => {
      const totalLessons = e.course.lessonCount;
      const completedLessons = completedMap.get(e.course.id) ?? 0;
      const progressPercent =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      return {
        id: e.course.id,
        title: e.course.title,
        imageUrl: e.course.imageUrl,
        totalLessons,
        completedLessons,
        progressPercent,
      };
    });
  }

  private async getRecommendedCourses(
    personId: string,
    excludeCourseIds: string[],
  ): Promise<PersonCourseDto[]> {
    const courses = await this.prisma.course.findMany({
      where: {
        status: CourseStatus.PUBLISHED,
        ...(excludeCourseIds.length > 0
          ? { id: { notIn: excludeCourseIds } }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        lessonCount: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      imageUrl: c.imageUrl,
      lessonCount: c.lessonCount,
      completedCount: 0,
      progressPercent: 0,
      enrollmentStatus: EnrollmentStatus.ACTIVE, // placeholder for recommended
    }));
  }

  private formatInTimezone(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    }
  }
}
