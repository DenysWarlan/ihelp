import { Injectable, Signal, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ActiveChatService {
  private readonly _activeCaseId = signal<string | null>(null);

  readonly activeCaseId: Signal<string | null> = this._activeCaseId.asReadonly();

  setActiveCaseId(caseId: string | null): void {
    this._activeCaseId.set(caseId);
  }
}
