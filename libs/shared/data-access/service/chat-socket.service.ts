import { inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface SocketChatMessage {
  readonly id: string;
  readonly caseId: string;
  readonly content: string | null;
  readonly senderId: string;
  readonly senderName?: string;
  readonly isFromStaff?: boolean;
  readonly isFromPerson?: boolean;
  readonly sentAt?: string;
  readonly createdAt?: string;
  readonly senderRole?: string;
  readonly isRead?: boolean;
}

export interface SocketMessagesRead {
  readonly messageIds: string[];
  readonly readBy: string;
  readonly count: number;
}

export interface SocketChatNotify {
  readonly caseId: string;
  readonly senderName: string;
  readonly preview: string;
}

@Injectable({ providedIn: 'root' })
export class ChatSocketService implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private socket: Socket | null = null;
  private readonly joinedRooms = new Set<string>();
  private readonly pendingJoins = new Set<string>();

  private readonly messageSubject = new Subject<SocketChatMessage>();
  readonly newMessage$: Observable<SocketChatMessage> =
    this.messageSubject.asObservable();

  private readonly messagesReadSubject = new Subject<SocketMessagesRead>();
  readonly messagesRead$: Observable<SocketMessagesRead> =
    this.messagesReadSubject.asObservable();

  private readonly notifySubject = new Subject<SocketChatNotify>();
  readonly notify$: Observable<SocketChatNotify> =
    this.notifySubject.asObservable();

  connect(): void {
    if (this.socket) return;

    const win = this.doc.defaultView;
    if (!win) return;

    const token = win.localStorage.getItem('ihelp_token');
    if (!token) return;

    // Connect to the API through the same origin (nginx/Railway proxy handles routing)
    // In production, Socket.io path /socket.io/ is proxied to the API server
    const apiUrl = `${win.location.origin}/chat`;

    this.socket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      // Join any rooms that were requested before connection was established
      for (const caseId of this.pendingJoins) {
        this.socket!.emit('chat:join', { caseId });
        this.joinedRooms.add(caseId);
      }
      this.pendingJoins.clear();
    });

    this.socket.on('chat:new_message', (msg: SocketChatMessage) => {
      this.messageSubject.next(msg);
    });

    this.socket.on('chat:messages_read', (data: SocketMessagesRead) => {
      this.messagesReadSubject.next(data);
    });

    this.socket.on('chat:notify', (data: SocketChatNotify) => {
      this.notifySubject.next(data);
    });
  }

  joinCase(caseId: string): void {
    if (this.joinedRooms.has(caseId)) return;

    if (this.socket?.connected) {
      this.socket.emit('chat:join', { caseId });
      this.joinedRooms.add(caseId);
    } else {
      // Socket not yet connected — queue the join
      this.pendingJoins.add(caseId);
    }
  }

  emitRead(messageIds: string[]): void {
    if (this.socket?.connected && messageIds.length > 0) {
      this.socket.emit('chat:read', { messageIds });
    }
  }

  leaveCase(caseId: string): void {
    this.joinedRooms.delete(caseId);
    this.pendingJoins.delete(caseId);
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
