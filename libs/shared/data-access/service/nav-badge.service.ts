import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Signal, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { catchError, EMPTY, tap } from 'rxjs';

interface ConversationSummary {
  readonly unreadCount: number;
}

const ENDPOINTS: Record<string, string> = {
  consultant: '/api/chat/staff/conversations',
  supervisor: '/api/chat/staff/conversations',
  coordinator: '/api/chat/staff/conversations',
  admin: '/api/chat/staff/conversations',
  person: '/api/person-cabinet/conversations',
};

@Injectable({ providedIn: 'root' })
export class NavBadgeService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly doc = inject(DOCUMENT);
  private readonly _chatUnreadCount = signal(0);
  private initialized = false;

  readonly chatUnreadCount: Signal<number> = this._chatUnreadCount.asReadonly();

  setChatUnreadCount(count: number): void {
    this._chatUnreadCount.set(count);
  }

  /** Reset state on logout so re-login fetches fresh counts. */
  reset(): void {
    this.initialized = false;
    this._chatUnreadCount.set(0);
  }

  /** Load initial unread count from server (called once from layout). */
  initUnreadCount(): void {
    if (this.initialized) return;

    const win = this.doc.defaultView;
    if (!win) return;

    const role = win.localStorage.getItem('ihelp_user_role') ?? '';
    const endpoint = ENDPOINTS[role];
    if (!endpoint) return;

    this.initialized = true;

    this.http.get<ConversationSummary[]>(endpoint).pipe(
      tap((conversations: ConversationSummary[]) => {
        const total = conversations.reduce((sum: number, c: ConversationSummary) => sum + c.unreadCount, 0);
        this._chatUnreadCount.set(total);
      }),
      catchError(() => {
        // Allow retry on next layout init if request failed
        this.initialized = false;
        return EMPTY;
      }),
    ).subscribe();
  }
}
