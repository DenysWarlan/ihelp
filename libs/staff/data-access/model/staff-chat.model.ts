export interface StaffChatConversation {
  readonly id: string;
  readonly personName: string;
  readonly caseId: string;
  readonly lastMessage: string | null;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
}

export interface StaffChatMessage {
  readonly id: string;
  readonly content: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly isFromStaff: boolean;
  readonly sentAt: string;
}
