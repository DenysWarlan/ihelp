import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../../auth/auth.model.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CreateFeedbackDto, FeedbackResponse } from './feedback.model.js';
import { FeedbackService } from './feedback.service.js';

/** Roles that can view feedback. */
const FEEDBACK_VIEW_ROLES = ['SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

@ApiTags('case-feedback')
@ApiBearerAuth()
@Controller('cases/:caseId/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit feedback for a completed case (person only)' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  @ApiResponse({ status: 400, description: 'Only the case person can submit feedback' })
  @ApiConflictResponse({ description: 'Feedback already submitted' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async create(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateFeedbackDto,
    @Req() req: Request,
  ): Promise<FeedbackResponse> {
    const actor = req.user as JwtPayload;
    return this.feedbackService.create(caseId, dto, actor);
  }

  @Get()
  @Roles(...FEEDBACK_VIEW_ROLES)
  @ApiOperation({ summary: 'Get feedback for a case (staff only)' })
  @ApiResponse({ status: 200, description: 'Feedback details' })
  @ApiNotFoundResponse({ description: 'Feedback not found' })
  async findOne(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<FeedbackResponse> {
    return this.feedbackService.findOne(caseId);
  }
}
