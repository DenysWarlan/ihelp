export type MessageStatus = 'sending' | 'sent' | 'read' | 'error';

export interface ChatMessage {
  readonly id: string;
  readonly content: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly isFromPerson: boolean;
  readonly sentAt: string;
  readonly status: MessageStatus;
}

export interface ChatConversation {
  readonly id: string;
  readonly consultantName: string;
  readonly lastMessage: string | null;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
}
