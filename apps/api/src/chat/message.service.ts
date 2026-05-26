import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, MessageChannel, Role } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';

import { JwtPayload } from '../auth/auth.model.js';
import { CrisisService } from '../crisis/crisis.service.js';
import { AttachmentScanMeta } from '../crisis/crisis.model.js';
import { GdprService } from '../gdpr/gdpr.service.js';
import { ResponseTimeService } from '../sla/response-time.service.js';
import { SlaService } from '../sla/sla.service.js';
import {
  DEFAULT_PAGE_SIZE,
  ELEVATED_CHAT_ROLES,
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_ERROR_MSG,
  MAX_PAGE_SIZE,
  SLA_RESPONDING_ROLES,
  SUPPORTED_CHANNELS,
} from './chat.const.js';
import {
  ActiveChannelResponse,
  AttachmentMeta,
  MessageResponse,
  MessageVersionResponse,
  PaginatedMessagesResponse,
  SendMessageDto,
  WebhookMessageInput,
} from './chat.model.js';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crisisService: CrisisService,
    @Inject(forwardRef(() => GdprService)) private readonly gdprService: GdprService,
    @Inject(forwardRef(() => SlaService)) private readonly slaService: SlaService,
    @Inject(forwardRef(() => ResponseTimeService)) private readonly responseTimeService: ResponseTimeService,
  ) {}

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

    // Crisis keyword scanning (S-E08-01) — runs synchronously before return
    await this.scanForCrisis(caseId, message.id, sanitizedContent, channel, dto.attachments);

    // SAR keyword scanning (S-E12-07) — detect subject access requests
    await this.scanForSarKeywords(sanitizedContent, actor.sub, caseId);

    // SLA & response-time hooks (S-E07-03, S-E07-04, S-E07-05, S-E07-07)
    await this.handleSlaOnMessage(caseId, message.id, actor);

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
    const caseMatch = await this.findCaseByChannelChat(
      input.channel,
      input.channelChatId,
    );

    if (!caseMatch) {
      this.logger.warn(
        `No case found for ${input.channel} chat ${input.channelChatId} — message dropped`,
      );
      return null;
    }

    const { caseId, userId } = caseMatch;

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
        senderId: userId,
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

    // Crisis keyword scanning (S-E08-01) — scan webhook messages too
    const attachmentScanMeta = this.toAttachmentScanMeta(input.attachments);
    await this.scanForCrisis(
      caseId,
      message.id,
      input.content,
      input.channel,
      undefined,
      attachmentScanMeta,
    );

    // SAR keyword scanning (S-E12-07) — detect subject access requests in webhook messages
    await this.scanForSarKeywords(input.content, message.senderId, caseId);

    // SLA hooks for webhook (person) messages — open response-time entry + resume paused timer
    await this.handleSlaOnPersonMessage(caseId, message.id);

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
   * For Telegram: also resolves via ProviderLink (telegram user ID → user → active case).
   */
  private async findCaseByChannelChat(
    channel: MessageChannel,
    channelChatId: string,
  ): Promise<{ caseId: string; userId: string } | null> {
    // 1. Check existing messages with this channelChatId
    const existingMessage = await this.prisma.message.findFirst({
      where: { channel, channelChatId },
      orderBy: { createdAt: 'desc' },
      select: { careCaseId: true, senderId: true },
    });

    if (existingMessage?.careCaseId) {
      // Try to get real user ID from the case
      const careCase = await this.prisma.careCase.findUnique({
        where: { id: existingMessage.careCaseId },
        select: { personId: true },
      });
      return {
        caseId: existingMessage.careCaseId,
        userId: careCase?.personId ?? existingMessage.senderId,
      };
    }

    // 2. For Telegram — resolve via ProviderLink
    if (channel === MessageChannel.TELEGRAM) {
      const providerLink = await this.prisma.providerLink.findFirst({
        where: { provider: 'telegram', providerAccountId: channelChatId },
        select: { userId: true },
      });

      if (providerLink) {
        // Find the most recent active case for this person
        const activeCase = await this.prisma.careCase.findFirst({
          where: {
            personId: providerLink.userId,
            status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEETING_SCHEDULED', 'ON_HOLD'] },
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });

        if (activeCase) {
          this.logger.log(
            `Resolved Telegram chat ${channelChatId} → user ${providerLink.userId} → case ${activeCase.id}`,
          );
          return { caseId: activeCase.id, userId: providerLink.userId };
        }

        this.logger.warn(
          `Telegram user ${channelChatId} (userId=${providerLink.userId}) has no active case`,
        );
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Crisis scanning helper
  // ---------------------------------------------------------------------------

  private async scanForCrisis(
    caseId: string,
    messageId: string,
    content: string,
    channel: MessageChannel,
    rawAttachments?: Record<string, unknown>,
    attachmentScanMeta?: AttachmentScanMeta[],
  ): Promise<void> {
    try {
      const attachments =
        attachmentScanMeta ?? this.extractAttachmentScanMeta(rawAttachments);

      await this.crisisService.processMessage(
        caseId,
        messageId,
        { content, attachments },
        channel,
      );
    } catch (error) {
      // Crisis scanning must never block message delivery
      this.logger.error(
        `Crisis scanning failed for message ${messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract scannable metadata from raw attachment JSON (used by create method).
   */
  private extractAttachmentScanMeta(
    rawAttachments?: Record<string, unknown>,
  ): AttachmentScanMeta[] | undefined {
    if (!rawAttachments) {
      return undefined;
    }

    const fileName = rawAttachments['fileName'] ?? rawAttachments['file_name'];
    const altText = rawAttachments['altText'] ?? rawAttachments['alt_text'];

    if (!fileName && !altText) {
      return undefined;
    }

    return [
      {
        fileName: typeof fileName === 'string' ? fileName : undefined,
        altText: typeof altText === 'string' ? altText : undefined,
      },
    ];
  }

  /**
   * Convert AttachmentMeta[] (from webhook) to AttachmentScanMeta[] for crisis scanning.
   */
  private toAttachmentScanMeta(
    attachments?: readonly AttachmentMeta[],
  ): AttachmentScanMeta[] | undefined {
    if (!attachments || attachments.length === 0) {
      return undefined;
    }

    return attachments.map((att) => ({
      fileName: att.fileName,
    }));
  }

  // ---------------------------------------------------------------------------
  // SAR scanning (S-E12-07)
  // ---------------------------------------------------------------------------

  /**
   * Scan message content for Subject Access Request (SAR) keywords.
   * Must never block message delivery.
   */
  private async scanForSarKeywords(
    content: string,
    senderId: string,
    caseId: string,
  ): Promise<void> {
    try {
      await this.gdprService.scanForSar(content, senderId, caseId);
    } catch (error) {
      // SAR scanning must never block message delivery
      this.logger.error(
        `SAR scanning failed for case ${caseId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SLA integration (S-E07-03, S-E07-04, S-E07-05, S-E07-07)
  // ---------------------------------------------------------------------------

  /**
   * Central SLA hook called after every message creation (web channel).
   *
   * - Person message → open response-time entry, resume paused SLA timer,
   *   set case IN_PROGRESS if ON_HOLD.
   * - Consultant/elevated reply → close response-time entry, resolve SLA timer,
   *   record firstResponseAt, start new SLA cycle.
   */
  private async handleSlaOnMessage(
    caseId: string,
    messageId: string,
    actor: JwtPayload,
  ): Promise<void> {
    try {
      const isResponder = SLA_RESPONDING_ROLES.includes(actor.role);

      if (actor.role === 'PERSON') {
        await this.handleSlaOnPersonMessage(caseId, messageId);
      } else if (isResponder) {
        await this.handleSlaOnConsultantReply(caseId, messageId, actor.sub);
      }
    } catch (error) {
      // SLA hooks must never block message delivery
      this.logger.error(
        `SLA hook failed for message ${messageId} in case ${caseId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle SLA logic when a person sends a message:
   * 1. Open a response-time tracking entry (S-E07-03)
   * 2. If SLA timer is paused → resume it (S-E07-04)
   * 3. If case is ON_HOLD → transition to IN_PROGRESS (S-E07-04)
   */
  private async handleSlaOnPersonMessage(
    caseId: string,
    messageId: string,
  ): Promise<void> {
    try {
      const now = new Date();

      // S-E07-03: Open response-time entry
      await this.responseTimeService.openEntry(caseId, messageId, now);

      // S-E07-04: Check SLA timer state
      const timerState = await this.slaService.hasActiveOrPausedTimer(caseId);

      if (timerState.isPaused) {
        // Resume the paused SLA timer
        await this.slaService.resumeTimer(caseId);
        this.logger.log(`SLA timer resumed for case ${caseId} on person message`);

        // Transition case from ON_HOLD to IN_PROGRESS
        await this.prisma.careCase.updateMany({
          where: { id: caseId, status: CaseStatus.ON_HOLD },
          data: { status: CaseStatus.IN_PROGRESS },
        });
      } else if (!timerState.exists) {
        // No active timer — start a new SLA cycle
        await this.slaService.startTimer(caseId, now);
        this.logger.log(`New SLA timer started for case ${caseId} on person message`);
      }
    } catch (error) {
      this.logger.error(
        `SLA person-message hook failed for case ${caseId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle SLA logic when a consultant (or elevated role) replies:
   * 1. Close the response-time entry (S-E07-03)
   * 2. Resolve the SLA timer — cancel all pending escalation jobs (S-E07-07)
   * 3. Record firstResponseAt on the case if not set yet (S-E07-07)
   * A new SLA cycle starts automatically when the next person message arrives (S-E07-07)
   */
  private async handleSlaOnConsultantReply(
    caseId: string,
    messageId: string,
    consultantId: string,
  ): Promise<void> {
    try {
      const now = new Date();

      // S-E07-03: Close the open response-time entry
      await this.responseTimeService.closeEntry(caseId, messageId, consultantId, now);

      // S-E07-07: Resolve the current SLA timer (cancels all escalation jobs)
      const timerState = await this.slaService.hasActiveOrPausedTimer(caseId);
      if (timerState.exists) {
        await this.slaService.resolveTimer(caseId);
        this.logger.log(`SLA timer resolved for case ${caseId} on consultant reply`);
      }

      // S-E07-07: Record firstResponseAt if not set
      await this.prisma.careCase.updateMany({
        where: { id: caseId, firstResponseAt: null },
        data: { firstResponseAt: now },
      });
    } catch (error) {
      this.logger.error(
        `SLA consultant-reply hook failed for case ${caseId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
