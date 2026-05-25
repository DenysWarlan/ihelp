import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ChatConversation, ChatMessage } from '../model/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http: HttpClient = inject(HttpClient);

  getConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>('/api/chat/conversations');
  }

  getMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `/api/chat/conversations/${conversationId}/messages`,
    );
  }

  sendMessage(
    conversationId: string,
    content: string,
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `/api/chat/conversations/${conversationId}/messages`,
      { content },
    );
  }
}
