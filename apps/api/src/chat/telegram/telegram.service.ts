import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@prisma/client';
import { PrismaService } from '@org/prisma-client';

import { MessageService } from '../message.service.js';
import { ChatGateway } from '../chat.gateway.js';
import { CASE_ROOM_PREFIX, CHAT_EVENTS } from '../chat.const.js';
import {
  TelegramUpdate,
  TelegramMessage,
  AttachmentMeta,
} from '../chat.model.js';
import {
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_SIZE_ERROR_MSG,
  TELEGRAM_API_BASE,
} from './telegram.const.js';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly messageService: MessageService,
    private readonly chatGateway: ChatGateway,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  /**
   * Process an incoming Telegram webhook update.
   * Handles new messages and edited messages.
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    this.logger.log(`Processing update ${update.update_id}`);

    if (update.edited_message) {
      this.logger.log(`Edited message: msg_id=${update.edited_message.message_id}`);
      await this.handleEditedMessage(update.edited_message);
      return;
    }

    if (update.message) {
      this.logger.log(`New message: msg_id=${update.message.message_id}, chat_id=${update.message.chat.id}`);
      await this.handleNewMessage(update.message);
      return;
    }

    this.logger.warn(`Ignoring unsupported Telegram update type: ${update.update_id}`);
  }

  // ---------------------------------------------------------------------------
  // New message
  // ---------------------------------------------------------------------------

  private async handleNewMessage(tgMessage: TelegramMessage): Promise<void> {
    const channelMsgId = tgMessage.message_id.toString();
    const channelChatId = tgMessage.chat.id.toString();
    const originalTs = new Date(tgMessage.date * 1000);
    const senderName = this.formatSenderName(tgMessage);
    const content = tgMessage.text ?? tgMessage.caption ?? '';

    this.logger.log(
      `Creating message from webhook: chatId=${channelChatId}, msgId=${channelMsgId}, sender="${senderName}", content="${content.slice(0, 50)}"`,
    );

    // Build attachment metadata if present
    const attachments = this.extractAttachments(tgMessage);
    if (attachments.length > 0) {
      this.logger.log(`Attachments: ${attachments.map((a) => a.type).join(', ')}`);
    }

    const message = await this.messageService.createFromWebhook({
      channel: MessageChannel.TELEGRAM,
      channelMsgId,
      channelChatId,
      content,
      originalTs,
      attachments: attachments.length > 0 ? attachments : undefined,
      senderName,
    });

    if (message) {
      const caseId = message.careCaseId;
      const room = `${CASE_ROOM_PREFIX}${caseId}`;

      // Mark all unread staff messages in this case as read (person replied = they read them)
      await this.prisma.message.updateMany({
        where: {
          careCaseId: caseId,
          senderRole: { not: 'PERSON' },
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });

      // Look up case details for consultant notification and system name
      const careCase = await this.prisma.careCase.findUnique({
        where: { id: caseId },
        select: {
          consultantId: true,
          person: { select: { name: true } },
        },
      });

      // Use system name (from User record) instead of Telegram display name
      const systemName = careCase?.person?.name || senderName;

      const payload = {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: systemName,
        isFromStaff: false,
        isRead: false,
        sentAt: message.createdAt.toISOString(),
        caseId,
      };

      // Broadcast to case room
      this.chatGateway.server.to(room).emit(CHAT_EVENTS.NEW_MESSAGE, payload);

      if (careCase?.consultantId) {
        // Send new_message directly to consultant's personal room (reliable — always joined)
        this.chatGateway.server
          .to(`user:${careCase.consultantId}`)
          .emit(CHAT_EVENTS.NEW_MESSAGE, payload);

        this.chatGateway.notifyUser(careCase.consultantId, {
          caseId,
          senderName: systemName,
          preview: content.slice(0, 100),
        });
        this.logger.log(`Notified consultant ${careCase.consultantId} about Telegram message`);
      }
    }

    this.logger.log(`Message saved from Telegram: chatId=${channelChatId}, msgId=${channelMsgId}`);
  }

  // ---------------------------------------------------------------------------
  // Edited message
  // ---------------------------------------------------------------------------

  private async handleEditedMessage(tgMessage: TelegramMessage): Promise<void> {
    const channelMsgId = tgMessage.message_id.toString();
    const newContent = tgMessage.text ?? tgMessage.caption ?? '';

    try {
      await this.messageService.editByChannelMsgId(
        MessageChannel.TELEGRAM,
        channelMsgId,
        newContent,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to process edited Telegram message ${channelMsgId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment extraction
  // ---------------------------------------------------------------------------

  private extractAttachments(tgMessage: TelegramMessage): AttachmentMeta[] {
    const attachments: AttachmentMeta[] = [];

    if (tgMessage.document) {
      const doc = tgMessage.document;
      if (doc.file_size && doc.file_size > MAX_ATTACHMENT_SIZE) {
        this.logger.warn(
          `Telegram document too large (${doc.file_size} bytes): ${ATTACHMENT_SIZE_ERROR_MSG}`,
        );
      } else {
        attachments.push({
          type: 'document',
          fileId: doc.file_id,
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          fileSize: doc.file_size,
        });
      }
    }

    if (tgMessage.photo && tgMessage.photo.length > 0) {
      // Take the largest photo (last in the array)
      const largest = tgMessage.photo[tgMessage.photo.length - 1];
      if (largest.file_size && largest.file_size > MAX_ATTACHMENT_SIZE) {
        this.logger.warn(
          `Telegram photo too large (${largest.file_size} bytes): ${ATTACHMENT_SIZE_ERROR_MSG}`,
        );
      } else {
        attachments.push({
          type: 'photo',
          fileId: largest.file_id,
          fileSize: largest.file_size,
          width: largest.width,
          height: largest.height,
        });
      }
    }

    if (tgMessage.voice) {
      const voice = tgMessage.voice;
      if (voice.file_size && voice.file_size > MAX_ATTACHMENT_SIZE) {
        this.logger.warn(`Telegram voice too large: ${ATTACHMENT_SIZE_ERROR_MSG}`);
      } else {
        attachments.push({
          type: 'voice',
          fileId: voice.file_id,
          mimeType: voice.mime_type,
          fileSize: voice.file_size,
          duration: voice.duration,
        });
      }
    }

    return attachments;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatSenderName(tgMessage: TelegramMessage): string {
    const from = tgMessage.from;
    if (!from) return 'Unknown';
    const parts = [from.first_name, from.last_name].filter(Boolean);
    return parts.join(' ') || from.username || 'Unknown';
  }
}
