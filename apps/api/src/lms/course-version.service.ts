import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CourseStatus, EnrollmentStatus } from '@prisma/client';
import {
  CourseVersionListItemDto,
  CourseVersionDetailDto,
  ForceUpdateResultDto,
} from './dto/course-version.dto.js';

@Injectable()
export class CourseVersionService {
  private readonly logger = new Logger(CourseVersionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Publish a new version ─────────────────────────────────

  async publishVersion(courseId: string, changelog?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          select: {
            id: true,
            title: true,
            sortOrder: true,
            contentType: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Only PUBLISHED courses can have a new version created. ' +
          `Current status: ${course.status}`,
      );
    }

    // Determine next version number
    const latestVersion = await this.prisma.courseVersion.findFirst({
      where: { courseId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    // Snapshot current lesson structure
    const lessonMapping = course.lessons.map((l) => ({
      lessonId: l.id,
      title: l.title,
      sortOrder: l.sortOrder,
      contentType: l.contentType,
    }));

    const version = await this.prisma.courseVersion.create({
      data: {
        courseId,
        versionNumber: nextVersionNumber,
        lessonMapping,
        changelog: changelog ?? null,
      },
    });

    this.logger.log(
      `Published version ${nextVersionNumber} for course "${course.title}" (${courseId})`,
    );

    return version;
  }

  // ── List versions ─────────────────────────────────────────

  async listVersions(courseId: string): Promise<CourseVersionListItemDto[]> {
    await this.assertCourseExists(courseId);

    return this.prisma.courseVersion.findMany({
      where: { courseId },
      select: {
        id: true,
        versionNumber: true,
        changelog: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  // ── Get specific version ──────────────────────────────────

  async getVersion(
    courseId: string,
    versionNum: number,
  ): Promise<CourseVersionDetailDto> {
    await this.assertCourseExists(courseId);

    const version = await this.prisma.courseVersion.findUnique({
      where: {
        courseId_versionNumber: { courseId, versionNumber: versionNum },
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Version ${versionNum} not found for course "${courseId}"`,
      );
    }

    return version;
  }

  // ── Get current (latest) version number ───────────────────

  async getCurrentVersionNumber(courseId: string): Promise<number | null> {
    const latest = await this.prisma.courseVersion.findFirst({
      where: { courseId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return latest?.versionNumber ?? null;
  }

  // ── Force-update enrollments to latest version ────────────

  async forceUpdateEnrollments(
    courseId: string,
  ): Promise<ForceUpdateResultDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, gracePeriodEnd: true, title: true },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    // Block during archive grace period
    if (
      course.gracePeriodEnd &&
      new Date() < course.gracePeriodEnd
    ) {
      throw new BadRequestException(
        'Cannot force-update enrollments during archive grace period. ' +
          `Grace period ends: ${course.gracePeriodEnd.toISOString()}`,
      );
    }

    const latestVersion = await this.prisma.courseVersion.findFirst({
      where: { courseId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    if (!latestVersion) {
      throw new BadRequestException(
        'No published versions exist for this course. Publish a version first.',
      );
    }

    const result = await this.prisma.enrollment.updateMany({
      where: {
        courseId,
        status: EnrollmentStatus.ACTIVE,
        OR: [
          { courseVersionNum: null },
          { courseVersionNum: { not: latestVersion.versionNumber } },
        ],
      },
      data: { courseVersionNum: latestVersion.versionNumber },
    });

    this.logger.log(
      `Force-updated ${result.count} enrollment(s) to version ${latestVersion.versionNumber} ` +
        `for course "${course.title}" (${courseId})`,
    );

    return {
      updatedCount: result.count,
      versionNumber: latestVersion.versionNumber,
    };
  }

  // ── Recalculate progress after lesson deletion ────────────

  async recalculateProgressAfterLessonDeletion(
    courseId: string,
    deletedLessonId: string,
  ) {
    // Delete progress records for the deleted lesson
    const deletedProgress = await this.prisma.lessonProgress.deleteMany({
      where: { lessonId: deletedLessonId },
    });

    this.logger.log(
      `Deleted ${deletedProgress.count} progress record(s) for removed lesson "${deletedLessonId}"`,
    );

    // Get current lesson count for the course
    const totalLessons = await this.prisma.lesson.count({
      where: { courseId },
    });

    // Find all active/completed enrollments
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        courseId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      select: { id: true, personId: true, status: true },
    });

    for (const enrollment of enrollments) {
      const completedCount = await this.prisma.lessonProgress.count({
        where: {
          personId: enrollment.personId,
          courseId,
          OR: [{ isCompleted: true }, { isSkipped: true }],
        },
      });

      if (totalLessons === 0) {
        // If no lessons remain, mark as completed
        if (enrollment.status !== EnrollmentStatus.COMPLETED) {
          await this.prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { status: EnrollmentStatus.COMPLETED },
          });
        }
      } else if (completedCount >= totalLessons) {
        // All remaining lessons completed
        if (enrollment.status !== EnrollmentStatus.COMPLETED) {
          await this.prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { status: EnrollmentStatus.COMPLETED },
          });
        }
      } else {
        // Not all lessons completed — set back to ACTIVE if was COMPLETED
        if (enrollment.status === EnrollmentStatus.COMPLETED) {
          await this.prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { status: EnrollmentStatus.ACTIVE },
          });
        }
      }
    }

    this.logger.log(
      `Recalculated progress for ${enrollments.length} enrollment(s) on course "${courseId}"`,
    );
  }

  // ── Helpers ───────────────────────────────────────────────

  private async assertCourseExists(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }
    return course;
  }
}
