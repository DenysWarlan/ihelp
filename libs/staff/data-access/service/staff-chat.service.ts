import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  StaffChatConversation,
  StaffChatMessage,
  MessageStatus,
} from '../model/staff-chat.model';

interface BackendStaffMessage {
  readonly id: string;
  readonly content: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly isFromStaff: boolean;
  readonly isRead: boolean;
  readonly sentAt: string;
}

@Injectable({ providedIn: 'root' })
export class StaffChatService {
  private readonly http: HttpClient = inject(HttpClient);

  getConversations(): Observable<StaffChatConversation[]> {
    return this.http.get<StaffChatConversation[]>(
      '/api/chat/staff/conversations',
    );
  }

  getMessages(conversationId: string): Observable<StaffChatMessage[]> {
    return this.http.get<BackendStaffMessage[]>(
      `/api/chat/staff/conversations/${conversationId}/messages`,
    ).pipe(
      map((msgs) => msgs.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        isFromStaff: m.isFromStaff,
        sentAt: m.sentAt,
        status: (m.isRead ? 'read' : 'sent') as MessageStatus,
      }))),
    );
  }

  sendMessage(
    conversationId: string,
    content: string,
  ): Observable<StaffChatMessage> {
    return this.http.post<BackendStaffMessage>(
      `/api/chat/staff/conversations/${conversationId}/messages`,
      { content },
    ).pipe(
      map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        isFromStaff: m.isFromStaff,
        sentAt: m.sentAt,
        status: 'sent' as MessageStatus,
      })),
    );
  }
}
