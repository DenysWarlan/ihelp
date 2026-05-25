import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@prisma/client';

import { MessageService } from '../message.service.js';
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
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  /**
   * Process an incoming Telegram webhook update.
   * Handles new messages and edited messages.
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    if (update.edited_message) {
      await this.handleEditedMessage(update.edited_message);
      return;
    }

    if (update.message) {
      await this.handleNewMessage(update.message);
      return;
    }

    this.logger.debug(`Ignoring unsupported Telegram update type: ${update.update_id}`);
  }

  // ---------------------------------------------------------------------------
  // New message
  // ---------------------------------------------------------------------------

  private async handleNewMessage(tgMessage: TelegramMessage): Promise<void> {
    const channelMsgId = tgMessage.message_id.toString();
    const channelChatId = tgMessage.chat.id.toString();
    const content = tgMessage.text ?? tgMessage.caption ?? '';
    const originalTs = new Date(tgMessage.date * 1000);

    // Build attachment metadata if present
    const attachments = this.extractAttachments(tgMessage);

    await this.messageService.createFromWebhook({
      channel: MessageChannel.TELEGRAM,
      channelMsgId,
      channelChatId,
      content,
      originalTs,
      attachments: attachments.length > 0 ? attachments : undefined,
      senderName: this.formatSenderName(tgMessage),
    });
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
