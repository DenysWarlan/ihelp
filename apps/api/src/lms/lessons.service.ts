import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CourseStatus } from '@prisma/client';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { CourseVersionService } from './course-version.service.js';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courseVersionService: CourseVersionService,
  ) {}

  async create(courseId: string, dto: CreateLessonDto) {
    await this.assertCourseExists(courseId);

    const sortOrder =
      dto.sortOrder ??
      (await this.prisma.lesson.count({ where: { courseId } }));

    const [lesson] = await this.prisma.$transaction([
      this.prisma.lesson.create({
        data: {
          courseId,
          title: dto.title,
          content: dto.content,
          contentType: dto.contentType,
          videoUrl: dto.videoUrl,
          imageUrl: dto.imageUrl,
          sortOrder,
          hasTriggerWarning: dto.hasTriggerWarning ?? false,
        },
      }),
      this.prisma.course.update({
        where: { id: courseId },
        data: { lessonCount: { increment: 1 } },
      }),
    ]);

    return lesson;
  }

  async update(lessonId: string, dto: UpdateLessonDto, courseId?: string) {
    const lesson = await this.assertLessonExists(lessonId);
    if (courseId && lesson.courseId !== courseId) {
      throw new BadRequestException('Lesson does not belong to the specified course');
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.contentType !== undefined && { contentType: dto.contentType }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.hasTriggerWarning !== undefined && { hasTriggerWarning: dto.hasTriggerWarning }),
      },
    });
  }

  async delete(lessonId: string, courseId?: string) {
    const lesson = await this.assertLessonExists(lessonId);
    if (courseId && lesson.courseId !== courseId) {
      throw new BadRequestException('Lesson does not belong to the specified course');
    }

    // Check if the course is published (need to recalculate progress)
    const course = await this.prisma.course.findUnique({
      where: { id: lesson.courseId },
      select: { status: true },
    });

    await this.prisma.$transaction([
      this.prisma.lesson.delete({ where: { id: lessonId } }),
      this.prisma.course.update({
        where: { id: lesson.courseId },
        data: { lessonCount: { decrement: 1 } },
      }),
    ]);

    // Recalculate progress for affected enrollments if course was published
    if (course?.status === CourseStatus.PUBLISHED) {
      this.logger.log(
        `Lesson "${lessonId}" deleted from published course "${lesson.courseId}" — recalculating progress`,
      );
      await this.courseVersionService.recalculateProgressAfterLessonDeletion(
        lesson.courseId,
        lessonId,
      );
    }
  }

  async reorder(courseId: string, lessonIds: string[]) {
    await this.assertCourseExists(courseId);

    const updates = lessonIds.map((id, index) =>
      this.prisma.lesson.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);
  }

  async findByCourse(courseId: string) {
    await this.assertCourseExists(courseId);

    return this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async assertCourseExists(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }
    return course;
  }

  private async assertLessonExists(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${lessonId}" not found`);
    }
    return lesson;
  }
}
