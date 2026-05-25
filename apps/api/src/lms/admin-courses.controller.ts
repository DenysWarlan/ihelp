import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CoursesService } from './courses.service.js';
import { LessonsService } from './lessons.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto.js';

@ApiTags('admin/courses')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
  ) {}

  // ── Course CRUD ────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new course (DRAFT)' })
  @ApiCreatedResponse({ description: 'Course created' })
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all courses (any status)' })
  @ApiOkResponse({ description: 'List of all courses' })
  async findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail (any status)' })
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

  @Patch('lessons/:lessonId')
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiOkResponse({ description: 'Lesson updated' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  async updateLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiOkResponse({ description: 'Lesson deleted' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  async deleteLesson(@Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.lessonsService.delete(lessonId);
  }

  @Post(':id/lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons within a course' })
  @ApiOkResponse({ description: 'Lessons reordered' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  async reorderLessons(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(courseId, dto.lessonIds);
  }
}
