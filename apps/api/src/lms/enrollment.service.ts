import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CourseStatus, EnrollmentStatus } from '@prisma/client';
import { CourseVersionService } from './course-version.service.js';

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseVersionService: CourseVersionService,
  ) {}

  async enroll(courseId: string, personId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Курс недоступний');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { personId_courseId: { personId, courseId } },
    });

    // Pin to the current published version (if any)
    const currentVersionNum =
      await this.courseVersionService.getCurrentVersionNumber(courseId);

    if (existing) {
      // Allow re-enrollment if previously dropped
      if (existing.status === EnrollmentStatus.DROPPED) {
        return this.prisma.enrollment.update({
          where: { id: existing.id },
          data: {
            status: EnrollmentStatus.ACTIVE,
            courseVersionNum: currentVersionNum,
          },
        });
      }
      throw new ConflictException('Already enrolled in this course');
    }

    return this.prisma.enrollment.create({
      data: {
        personId,
        courseId,
        courseVersionNum: currentVersionNum,
      },
    });
  }

  async getMyEnrollments(personId: string) {
    return this.prisma.enrollment.findMany({
      where: { personId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            imageUrl: true,
            lessonCount: true,
            gracePeriodEnd: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
