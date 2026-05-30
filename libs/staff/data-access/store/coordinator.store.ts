import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import type {
  SlaOverview,
  WorkloadEntry,
  AssignmentSuggestion,
  CrisisAlert,
  ConsultantDetail,
} from '../model/coordinator.model';
import { CoordinatorService } from '../service/coordinator.service';

interface CoordinatorState {
  slaOverview: SlaOverview | null;
  workload: WorkloadEntry[];
  assignments: AssignmentSuggestion[];
  crisisAlerts: CrisisAlert[];
  consultantDetail: ConsultantDetail | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CoordinatorState = {
  slaOverview: null,
  workload: [],
  assignments: [],
  crisisAlerts: [],
  consultantDetail: null,
  isLoading: false,
  error: null,
};

export const CoordinatorStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const service: CoordinatorService = inject(CoordinatorService);

    return {
      loadSlaOverview: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getSlaOverview().pipe(
              tap((slaOverview: SlaOverview) =>
                patchState(store, { slaOverview, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load SLA overview',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadWorkload: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getWorkload().pipe(
              tap((workload: WorkloadEntry[]) =>
                patchState(store, { workload, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load workload',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadAssignmentSuggestions: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getAssignmentSuggestions().pipe(
              tap((assignments: AssignmentSuggestion[]) =>
                patchState(store, { assignments, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load assignment suggestions',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadCrisisAlerts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getCrisisAlerts().pipe(
              tap((crisisAlerts: CrisisAlert[]) =>
                patchState(store, { crisisAlerts, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load crisis alerts',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      confirmAssignment: rxMethod<{ caseId: string; consultantId: string }>(
        pipe(
          switchMap(({ caseId, consultantId }) =>
            service.confirmAssignment(caseId, consultantId).pipe(
              tap(() => {
                const assignments: AssignmentSuggestion[] = store
                  .assignments()
                  .filter((a: AssignmentSuggestion) => a.caseId !== caseId);
                patchState(store, { assignments });
              }),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to confirm assignment',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      rejectAssignment: rxMethod<string>(
        pipe(
          switchMap((caseId: string) =>
            service.rejectAssignment(caseId).pipe(
              tap(() => {
                const assignments: AssignmentSuggestion[] = store
                  .assignments()
                  .filter((a: AssignmentSuggestion) => a.caseId !== caseId);
                patchState(store, { assignments });
              }),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to reject assignment',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      acknowledgeCrisis: rxMethod<string>(
        pipe(
          switchMap((id: string) =>
            service.acknowledgeCrisis(id).pipe(
              tap(() => {
                const alerts: CrisisAlert[] = store.crisisAlerts().map(
                  (alert: CrisisAlert) =>
                    alert.id === id
                      ? { ...alert, isAcknowledged: true }
                      : alert
                );
                patchState(store, { crisisAlerts: alerts });
              }),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to acknowledge crisis',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadConsultantCases: rxMethod<string>(
        pipe(
          switchMap((userId: string) =>
            service.getConsultantCases(userId).pipe(
              tap((consultantDetail: ConsultantDetail) =>
                patchState(store, { consultantDetail })
              ),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to load consultant cases',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      clearConsultantDetail(): void {
        patchState(store, { consultantDetail: null });
      },
    };
  })
);
