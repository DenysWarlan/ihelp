import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '@org/prisma-client';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ACCEPT_REQUEST_ROLES, CREATE_MEETING_ROLES, ELEVATED_ROLES } from './meetings.const.js';
import {
  CancelMeetingDto,
  CreateMeetingDto,
  MeetingResponse,
  RequestMeetingDto,
} from './meetings.model.js';
import { MeetingsService } from './meetings.service.js';

@ApiTags('meetings')
@ApiBearerAuth()
@Controller()
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('meetings')
  @Roles(...CREATE_MEETING_ROLES)
  @ApiOperation({ summary: 'Create a meeting linked to a care case' })
  @ApiResponse({ status: 201, description: 'Meeting created' })
  @ApiResponse({ status: 400, description: 'Validation error or past date' })
  @ApiConflictResponse({ description: 'Time slot overlaps with existing meeting' })
  @ApiNotFoundResponse({ description: 'Care case not found' })
  async create(
    @Body() dto: CreateMeetingDto,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.create(dto, actor.sub, actor.role);
  }

  @Post('meetings/request')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Request a meeting with the assigned consultant' })
  @ApiResponse({ status: 201, description: 'Meeting request created (status REQUESTED)' })
  @ApiResponse({ status: 400, description: 'Validation error, past date, or no consultant assigned' })
  @ApiNotFoundResponse({ description: 'Care case not found' })
  async request(
    @Body() dto: RequestMeetingDto,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.requestByPerson(dto, actor.sub);
  }

  @Get('cases/:caseId/meetings')
  @ApiOperation({ summary: 'List meetings for a specific care case' })
  @ApiResponse({ status: 200, description: 'List of meetings for the case' })
  @ApiNotFoundResponse({ description: 'Case not found or access denied' })
  async findByCaseId(
    @Param('caseId', ParseUuidPipe) caseId: string,
    @Req() req: Request,
  ): Promise<MeetingResponse[]> {
    const actor = req.user as JwtPayload;
    await this.validateCaseAccess(caseId, actor);
    return this.meetingsService.findByCaseId(caseId);
  }

  @Get('meetings/my')
  @Roles(...CREATE_MEETING_ROLES)
  @ApiOperation({ summary: "List the consultant's own meetings" })
  @ApiResponse({ status: 200, description: "Consultant's meetings" })
  @ApiQuery({ name: 'from', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Filter to date (ISO 8601)' })
  async findMyMeetings(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<MeetingResponse[]> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.findByConsultant(actor.sub, from, to);
  }

  @Get('meetings/person/my')
  @Roles('PERSON')
  @ApiOperation({ summary: "List the person's own meetings" })
  @ApiResponse({ status: 200, description: "Person's meetings" })
  @ApiQuery({ name: 'from', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Filter to date (ISO 8601)' })
  async findPersonMeetings(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<MeetingResponse[]> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.findByPerson(actor.sub, from, to);
  }

  @Get('meetings/:id')
  @ApiOperation({ summary: 'Get a single meeting by ID' })
  @ApiResponse({ status: 200, description: 'Meeting details' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async findById(
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<MeetingResponse> {
    return this.meetingsService.findById(id);
  }

  @Patch('meetings/:id/cancel')
  @Roles(...CREATE_MEETING_ROLES)
  @ApiOperation({ summary: 'Cancel a meeting' })
  @ApiResponse({ status: 200, description: 'Meeting cancelled' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be cancelled' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async cancel(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CancelMeetingDto,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.cancel(id, dto, actor.sub);
  }

  @Patch('meetings/:id/confirm')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Person confirms a consultant-scheduled meeting' })
  @ApiResponse({ status: 200, description: 'Meeting confirmed' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be confirmed' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async confirm(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.confirmByPerson(id, actor.sub);
  }

  @Patch('meetings/:id/accept')
  @Roles(...ACCEPT_REQUEST_ROLES)
  @ApiOperation({ summary: "Accept a person's meeting request" })
  @ApiResponse({ status: 200, description: 'Request accepted (status CONFIRMED)' })
  @ApiResponse({ status: 400, description: 'Request cannot be accepted' })
  @ApiConflictResponse({ description: 'Proposed time overlaps with an existing meeting' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async accept(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.acceptRequest(id, actor.sub, actor.role);
  }

  @Patch('meetings/:id/decline')
  @Roles(...ACCEPT_REQUEST_ROLES)
  @ApiOperation({ summary: "Decline a person's meeting request" })
  @ApiResponse({ status: 200, description: 'Request declined (status CANCELLED)' })
  @ApiResponse({ status: 400, description: 'Request cannot be declined' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async decline(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CancelMeetingDto,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.declineRequest(id, dto, actor.sub, actor.role);
  }

  @Patch('meetings/:id/complete')
  @Roles(...CREATE_MEETING_ROLES)
  @ApiOperation({ summary: 'Mark a meeting as completed' })
  @ApiResponse({ status: 200, description: 'Meeting completed' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async complete(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<MeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.meetingsService.complete(id, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async validateCaseAccess(
    caseId: string,
    actor: JwtPayload,
  ): Promise<void> {
    // Elevated roles can access any case's meetings
    if ((ELEVATED_ROLES as readonly string[]).includes(actor.role)) {
      return;
    }

    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { consultantId: true, personId: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    if (actor.role === 'CONSULTANT' && careCase.consultantId !== actor.sub) {
      throw new NotFoundException('Case not found');
    }

    if (actor.role === 'PERSON' && careCase.personId !== actor.sub) {
      throw new NotFoundException('Case not found');
    }
  }
}
