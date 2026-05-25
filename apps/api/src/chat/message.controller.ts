import {
  Body,
  Controller,
  Delete,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import {
  ActiveChannelResponse,
  EditMessageDto,
  MessageQueryDto,
  MessageResponse,
  MessageVersionResponse,
  PaginatedMessagesResponse,
  SendMessageDto,
} from './chat.model.js';
import { MessageService } from './message.service.js';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('cases/:caseId/messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated message history for a case' })
  @ApiResponse({ status: 200, description: 'Paginated messages' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async findByCaseId(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query() query: MessageQueryDto,
    @Req() req: Request,
  ): Promise<PaginatedMessagesResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.findByCaseId(
      caseId,
      actor,
      query.cursor,
      query.limit,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Send a message in a case' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  @ApiUnprocessableEntityResponse({ description: 'Unsupported channel' })
  async create(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.create(caseId, dto, actor);
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller('cases/:caseId')
export class CaseChannelController {
  constructor(private readonly messageService: MessageService) {}

  @Get('active-channel')
  @ApiOperation({ summary: 'Get the active channel for a case' })
  @ApiResponse({ status: 200, description: 'Active channel information' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async getActiveChannel(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Req() req: Request,
  ): Promise<ActiveChannelResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.getActiveChannel(caseId, actor);
  }
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller('messages')
export class MessageReadController {
  constructor(private readonly messageService: MessageService) {}

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  @ApiNotFoundResponse({ description: 'Message not found' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.markAsRead(id, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a message' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiForbiddenResponse({ description: 'Cannot edit another user\'s message' })
  async editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditMessageDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.editMessage(id, dto.content, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a message' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiForbiddenResponse({ description: 'Cannot delete another user\'s message' })
  async softDeleteMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    const actor = req.user as JwtPayload;
    return this.messageService.softDeleteMessage(id, actor);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get version history for a message (elevated roles only)' })
  @ApiResponse({ status: 200, description: 'Message version history' })
  @ApiNotFoundResponse({ description: 'Message not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async getVersionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<MessageVersionResponse[]> {
    const actor = req.user as JwtPayload;
    return this.messageService.getVersionHistory(id, actor);
  }
}
