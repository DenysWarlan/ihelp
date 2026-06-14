/** Conversation kind — mirrors the backend `ConversationKind` enum. */
export type ConversationKind =
  | 'STAFF_DIRECT'
  | 'STAFF_GROUP'
  | 'SUPERVISOR_CLIENT';

/** Role string as returned by the API (uppercase Prisma `Role`). */
export type ConversationRole =
  | 'PERSON'
  | 'CONSULTANT'
  | 'SUPERVISOR'
  | 'COORDINATOR'
  | 'ADMIN';

export interface ConversationMember {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly role: ConversationRole;
}

export interface Conversation {
  readonly id: string;
  readonly kind: ConversationKind;
  readonly title: string | null;
  readonly createdById: string;
  readonly members: ConversationMember[];
  readonly lastMessage: string | null;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
  readonly createdAt: string;
}

export type ConversationMessageStatus = 'sending' | 'sent' | 'error';

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly content: string;
  readonly isDeleted: boolean;
  readonly createdAt: string;
  readonly status: ConversationMessageStatus;
}

export interface ConversationContact {
  readonly id: string;
  readonly name: string;
  readonly role: ConversationRole;
}

/** Payload for creating a conversation (creator added automatically by API). */
export interface CreateConversationPayload {
  readonly title?: string;
  readonly participantIds: string[];
}

/** Realtime "new message" event payload from the gateway. */
export interface ConversationSocketMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly content: string;
  readonly isDeleted: boolean;
  readonly createdAt: string;
}

/** Realtime unread-badge notification payload from the gateway. */
export interface ConversationSocketNotify {
  readonly conversationId: string;
  readonly senderName: string;
  readonly preview: string;
}

/** Realtime typing indicator payload from the gateway. */
export interface ConversationSocketTyping {
  readonly conversationId: string;
  readonly userId: string;
  readonly isTyping: boolean;
}
