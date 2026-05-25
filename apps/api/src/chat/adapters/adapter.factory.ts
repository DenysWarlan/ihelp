import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';

import { ChannelAdapter, DeliveryResult } from './channel-adapter.interface.js';
import { WebAdapter } from './web.adapter.js';
import { TelegramAdapter } from './telegram.adapter.js';
import { GenericAdapter } from './generic.adapter.js';

/**
 * Fallback chain order: prefer the requested channel, then fall through
 * Telegram -> WEB -> Generic.
 */
const FALLBACK_CHAIN: MessageChannel[] = [
  MessageChannel.TELEGRAM,
  MessageChannel.WEB,
];

@Injectable()
export class AdapterFactory {
  private readonly logger = new Logger(AdapterFactory.name);
  private readonly adapters: Map<MessageChannel, ChannelAdapter>;

  constructor(
    private readonly webAdapter: WebAdapter,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly genericAdapter: GenericAdapter,
  ) {
    this.adapters = new Map<MessageChannel, ChannelAdapter>([
      [MessageChannel.WEB, this.webAdapter],
      [MessageChannel.TELEGRAM, this.telegramAdapter],
    ]);
  }

  /** Resolve the adapter for the given channel. Falls back to GenericAdapter. */
  getAdapter(channel: MessageChannel): ChannelAdapter {
    return this.adapters.get(channel) ?? this.genericAdapter;
  }

  /**
   * Send a message through the requested channel with fallback.
   * If the primary channel is unhealthy, walks the fallback chain
   * (Telegram -> WEB) and alerts on fallback usage.
   */
  async sendWithFallback(
    channel: MessageChannel,
    content: string,
    recipientChatId: string,
    attachments?: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    const primaryAdapter = this.getAdapter(channel);

    // Try primary channel first
    const isHealthy = await primaryAdapter.healthCheck();
    if (isHealthy) {
      const result = await primaryAdapter.send(content, recipientChatId, attachments);
      if (result.success) {
        return result;
      }
      this.logger.warn(
        `Primary channel ${channel} send failed: ${result.error}`,
      );
    } else {
      this.logger.warn(`Primary channel ${channel} is unhealthy — trying fallback chain`);
    }

    // Walk the fallback chain
    for (const fallbackChannel of FALLBACK_CHAIN) {
      if (fallbackChannel === channel) continue; // Skip the already-failed primary

      const fallbackAdapter = this.adapters.get(fallbackChannel);
      if (!fallbackAdapter) continue;

      const fallbackHealthy = await fallbackAdapter.healthCheck();
      if (!fallbackHealthy) continue;

      const fallbackResult = await fallbackAdapter.send(
        content,
        recipientChatId,
        attachments,
      );

      if (fallbackResult.success) {
        this.logger.warn(
          `FALLBACK ALERT: Message delivered via ${fallbackChannel} instead of ${channel}`,
        );
        return { ...fallbackResult, fallbackUsed: true };
      }
    }

    // All channels failed — use generic adapter as last resort
    this.logger.error(
      `FALLBACK ALERT: All channels failed for message to ${recipientChatId}. Using generic adapter.`,
    );
    const genericResult = await this.genericAdapter.send(content, recipientChatId);
    return { ...genericResult, fallbackUsed: true };
  }
}
