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
  GdprAccessRequest,
  GdprRetentionPolicy,
  GdprSarKeyword,
  GdprAuditEntry,
  GdprTab,
} from '../model/gdpr.model';
import { GdprService } from '../service/gdpr.service';

interface GdprState {
  accessRequests: GdprAccessRequest[];
  retentionPolicies: GdprRetentionPolicy[];
  sarKeywords: GdprSarKeyword[];
  auditLog: GdprAuditEntry[];
  activeTab: GdprTab;
  isLoading: boolean;
  error: string | null;
}

const initialState: GdprState = {
  accessRequests: [],
  retentionPolicies: [],
  sarKeywords: [],
  auditLog: [],
  activeTab: 'accessRequests',
  isLoading: false,
  error: null,
};

export const GdprStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const gdprService: GdprService = inject(GdprService);

    return {
      setActiveTab(tab: GdprTab): void {
        patchState(store, { activeTab: tab });
      },

      loadAccessRequests: rxMethod<string | void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((status?: string | void) =>
            gdprService
              .getAccessRequests(status ? String(status) : undefined)
              .pipe(
                tap((requests: GdprAccessRequest[]) =>
                  patchState(store, {
                    accessRequests: requests,
                    isLoading: false,
                  })
                ),
                catchError(() => {
                  patchState(store, {
                    isLoading: false,
                    error: 'Failed to load access requests',
                  });
                  return EMPTY;
                })
              )
          )
        )
      ),

      loadRetentionPolicies: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            gdprService.getRetentionPolicies().pipe(
              tap((policies: GdprRetentionPolicy[]) =>
                patchState(store, {
                  retentionPolicies: policies,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load retention policies',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadSarKeywords: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            gdprService.getSarKeywords().pipe(
              tap((keywords: GdprSarKeyword[]) =>
                patchState(store, {
                  sarKeywords: keywords,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load SAR keywords',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadAuditLog: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            gdprService.getAuditLog().pipe(
              tap((entries: GdprAuditEntry[]) =>
                patchState(store, {
                  auditLog: entries,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load audit log',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      approveRequest: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((id: string) =>
            gdprService.approveRequest(id).pipe(
              tap((updated: GdprAccessRequest) =>
                patchState(store, {
                  accessRequests: store
                    .accessRequests()
                    .map((r: GdprAccessRequest) =>
                      r.id === updated.id ? updated : r
                    ),
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to approve request',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      rejectRequest: rxMethod<{ id: string; reason?: string }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((params: { id: string; reason?: string }) =>
            gdprService.rejectRequest(params.id, params.reason).pipe(
              tap((updated: GdprAccessRequest) =>
                patchState(store, {
                  accessRequests: store
                    .accessRequests()
                    .map((r: GdprAccessRequest) =>
                      r.id === updated.id ? updated : r
                    ),
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to reject request',
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
