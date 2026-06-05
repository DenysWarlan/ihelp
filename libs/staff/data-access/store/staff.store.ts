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
  CaseNote,
  ScheduleMeetingRequest,
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

      sendCaseMessage: rxMethod<{ caseId: string; content: string }>(
        pipe(
          switchMap(({ caseId, content }) =>
            staffService.sendMessage(caseId, content).pipe(
              switchMap(() => staffService.getCaseDetail(caseId)),
              tap((caseDetail: CaseDetail) =>
                patchState(store, { selectedCase: caseDetail })
              ),
              catchError(() => {
                patchState(store, { error: 'Failed to send message' });
                return EMPTY;
              })
            )
          )
        )
      ),

      addCaseNote: rxMethod<{ caseId: string; content: string; isInternal: boolean }>(
        pipe(
          switchMap(({ caseId, content, isInternal }) =>
            staffService.addNote(caseId, content, isInternal).pipe(
              tap((note: CaseNote) => {
                const current: CaseDetail | null = store.selectedCase();
                if (current) {
                  patchState(store, {
                    selectedCase: { ...current, notes: [...current.notes, note] },
                  });
                }
              }),
              catchError(() => {
                patchState(store, { error: 'Failed to add note' });
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
              tap((meetings: StaffMeeting[]) => {
                const sorted = [...meetings].sort(
                  (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
                );
                patchState(store, { meetings: sorted, isLoading: false });
              }),
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

      scheduleMeeting: rxMethod<ScheduleMeetingRequest>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((data: ScheduleMeetingRequest) =>
            staffService.scheduleMeeting(data).pipe(
              tap((meeting: StaffMeeting) => {
                const updated = [...store.meetings(), meeting].sort(
                  (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
                );
                patchState(store, { meetings: updated, isLoading: false });
              }),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to schedule meeting',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      completeCase: rxMethod<{ caseId: string; version: number }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(({ caseId, version }) =>
            staffService.updateCaseStatus(caseId, 'COMPLETED', version).pipe(
              switchMap(() => staffService.getCaseDetail(caseId)),
              tap((caseDetail: CaseDetail) =>
                patchState(store, { selectedCase: caseDetail, isLoading: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to complete case',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      reassignCase: rxMethod<{ caseId: string; consultantUserId: string }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(({ caseId, consultantUserId }) =>
            staffService.reassignCase(caseId, consultantUserId).pipe(
              switchMap(() => staffService.getCaseDetail(caseId)),
              tap((caseDetail: CaseDetail) =>
                patchState(store, { selectedCase: caseDetail, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to reassign case',
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
