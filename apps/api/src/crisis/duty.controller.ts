import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';

import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  CreateDutyScheduleDto,
  DutyGap,
  DutyScheduleResponse,
  UpdateDutyScheduleDto,
} from './crisis.model.js';
import { DutyService } from './duty.service.js';

// ===========================================================================
// S-E08-07/08: Duty Schedule Management
// ===========================================================================

@ApiTags('duty')
@ApiBearerAuth()
@Controller('crisis/duty')
export class DutyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dutyService: DutyService,
  ) {}

  @Get('schedules')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'List all duty schedules' })
  @ApiOkResponse({ description: 'List of duty schedules' })
  async listSchedules(): Promise<DutyScheduleResponse[]> {
    return this.prisma.dutySchedule.findMany({
      orderBy: { startTime: 'asc' },
    });
  }

  @Get('schedules/current')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get the currently active duty schedule' })
  @ApiOkResponse({ description: 'Current duty schedule or null' })
  async getCurrentSchedule(): Promise<DutyScheduleResponse | null> {
    const now = new Date();
    return this.prisma.dutySchedule.findFirst({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  @Post('schedules')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a duty schedule entry' })
  @ApiResponse({ status: 201, description: 'Schedule created' })
  async createSchedule(
    @Body() dto: CreateDutyScheduleDto,
  ): Promise<DutyScheduleResponse> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    return this.prisma.dutySchedule.create({
      data: {
        userId: dto.userId,
        startTime,
        endTime,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch('schedules/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a duty schedule entry' })
  @ApiOkResponse({ description: 'Schedule updated' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDutyScheduleDto,
  ): Promise<DutyScheduleResponse> {
    const existing = await this.prisma.dutySchedule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Duty schedule ${id} not found`);
    }

    const startTime = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    return this.prisma.dutySchedule.update({
      where: { id },
      data: {
        ...(dto.userId !== undefined && { userId: dto.userId }),
        ...(dto.startTime !== undefined && { startTime }),
        ...(dto.endTime !== undefined && { endTime }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  @Delete('schedules/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a duty schedule entry' })
  @ApiOkResponse({ description: 'Schedule deleted' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async deleteSchedule(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.dutySchedule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Duty schedule ${id} not found`);
    }

    await this.prisma.dutySchedule.delete({ where: { id } });

    return { deleted: true };
  }

  @Get('gaps')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Check for duty schedule gaps in the next 48 hours',
    description: 'Returns gaps in off-hours duty coverage for the next 48 hours.',
  })
  @ApiOkResponse({ description: 'List of duty gaps (empty = full coverage)' })
  async checkGaps(): Promise<DutyGap[]> {
    return this.dutyService.checkDutyGaps();
  }
}
