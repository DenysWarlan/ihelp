export interface StaffChatConversation {
  readonly id: string;
  readonly personName: string;
  readonly caseId: string;
  readonly lastMessage: string | null;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
  readonly topic: string | null;
  readonly status: string;
  readonly description: string | null;
  readonly contactMethod: string | null;
  readonly language: string | null;
  readonly country: string | null;
  readonly createdAt: string;
}

export type MessageStatus = 'sending' | 'sent' | 'read' | 'error';

export interface StaffChatMessage {
  readonly id: string;
  readonly content: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly isFromStaff: boolean;
  readonly sentAt: string;
  readonly status: MessageStatus;
}
