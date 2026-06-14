import {
  Body,
  Controller,
  Get,
  Param,
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
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';

import { STAFF_ROLES } from './conversations.const.js';
import { ConversationsGateway } from './conversations.gateway.js';
import {
  ContactResponse,
  ConversationMessageResponse,
  ConversationResponse,
  CreateConversationDto,
  SendConversationMessageDto,
} from './conversations.model.js';
import { ConversationsService } from './conversations.service.js';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly gateway: ConversationsGateway,
  ) {}

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Start a direct or group conversation (staff only)' })
  @ApiResponse({ status: 201, description: 'Conversation created or reused' })
  @ApiResponse({ status: 400, description: 'Invalid or inactive participants' })
  async create(
    @Body() dto: CreateConversationDto,
    @Req() req: Request,
  ): Promise<ConversationResponse> {
    const actor = req.user as JwtPayload;
    return this.conversationsService.create(dto, actor.sub);
  }

  @Get('my')
  @ApiOperation({ summary: 'List conversations the user is a member of' })
  @ApiResponse({ status: 200, description: 'Conversations for the user' })
  async findMine(@Req() req: Request): Promise<ConversationResponse[]> {
    const actor = req.user as JwtPayload;
    return this.conversationsService.findMine(actor.sub);
  }

  @Get('contacts')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List users that staff can start a conversation with' })
  @ApiResponse({ status: 200, description: 'Active users excluding the requester' })
  async listContacts(@Req() req: Request): Promise<ContactResponse[]> {
    const actor = req.user as JwtPayload;
    return this.conversationsService.listContacts(actor.sub);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message history for a conversation' })
  @ApiResponse({ status: 200, description: 'Messages in chronological order' })
  @ApiForbiddenResponse({ description: 'You are not a member of this conversation' })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async getMessages(
    @Param('id', ParseUuidPipe) id: string,
    @Query('limit') limit: string | undefined,
    @Req() req: Request,
  ): Promise<ConversationMessageResponse[]> {
    const actor = req.user as JwtPayload;
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.conversationsService.getMessages(
      id,
      actor.sub,
      Number.isNaN(parsed) ? undefined : parsed,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message to a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiForbiddenResponse({ description: 'You are not a member of this conversation' })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async sendMessage(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: SendConversationMessageDto,
    @Req() req: Request,
  ): Promise<ConversationMessageResponse> {
    const actor = req.user as JwtPayload;
    const message = await this.conversationsService.postMessage(
      id,
      actor.sub,
      dto.content,
    );
    await this.gateway.broadcastNewMessage(id, message);
    return message;
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a conversation as read up to now' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  @ApiForbiddenResponse({ description: 'You are not a member of this conversation' })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async markRead(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actor = req.user as JwtPayload;
    await this.conversationsService.markRead(id, actor.sub);
    return { success: true };
  }
}
