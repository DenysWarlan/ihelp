import {
  Controller,
  Get,
  Post,
  Param,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ProgressService } from './progress.service.js';
import { StrugglingService } from './struggling.service.js';
import { JwtPayload } from '../auth/auth.model.js';
import {
  CourseProgressDto,
  StrugglingResponseDto,
  ProgressResetResponseDto,
} from './dto/progress.dto.js';

@ApiTags('lms-progress')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly strugglingService: StrugglingService,
  ) {}

  // ── Lesson completion ──────────────────────────────────────

  @Post('lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Mark a lesson as completed' })
  @ApiCreatedResponse({ description: 'Lesson marked as completed' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  @ApiBadRequestResponse({ description: 'Not enrolled or enrollment not active' })
  async completeLesson(
    @Param('lessonId', ParseUuidPipe) lessonId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.progressService.completeLesson(actor.sub, lessonId);
  }

  // ── Lesson skip (trigger warning) ─────────────────────────

  @Post('lessons/:lessonId/skip')
  @ApiOperation({ summary: 'Skip a lesson (trigger warning)' })
  @ApiCreatedResponse({ description: 'Lesson skipped' })
  @ApiNotFoundResponse({ description: 'Lesson not found' })
  @ApiBadRequestResponse({ description: 'Not enrolled or enrollment not active' })
  async skipLesson(
    @Param('lessonId', ParseUuidPipe) lessonId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.progressService.skipLesson(actor.sub, lessonId);
  }

  // ── Get progress for an enrollment ────────────────────────

  @Get('enrollments/:enrollmentId/progress')
  @ApiOperation({ summary: 'Get progress for a specific enrollment' })
  @ApiOkResponse({ type: CourseProgressDto, description: 'Course progress with lesson details' })
  @ApiNotFoundResponse({ description: 'Enrollment not found' })
  async getProgress(
    @Param('enrollmentId', ParseUuidPipe) enrollmentId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.progressService.getProgress(actor.sub, enrollmentId);
  }

  // ── Reset progress ────────────────────────────────────────

  @Post('enrollments/:enrollmentId/reset')
  @ApiOperation({ summary: 'Reset progress for an enrollment (max 3 per course)' })
  @ApiCreatedResponse({ type: ProgressResetResponseDto, description: 'Progress reset successfully' })
  @ApiNotFoundResponse({ description: 'Enrollment not found' })
  @ApiBadRequestResponse({ description: 'Max resets reached or enrollment dropped' })
  async resetProgress(
    @Param('enrollmentId', ParseUuidPipe) enrollmentId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.progressService.resetProgress(actor.sub, enrollmentId);
  }

  // ── Drop enrollment (leave course) ────────────────────────

  @Post('enrollments/:enrollmentId/drop')
  @ApiOperation({ summary: 'Leave a course (status changes to DROPPED)' })
  @ApiCreatedResponse({ description: 'Enrollment dropped' })
  @ApiNotFoundResponse({ description: 'Enrollment not found' })
  @ApiBadRequestResponse({ description: 'Already dropped' })
  async dropEnrollment(
    @Param('enrollmentId', ParseUuidPipe) enrollmentId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.progressService.dropEnrollment(actor.sub, enrollmentId);
  }

  // ── "I'm struggling" button ───────────────────────────────

  @Post('courses/:courseId/lessons/:lessonId/struggling')
  @ApiOperation({ summary: '"I\'m struggling" — create or return existing care case' })
  @ApiCreatedResponse({ type: StrugglingResponseDto, description: 'Care case created or existing returned' })
  @ApiNotFoundResponse({ description: 'Course or lesson not found' })
  @ApiBadRequestResponse({ description: 'Not enrolled or lesson does not belong to course' })
  async struggling(
    @Param('courseId', ParseUuidPipe) courseId: string,
    @Param('lessonId', ParseUuidPipe) lessonId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.strugglingService.handleStruggling(actor.sub, courseId, lessonId);
  }
}
