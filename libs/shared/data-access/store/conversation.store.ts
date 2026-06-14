import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import { NavBadgeService } from '../service/nav-badge.service';
import { ConversationService } from '../service/conversation.service';
import { ConversationSocketService } from '../service/conversation-socket.service';
import {
  Conversation,
  ConversationContact,
  ConversationMessage,
  ConversationSocketMessage,
  ConversationSocketNotify,
  CreateConversationPayload,
} from '../model/conversation.model';

interface ConversationState {
  conversations: Conversation[];
  contacts: ConversationContact[];
  messages: ConversationMessage[];
  selectedConversationId: string | null;
  currentUserId: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}

const initialState: ConversationState = {
  conversations: [],
  contacts: [],
  messages: [],
  selectedConversationId: null,
  currentUserId: null,
  isLoading: false,
  isSending: false,
  error: null,
};

/** Reads the `sub` claim from the stored JWT to identify the current user. */
function readCurrentUserId(doc: Document): string | null {
  const win = doc.defaultView;
  const token = win?.localStorage.getItem('ihelp_token');
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const raw = (globalThis as unknown as { atob(s: string): string }).atob(
      base64,
    );
    return JSON.parse(raw).sub ?? null;
  } catch {
    return null;
  }
}

function totalUnread(conversations: Conversation[]): number {
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

export const ConversationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const conversationService = inject(ConversationService);
    const socketService = inject(ConversationSocketService);
    const navBadgeService = inject(NavBadgeService);

    return {
      loadConversations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            conversationService.getMyConversations().pipe(
              tap((conversations: Conversation[]) => {
                patchState(store, { conversations, isLoading: false });
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

      loadContacts: rxMethod<void>(
        pipe(
          switchMap(() =>
            conversationService.getContacts().pipe(
              tap((contacts: ConversationContact[]) => {
                patchState(store, { contacts });
              }),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),

      createConversation: rxMethod<CreateConversationPayload>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((payload: CreateConversationPayload) =>
            conversationService.createConversation(payload).pipe(
              tap((conversation: Conversation) => {
                const existing = store
                  .conversations()
                  .filter((c) => c.id !== conversation.id);
                patchState(store, {
                  conversations: [conversation, ...existing],
                  selectedConversationId: conversation.id,
                  isLoading: false,
                });
              }),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to start conversation',
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
            socketService.joinConversation(conversationId);
          }),
          switchMap((conversationId: string) =>
            conversationService.getMessages(conversationId).pipe(
              tap((messages: ConversationMessage[]) => {
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
            const tempMsg: ConversationMessage = {
              id: `temp-${Date.now()}`,
              conversationId: store.selectedConversationId() ?? '',
              senderId: store.currentUserId() ?? '',
              senderName: '',
              content,
              isDeleted: false,
              createdAt: new Date().toISOString(),
              status: 'sending',
            };
            patchState(store, {
              messages: [...store.messages(), tempMsg],
              isSending: true,
            });
          }),
          switchMap(({ conversationId, content }) =>
            conversationService.sendMessage(conversationId, content).pipe(
              tap((message: ConversationMessage) => {
                const filtered = store
                  .messages()
                  .filter(
                    (m) => !m.id.startsWith('temp-') && m.id !== message.id,
                  );
                patchState(store, {
                  messages: [...filtered, message],
                  isSending: false,
                });
              }),
              catchError(() => {
                const updated = store.messages().map((m) =>
                  m.id.startsWith('temp-') && m.status === 'sending'
                    ? { ...m, status: 'error' as const }
                    : m,
                );
                patchState(store, {
                  messages: updated,
                  isSending: false,
                  error: 'Failed to send message',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      markRead: rxMethod<string>(
        pipe(
          switchMap((conversationId: string) =>
            conversationService.markRead(conversationId).pipe(
              tap(() => {
                socketService.emitRead(conversationId);
                const updatedConvs = store
                  .conversations()
                  .map((c) =>
                    c.id === conversationId ? { ...c, unreadCount: 0 } : c,
                  );
                patchState(store, { conversations: updatedConvs });
                navBadgeService.setChatUnreadCount(totalUnread(updatedConvs));
              }),
              catchError(() => EMPTY),
            ),
          ),
        ),
      ),

      handleSocketMessage(msg: ConversationSocketMessage): void {
        const selectedId = store.selectedConversationId();

        // Append to the open thread (dedup against optimistic + echo).
        if (selectedId && msg.conversationId === selectedId) {
          const existing = store.messages().find((m) => m.id === msg.id);
          if (!existing) {
            const mine = msg.senderId === store.currentUserId();
            const withoutTemp = mine
              ? store.messages().filter((m) => !m.id.startsWith('temp-'))
              : store.messages();
            patchState(store, {
              messages: [
                ...withoutTemp,
                {
                  id: msg.id,
                  conversationId: msg.conversationId,
                  senderId: msg.senderId,
                  senderName: msg.senderName,
                  content: msg.content,
                  isDeleted: msg.isDeleted,
                  createdAt: msg.createdAt,
                  status: 'sent' as const,
                },
              ],
            });
          }
        }

        // Keep the conversation list preview + ordering fresh.
        const isOpenAndMine =
          selectedId === msg.conversationId &&
          msg.senderId === store.currentUserId();
        const updatedConvs = store.conversations().map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: msg.content,
                lastMessageAt: msg.createdAt,
                unreadCount:
                  selectedId === msg.conversationId || isOpenAndMine
                    ? c.unreadCount
                    : c.unreadCount + 1,
              }
            : c,
        );
        patchState(store, { conversations: updatedConvs });
        navBadgeService.setChatUnreadCount(totalUnread(updatedConvs));
      },

      handleNotify(data: ConversationSocketNotify): void {
        // If the conversation isn't in the list yet (created elsewhere), reload.
        const known = store
          .conversations()
          .some((c) => c.id === data.conversationId);
        if (!known) {
          conversationService
            .getMyConversations()
            .pipe(catchError(() => EMPTY))
            .subscribe((conversations) => {
              patchState(store, { conversations });
              navBadgeService.setChatUnreadCount(totalUnread(conversations));
            });
        }
      },

      setCurrentUserId(userId: string | null): void {
        patchState(store, { currentUserId: userId });
      },

      clearSelection(): void {
        patchState(store, { selectedConversationId: null, messages: [] });
      },
    };
  }),
  withHooks((store) => {
    const socketService = inject(ConversationSocketService);
    const doc = inject(DOCUMENT);

    return {
      onInit() {
        store.setCurrentUserId(readCurrentUserId(doc));
        socketService.newMessage$.subscribe((msg) =>
          store.handleSocketMessage(msg),
        );
        socketService.notify$.subscribe((data) => store.handleNotify(data));
      },
    };
  }),
);
