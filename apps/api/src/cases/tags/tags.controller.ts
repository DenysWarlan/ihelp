import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
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
import {
  AddTagDto,
  CaseTagResponse,
  CreateTagDto,
  TagResponse,
} from './tags.model.js';
import { TagsService } from './tags.service.js';

/** Roles allowed to manage tags on cases. */
const TAG_MANAGE_ROLES = ['COORDINATOR', 'CONSULTANT', 'ADMIN'] as const;

@ApiTags('tags')
@ApiBearerAuth()
@Controller()
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // ---------------------------------------------------------------------------
  // Tag CRUD
  // ---------------------------------------------------------------------------

  @Post('tags')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new tag (admin only)' })
  @ApiResponse({ status: 201, description: 'Tag created' })
  @ApiConflictResponse({ description: 'Tag already exists' })
  async createTag(@Body() dto: CreateTagDto): Promise<TagResponse> {
    return this.tagsService.createTag(dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags' })
  @ApiResponse({ status: 200, description: 'List of tags' })
  async findAllTags(): Promise<TagResponse[]> {
    return this.tagsService.findAllTags();
  }

  // ---------------------------------------------------------------------------
  // Case-Tag operations
  // ---------------------------------------------------------------------------

  @Post('cases/:caseId/tags')
  @Roles(...TAG_MANAGE_ROLES)
  @ApiOperation({ summary: 'Add a tag to a case' })
  @ApiResponse({ status: 201, description: 'Tag added to case' })
  @ApiConflictResponse({ description: 'Tag already assigned to case' })
  @ApiNotFoundResponse({ description: 'Case or tag not found' })
  async addTag(
    @Param('caseId', ParseUuidPipe) caseId: string,
    @Body() dto: AddTagDto,
    @Req() req: Request,
  ): Promise<CaseTagResponse> {
    const actor = req.user as JwtPayload;
    return this.tagsService.addTagToCase(caseId, dto, actor);
  }

  @Delete('cases/:caseId/tags/:tagId')
  @Roles(...TAG_MANAGE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a tag from a case' })
  @ApiResponse({ status: 204, description: 'Tag removed from case' })
  @ApiNotFoundResponse({ description: 'Case or tag assignment not found' })
  async removeTag(
    @Param('caseId', ParseUuidPipe) caseId: string,
    @Param('tagId', ParseUuidPipe) tagId: string,
    @Req() req: Request,
  ): Promise<void> {
    const actor = req.user as JwtPayload;
    return this.tagsService.removeTagFromCase(caseId, tagId, actor);
  }
}
