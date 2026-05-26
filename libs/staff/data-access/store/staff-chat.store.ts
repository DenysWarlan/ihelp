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

import {
  StaffChatConversation,
  StaffChatMessage,
} from '../model/staff-chat.model';
import { StaffChatService } from '../service/staff-chat.service';

interface StaffChatState {
  conversations: StaffChatConversation[];
  messages: StaffChatMessage[];
  selectedConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: StaffChatState = {
  conversations: [],
  messages: [],
  selectedConversationId: null,
  isLoading: false,
  error: null,
};

export const StaffChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const chatService = inject(StaffChatService);
    const socketService = inject(ChatSocketService);
    const navBadgeService = inject(NavBadgeService);

    return {
      loadConversations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            chatService.getConversations().pipe(
              tap((conversations: StaffChatConversation[]) => {
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
            // Connect to WebSocket and join the case room
            socketService.connect();
            socketService.joinCase(conversationId);
          }),
          switchMap((conversationId: string) =>
            chatService.getMessages(conversationId).pipe(
              tap((messages: StaffChatMessage[]) => {
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
            // Optimistic: show message as "sending"
            const tempMsg: StaffChatMessage = {
              id: `temp-${Date.now()}`,
              content,
              senderId: '',
              senderName: '',
              isFromStaff: true,
              sentAt: new Date().toISOString(),
              status: 'sending',
            };
            patchState(store, {
              messages: [...store.messages(), tempMsg],
            });
          }),
          switchMap(({ conversationId, content }) =>
            chatService.sendMessage(conversationId, content).pipe(
              tap((message: StaffChatMessage) => {
                // Replace temp message with real one, dedup socket
                const filtered = store.messages().filter(
                  (m) => !m.id.startsWith('temp-') && m.id !== message.id,
                );
                patchState(store, {
                  messages: [...filtered, message],
                });
              }),
              catchError(() => {
                // Mark last temp message as error
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

        // Avoid duplicates (message already added optimistically by sendMessage)
        const existing = store.messages().find((m) => m.id === msg.id);
        if (existing) return;

        const mapped: StaffChatMessage = {
          id: msg.id,
          content: msg.content ?? '',
          senderId: msg.senderId,
          senderName: msg.senderName ?? '',
          isFromStaff: msg.isFromStaff ?? msg.senderRole !== 'PERSON',
          sentAt: msg.sentAt ?? msg.createdAt ?? new Date().toISOString(),
          status: 'sent',
        };

        patchState(store, {
          messages: [...store.messages(), mapped],
        });
      },

      markMessagesAsRead(): void {
        const unreadIds = store.messages()
          .filter((m) => !m.isFromStaff && m.status !== 'read' && !m.id.startsWith('temp-'))
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          socketService.emitRead(unreadIds);
        }
      },

      handleMessagesRead(data: SocketMessagesRead): void {
        const ids = new Set(data.messageIds);
        const updatedMessages = store.messages().map((m) =>
          ids.has(m.id) ? { ...m, status: 'read' as const } : m,
        );
        patchState(store, { messages: updatedMessages });

        // Update conversation unread counts: messages that were ours don't affect count,
        // but if we received read for messages from others, update the sidebar
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
