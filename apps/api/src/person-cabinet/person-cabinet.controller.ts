import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  PersonConversationDto,
  PersonCoursesResponse,
  PersonDashboardResponse,
  PersonMeetingDto,
  PersonProfileResponse,
  UpdateProfileDto,
} from './person-cabinet.model.js';
import { PersonCabinetService } from './person-cabinet.service.js';

@ApiTags('person-cabinet')
@ApiBearerAuth()
@Controller('person-cabinet')
export class PersonCabinetController {
  constructor(private readonly cabinetService: PersonCabinetService) {}

  @Get('dashboard')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Get person dashboard with case, meeting & courses' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — PERSON role required' })
  async getDashboard(
    @Req() req: Request,
  ): Promise<PersonDashboardResponse> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.getDashboard(actor.sub);
  }

  @Get('courses')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Get person courses (active + recommended)' })
  @ApiResponse({ status: 200, description: 'Active and recommended courses' })
  async getCourses(
    @Req() req: Request,
  ): Promise<PersonCoursesResponse> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.getCourses(actor.sub);
  }

  @Get('profile')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Get person profile and settings' })
  @ApiResponse({ status: 200, description: 'Profile data' })
  async getProfile(
    @Req() req: Request,
  ): Promise<PersonProfileResponse> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.getProfile(actor.sub);
  }

  @Patch('profile')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Update person profile (name, timezone)' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<PersonProfileResponse> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.updateProfile(actor.sub, dto);
  }

  @Get('meetings')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Get upcoming meetings for person' })
  @ApiResponse({ status: 200, description: 'List of upcoming meetings' })
  async getMeetings(
    @Req() req: Request,
  ): Promise<PersonMeetingDto[]> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.getUpcomingMeetings(actor.sub);
  }

  @Get('conversations')
  @Roles('PERSON')
  @ApiOperation({ summary: 'Get active chat conversations for person' })
  @ApiResponse({ status: 200, description: 'List of conversations (active care cases)' })
  async getConversations(
    @Req() req: Request,
  ): Promise<PersonConversationDto[]> {
    const actor = req.user as JwtPayload;
    return this.cabinetService.getConversations(actor.sub);
  }
}
