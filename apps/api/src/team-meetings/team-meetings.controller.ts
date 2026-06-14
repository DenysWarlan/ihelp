import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import { STAFF_ROLES } from './team-meetings.const.js';
import {
  CancelTeamMeetingDto,
  CreateTeamMeetingDto,
  RespondTeamMeetingDto,
  StaffUserResponse,
  TeamMeetingResponse,
} from './team-meetings.model.js';
import { TeamMeetingsService } from './team-meetings.service.js';

@ApiTags('team-meetings')
@ApiBearerAuth()
@Controller('team-meetings')
export class TeamMeetingsController {
  constructor(private readonly teamMeetingsService: TeamMeetingsService) {}

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create an internal staff / group meeting' })
  @ApiResponse({ status: 201, description: 'Team meeting created' })
  @ApiResponse({ status: 400, description: 'Validation error, past date, or invalid participants' })
  async create(
    @Body() dto: CreateTeamMeetingDto,
    @Req() req: Request,
  ): Promise<TeamMeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.create(dto, actor.sub);
  }

  @Get('my')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List team meetings the user organizes or is invited to' })
  @ApiResponse({ status: 200, description: 'Team meetings for the user' })
  async findMine(@Req() req: Request): Promise<TeamMeetingResponse[]> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.findMine(actor.sub);
  }

  @Get('staff')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List active staff users that can be invited' })
  @ApiResponse({ status: 200, description: 'List of staff users (excluding the requester)' })
  async listStaff(@Req() req: Request): Promise<StaffUserResponse[]> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.listStaff(actor.sub);
  }

  @Patch(':id/respond')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Accept or decline a team meeting invitation' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  @ApiResponse({ status: 400, description: 'Meeting is not open for responses' })
  @ApiForbiddenResponse({ description: 'You are not invited to this meeting' })
  @ApiNotFoundResponse({ description: 'Team meeting not found' })
  async respond(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: RespondTeamMeetingDto,
    @Req() req: Request,
  ): Promise<TeamMeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.respond(id, actor.sub, dto.status);
  }

  @Patch(':id/cancel')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Cancel a team meeting (organizer only)' })
  @ApiResponse({ status: 200, description: 'Team meeting cancelled' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be cancelled' })
  @ApiForbiddenResponse({ description: 'Only the organizer can cancel' })
  @ApiNotFoundResponse({ description: 'Team meeting not found' })
  async cancel(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CancelTeamMeetingDto,
    @Req() req: Request,
  ): Promise<TeamMeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.cancel(id, actor.sub, dto);
  }

  @Patch(':id/complete')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Mark a team meeting as completed (organizer only)' })
  @ApiResponse({ status: 200, description: 'Team meeting completed' })
  @ApiResponse({ status: 400, description: 'Meeting cannot be completed' })
  @ApiForbiddenResponse({ description: 'Only the organizer can complete' })
  @ApiNotFoundResponse({ description: 'Team meeting not found' })
  async complete(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<TeamMeetingResponse> {
    const actor = req.user as JwtPayload;
    return this.teamMeetingsService.complete(id, actor.sub);
  }
}
