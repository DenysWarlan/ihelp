import { inject, Injectable, Signal } from '@angular/core';

import type {
  SlaOverview,
  WorkloadEntry,
  AssignmentSuggestion,
  CrisisAlert,
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

  loadSlaOverview(): void {
    this.store.loadSlaOverview();
  }

  loadWorkload(): void {
    this.store.loadWorkload();
  }

  loadAssignmentSuggestions(): void {
    this.store.loadAssignmentSuggestions();
  }

  loadCrisisAlerts(): void {
    this.store.loadCrisisAlerts();
  }

  acknowledgeCrisis(id: string): void {
    this.store.acknowledgeCrisis(id);
  }
}
