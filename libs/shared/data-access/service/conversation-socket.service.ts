import { inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import {
  CONVERSATION_SOCKET_EVENTS,
  CONVERSATION_SOCKET_NAMESPACE,
} from '../const/conversation.const';
import {
  ConversationSocketMessage,
  ConversationSocketNotify,
  ConversationSocketTyping,
} from '../model/conversation.model';

@Injectable({ providedIn: 'root' })
export class ConversationSocketService implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private socket: Socket | null = null;
  private readonly joinedRooms = new Set<string>();
  private readonly pendingJoins = new Set<string>();

  private readonly messageSubject = new Subject<ConversationSocketMessage>();
  readonly newMessage$: Observable<ConversationSocketMessage> =
    this.messageSubject.asObservable();

  private readonly notifySubject = new Subject<ConversationSocketNotify>();
  readonly notify$: Observable<ConversationSocketNotify> =
    this.notifySubject.asObservable();

  private readonly typingSubject = new Subject<ConversationSocketTyping>();
  readonly typing$: Observable<ConversationSocketTyping> =
    this.typingSubject.asObservable();

  connect(): void {
    if (this.socket) return;

    const win = this.doc.defaultView;
    if (!win) return;

    const token = win.localStorage.getItem('ihelp_token');
    if (!token) return;

    // Same-origin connection; nginx/Railway proxies /socket.io to the API.
    const url = `${win.location.origin}${CONVERSATION_SOCKET_NAMESPACE}`;

    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on(CONVERSATION_SOCKET_EVENTS.CONNECT, () => {
      for (const conversationId of this.pendingJoins) {
        this.socket!.emit(CONVERSATION_SOCKET_EVENTS.JOIN, { conversationId });
        this.joinedRooms.add(conversationId);
      }
      this.pendingJoins.clear();
    });

    this.socket.on(
      CONVERSATION_SOCKET_EVENTS.NEW_MESSAGE,
      (msg: ConversationSocketMessage) => this.messageSubject.next(msg),
    );

    this.socket.on(
      CONVERSATION_SOCKET_EVENTS.NOTIFY,
      (data: ConversationSocketNotify) => this.notifySubject.next(data),
    );

    this.socket.on(
      CONVERSATION_SOCKET_EVENTS.TYPING,
      (data: ConversationSocketTyping) => this.typingSubject.next(data),
    );
  }

  joinConversation(conversationId: string): void {
    if (this.joinedRooms.has(conversationId)) return;

    if (this.socket?.connected) {
      this.socket.emit(CONVERSATION_SOCKET_EVENTS.JOIN, { conversationId });
      this.joinedRooms.add(conversationId);
    } else {
      this.pendingJoins.add(conversationId);
    }
  }

  emitTyping(conversationId: string, isTyping: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit(CONVERSATION_SOCKET_EVENTS.TYPING, {
        conversationId,
        isTyping,
      });
    }
  }

  emitRead(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit(CONVERSATION_SOCKET_EVENTS.READ, { conversationId });
    }
  }

  leaveConversation(conversationId: string): void {
    this.joinedRooms.delete(conversationId);
    this.pendingJoins.delete(conversationId);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.joinedRooms.clear();
    this.pendingJoins.clear();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
