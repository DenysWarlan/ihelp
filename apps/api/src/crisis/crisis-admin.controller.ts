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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { MIN_KEYWORD_COUNT, MVP_NOTIFICATION_PREFIX } from './crisis.const.js';
import {
  CreateCrisisAutoReplyDto,
  CreateCrisisKeywordDto,
  CrisisAutoReplyResponse,
  CrisisKeywordResponse,
  UpdateCrisisAutoReplyDto,
  UpdateCrisisKeywordDto,
} from './crisis.model.js';
import { CrisisService } from './crisis.service.js';

// ===========================================================================
// S-E08-06: Admin CRUD for Crisis Keywords and Auto-Reply Templates
// ===========================================================================

@ApiTags('crisis-admin')
@ApiBearerAuth()
@Controller('crisis/admin')
export class CrisisAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crisisService: CrisisService,
  ) {}

  // ---------------------------------------------------------------------------
  // Keywords
  // ---------------------------------------------------------------------------

  @Get('keywords')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all crisis keywords' })
  @ApiOkResponse({ description: 'List of crisis keywords' })
  async listKeywords(): Promise<CrisisKeywordResponse[]> {
    return this.prisma.crisisKeyword.findMany({
      orderBy: [{ riskLevel: 'desc' }, { language: 'asc' }, { keyword: 'asc' }],
    });
  }

  @Post('keywords')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a crisis keyword' })
  @ApiResponse({ status: 201, description: 'Keyword created' })
  @ApiConflictResponse({ description: 'Keyword already exists for this language' })
  async createKeyword(
    @Body() dto: CreateCrisisKeywordDto,
  ): Promise<CrisisKeywordResponse> {
    const keyword = await this.prisma.crisisKeyword.create({
      data: {
        keyword: dto.keyword,
        language: dto.language ?? 'uk',
        riskLevel: dto.riskLevel ?? 'HIGH',
        isActive: dto.isActive ?? true,
      },
    });

    await this.crisisService.refreshKeywordCache();

    return keyword;
  }

  @Patch('keywords/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a crisis keyword' })
  @ApiOkResponse({ description: 'Keyword updated' })
  @ApiNotFoundResponse({ description: 'Keyword not found' })
  async updateKeyword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrisisKeywordDto,
  ): Promise<CrisisKeywordResponse> {
    const existing = await this.prisma.crisisKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Crisis keyword ${id} not found`);
    }

    const keyword = await this.prisma.crisisKeyword.update({
      where: { id },
      data: {
        ...(dto.keyword !== undefined && { keyword: dto.keyword }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.riskLevel !== undefined && { riskLevel: dto.riskLevel }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.crisisService.refreshKeywordCache();

    return keyword;
  }

  @Delete('keywords/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a crisis keyword' })
  @ApiOkResponse({ description: 'Keyword deleted' })
  @ApiNotFoundResponse({ description: 'Keyword not found' })
  async deleteKeyword(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.crisisKeyword.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Crisis keyword ${id} not found`);
    }

    // Check minimum keyword count
    const totalCount = await this.prisma.crisisKeyword.count();
    if (totalCount <= MIN_KEYWORD_COUNT) {
      throw new BadRequestException(
        `Cannot delete: at least ${MIN_KEYWORD_COUNT} crisis keyword(s) must remain`,
      );
    }

    await this.prisma.crisisKeyword.delete({ where: { id } });
    await this.crisisService.refreshKeywordCache();

    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Auto-Reply Templates
  // ---------------------------------------------------------------------------

  @Get('auto-replies')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all crisis auto-reply templates' })
  @ApiOkResponse({ description: 'List of auto-reply templates' })
  async listAutoReplies(): Promise<CrisisAutoReplyResponse[]> {
    return this.prisma.crisisAutoReply.findMany({
      orderBy: [{ language: 'asc' }],
    });
  }

  @Post('auto-replies')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a crisis auto-reply template' })
  @ApiResponse({ status: 201, description: 'Auto-reply template created' })
  @ApiConflictResponse({ description: 'Template for this language already exists' })
  async createAutoReply(
    @Body() dto: CreateCrisisAutoReplyDto,
  ): Promise<CrisisAutoReplyResponse> {
    return this.prisma.crisisAutoReply.create({
      data: {
        language: dto.language,
        template: dto.template,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch('auto-replies/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a crisis auto-reply template' })
  @ApiOkResponse({ description: 'Auto-reply template updated' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  async updateAutoReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrisisAutoReplyDto,
  ): Promise<CrisisAutoReplyResponse> {
    const existing = await this.prisma.crisisAutoReply.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-reply template ${id} not found`);
    }

    return this.prisma.crisisAutoReply.update({
      where: { id },
      data: {
        ...(dto.template !== undefined && { template: dto.template }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  @Delete('auto-replies/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a crisis auto-reply template' })
  @ApiOkResponse({ description: 'Auto-reply template deleted' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  async deleteAutoReply(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.crisisAutoReply.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-reply template ${id} not found`);
    }

    await this.prisma.crisisAutoReply.delete({ where: { id } });

    return { deleted: true };
  }
}
