import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ConversationKind, Role } from '@prisma/client';

import { IsUuidFormat } from '../common/pipes/uuid-format.validator.js';

import {
  MAX_CONVERSATION_MESSAGE_LENGTH,
  MAX_CONVERSATION_PARTICIPANTS,
} from './conversations.const.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Optional title (used for group conversations)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    description: 'User IDs of the other participants (creator added automatically)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CONVERSATION_PARTICIPANTS)
  @IsUuidFormat({ each: true })
  participantIds!: string[];
}

export class SendConversationMessageDto {
  @ApiProperty({
    description: 'Message text content',
    maxLength: MAX_CONVERSATION_MESSAGE_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CONVERSATION_MESSAGE_LENGTH)
  content!: string;
}

// ---------------------------------------------------------------------------
// Response interfaces
// ---------------------------------------------------------------------------

export interface ConversationMemberResponse {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly role: Role;
}

export interface ConversationMessageResponse {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly content: string;
  readonly isDeleted: boolean;
  readonly createdAt: Date;
}

export interface ConversationResponse {
  readonly id: string;
  readonly kind: ConversationKind;
  readonly title: string | null;
  readonly createdById: string;
  readonly members: ConversationMemberResponse[];
  readonly lastMessage: string | null;
  readonly lastMessageAt: Date | null;
  readonly unreadCount: number;
  readonly createdAt: Date;
}

export interface ContactResponse {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}
