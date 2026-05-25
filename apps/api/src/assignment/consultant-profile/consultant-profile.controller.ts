import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator.js';
import {
  ConsultantProfileResponse,
  CreateConsultantProfileDto,
  UpdateConsultantProfileDto,
} from './consultant-profile.model.js';
import { ConsultantProfileService } from './consultant-profile.service.js';

@ApiTags('consultant-profiles')
@ApiBearerAuth()
@Controller('consultant-profiles')
export class ConsultantProfileController {
  constructor(
    private readonly consultantProfileService: ConsultantProfileService,
  ) {}

  @Get()
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'List all consultant profiles' })
  @ApiResponse({ status: 200, description: 'List of consultant profiles' })
  async findAll(): Promise<ConsultantProfileResponse[]> {
    return this.consultantProfileService.findAll();
  }

  @Get(':userId')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get consultant profile by user ID' })
  @ApiResponse({ status: 200, description: 'Consultant profile' })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  async findByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ConsultantProfileResponse> {
    return this.consultantProfileService.findByUserId(userId);
  }

  @Post()
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a consultant profile for a user' })
  @ApiResponse({ status: 201, description: 'Profile created' })
  @ApiConflictResponse({ description: 'Profile already exists for this user' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async create(
    @Body() dto: CreateConsultantProfileDto,
  ): Promise<ConsultantProfileResponse> {
    return this.consultantProfileService.create(dto);
  }

  @Patch(':userId')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Update consultant profile (specializations, languages, maxCases, status)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiNotFoundResponse({ description: 'Profile not found' })
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateConsultantProfileDto,
  ): Promise<ConsultantProfileResponse> {
    return this.consultantProfileService.update(userId, dto);
  }
}
