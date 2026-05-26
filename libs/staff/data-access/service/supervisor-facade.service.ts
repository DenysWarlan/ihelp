import { inject, Injectable, Signal } from '@angular/core';
import { Router } from '@angular/router';

import type { CaseListItem } from '../model/staff.model';
import type {
  CrisisHistoryItem,
  TeamAnalytics,
  TeamMember,
  SupervisorCaseDetail,
} from '../model/supervisor.model';
import { SupervisorStore } from '../store/supervisor.store';

@Injectable({ providedIn: 'root' })
export class SupervisorFacadeService {
  private readonly store = inject(SupervisorStore);
  private readonly router: Router = inject(Router);

  readonly teamAnalytics: Signal<TeamAnalytics | null> =
    this.store.teamAnalytics;
  readonly teamMembers: Signal<TeamMember[]> = this.store.teamMembers;
  readonly allCases: Signal<CaseListItem[]> = this.store.allCases;
  readonly supervisorCaseDetail: Signal<SupervisorCaseDetail | null> =
    this.store.supervisorCaseDetail;
  readonly crisisHistory: Signal<CrisisHistoryItem[]> = this.store.crisisHistory;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;

  loadTeamAnalytics(): void {
    this.store.loadTeamAnalytics();
  }

  loadTeamMembers(): void {
    this.store.loadTeamMembers();
  }

  loadAllCases(): void {
    this.store.loadAllCases();
  }

  loadCrisisHistory(): void {
    this.store.loadCrisisHistory();
  }

  loadSupervisorCaseDetail(id: string): void {
    this.store.loadSupervisorCaseDetail(id);
  }

  addSupervisorComment(caseId: string, comment: string): void {
    this.store.addSupervisorComment({ caseId, comment });
  }

  navigateToCase(id: string): void {
    this.router.navigate(['/staff/supervisor/cases', id]);
  }
}
