import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CourseStatus } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublished() {
    Logger.log('test')
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
}
