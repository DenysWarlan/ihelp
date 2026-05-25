import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';

import { ChatConversation, ChatMessage } from '../model/chat.model';
import { ChatStore } from '../store/chat.store';

export interface ChatMessageForm {
  readonly content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatFacade {
  private readonly store = inject(ChatStore);

  readonly conversations: Signal<ChatConversation[]> = this.store.conversations;
  readonly messages: Signal<ChatMessage[]> = this.store.messages;
  readonly selectedConversationId: Signal<string | null> =
    this.store.selectedConversationId;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  readonly messageForm: WritableSignal<ChatMessageForm> = signal({
    content: '',
  });

  loadConversations(): void {
    this.store.loadConversations();
  }

  selectConversation(conversationId: string): void {
    this.store.loadMessages(conversationId);
  }

  sendMessage(content: string): void {
    const conversationId = this.selectedConversationId();
    if (conversationId && content.trim()) {
      this.store.sendMessage({ conversationId, content: content.trim() });
      this.messageForm.set({ content: '' });
    }
  }

  updateMessageContent(content: string): void {
    this.messageForm.set({ content });
  }
}
