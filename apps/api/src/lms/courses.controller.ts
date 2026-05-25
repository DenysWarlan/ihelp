import { Controller, Get, Post, Param, Req, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CoursesService } from './courses.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { CourseListItemDto, CourseDetailDto } from './dto/course.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { JwtPayload } from '../auth/auth.model.js';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all published courses' })
  @ApiOkResponse({ type: [CourseListItemDto], description: 'List of published courses' })
  async findAll(): Promise<CourseListItemDto[]> {
    return this.coursesService.findAllPublished();
  }

  @Get('my-enrollments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List courses the current user is enrolled in' })
  @ApiOkResponse({ description: 'List of enrollments with course details' })
  async getMyEnrollments(@Req() req: Request) {
    const actor = req.user as JwtPayload;
    return this.enrollmentService.getMyEnrollments(actor.sub);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get published course detail with lessons' })
  @ApiOkResponse({ type: CourseDetailDto, description: 'Course detail with lessons' })
  @ApiNotFoundResponse({ description: 'Course not found or not published' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CourseDetailDto> {
    return this.coursesService.findOnePublished(id);
  }

  @Post(':id/enroll')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enroll in a published course' })
  @ApiCreatedResponse({ description: 'Successfully enrolled' })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiBadRequestResponse({ description: 'Course is not available for enrollment' })
  @ApiConflictResponse({ description: 'Already enrolled in this course' })
  async enroll(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.enrollmentService.enroll(courseId, actor.sub);
  }
}
