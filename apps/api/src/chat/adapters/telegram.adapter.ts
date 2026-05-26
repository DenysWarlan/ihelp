import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@prisma/client';

import { ChannelAdapter, DeliveryResult } from './channel-adapter.interface.js';
import { TELEGRAM_API_BASE } from '../telegram/telegram.const.js';

/**
 * TelegramAdapter sends messages through the Telegram Bot API.
 * Health check validates that the configured bot token is valid via getMe.
 */
@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  readonly channel = MessageChannel.TELEGRAM;
  private readonly logger = new Logger(TelegramAdapter.name);
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  async send(
    content: string,
    recipientChatId: string,
    attachments?: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    this.logger.log(`Sending to Telegram: chatId=${recipientChatId}, content="${content.slice(0, 50)}"`);

    if (!this.botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not set — cannot send');
      return {
        success: false,
        channel: MessageChannel.TELEGRAM,
        error: 'Telegram bot token is not configured',
      };
    }

    try {
      const url = `${TELEGRAM_API_BASE}${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipientChatId,
          text: content,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`Telegram sendMessage failed: ${response.status} ${body}`);
        return {
          success: false,
          channel: MessageChannel.TELEGRAM,
          error: `Telegram API error: ${response.status}`,
        };
      }

      const result = (await response.json()) as {
        ok: boolean;
        result?: { message_id: number };
      };

      this.logger.log(`Telegram message sent OK: chatId=${recipientChatId}, tg_msg_id=${result.result?.message_id}`);
      return {
        success: true,
        channel: MessageChannel.TELEGRAM,
        externalMessageId: result.result?.message_id?.toString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to send Telegram message',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        channel: MessageChannel.TELEGRAM,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.botToken) {
      return false;
    }

    try {
      const url = `${TELEGRAM_API_BASE}${this.botToken}/getMe`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}
