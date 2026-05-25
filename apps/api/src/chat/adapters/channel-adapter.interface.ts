import { MessageChannel } from '@prisma/client';

/**
 * Result of a message delivery attempt through a channel adapter.
 */
export interface DeliveryResult {
  readonly success: boolean;
  readonly channel: MessageChannel;
  readonly externalMessageId?: string;
  readonly error?: string;
  readonly fallbackUsed?: boolean;
}

/**
 * Channel adapter interface for outbound message delivery.
 * Each supported channel (WEB, TELEGRAM, etc.) implements this interface
 * to provide platform-specific delivery and health-check logic.
 */
export interface ChannelAdapter {
  /** The channel this adapter handles. */
  readonly channel: MessageChannel;

  /**
   * Send a message to the recipient through this channel.
   * @param content  - Text content of the message.
   * @param recipientChatId - Channel-specific recipient identifier.
   * @param attachments - Optional attachment metadata.
   */
  send(
    content: string,
    recipientChatId: string,
    attachments?: Record<string, unknown>,
  ): Promise<DeliveryResult>;

  /**
   * Verify that the channel is currently reachable and configured.
   * Used before attempting delivery to decide whether to fall back.
   */
  healthCheck(): Promise<boolean>;
}
