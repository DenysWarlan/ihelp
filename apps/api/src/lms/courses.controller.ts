import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { CoursesService } from './courses.service.js';
import { CourseListItemDto, CourseDetailDto } from './dto/course.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@ApiTags('courses')
@Public()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List all published courses' })
  @ApiOkResponse({ type: [CourseListItemDto], description: 'List of published courses' })
  async findAll(): Promise<CourseListItemDto[]> {
    return this.coursesService.findAllPublished();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get published course detail with lessons' })
  @ApiOkResponse({ type: CourseDetailDto, description: 'Course detail with lessons' })
  @ApiNotFoundResponse({ description: 'Course not found or not published' })
  async findOne(@Param('id') id: string): Promise<CourseDetailDto> {
    return this.coursesService.findOnePublished(id);
  }
}
