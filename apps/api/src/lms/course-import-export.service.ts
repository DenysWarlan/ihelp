import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@org/prisma-client';
import { LessonContentType } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';

import {
  CourseExportBundleDto,
  CourseImportResultDto,
  AsyncExportResponseDto,
} from './dto/course-import-export.dto.js';
import {
  COURSE_EXPORT_QUEUE,
  EXPORT_ASYNC_THRESHOLD,
  IMPORT_MAX_LESSONS,
  JOB_COURSE_EXPORT,
} from './lms.const.js';

/** Current export format version. */
const EXPORT_FORMAT_VERSION = 1;

/** Valid LessonContentType values for import validation. */
const VALID_CONTENT_TYPES = Object.values(LessonContentType);

@Injectable()
export class CourseImportExportService {
  private readonly logger = new Logger(CourseImportExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(COURSE_EXPORT_QUEUE) private readonly exportQueue: Queue,
  ) {}

  // ── Export ────────────────────────────────────────────────

  async exportCourse(
    courseId: string,
  ): Promise<CourseExportBundleDto | AsyncExportResponseDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    // For large courses, process asynchronously
    if (course.lessons.length > EXPORT_ASYNC_THRESHOLD) {
      const job = await this.exportQueue.add(JOB_COURSE_EXPORT, { courseId });
      this.logger.log(
        `Large course "${course.title}" (${course.lessons.length} lessons) — ` +
          `export queued as job ${job.id}`,
      );
      return {
        async: true,
        jobId: job.id,
        message:
          'Course has many lessons. Export is being processed in the background. ' +
          'The result will be available via the export job status endpoint.',
      } as AsyncExportResponseDto;
    }

    return this.buildExportBundle(course);
  }

  /** Build the export bundle synchronously (also used by the processor). */
  async buildExportBundleById(
    courseId: string,
  ): Promise<CourseExportBundleDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with id "${courseId}" not found`);
    }

    return this.buildExportBundle(course);
  }

  // ── Import ────────────────────────────────────────────────

  async importCourse(raw: unknown): Promise<CourseImportResultDto> {
    const bundle = this.validateAndSanitize(raw);

    const course = await this.prisma.course.create({
      data: {
        title: bundle.title,
        description: bundle.description,
        language: bundle.language ?? null,
        tags: bundle.tags ?? [],
        imageUrl: bundle.imageUrl ?? null,
        lessonCount: bundle.lessons.length,
        // Always imported as DRAFT
      },
    });

    if (bundle.lessons.length > 0) {
      await this.prisma.lesson.createMany({
        data: bundle.lessons.map((l, idx) => ({
          courseId: course.id,
          title: l.title,
          content: l.content,
          contentType: l.contentType as LessonContentType,
          videoUrl: l.videoUrl ?? null,
          sortOrder: l.sortOrder ?? idx,
          hasTriggerWarning: l.hasTriggerWarning ?? false,
        })),
      });
    }

    this.logger.log(
      `Imported course "${bundle.title}" as DRAFT with ${bundle.lessons.length} lesson(s). ` +
        `New course ID: ${course.id}`,
    );

    return {
      courseId: course.id,
      lessonCount: bundle.lessons.length,
    };
  }

  // ── Private helpers ───────────────────────────────────────

  private buildExportBundle(
    course: {
      title: string;
      description: string;
      language: string | null;
      tags: string[];
      imageUrl: string | null;
      lessons: Array<{
        title: string;
        content: string;
        contentType: string;
        videoUrl: string | null;
        sortOrder: number;
        hasTriggerWarning: boolean;
      }>;
    },
  ): CourseExportBundleDto {
    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      title: course.title,
      description: course.description,
      language: course.language,
      tags: course.tags,
      imageUrl: course.imageUrl,
      lessons: course.lessons.map((l) => ({
        title: l.title,
        content: l.content,
        contentType: l.contentType,
        videoUrl: l.videoUrl,
        sortOrder: l.sortOrder,
        hasTriggerWarning: l.hasTriggerWarning,
      })),
      exportedAt: new Date().toISOString(),
    };
  }

  private validateAndSanitize(raw: unknown): {
    title: string;
    description: string;
    language: string | null;
    tags: string[];
    imageUrl: string | null;
    lessons: Array<{
      title: string;
      content: string;
      contentType: string;
      videoUrl: string | null;
      sortOrder: number;
      hasTriggerWarning: boolean;
    }>;
  } {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Invalid import bundle: must be a JSON object');
    }

    const bundle = raw as Record<string, unknown>;

    // Validate required fields
    if (!bundle['title'] || typeof bundle['title'] !== 'string') {
      throw new BadRequestException('Invalid import bundle: "title" is required and must be a string');
    }
    if (!bundle['description'] || typeof bundle['description'] !== 'string') {
      throw new BadRequestException('Invalid import bundle: "description" is required and must be a string');
    }

    // Validate lessons array
    if (!Array.isArray(bundle['lessons'])) {
      throw new BadRequestException('Invalid import bundle: "lessons" must be an array');
    }

    if (bundle['lessons'].length > IMPORT_MAX_LESSONS) {
      throw new BadRequestException(
        `Import bundle exceeds maximum lesson count (${IMPORT_MAX_LESSONS})`,
      );
    }

    // Sanitize and validate each lesson
    const lessons = (bundle['lessons'] as unknown[]).map(
      (item: unknown, idx: number) => {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(
            `Invalid lesson at index ${idx}: must be an object`,
          );
        }

        const lesson = item as Record<string, unknown>;

        if (!lesson['title'] || typeof lesson['title'] !== 'string') {
          throw new BadRequestException(
            `Invalid lesson at index ${idx}: "title" is required`,
          );
        }

        if (typeof lesson['content'] !== 'string') {
          throw new BadRequestException(
            `Invalid lesson at index ${idx}: "content" must be a string`,
          );
        }

        const contentType =
          typeof lesson['contentType'] === 'string' ? lesson['contentType'] : 'TEXT';

        if (!VALID_CONTENT_TYPES.includes(contentType as LessonContentType)) {
          throw new BadRequestException(
            `Invalid lesson at index ${idx}: "contentType" must be one of ${VALID_CONTENT_TYPES.join(', ')}`,
          );
        }

        return {
          title: DOMPurify.sanitize(lesson['title'] as string),
          content: DOMPurify.sanitize(lesson['content'] as string),
          contentType,
          videoUrl:
            typeof lesson['videoUrl'] === 'string'
              ? DOMPurify.sanitize(lesson['videoUrl'] as string)
              : null,
          sortOrder: typeof lesson['sortOrder'] === 'number' ? lesson['sortOrder'] : idx,
          hasTriggerWarning: lesson['hasTriggerWarning'] === true,
        };
      },
    );

    // Sanitize course-level fields
    const tags = Array.isArray(bundle['tags'])
      ? (bundle['tags'] as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .map((t) => DOMPurify.sanitize(t))
      : [];

    return {
      title: DOMPurify.sanitize(bundle['title'] as string),
      description: DOMPurify.sanitize(bundle['description'] as string),
      language:
        typeof bundle['language'] === 'string'
          ? DOMPurify.sanitize(bundle['language'] as string)
          : null,
      tags,
      imageUrl:
        typeof bundle['imageUrl'] === 'string'
          ? DOMPurify.sanitize(bundle['imageUrl'] as string)
          : null,
      lessons,
    };
  }
}
