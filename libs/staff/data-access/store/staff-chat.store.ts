import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

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

    return {
      loadConversations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            chatService.getConversations().pipe(
              tap((conversations: StaffChatConversation[]) =>
                patchState(store, { conversations, isLoading: false }),
              ),
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
          tap((conversationId: string) =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedConversationId: conversationId,
              messages: [],
            }),
          ),
          switchMap((conversationId: string) =>
            chatService.getMessages(conversationId).pipe(
              tap((messages: StaffChatMessage[]) =>
                patchState(store, { messages, isLoading: false }),
              ),
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
          switchMap(({ conversationId, content }) =>
            chatService.sendMessage(conversationId, content).pipe(
              tap((message: StaffChatMessage) =>
                patchState(store, {
                  messages: [...store.messages(), message],
                }),
              ),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to send message',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
