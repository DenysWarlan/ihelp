import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

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

    return {
      loadConversations: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            chatService.getConversations().pipe(
              tap((conversations: ChatConversation[]) =>
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
              tap((messages: ChatMessage[]) =>
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
              tap((message: ChatMessage) =>
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
