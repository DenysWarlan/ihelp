import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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

import { JwtPayload } from '../../auth/auth.model.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { STAFF_ROLES } from '../cases.const.js';
import { CreateNoteDto, NoteResponse, UpdateNoteDto } from './notes.model.js';
import { NotesService } from './notes.service.js';

@ApiTags('case-notes')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('cases/:caseId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a private note on a case (staff only)' })
  @ApiResponse({ status: 201, description: 'Note created' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async create(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ): Promise<NoteResponse> {
    const actor = req.user as JwtPayload;
    return this.notesService.create(caseId, dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List all notes for a case (staff only)' })
  @ApiResponse({ status: 200, description: 'List of notes' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async findAll(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<NoteResponse[]> {
    return this.notesService.findAll(caseId);
  }

  @Put(':noteId')
  @ApiOperation({ summary: 'Edit a note (author only)' })
  @ApiResponse({ status: 200, description: 'Note updated' })
  @ApiNotFoundResponse({ description: 'Note not found' })
  @ApiForbiddenResponse({ description: 'Only the author can edit' })
  async update(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: Request,
  ): Promise<NoteResponse> {
    const actor = req.user as JwtPayload;
    return this.notesService.update(caseId, noteId, dto, actor);
  }
}
