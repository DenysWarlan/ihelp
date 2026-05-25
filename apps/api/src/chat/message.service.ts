import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { MessageChannel, Role } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';

import { JwtPayload } from '../auth/auth.model.js';
import {
  DEFAULT_PAGE_SIZE,
  ELEVATED_CHAT_ROLES,
  MAX_PAGE_SIZE,
  SUPPORTED_CHANNELS,
} from './chat.const.js';
import {
  MessageResponse,
  PaginatedMessagesResponse,
  SendMessageDto,
} from './chat.model.js';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create message
  // ---------------------------------------------------------------------------

  async create(
    caseId: string,
    dto: SendMessageDto,
    actor: JwtPayload,
  ): Promise<MessageResponse> {
    const channel = dto.channel ?? MessageChannel.WEB;

    this.validateChannel(channel);
    await this.validateCaseAccess(caseId, actor);

    const sanitizedContent = this.sanitize(dto.content);

    const message = await this.prisma.message.create({
      data: {
        careCaseId: caseId,
        senderId: actor.sub,
        senderRole: actor.role as Role,
        channel,
        content: sanitizedContent,
        attachments: dto.attachments ?? undefined,
      },
    });

    this.logger.log(
      `Message created: ${message.id} in case ${caseId} by ${actor.sub}`,
    );

    return message;
  }

  // ---------------------------------------------------------------------------
  // Read messages (cursor-based pagination)
  // ---------------------------------------------------------------------------

  async findByCaseId(
    caseId: string,
    actor: JwtPayload,
    cursor?: string,
    limit?: number,
  ): Promise<PaginatedMessagesResponse> {
    await this.validateCaseAccess(caseId, actor);

    const pageSize = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const messages = await this.prisma.message.findMany({
      where: { careCaseId: caseId },
      orderBy: { createdAt: 'asc' },
      take: pageSize + 1, // fetch one extra to detect hasMore
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // skip the cursor itself
          }
        : {}),
    });

    const hasMore = messages.length > pageSize;
    const data = hasMore ? messages.slice(0, pageSize) : messages;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor, hasMore };
  }

  // ---------------------------------------------------------------------------
  // Mark as read
  // ---------------------------------------------------------------------------

  async markAsRead(
    messageId: string,
    actor: JwtPayload,
  ): Promise<MessageResponse> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only allow marking as read if user has access to the case
    await this.validateCaseAccess(message.careCaseId, actor);

    // Don't re-mark if already read
    if (message.isRead) {
      return message;
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Batch mark as read (for socket events)
  // ---------------------------------------------------------------------------

  async markManyAsRead(
    messageIds: string[],
    actor: JwtPayload,
  ): Promise<number> {
    if (messageIds.length === 0) return 0;

    // Verify all messages belong to cases the user can access
    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { careCaseId: true },
    });

    const uniqueCaseIds = [...new Set(messages.map((m) => m.careCaseId))];
    for (const caseId of uniqueCaseIds) {
      await this.validateCaseAccess(caseId, actor);
    }

    const result = await this.prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  // ---------------------------------------------------------------------------
  // Access control
  // ---------------------------------------------------------------------------

  async validateCaseAccess(
    caseId: string,
    actor: JwtPayload,
  ): Promise<void> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { id: true, personId: true, consultantId: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // Elevated roles (SUPERVISOR, COORDINATOR, ADMIN) can access all cases
    if (
      (ELEVATED_CHAT_ROLES as readonly string[]).includes(actor.role)
    ) {
      return;
    }

    // PERSON can only access their own cases
    if (actor.role === 'PERSON' && careCase.personId !== actor.sub) {
      throw new ForbiddenException('You do not have access to this case');
    }

    // CONSULTANT can only access cases assigned to them
    if (
      actor.role === 'CONSULTANT' &&
      careCase.consultantId !== actor.sub
    ) {
      throw new ForbiddenException('You are not assigned to this case');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validateChannel(channel: MessageChannel): void {
    if (!SUPPORTED_CHANNELS.includes(channel)) {
      throw new UnprocessableEntityException(
        `Channel "${channel}" is not supported in MVP. Supported channels: ${SUPPORTED_CHANNELS.join(', ')}`,
      );
    }
  }

  private sanitize(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }
}
