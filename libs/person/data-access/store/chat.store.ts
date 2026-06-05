import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';
import { ChatSocketService, NavBadgeService } from '@org/shared/data-access';
import type { SocketChatMessage, SocketMessagesRead } from '@org/shared/data-access';

import { ChatConversation, ChatMessage } from '../model/chat.model';
import { ChatService } from '../service/chat.service';

interface ChatState {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  selectedConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  conversations: [],
  messages: [],
  selectedConversationId: null,
  isLoading: false,
  error: null,
};

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const chatService = inject(ChatService);
    const socketService = inject(ChatSocketService);
    const navBadgeService = inject(NavBadgeService);

    return {
      loadConversations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            chatService.getConversations().pipe(
              tap((conversations: ChatConversation[]) => {
                patchState(store, { conversations, isLoading: false });
                const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
                navBadgeService.setChatUnreadCount(totalUnread);
              }),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load conversations',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadMessages: rxMethod<string>(
        pipe(
          tap((conversationId: string) => {
            patchState(store, {
              isLoading: true,
              error: null,
              selectedConversationId: conversationId,
              messages: [],
            });
            socketService.connect();
            socketService.joinCase(conversationId);
          }),
          switchMap((conversationId: string) =>
            chatService.getMessages(conversationId).pipe(
              tap((messages: ChatMessage[]) => {
                patchState(store, { messages, isLoading: false });
              }),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load messages',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      sendMessage: rxMethod<{ conversationId: string; content: string }>(
        pipe(
          tap(({ content }) => {
            const tempMsg: ChatMessage = {
              id: `temp-${Date.now()}`,
              content,
              senderId: '',
              senderName: 'You',
              isFromPerson: true,
              sentAt: new Date().toISOString(),
              status: 'sending',
            };
            patchState(store, {
              messages: [...store.messages(), tempMsg],
            });
          }),
          switchMap(({ conversationId, content }) =>
            chatService.sendMessage(conversationId, content).pipe(
              tap((message: ChatMessage) => {
                const filtered = store.messages().filter(
                  (m) => !m.id.startsWith('temp-') && m.id !== message.id,
                );
                patchState(store, {
                  messages: [...filtered, message],
                });
              }),
              catchError(() => {
                const updated = store.messages().map((m) =>
                  m.id.startsWith('temp-') && m.status === 'sending'
                    ? { ...m, status: 'error' as const }
                    : m,
                );
                patchState(store, { messages: updated, error: 'Failed to send message' });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      handleSocketMessage(msg: SocketChatMessage): void {
        const selectedId = store.selectedConversationId();
        if (!selectedId || msg.caseId !== selectedId) return;

        const existing = store.messages().find((m) => m.id === msg.id);
        if (existing) return;

        const mapped: ChatMessage = {
          id: msg.id,
          content: msg.content ?? '',
          senderId: msg.senderId,
          senderName: msg.senderRole === 'PERSON' ? 'You' : 'Consultant',
          isFromPerson: msg.senderRole === 'PERSON',
          sentAt: msg.sentAt ?? msg.createdAt ?? new Date().toISOString(),
          status: 'sent',
        };

        patchState(store, {
          messages: [...store.messages(), mapped],
        });
      },

      markMessagesAsRead: rxMethod<void>(
        pipe(
          switchMap(() => {
            const unreadIds = store.messages()
              .filter((m: ChatMessage) => !m.isFromPerson && m.status !== 'read' && !m.id.startsWith('temp-'))
              .map((m: ChatMessage) => m.id);
            const selectedId = store.selectedConversationId();

            if (unreadIds.length === 0 || !selectedId) return EMPTY;

            return chatService.markAsRead(selectedId, unreadIds).pipe(
              tap(() => {
                socketService.emitRead(unreadIds);
                const updated = store.messages().map((m: ChatMessage) =>
                  unreadIds.includes(m.id) ? { ...m, status: 'read' as const } : m,
                );
                const updatedConvs = store.conversations().map((c: ChatConversation) =>
                  c.id === selectedId
                    ? { ...c, unreadCount: Math.max(0, c.unreadCount - unreadIds.length) }
                    : c,
                );
                patchState(store, { messages: updated, conversations: updatedConvs });
                const totalUnread = updatedConvs.reduce((sum: number, c: ChatConversation) => sum + c.unreadCount, 0);
                navBadgeService.setChatUnreadCount(totalUnread);
              }),
              catchError(() => EMPTY),
            );
          }),
        ),
      ),

      handleMessagesRead(data: SocketMessagesRead): void {
        const ids = new Set(data.messageIds);
        const updatedMessages = store.messages().map((m) =>
          ids.has(m.id) ? { ...m, status: 'read' as const } : m,
        );
        patchState(store, { messages: updatedMessages });

        const selectedId = store.selectedConversationId();
        if (selectedId) {
          const updatedConvs = store.conversations().map((c) =>
            c.id === selectedId
              ? { ...c, unreadCount: Math.max(0, c.unreadCount - data.count) }
              : c,
          );
          patchState(store, { conversations: updatedConvs });
          const totalUnread = updatedConvs.reduce((sum, c) => sum + c.unreadCount, 0);
          navBadgeService.setChatUnreadCount(totalUnread);
        }
      },
    };
  }),
  withHooks((store) => {
    const socketService = inject(ChatSocketService);

    return {
      onInit() {
        socketService.newMessage$.subscribe((msg) => {
          store.handleSocketMessage(msg);
        });
        socketService.messagesRead$.subscribe((data) => {
          store.handleMessagesRead(data);
        });
      },
    };
  }),
);
