import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  CONVERSATION_API_BASE,
  CONVERSATION_PAGE_SIZE,
} from '../const/conversation.const';
import {
  Conversation,
  ConversationContact,
  ConversationMessage,
  CreateConversationPayload,
} from '../model/conversation.model';

interface BackendConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly content: string;
  readonly isDeleted: boolean;
  readonly createdAt: string;
}

function toMessage(m: BackendConversationMessage): ConversationMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: m.senderName,
    content: m.content,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt,
    status: 'sent',
  };
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http: HttpClient = inject(HttpClient);

  getMyConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${CONVERSATION_API_BASE}/my`);
  }

  getContacts(): Observable<ConversationContact[]> {
    return this.http.get<ConversationContact[]>(
      `${CONVERSATION_API_BASE}/contacts`,
    );
  }

  createConversation(
    payload: CreateConversationPayload,
  ): Observable<Conversation> {
    return this.http.post<Conversation>(CONVERSATION_API_BASE, payload);
  }

  getMessages(
    conversationId: string,
    limit: number = CONVERSATION_PAGE_SIZE,
  ): Observable<ConversationMessage[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http
      .get<BackendConversationMessage[]>(
        `${CONVERSATION_API_BASE}/${conversationId}/messages`,
        { params },
      )
      .pipe(map((msgs) => msgs.map(toMessage)));
  }

  sendMessage(
    conversationId: string,
    content: string,
  ): Observable<ConversationMessage> {
    return this.http
      .post<BackendConversationMessage>(
        `${CONVERSATION_API_BASE}/${conversationId}/messages`,
        { content },
      )
      .pipe(map(toMessage));
  }

  markRead(conversationId: string): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(
      `${CONVERSATION_API_BASE}/${conversationId}/read`,
      {},
    );
  }
}
