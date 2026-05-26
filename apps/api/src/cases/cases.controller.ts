import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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

import { JwtPayload } from '../auth/auth.model.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ASSIGN_ROLES } from './cases.const.js';
import {
  AssignConsultantDto,
  CaseResponse,
  ChangeStatusDto,
  CreateCaseDto,
} from './cases.model.js';
import { CasesService } from './cases.service.js';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a care case from intake form' })
  @ApiResponse({ status: 201, description: 'Case created' })
  @ApiResponse({ status: 400, description: 'Validation or GDPR consent error' })
  @ApiConflictResponse({ description: 'Person already has an active case' })
  async create(
    @Body() dto: CreateCaseDto,
    @Req() req: Request,
  ): Promise<CaseResponse> {
    const actor = (req.user as JwtPayload) ?? undefined;
    return this.casesService.create(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List cases (filtered by role, optionally by tag)' })
  @ApiResponse({ status: 200, description: 'List of cases' })
  @ApiQuery({ name: 'tagId', required: false, description: 'Filter by tag ID' })
  async findAll(
    @Req() req: Request,
    @Query('tagId') tagId?: string,
  ): Promise<CaseResponse[]> {
    const actor = req.user as JwtPayload;
    return this.casesService.findAll(actor, tagId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get staff dashboard stats' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getDashboard(@Req() req: Request) {
    const actor = req.user as JwtPayload;
    return this.casesService.getDashboard(actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single case with relations' })
  @ApiResponse({ status: 200, description: 'Case details' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<CaseResponse> {
    const actor = req.user as JwtPayload;
    return this.casesService.findOne(id, actor);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change case status (state machine)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiConflictResponse({ description: 'Version mismatch' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<CaseResponse> {
    const actor = req.user as JwtPayload;
    return this.casesService.changeStatus(id, dto, actor);
  }

  @Post(':id/assign')
  @Roles(...ASSIGN_ROLES)
  @ApiOperation({ summary: 'Assign a consultant to a case' })
  @ApiResponse({ status: 201, description: 'Consultant assigned' })
  @ApiConflictResponse({ description: 'Version mismatch' })
  @ApiNotFoundResponse({ description: 'Case or consultant not found' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignConsultantDto,
    @Req() req: Request,
  ): Promise<CaseResponse> {
    const actor = req.user as JwtPayload;
    return this.casesService.assignConsultant(id, dto, actor);
  }
}
