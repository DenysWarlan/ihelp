import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CourseStatus, CaseStatus } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import {
  ALLOWED_COURSE_TRANSITIONS,
  ARCHIVE_GRACE_PERIOD_DAYS,
} from './lms.const.js';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Admin methods ──────────────────────────────────────────

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        language: dto.language,
        tags: dto.tags ?? [],
        imageUrl: dto.imageUrl,
      },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.assertCourseExists(id);

    return this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      },
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: { select: { lessons: true, enrollments: true } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${id}" not found`);
    }

    const allowed = ALLOWED_COURSE_TRANSITIONS[course.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transition from ${course.status} to ${dto.status} is not allowed`,
      );
    }

    // Publishing prerequisites
    if (dto.status === CourseStatus.PUBLISHED) {
      if (course._count.lessons === 0) {
        throw new BadRequestException(
          'Cannot publish a course without at least one lesson',
        );
      }
      if (!course.title || !course.description) {
        throw new BadRequestException(
          'Cannot publish a course without title and description',
        );
      }
    }

    const updateData: Record<string, unknown> = { status: dto.status };

    // Set grace period on archive
    if (dto.status === CourseStatus.ARCHIVED) {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + ARCHIVE_GRACE_PERIOD_DAYS,
      );
      updateData['gracePeriodEnd'] = gracePeriodEnd;

      // Log notification for enrolled users (MVP: log only)
      if (course._count.enrollments > 0) {
        this.logger.log(
          `[NOTIFICATION] Course "${course.title}" (${id}) archived. ` +
            `${course._count.enrollments} enrolled person(s) should be notified. ` +
            `Grace period ends: ${gracePeriodEnd.toISOString()}`,
        );
      }

      // Check for active care cases linked to this course
      const activeCases = await this.prisma.careCase.findMany({
        where: {
          sourceCourseId: id,
          status: {
            notIn: [CaseStatus.COMPLETED, CaseStatus.CLOSED],
          },
        },
        select: { id: true, consultantId: true },
      });

      if (activeCases.length > 0) {
        this.logger.log(
          `[NOTIFICATION] Course "${course.title}" (${id}) archived with ` +
            `${activeCases.length} active care case(s). Consultants should be notified.`,
        );
      }
    }

    return this.prisma.course.update({
      where: { id },
      data: updateData,
    });
  }

  async findAll() {
    return this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        tags: true,
        lessonCount: true,
        imageUrl: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${id}" not found`);
    }

    return course;
  }

  // ── Public catalog methods ─────────────────────────────────

  async findAllPublished() {
    return this.prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        lessonCount: true,
        imageUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePublished(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, status: CourseStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        lessonCount: true,
        imageUrl: true,
        lessons: {
          select: {
            id: true,
            title: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${id}" not found`);
    }

    return course;
  }

  // ── Helpers ────────────────────────────────────────────────

  private async assertCourseExists(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Course with id "${id}" not found`);
    }
    return course;
  }
}
