import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';

import {
  StaffChatConversation,
  StaffChatMessage,
} from '../model/staff-chat.model';
import { StaffChatStore } from '../store/staff-chat.store';

export interface StaffChatMessageForm {
  readonly content: string;
}

@Injectable({ providedIn: 'root' })
export class StaffChatFacade {
  private readonly store = inject(StaffChatStore);

  readonly conversations: Signal<StaffChatConversation[]> =
    this.store.conversations;
  readonly messages: Signal<StaffChatMessage[]> = this.store.messages;
  readonly selectedConversationId: Signal<string | null> =
    this.store.selectedConversationId;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  readonly selectedConversation: Signal<StaffChatConversation | null> = computed(
    () => {
      const id = this.selectedConversationId();
      if (!id) return null;
      return this.conversations().find((c) => c.id === id) ?? null;
    },
  );

  readonly messageForm: WritableSignal<StaffChatMessageForm> = signal({
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

  markMessagesAsRead(): void {
    this.store.markMessagesAsRead();
  }

  updateMessageContent(content: string): void {
    this.messageForm.set({ content });
  }
}
