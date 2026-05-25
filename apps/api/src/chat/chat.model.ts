import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MessageChannel, Role } from '@prisma/client';
import { Type } from 'class-transformer';

import { MAX_MESSAGE_LENGTH } from './chat.const.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

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

export class MessageQueryDto {
  @ApiPropertyOptional({ description: 'Cursor: message ID to start after' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size (default 50, max 100)', default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// ---------------------------------------------------------------------------
// Response
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
  readonly readAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaginatedMessagesResponse {
  readonly data: MessageResponse[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
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

export interface SocketUser {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
}
