import { Injectable, Signal, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavBadgeService {
  private readonly _chatUnreadCount = signal(0);

  readonly chatUnreadCount: Signal<number> = this._chatUnreadCount.asReadonly();

  setChatUnreadCount(count: number): void {
    this._chatUnreadCount.set(count);
  }
}
