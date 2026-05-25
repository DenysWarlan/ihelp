import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import {
  CaseDetail,
  CaseListItem,
  StaffDashboard,
  StaffMeeting,
} from '../model/staff.model';
import { StaffService } from '../service/staff.service';

interface StaffState {
  dashboard: StaffDashboard | null;
  cases: CaseListItem[];
  selectedCase: CaseDetail | null;
  meetings: StaffMeeting[];
  isLoading: boolean;
  error: string | null;
}

const initialState: StaffState = {
  dashboard: null,
  cases: [],
  selectedCase: null,
  meetings: [],
  isLoading: false,
  error: null,
};

export const StaffStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const staffService = inject(StaffService);

    return {
      loadDashboard: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            staffService.getDashboard().pipe(
              tap((dashboard: StaffDashboard) =>
                patchState(store, { dashboard, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load dashboard',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadCases: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            staffService.getCases().pipe(
              tap((cases: CaseListItem[]) =>
                patchState(store, { cases, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load cases',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadCaseDetail: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCase: null,
            })
          ),
          switchMap((id: string) =>
            staffService.getCaseDetail(id).pipe(
              tap((caseDetail: CaseDetail) =>
                patchState(store, {
                  selectedCase: caseDetail,
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

      loadMeetings: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            staffService.getMeetings().pipe(
              tap((meetings: StaffMeeting[]) =>
                patchState(store, { meetings, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load meetings',
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
