import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import type { CaseListItem } from '../model/staff.model';
import type {
  CrisisHistoryItem,
  TeamAnalytics,
  TeamMember,
  SupervisorCaseDetail,
} from '../model/supervisor.model';
import { SupervisorService } from '../service/supervisor.service';

interface SupervisorState {
  teamAnalytics: TeamAnalytics | null;
  teamMembers: TeamMember[];
  allCases: CaseListItem[];
  supervisorCaseDetail: SupervisorCaseDetail | null;
  crisisHistory: CrisisHistoryItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SupervisorState = {
  teamAnalytics: null,
  teamMembers: [],
  allCases: [],
  supervisorCaseDetail: null,
  crisisHistory: [],
  isLoading: false,
  error: null,
};

export const SupervisorStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const service: SupervisorService = inject(SupervisorService);

    return {
      loadTeamAnalytics: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getTeamAnalytics().pipe(
              tap((teamAnalytics: TeamAnalytics) =>
                patchState(store, { teamAnalytics, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load team analytics',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadTeamMembers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getTeamMembers().pipe(
              tap((teamMembers: TeamMember[]) =>
                patchState(store, { teamMembers, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load team members',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadAllCases: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getAllCases().pipe(
              tap((allCases: CaseListItem[]) =>
                patchState(store, { allCases, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load all cases',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadSupervisorCaseDetail: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, { isLoading: true, error: null })
          ),
          switchMap((id: string) =>
            service.getCaseDetail(id).pipe(
              tap((supervisorCaseDetail: SupervisorCaseDetail) =>
                patchState(store, {
                  supervisorCaseDetail,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load case detail',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadCrisisHistory: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getCrisisHistory().pipe(
              tap((crisisHistory: CrisisHistoryItem[]) =>
                patchState(store, { crisisHistory, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load crisis history',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      addSupervisorComment: rxMethod<{
        caseId: string;
        comment: string;
      }>(
        pipe(
          switchMap(
            (params: { caseId: string; comment: string }) =>
              service
                .addComment(params.caseId, params.comment)
                .pipe(
                  switchMap(() =>
                    service.getCaseDetail(params.caseId).pipe(
                      tap(
                        (
                          supervisorCaseDetail: SupervisorCaseDetail
                        ) =>
                          patchState(store, {
                            supervisorCaseDetail,
                          })
                      )
                    )
                  ),
                  catchError(() => {
                    patchState(store, {
                      error: 'Failed to add comment',
                    });
                    return EMPTY;
                  })
                )
          )
        )
      ),
    };
  })
);
