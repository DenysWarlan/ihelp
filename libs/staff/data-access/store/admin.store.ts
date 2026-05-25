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
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
} from '../model/admin.model';
import { AdminService } from '../service/admin.service';

interface AdminState {
  users: AdminUser[];
  usersTotal: number;
  invites: AdminInvite[];
  invitesTotal: number;
  auditLog: AuditLogEntry[];
  auditLogTotal: number;
  settings: SystemSetting[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AdminState = {
  users: [],
  usersTotal: 0,
  invites: [],
  invitesTotal: 0,
  auditLog: [],
  auditLogTotal: 0,
  settings: [],
  isLoading: false,
  error: null,
};

export const AdminStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const adminService: AdminService = inject(AdminService);

    return {
      loadUsers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            adminService.getUsers().pipe(
              tap((result: { data: AdminUser[]; total: number }) =>
                patchState(store, {
                  users: result.data,
                  usersTotal: result.total,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load users',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      createUser: rxMethod<CreateUserRequest>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((dto: CreateUserRequest) =>
            adminService.createUser(dto).pipe(
              tap((user: AdminUser) =>
                patchState(store, {
                  users: [...store.users(), user],
                  usersTotal: store.usersTotal() + 1,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to create user',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadInvites: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            adminService.getInvites().pipe(
              tap((result: { data: AdminInvite[]; total: number }) =>
                patchState(store, {
                  invites: result.data,
                  invitesTotal: result.total,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load invites',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      createInvite: rxMethod<CreateInviteRequest>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((dto: CreateInviteRequest) =>
            adminService.createInvite(dto).pipe(
              tap((invite: AdminInvite) =>
                patchState(store, {
                  invites: [...store.invites(), invite],
                  invitesTotal: store.invitesTotal() + 1,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to create invite',
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
            adminService.getAuditLog().pipe(
              tap((result: { data: AuditLogEntry[]; total: number }) =>
                patchState(store, {
                  auditLog: result.data,
                  auditLogTotal: result.total,
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

      loadSettings: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((category: string) =>
            adminService.getSettings(category).pipe(
              tap((settings: SystemSetting[]) =>
                patchState(store, { settings, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load settings',
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
