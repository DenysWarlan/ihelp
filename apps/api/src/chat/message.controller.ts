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
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import {
  MessageQueryDto,
  MessageResponse,
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
}
