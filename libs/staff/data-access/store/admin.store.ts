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
  AdminDashboardResponse,
  AdminDashboardStats,
  AdminDashboardAlerts,
  AdminDashboardAuditEntry,
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
  EditUserFormModel,
  UsersQueryParams,
  PaginatedUsersResponse,
  DuplicatesResponse,
} from '../model/admin.model';
import type { CaseListItem } from '../model/staff.model';
import { AdminService } from '../service/admin.service';

interface AdminState {
  dashboardStats: AdminDashboardStats | null;
  dashboardAlerts: AdminDashboardAlerts | null;
  dashboardAudit: AdminDashboardAuditEntry[];
  dashboardLoading: boolean;
  cases: CaseListItem[];
  casesLoading: boolean;
  users: AdminUser[];
  usersTotal: number;
  usersPage: number;
  usersPageSize: number;
  usersTotalPages: number;
  invites: AdminInvite[];
  invitesTotal: number;
  auditLog: AuditLogEntry[];
  auditLogTotal: number;
  duplicatesCount: number;
  settings: SystemSetting[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AdminState = {
  dashboardStats: null,
  dashboardAlerts: null,
  dashboardAudit: [],
  dashboardLoading: false,
  cases: [],
  casesLoading: false,
  users: [],
  usersTotal: 0,
  usersPage: 1,
  usersPageSize: 20,
  usersTotalPages: 0,
  invites: [],
  invitesTotal: 0,
  auditLog: [],
  auditLogTotal: 0,
  duplicatesCount: 0,
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
      loadCases: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { casesLoading: true, error: null })),
          switchMap(() =>
            adminService.getCases().pipe(
              tap((cases: CaseListItem[]) =>
                patchState(store, { cases, casesLoading: false }),
              ),
              catchError(() => {
                patchState(store, { casesLoading: false, error: 'Failed to load cases' });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadDashboard: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { dashboardLoading: true })),
          switchMap(() =>
            adminService.getDashboard().pipe(
              tap((result: AdminDashboardResponse) =>
                patchState(store, {
                  dashboardStats: result.stats,
                  dashboardAlerts: result.alerts,
                  dashboardAudit: result.recentAudit,
                  dashboardLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, { dashboardLoading: false });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadUsers: rxMethod<UsersQueryParams>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((query: UsersQueryParams) =>
            adminService.getUsers(query).pipe(
              tap((result: PaginatedUsersResponse) =>
                patchState(store, {
                  users: result.data,
                  usersTotal: result.total,
                  usersPage: result.page,
                  usersPageSize: result.pageSize,
                  usersTotalPages: result.totalPages,
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

      updateUser: rxMethod<{ id: string; dto: EditUserFormModel }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(({ id, dto }) =>
            adminService.updateUser(id, dto).pipe(
              tap((updated: AdminUser) =>
                patchState(store, {
                  users: store.users().map((u: AdminUser) =>
                    u.id === updated.id ? updated : u,
                  ),
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to update user',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      toggleUserActive: rxMethod<{ id: string; isActive: boolean }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(({ id, isActive }) =>
            adminService.updateUser(id, { isActive }).pipe(
              tap((updated: AdminUser) =>
                patchState(store, {
                  users: store.users().map((u: AdminUser) =>
                    u.id === updated.id ? updated : u,
                  ),
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to update user status',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
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

      loadDuplicates: rxMethod<void>(
        pipe(
          switchMap(() =>
            adminService.getDuplicates().pipe(
              tap((result: DuplicatesResponse) =>
                patchState(store, { duplicatesCount: result.total })
              ),
              catchError(() => EMPTY)
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
