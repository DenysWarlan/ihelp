import { inject, Injectable, Signal } from '@angular/core';

import type {
  SlaOverview,
  WorkloadEntry,
  AssignmentSuggestion,
  CrisisAlert,
  ConsultantDetail,
} from '../model/coordinator.model';
import { CoordinatorStore } from '../store/coordinator.store';

@Injectable({ providedIn: 'root' })
export class CoordinatorFacadeService {
  private readonly store = inject(CoordinatorStore);

  readonly slaOverview: Signal<SlaOverview | null> = this.store.slaOverview;
  readonly workload: Signal<WorkloadEntry[]> = this.store.workload;
  readonly assignments: Signal<AssignmentSuggestion[]> = this.store.assignments;
  readonly crisisAlerts: Signal<CrisisAlert[]> = this.store.crisisAlerts;
  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly error: Signal<string | null> = this.store.error;
  readonly consultantDetail: Signal<ConsultantDetail | null> = this.store.consultantDetail;

  loadSlaOverview(): void {
    this.store.loadSlaOverview();
  }

  loadWorkload(): void {
    this.store.loadWorkload();
  }

  loadAssignmentSuggestions(): void {
    this.store.loadAssignmentSuggestions();
  }

  confirmAssignment(caseId: string, consultantId: string): void {
    this.store.confirmAssignment({ caseId, consultantId });
  }

  rejectAssignment(caseId: string): void {
    this.store.rejectAssignment(caseId);
  }

  loadCrisisAlerts(): void {
    this.store.loadCrisisAlerts();
  }

  acknowledgeCrisis(id: string): void {
    this.store.acknowledgeCrisis(id);
  }

  loadConsultantCases(userId: string): void {
    this.store.loadConsultantCases(userId);
  }

  clearConsultantDetail(): void {
    this.store.clearConsultantDetail();
  }
}
