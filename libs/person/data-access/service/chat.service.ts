import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ChatConversation, ChatMessage, MessageStatus } from '../model/chat.model';

interface BackendMessage {
  readonly id: string;
  readonly careCaseId: string;
  readonly senderId: string;
  readonly senderRole: string;
  readonly channel: string;
  readonly content: string | null;
  readonly isRead: boolean;
  readonly isEdited: boolean;
  readonly isDeleted: boolean;
  readonly createdAt: string;
}

interface BackendMessagesResponse {
  readonly data: BackendMessage[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http: HttpClient = inject(HttpClient);

  getConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>('/api/person-cabinet/conversations');
  }

  getMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<BackendMessagesResponse>(
      `/api/cases/${conversationId}/messages`,
    ).pipe(
      map((res) =>
        res.data
          .filter((m) => !m.isDeleted && m.content)
          .map((m) => ({
            id: m.id,
            content: m.content!,
            senderId: m.senderId,
            senderName: m.senderRole === 'PERSON' ? 'You' : 'Consultant',
            isFromPerson: m.senderRole === 'PERSON',
            sentAt: m.createdAt,
            status: (m.isRead ? 'read' : 'sent') as MessageStatus,
          })),
      ),
    );
  }

  sendMessage(
    conversationId: string,
    content: string,
  ): Observable<ChatMessage> {
    return this.http.post<BackendMessage>(
      `/api/cases/${conversationId}/messages`,
      { content },
    ).pipe(
      map((m) => ({
        id: m.id,
        content: m.content ?? '',
        senderId: m.senderId,
        senderName: 'You',
        isFromPerson: true,
        sentAt: m.createdAt,
        status: 'sent' as MessageStatus,
      })),
    );
  }
}
