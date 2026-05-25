import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PersonDashboardResponse } from './person-cabinet.model.js';
import { PersonCabinetService } from './person-cabinet.service.js';

@ApiTags('person-cabinet')
@ApiBearerAuth()
@Controller('my')
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
}
