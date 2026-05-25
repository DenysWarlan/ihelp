import { inject, Injectable, Signal } from '@angular/core';

import type { TeamAnalytics, TeamMember } from '../model/supervisor.model';
import { SupervisorStore } from '../store/supervisor.store';

@Injectable({ providedIn: 'root' })
export class SupervisorFacadeService {
  private readonly store = inject(SupervisorStore);

  readonly teamAnalytics: Signal<TeamAnalytics | null> =
    this.store.teamAnalytics;
  readonly teamMembers: Signal<TeamMember[]> = this.store.teamMembers;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  loadTeamAnalytics(): void {
    this.store.loadTeamAnalytics();
  }

  loadTeamMembers(): void {
    this.store.loadTeamMembers();
  }
}
