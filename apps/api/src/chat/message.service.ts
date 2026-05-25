import {
  BadRequestException,
  ConflictException,
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
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_ERROR_MSG,
  MAX_PAGE_SIZE,
  SUPPORTED_CHANNELS,
} from './chat.const.js';
import {
  ActiveChannelResponse,
  MessageResponse,
  MessageVersionResponse,
  PaginatedMessagesResponse,
  SendMessageDto,
  WebhookMessageInput,
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

    // Validate attachment sizes if present
    if (dto.attachments) {
      this.validateAttachmentSize(dto.attachments);
    }

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
  // Create from webhook (idempotent — dedup by channelMsgId)
  // ---------------------------------------------------------------------------

  async createFromWebhook(
    input: WebhookMessageInput,
  ): Promise<MessageResponse | null> {
    // Dedup check: if a message with this channel + channelMsgId already exists, skip
    const existing = await this.prisma.message.findFirst({
      where: {
        channel: input.channel,
        channelMsgId: input.channelMsgId,
      },
    });

    if (existing) {
      this.logger.debug(
        `Duplicate webhook message ignored: ${input.channel}/${input.channelMsgId}`,
      );
      return null;
    }

    // Find or create the case mapping by channelChatId
    // For MVP, we look up an existing case by channelChatId in recent messages
    const caseId = await this.findCaseByChannelChat(
      input.channel,
      input.channelChatId,
    );

    if (!caseId) {
      this.logger.warn(
        `No case found for ${input.channel} chat ${input.channelChatId} — message stored without case`,
      );
      return null;
    }

    // Validate attachment sizes
    const validAttachments = input.attachments?.filter((att) => {
      if (att.fileSize && att.fileSize > MAX_ATTACHMENT_SIZE) {
        this.logger.warn(
          `Attachment rejected (${att.fileSize} bytes): ${ATTACHMENT_ERROR_MSG}`,
        );
        return false;
      }
      return true;
    });

    const message = await this.prisma.message.create({
      data: {
        careCaseId: caseId,
        senderId: '00000000-0000-0000-0000-000000000000', // system/external sender placeholder
        senderRole: Role.PERSON,
        channel: input.channel,
        channelMsgId: input.channelMsgId,
        channelChatId: input.channelChatId,
        content: this.sanitize(input.content),
        originalTs: input.originalTs,
        attachments:
          validAttachments && validAttachments.length > 0
            ? validAttachments
            : undefined,
      },
    });

    this.logger.log(
      `Webhook message created: ${message.id} (${input.channel}/${input.channelMsgId}) in case ${caseId}`,
    );

    return message;
  }

  // ---------------------------------------------------------------------------
  // Edit message
  // ---------------------------------------------------------------------------

  async editMessage(
    messageId: string,
    newContent: string,
    actor: JwtPayload,
  ): Promise<MessageResponse> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    await this.validateCaseAccess(message.careCaseId, actor);

    // Only the sender or elevated roles can edit
    if (
      message.senderId !== actor.sub &&
      !(ELEVATED_CHAT_ROLES as readonly string[]).includes(actor.role)
    ) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const sanitizedContent = this.sanitize(newContent);
    const nextVersion =
      message.versions.length > 0 ? message.versions[0].version + 1 : 1;

    // Create version record and update message in a transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.messageVersion.create({
        data: {
          messageId: message.id,
          version: nextVersion,
          content: message.content, // Save the OLD content as a version
        },
      });

      return tx.message.update({
        where: { id: messageId },
        data: {
          content: sanitizedContent,
          isEdited: true,
        },
      });
    });

    this.logger.log(`Message ${messageId} edited by ${actor.sub} (v${nextVersion})`);

    return updated;
  }

  /**
   * Edit a message by its channel-specific message ID.
   * Used by webhook processors (e.g., Telegram edited_message).
   */
  async editByChannelMsgId(
    channel: MessageChannel,
    channelMsgId: string,
    newContent: string,
  ): Promise<MessageResponse | null> {
    const message = await this.prisma.message.findFirst({
      where: { channel, channelMsgId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!message) {
      this.logger.warn(
        `Cannot edit — message not found: ${channel}/${channelMsgId}`,
      );
      return null;
    }

    if (message.isDeleted) {
      this.logger.warn(`Cannot edit deleted message: ${channel}/${channelMsgId}`);
      return null;
    }

    const sanitizedContent = this.sanitize(newContent);
    const nextVersion =
      message.versions.length > 0 ? message.versions[0].version + 1 : 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.messageVersion.create({
        data: {
          messageId: message.id,
          version: nextVersion,
          content: message.content,
        },
      });

      return tx.message.update({
        where: { id: message.id },
        data: {
          content: sanitizedContent,
          isEdited: true,
        },
      });
    });

    this.logger.log(
      `Message ${message.id} edited via webhook (${channel}/${channelMsgId}, v${nextVersion})`,
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Soft delete
  // ---------------------------------------------------------------------------

  async softDeleteMessage(
    messageId: string,
    actor: JwtPayload,
  ): Promise<MessageResponse> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Message is already deleted');
    }

    await this.validateCaseAccess(message.careCaseId, actor);

    // Only the sender or elevated roles can delete
    if (
      message.senderId !== actor.sub &&
      !(ELEVATED_CHAT_ROLES as readonly string[]).includes(actor.role)
    ) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const nextVersion =
      message.versions.length > 0 ? message.versions[0].version + 1 : 1;

    const deleted = await this.prisma.$transaction(async (tx) => {
      // Save the final content as a version before soft-deleting
      await tx.messageVersion.create({
        data: {
          messageId: message.id,
          version: nextVersion,
          content: message.content,
        },
      });

      return tx.message.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    });

    this.logger.log(`Message ${messageId} soft-deleted by ${actor.sub}`);

    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Version history
  // ---------------------------------------------------------------------------

  async getVersionHistory(
    messageId: string,
    actor: JwtPayload,
  ): Promise<MessageVersionResponse[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.validateCaseAccess(message.careCaseId, actor);

    // Only elevated roles can view version history
    if (
      !(ELEVATED_CHAT_ROLES as readonly string[]).includes(actor.role)
    ) {
      throw new ForbiddenException(
        'Only supervisors, coordinators, and admins can view message history',
      );
    }

    return this.prisma.messageVersion.findMany({
      where: { messageId },
      orderBy: { version: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Active channel
  // ---------------------------------------------------------------------------

  async getActiveChannel(
    caseId: string,
    actor: JwtPayload,
  ): Promise<ActiveChannelResponse> {
    await this.validateCaseAccess(caseId, actor);

    // Active channel = channel of the last message from a PERSON in this case
    const lastPersonMessage = await this.prisma.message.findFirst({
      where: {
        careCaseId: caseId,
        senderRole: Role.PERSON,
        isDeleted: false,
      },
      orderBy: [
        { originalTs: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      select: { channel: true },
    });

    return {
      caseId,
      activeChannel: lastPersonMessage?.channel ?? null,
    };
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
      orderBy: [
        { originalTs: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
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

  private validateAttachmentSize(
    attachments: Record<string, unknown>,
  ): void {
    const size = attachments['fileSize'];
    if (typeof size === 'number' && size > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException(ATTACHMENT_ERROR_MSG);
    }
  }

  /**
   * Find a case ID by looking at existing messages from a channel+chat combination.
   * In MVP, this is a simple lookup — a full mapping table is deferred.
   */
  private async findCaseByChannelChat(
    channel: MessageChannel,
    channelChatId: string,
  ): Promise<string | null> {
    const existingMessage = await this.prisma.message.findFirst({
      where: { channel, channelChatId },
      orderBy: { createdAt: 'desc' },
      select: { careCaseId: true },
    });

    return existingMessage?.careCaseId ?? null;
  }
}
