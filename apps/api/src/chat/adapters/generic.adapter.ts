import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';

import { ChannelAdapter, DeliveryResult } from './channel-adapter.interface.js';

/**
 * GenericAdapter is the fallback adapter used when the platform cannot
 * be determined. It persists the message (handled by the service layer)
 * but does not perform any outbound delivery.
 *
 * Messages delivered through GenericAdapter are marked with a "generic"
 * channel indicator so the consultant is aware the source is unknown.
 */
@Injectable()
export class GenericAdapter implements ChannelAdapter {
  readonly channel = MessageChannel.WEB; // Fallback channel identifier
  private readonly logger = new Logger(GenericAdapter.name);

  async send(
    content: string,
    recipientChatId: string,
  ): Promise<DeliveryResult> {
    this.logger.debug(
      `Generic adapter — message saved but no outbound delivery for chat ${recipientChatId}`,
    );
    return {
      success: true,
      channel: MessageChannel.WEB,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true; // No external dependency — always healthy
  }
}
