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
  DuplicateGroup,
  DuplicateGroupsResponse,
  ExecuteMergeRequest,
  MergeExecutionResult,
} from '../model/duplicate.model';
import { DuplicateService } from '../service/duplicate.service';

interface DuplicateState {
  groups: DuplicateGroup[];
  total: number;
  selectedGroup: DuplicateGroup | null;
  mergeResult: MergeExecutionResult | null;
  isLoading: boolean;
  isMerging: boolean;
  error: string | null;
}

const initialState: DuplicateState = {
  groups: [],
  total: 0,
  selectedGroup: null,
  mergeResult: null,
  isLoading: false,
  isMerging: false,
  error: null,
};

export const DuplicateStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const duplicateService: DuplicateService = inject(DuplicateService);

    return {
      loadGroups: rxMethod<string | undefined>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((confidence?: string) =>
            duplicateService.getGroups(confidence).pipe(
              tap((result: DuplicateGroupsResponse) =>
                patchState(store, {
                  groups: result.groups,
                  total: result.total,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load duplicate groups',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadGroupDetail: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((groupId: string) =>
            duplicateService.getGroupDetail(groupId).pipe(
              tap((group: DuplicateGroup) =>
                patchState(store, {
                  selectedGroup: group,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load group detail',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      dismissGroup: rxMethod<{ groupId: string; reason?: string }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(({ groupId, reason }) =>
            duplicateService.dismissGroup(groupId, reason).pipe(
              tap(() =>
                patchState(store, {
                  groups: store.groups().filter(
                    (g: DuplicateGroup) => g.groupId !== groupId,
                  ),
                  total: store.total() - 1,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to dismiss group',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      executeMerge: rxMethod<{ groupId: string; dto: ExecuteMergeRequest }>(
        pipe(
          tap(() =>
            patchState(store, { isMerging: true, error: null, mergeResult: null }),
          ),
          switchMap(({ groupId, dto }) =>
            duplicateService.executeMerge(groupId, dto).pipe(
              tap((result: MergeExecutionResult) =>
                patchState(store, {
                  mergeResult: result,
                  groups: store.groups().filter(
                    (g: DuplicateGroup) => g.groupId !== groupId,
                  ),
                  total: store.total() - 1,
                  selectedGroup: null,
                  isMerging: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isMerging: false,
                  error: 'Failed to merge users',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      clearSelectedGroup(): void {
        patchState(store, { selectedGroup: null });
      },

      clearMergeResult(): void {
        patchState(store, { mergeResult: null });
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
