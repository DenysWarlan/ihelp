import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { EnrollmentStatus } from '@prisma/client';
import { MAX_PROGRESS_RESETS } from './lms.const.js';
import {
  CourseProgressDto,
  LessonProgressDto,
  PersonProgressDto,
  ProgressResetResponseDto,
} from './dto/progress.dto.js';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Complete a lesson ──────────────────────────────────────

  async completeLesson(personId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${lessonId}" not found`);
    }

    await this.assertActiveEnrollment(personId, lesson.courseId);

    const progress = await this.prisma.lessonProgress.upsert({
      where: { personId_lessonId: { personId, lessonId } },
      create: {
        personId,
        lessonId,
        courseId: lesson.courseId,
        isCompleted: true,
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        isSkipped: false,
        completedAt: new Date(),
      },
    });

    // Check if all lessons in the course are now completed
    await this.checkCourseCompletion(personId, lesson.courseId);

    return progress;
  }

  // ── Skip a lesson (trigger warning) ───────────────────────

  async skipLesson(personId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, hasTriggerWarning: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${lessonId}" not found`);
    }

    await this.assertActiveEnrollment(personId, lesson.courseId);

    const progress = await this.prisma.lessonProgress.upsert({
      where: { personId_lessonId: { personId, lessonId } },
      create: {
        personId,
        lessonId,
        courseId: lesson.courseId,
        isSkipped: true,
        isCompleted: false,
      },
      update: {
        isSkipped: true,
      },
    });

    // Skipped lessons count towards completion
    await this.checkCourseCompletion(personId, lesson.courseId);

    return progress;
  }

  // ── Get progress for an enrollment ────────────────────────

  async getProgress(personId: string, enrollmentId: string): Promise<CourseProgressDto> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, personId: true, courseId: true, status: true },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    if (enrollment.personId !== personId) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    return this.buildCourseProgress(enrollment.id, enrollment.courseId, personId, enrollment.status);
  }

  // ── Reset progress ────────────────────────────────────────

  async resetProgress(personId: string, enrollmentId: string): Promise<ProgressResetResponseDto> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, personId: true, courseId: true, status: true },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    if (enrollment.personId !== personId) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    if (enrollment.status !== EnrollmentStatus.ACTIVE && enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot reset progress for a dropped enrollment');
    }

    const resetCount = await this.prisma.progressReset.count({
      where: { personId, courseId: enrollment.courseId },
    });

    if (resetCount >= MAX_PROGRESS_RESETS) {
      throw new BadRequestException(
        `Maximum number of progress resets (${MAX_PROGRESS_RESETS}) reached for this course`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.lessonProgress.deleteMany({
        where: { personId, courseId: enrollment.courseId },
      }),
      this.prisma.progressReset.create({
        data: { personId, courseId: enrollment.courseId },
      }),
      // If enrollment was COMPLETED, set back to ACTIVE
      this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.ACTIVE },
      }),
    ]);

    this.logger.log(
      `Progress reset for person "${personId}" on course "${enrollment.courseId}" ` +
        `(reset ${resetCount + 1}/${MAX_PROGRESS_RESETS})`,
    );

    return {
      resetsUsed: resetCount + 1,
      resetsAllowed: MAX_PROGRESS_RESETS,
    };
  }

  // ── Drop enrollment (leave course) ────────────────────────

  async dropEnrollment(personId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, personId: true, courseId: true, status: true },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    if (enrollment.personId !== personId) {
      throw new NotFoundException(`Enrollment with id "${enrollmentId}" not found`);
    }

    if (enrollment.status === EnrollmentStatus.DROPPED) {
      throw new BadRequestException('Already dropped from this course');
    }

    return this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: EnrollmentStatus.DROPPED },
    });
  }

  // ── Person progress (consultant view) ─────────────────────

  async getPersonProgress(personId: string): Promise<PersonProgressDto> {
    const person = await this.prisma.user.findUnique({
      where: { id: personId },
      select: { id: true, name: true },
    });

    if (!person) {
      throw new NotFoundException(`Person with id "${personId}" not found`);
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { personId },
      select: { id: true, courseId: true, status: true },
      orderBy: { createdAt: 'desc' },
    });

    const courseProgressList: CourseProgressDto[] = [];

    for (const enrollment of enrollments) {
      const courseProgress = await this.buildCourseProgress(
        enrollment.id,
        enrollment.courseId,
        personId,
        enrollment.status,
      );
      courseProgressList.push(courseProgress);
    }

    return {
      personId: person.id,
      personName: person.name,
      enrollments: courseProgressList,
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private async assertActiveEnrollment(personId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { personId_courseId: { personId, courseId } },
      select: { status: true },
    });

    if (!enrollment) {
      throw new BadRequestException('Not enrolled in this course');
    }

    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException('Enrollment is not active');
    }
  }

  private async checkCourseCompletion(personId: string, courseId: string) {
    const totalLessons = await this.prisma.lesson.count({
      where: { courseId },
    });

    if (totalLessons === 0) {
      return;
    }

    const progressCount = await this.prisma.lessonProgress.count({
      where: {
        personId,
        courseId,
        OR: [{ isCompleted: true }, { isSkipped: true }],
      },
    });

    if (progressCount >= totalLessons) {
      await this.prisma.enrollment.update({
        where: { personId_courseId: { personId, courseId } },
        data: { status: EnrollmentStatus.COMPLETED },
      });

      this.logger.log(
        `Person "${personId}" completed course "${courseId}"`,
      );
    }
  }

  private async buildCourseProgress(
    enrollmentId: string,
    courseId: string,
    personId: string,
    status: string,
  ): Promise<CourseProgressDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        lessons: {
          select: {
            id: true,
            title: true,
            sortOrder: true,
            hasTriggerWarning: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    const progressRecords = await this.prisma.lessonProgress.findMany({
      where: { personId, courseId },
      select: {
        lessonId: true,
        isCompleted: true,
        isSkipped: true,
        completedAt: true,
      },
    });

    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p]),
    );

    const lessons: LessonProgressDto[] = course.lessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      return {
        lessonId: lesson.id,
        title: lesson.title,
        sortOrder: lesson.sortOrder,
        hasTriggerWarning: lesson.hasTriggerWarning,
        isCompleted: progress?.isCompleted ?? false,
        isSkipped: progress?.isSkipped ?? false,
        completedAt: progress?.completedAt ?? null,
      };
    });

    const totalLessons = course.lessons.length;
    const completedLessons = lessons.filter(
      (l) => l.isCompleted || l.isSkipped,
    ).length;
    const progressPercent =
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    return {
      enrollmentId,
      courseId: course.id,
      courseTitle: course.title,
      status,
      totalLessons,
      completedLessons,
      progressPercent,
      lessons,
    };
  }
}
