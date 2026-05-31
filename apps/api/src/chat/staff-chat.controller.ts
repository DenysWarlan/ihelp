import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ChatGateway } from './chat.gateway.js';
import { MessageService } from './message.service.js';
import { SendMessageDto } from './chat.model.js';
import { CASE_ROOM_PREFIX, CHAT_EVENTS } from './chat.const.js';
import { TelegramAdapter } from './adapters/telegram.adapter.js';

export class MarkAsReadDto {
  @ApiProperty({ description: 'Array of message IDs to mark as read' })
  @IsArray()
  @IsUUID('4', { each: true })
  messageIds!: string[];
}

const STAFF_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat/staff')
export class StaffChatController {
  private readonly logger = new Logger(StaffChatController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly messageService: MessageService,
  ) {}

  @Get('conversations')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List staff chat conversations (assigned cases)' })
  @ApiResponse({ status: 200, description: 'Staff conversations' })
  async getConversations(@Req() req: Request) {
    const actor = req.user as JwtPayload;

    const cases = await this.prisma.careCase.findMany({
      where: {
        consultantId: actor.sub,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEETING_SCHEDULED', 'ON_HOLD'] },
      },
      include: {
        person: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where: { isDeleted: false },
          select: { content: true, createdAt: true },
        },
        _count: {
          select: {
            messages: {
              where: {
                isDeleted: false,
                isRead: false,
                senderId: { not: actor.sub },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Sort: conversations with unread messages first, then by last message time
    const mapped = cases.map((c) => {
      const lastMsg = c.messages[0] ?? null;
      return {
        id: c.id,
        personName: c.person?.name ?? '',
        caseId: c.id,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
        unreadCount: c._count.messages,
        topic: c.topic,
        status: c.status,
        description: c.description,
        contactMethod: c.contactMethod,
        language: c.language,
        country: c.country,
        createdAt: c.createdAt.toISOString(),
      };
    });

    mapped.sort((a, b) => {
      // Unread first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      // Then by last message time (newest first)
      const aTime = a.lastMessageAt ?? '';
      const bTime = b.lastMessageAt ?? '';
      return bTime.localeCompare(aTime);
    });

    return mapped;
  }

  @Get('conversations/:id/messages')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get messages for a staff conversation' })
  @ApiResponse({ status: 200, description: 'Conversation messages' })
  async getMessages(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;

    // TODO: Add case-level access control — currently any staff member can read
    // messages from any case. Should verify that the requesting user is the
    // assigned consultant, or has a SUPERVISOR/COORDINATOR/ADMIN role.
    const messages = await this.prisma.message.findMany({
      where: { careCaseId: caseId, isDeleted: false },
      include: {
        sender: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return messages.map((m) => ({
      id: m.id,
      content: m.content ?? '',
      senderId: m.senderId,
      senderName: m.sender?.name ?? '',
      isFromStaff: m.sender?.role !== 'PERSON',
      isRead: m.isRead,
      sentAt: m.createdAt.toISOString(),
    }));
  }

  @Post('conversations/:id/messages')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Send a message in a staff conversation' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;

    // Delegate to MessageService which handles sanitization, crisis scanning, SAR detection, and SLA hooks
    const message = await this.messageService.create(caseId, dto, actor);

    // Re-fetch sender info for the response
    const sender = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { name: true },
    });
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { personId: true },
    });

    const response = {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: sender?.name ?? '',
      isFromStaff: true,
      isRead: false,
      sentAt: message.createdAt.toISOString(),
    };

    // Broadcast to all clients in the case room
    const room = `${CASE_ROOM_PREFIX}${caseId}`;
    this.chatGateway.server.to(room).emit(CHAT_EVENTS.NEW_MESSAGE, {
      ...response,
      caseId,
    });

    // Notify the person about the new message
    if (careCase?.personId) {
      this.chatGateway.notifyUser(careCase.personId, {
        caseId,
        senderName: sender?.name ?? '',
        preview: (dto.content ?? '').slice(0, 100),
      });

      // Deliver to Telegram if person has a linked Telegram account
      void this.deliverToTelegram(careCase.personId, dto.content);
    }

    return response;
  }

  @Put('conversations/:id/read')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Mark messages as read via REST (fallback for WebSocket)' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) caseId: string,
    @Body() dto: MarkAsReadDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    const count = await this.messageService.markManyAsRead(dto.messageIds, actor);
    return { count };
  }

  /**
   * Look up the person's Telegram provider link and deliver the message
   * via Telegram Bot API if they have one.
   */
  private async deliverToTelegram(
    personId: string,
    content: string,
  ): Promise<void> {
    try {
      const telegramLink = await this.prisma.providerLink.findFirst({
        where: { userId: personId, provider: 'telegram' },
      });

      if (!telegramLink) {
        this.logger.debug(`No Telegram link for user ${personId} — skipping TG delivery`);
        return;
      }

      // For Telegram private chats, the chat ID equals the user ID
      const chatId = telegramLink.providerAccountId;
      this.logger.log(`Delivering to Telegram: userId=${personId}, tg_chatId=${chatId}`);
      const result = await this.telegramAdapter.send(content, chatId);

      if (!result.success) {
        this.logger.warn(
          `Failed to deliver message to Telegram for user ${personId}: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Telegram delivery error for user ${personId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
