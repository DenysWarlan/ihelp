import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { CourseVersionService } from './course-version.service.js';
import { CourseImportExportService } from './course-import-export.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto.js';
import { PublishVersionDto } from './dto/course-version.dto.js';
import { IMPORT_MAX_FILE_SIZE_BYTES } from './lms.const.js';

@ApiTags('admin/courses')
@ApiBearerAuth()
@Roles('ADMIN', 'COORDINATOR')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
    private readonly courseVersionService: CourseVersionService,
    private readonly importExportService: CourseImportExportService,
  ) {}

  // ── Course CRUD ────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new course (DRAFT)' })
  @ApiCreatedResponse({ description: 'Course created' })
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all courses (with optional filters and pagination)' })
  @ApiOkResponse({ description: 'Paginated list of courses' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by course status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by title' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of records to take' })
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.coursesService.findAllAdmin({
      status,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail (any status) with lessons' })
  @ApiOkResponse({ description: 'Course detail with lessons' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update course fields' })
  @ApiOkResponse({ description: 'Course updated' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete course (archive with grace period)' })
  @ApiOkResponse({ description: 'Course archived' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiBadRequestResponse({ description: 'Cannot archive from current status' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.softDelete(id);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Change course status (state machine)' })
  @ApiOkResponse({ description: 'Course status changed' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiBadRequestResponse({ description: 'Invalid transition or prerequisites not met' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.coursesService.changeStatus(id, dto);
  }

  // ── Lesson CRUD ────────────────────────────────────────────

  @Post(':id/lessons')
  @ApiOperation({ summary: 'Create a lesson for a course' })
  @ApiCreatedResponse({ description: 'Lesson created' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async createLesson(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(courseId, dto);
  }

  @Get(':id/lessons')
  @ApiOperation({ summary: 'List lessons for a course' })
  @ApiOkResponse({ description: 'List of lessons ordered by sortOrder' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async findLessons(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.lessonsService.findByCourse(courseId);
  }

  @Patch(':id/lessons/:lessonId')
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiOkResponse({ description: 'Lesson updated' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  async updateLesson(
    @Param('id', ParseUUIDPipe) _courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(lessonId, dto);
  }

  @Delete(':id/lessons/:lessonId')
  @ApiOperation({ summary: 'Delete a lesson (recalculates progress for published courses)' })
  @ApiOkResponse({ description: 'Lesson deleted' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  async deleteLesson(
    @Param('id', ParseUUIDPipe) _courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.lessonsService.delete(lessonId);
  }

  @Patch(':id/lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons within a course' })
  @ApiOkResponse({ description: 'Lessons reordered' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async reorderLessons(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(courseId, dto.lessonIds);
  }

  // ── Versioning (S-E04-09) ─────────────────────────────────

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a new course version (snapshot current lessons)' })
  @ApiCreatedResponse({ description: 'Version published' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiBadRequestResponse({ description: 'Course is not in PUBLISHED status' })
  async publishVersion(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: PublishVersionDto,
  ) {
    return this.courseVersionService.publishVersion(courseId, dto.changelog);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions for a course' })
  @ApiOkResponse({ description: 'List of versions' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async listVersions(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.courseVersionService.listVersions(courseId);
  }

  @Get(':id/versions/:versionNum')
  @ApiOperation({ summary: 'Get specific version details' })
  @ApiOkResponse({ description: 'Version detail' })
  @ApiNotFoundResponse({ description: 'Version not found' })
  async getVersion(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Param('versionNum', ParseIntPipe) versionNum: number,
  ) {
    return this.courseVersionService.getVersion(courseId, versionNum);
  }

  @Post(':id/force-update-enrollments')
  @ApiOperation({ summary: 'Force-update all active enrollments to latest version' })
  @ApiOkResponse({ description: 'Enrollments updated' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiBadRequestResponse({ description: 'No versions exist or grace period active' })
  async forceUpdateEnrollments(
    @Param('id', ParseUUIDPipe) courseId: string,
  ) {
    return this.courseVersionService.forceUpdateEnrollments(courseId);
  }

  // ── Import / Export (S-E04-10) ────────────────────────────

  @Post('import')
  @ApiOperation({ summary: 'Import a course from a JSON bundle (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JSON file containing the course bundle',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Course imported as DRAFT' })
  @ApiBadRequestResponse({ description: 'Invalid import bundle' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MAX_FILE_SIZE_BYTES },
    }),
  )
  async importCourse(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Uploaded file is not valid JSON');
    }

    return this.importExportService.importCourse(parsed);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export course as JSON bundle' })
  @ApiOkResponse({ description: 'Course export bundle or async job reference' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async exportCourse(@Param('id', ParseUUIDPipe) courseId: string) {
    return this.importExportService.exportCourse(courseId);
  }
}
