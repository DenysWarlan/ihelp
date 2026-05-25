import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';

import { ChannelAdapter, DeliveryResult } from './channel-adapter.interface.js';

/**
 * WebAdapter delivers messages via Socket.io rooms.
 * "Sending" through the web channel simply means the message is already
 * persisted and the gateway broadcasts it — so this adapter is always healthy
 * and always reports success.
 */
@Injectable()
export class WebAdapter implements ChannelAdapter {
  readonly channel = MessageChannel.WEB;
  private readonly logger = new Logger(WebAdapter.name);

  async send(
    content: string,
    recipientChatId: string,
  ): Promise<DeliveryResult> {
    this.logger.debug(
      `Web delivery for chat ${recipientChatId} — handled by Socket.io gateway`,
    );
    return { success: true, channel: MessageChannel.WEB };
  }

  async healthCheck(): Promise<boolean> {
    return true; // Socket.io gateway is always reachable in-process
  }
}
