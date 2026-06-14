import {
  computed,
  inject,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';

import {
  Conversation,
  ConversationContact,
  ConversationMessage,
} from '../model/conversation.model';
import { ConversationStore } from '../store/conversation.store';
import { ConversationSocketService } from './conversation-socket.service';

export interface ConversationMessageForm {
  readonly content: string;
}

@Injectable({ providedIn: 'root' })
export class ConversationFacade {
  private readonly store = inject(ConversationStore);
  private readonly socket = inject(ConversationSocketService);

  readonly conversations: Signal<Conversation[]> = this.store.conversations;
  readonly contacts: Signal<ConversationContact[]> = this.store.contacts;
  readonly messages: Signal<ConversationMessage[]> = this.store.messages;
  readonly selectedConversationId: Signal<string | null> =
    this.store.selectedConversationId;
  readonly currentUserId: Signal<string | null> = this.store.currentUserId;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isSending: Signal<boolean> = this.store.isSending;
  readonly error: Signal<string | null> = this.store.error;

  readonly selectedConversation: Signal<Conversation | null> = computed(() => {
    const id = this.selectedConversationId();
    if (!id) return null;
    return this.conversations().find((c) => c.id === id) ?? null;
  });

  readonly messageForm: WritableSignal<ConversationMessageForm> = signal({
    content: '',
  });

  loadConversations(): void {
    this.store.loadConversations();
  }

  loadContacts(): void {
    this.store.loadContacts();
  }

  selectConversation(conversationId: string): void {
    this.store.loadMessages(conversationId);
    this.store.markRead(conversationId);
  }

  startConversation(participantIds: string[], title?: string): void {
    if (participantIds.length === 0) return;
    this.store.createConversation({ participantIds, title });
  }

  sendMessage(content: string): void {
    const conversationId = this.selectedConversationId();
    const trimmed = content.trim();
    if (conversationId && trimmed) {
      this.store.sendMessage({ conversationId, content: trimmed });
      this.messageForm.set({ content: '' });
    }
  }

  markRead(): void {
    const conversationId = this.selectedConversationId();
    if (conversationId) {
      this.store.markRead(conversationId);
    }
  }

  notifyTyping(isTyping: boolean): void {
    const conversationId = this.selectedConversationId();
    if (conversationId) {
      this.socket.emitTyping(conversationId, isTyping);
    }
  }

  updateMessageContent(content: string): void {
    this.messageForm.set({ content });
  }

  /** Display label for a conversation (group title, or the other member's name). */
  conversationLabel(conversation: Conversation): string {
    if (conversation.title) return conversation.title;
    const me = this.currentUserId();
    const others = conversation.members.filter((m) => m.userId !== me);
    if (others.length === 0) return conversation.members[0]?.name ?? '';
    return others.map((m) => m.name).join(', ');
  }
}
