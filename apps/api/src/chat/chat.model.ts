import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MessageChannel, Role } from '@prisma/client';
import { Type } from 'class-transformer';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

import { MAX_MESSAGE_LENGTH } from './chat.const.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class MarkAsReadDto {
  @ApiProperty({ description: 'Array of message IDs to mark as read' })
  @IsArray()
  @IsUuidFormat({ each: true })
  messageIds!: string[];
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message text content', maxLength: MAX_MESSAGE_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    enum: MessageChannel,
    default: MessageChannel.WEB,
    description: 'Message channel (MVP: WEB or TELEGRAM)',
  })
  @IsOptional()
  @IsEnum(MessageChannel)
  channel?: MessageChannel;

  @ApiPropertyOptional({ description: 'Attachments metadata (JSON)' })
  @IsOptional()
  @IsObject()
  attachments?: Record<string, unknown>;
}

export class EditMessageDto {
  @ApiProperty({ description: 'Updated message content', maxLength: MAX_MESSAGE_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;
}

export class MessageQueryDto {
  @ApiPropertyOptional({ description: 'Cursor: message ID to start after' })
  @IsOptional()
  @IsUuidFormat()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size (default 50, max 100)', default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface MessageResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly senderId: string;
  readonly senderRole: Role;
  readonly channel: MessageChannel;
  readonly content: string | null;
  readonly attachments: unknown;
  readonly isRead: boolean;
  readonly isEdited: boolean;
  readonly isDeleted: boolean;
  readonly originalTs: Date | null;
  readonly readAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaginatedMessagesResponse {
  readonly data: MessageResponse[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface MessageVersionResponse {
  readonly id: string;
  readonly messageId: string;
  readonly version: number;
  readonly content: string | null;
  readonly editedAt: Date;
}

export interface ActiveChannelResponse {
  readonly caseId: string;
  readonly activeChannel: MessageChannel | null;
}

// ---------------------------------------------------------------------------
// Delivery result (used by adapters)
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  readonly success: boolean;
  readonly channel: MessageChannel;
  readonly externalMessageId?: string;
  readonly error?: string;
  readonly fallbackUsed?: boolean;
}

// ---------------------------------------------------------------------------
// Attachment metadata (stored in Message.attachments JSON)
// ---------------------------------------------------------------------------

export interface AttachmentMeta {
  readonly type: 'document' | 'photo' | 'voice' | 'video' | 'audio';
  readonly fileId: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly fileSize?: number;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
}

// ---------------------------------------------------------------------------
// Telegram webhook types (subset of Bot API)
// ---------------------------------------------------------------------------

export interface TelegramUpdate {
  readonly update_id: number;
  readonly message?: TelegramMessage;
  readonly edited_message?: TelegramMessage;
}

export interface TelegramMessage {
  readonly message_id: number;
  readonly date: number;
  readonly chat: { readonly id: number; readonly type: string };
  readonly from?: {
    readonly id: number;
    readonly first_name: string;
    readonly last_name?: string;
    readonly username?: string;
  };
  readonly text?: string;
  readonly caption?: string;
  readonly document?: {
    readonly file_id: string;
    readonly file_name?: string;
    readonly mime_type?: string;
    readonly file_size?: number;
  };
  readonly photo?: ReadonlyArray<{
    readonly file_id: string;
    readonly width: number;
    readonly height: number;
    readonly file_size?: number;
  }>;
  readonly voice?: {
    readonly file_id: string;
    readonly mime_type?: string;
    readonly file_size?: number;
    readonly duration: number;
  };
}

// ---------------------------------------------------------------------------
// Webhook creation DTO (internal, not exposed via API)
// ---------------------------------------------------------------------------

export interface WebhookMessageInput {
  readonly channel: MessageChannel;
  readonly channelMsgId: string;
  readonly channelChatId: string;
  readonly content: string;
  readonly originalTs: Date;
  readonly attachments?: AttachmentMeta[];
  readonly senderName?: string;
}

// ---------------------------------------------------------------------------
// Socket.io payloads
// ---------------------------------------------------------------------------

export interface ChatJoinPayload {
  readonly caseId: string;
}

export interface ChatMessagePayload {
  readonly caseId: string;
  readonly content: string;
  readonly channel?: MessageChannel;
  readonly attachments?: Record<string, unknown>;
}

export interface ChatTypingPayload {
  readonly caseId: string;
  readonly isTyping: boolean;
}

export interface ChatReadPayload {
  readonly messageIds: string[];
}

export interface ChatEditPayload {
  readonly messageId: string;
  readonly caseId: string;
  readonly content: string;
}

export interface ChatDeletePayload {
  readonly messageId: string;
  readonly caseId: string;
}

export interface SocketUser {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
}
