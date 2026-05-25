import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseSource, CaseStatus, CasePriority } from '@prisma/client';
import { STRUGGLING_DEDUP_WINDOW_MS } from './lms.const.js';
import { StrugglingResponseDto } from './dto/progress.dto.js';

@Injectable()
export class StrugglingService {
  private readonly logger = new Logger(StrugglingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleStruggling(
    personId: string,
    courseId: string,
    lessonId: string,
  ): Promise<StrugglingResponseDto> {
    // Validate course and lesson exist
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, title: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${lessonId}" not found`);
    }

    if (lesson.courseId !== courseId) {
      throw new BadRequestException('Lesson does not belong to the specified course');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    // Verify person is enrolled
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { personId_courseId: { personId, courseId } },
      select: { status: true },
    });

    if (!enrollment) {
      throw new BadRequestException('Not enrolled in this course');
    }

    // Idempotency: check if a case was created < 1 min ago with same sourceLessonId
    const deduplicationCutoff = new Date(Date.now() - STRUGGLING_DEDUP_WINDOW_MS);

    const recentCase = await this.prisma.careCase.findFirst({
      where: {
        personId,
        sourceLessonId: lessonId,
        source: CaseSource.COURSE,
        createdAt: { gte: deduplicationCutoff },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCase) {
      this.logger.log(
        `Returning existing case "${recentCase.id}" for person "${personId}" ` +
          `(deduplication window)`,
      );
      return { caseId: recentCase.id, isNew: false };
    }

    // Check if person has an active case — send context to that case
    const activeCase = await this.prisma.careCase.findFirst({
      where: {
        personId,
        status: { notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED] },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (activeCase) {
      // Add a note to existing case with course/lesson context
      await this.prisma.caseNote.create({
        data: {
          careCaseId: activeCase.id,
          authorId: personId,
          content:
            `[Автоматичне повідомлення] Людина натиснула "Мені важко" ` +
            `під час уроку "${lesson.title}" курсу "${course.title}"`,
        },
      });

      this.logger.log(
        `Added struggling context to existing case "${activeCase.id}" ` +
          `for person "${personId}"`,
      );

      return { caseId: activeCase.id, isNew: false };
    }

    // Create new CareCase with source COURSE
    // Try to find a duty consultant
    const dutyConsultant = await this.prisma.user.findFirst({
      where: {
        role: 'CONSULTANT',
        consultantProfile: {
          status: 'AVAILABLE',
        },
      },
      select: { id: true },
    });

    const newCase = await this.prisma.careCase.create({
      data: {
        personId,
        source: CaseSource.COURSE,
        sourceCourseId: courseId,
        sourceLessonId: lessonId,
        topic: `Потрібна допомога: ${course.title}`,
        description:
          `Людина натиснула "Мені важко" під час уроку "${lesson.title}" ` +
          `курсу "${course.title}"`,
        priority: CasePriority.MEDIUM,
        ...(dutyConsultant
          ? { consultantId: dutyConsultant.id, status: CaseStatus.ASSIGNED }
          : {}),
      },
    });

    this.logger.log(
      `Created new care case "${newCase.id}" for person "${personId}" ` +
        `from course "${courseId}", lesson "${lessonId}". ` +
        `Consultant: ${dutyConsultant ? dutyConsultant.id : 'none (queued for coordinator)'}`,
    );

    return { caseId: newCase.id, isNew: true };
  }
}
