import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  StaffChatConversation,
  StaffChatMessage,
} from '../model/staff-chat.model';

@Injectable({ providedIn: 'root' })
export class StaffChatService {
  private readonly http: HttpClient = inject(HttpClient);

  getConversations(): Observable<StaffChatConversation[]> {
    return this.http.get<StaffChatConversation[]>(
      '/api/chat/staff/conversations',
    );
  }

  getMessages(conversationId: string): Observable<StaffChatMessage[]> {
    return this.http.get<StaffChatMessage[]>(
      `/api/chat/staff/conversations/${conversationId}/messages`,
    );
  }

  sendMessage(
    conversationId: string,
    content: string,
  ): Observable<StaffChatMessage> {
    return this.http.post<StaffChatMessage>(
      `/api/chat/staff/conversations/${conversationId}/messages`,
      { content },
    );
  }
}
