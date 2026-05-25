import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';
import { AuthService } from '../service/auth.service';
import { StaffLoginRequest, UserProfile } from '../model/auth.model';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
  mfaRequired: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const doc = inject(DOCUMENT);

    return {
      staffLogin: rxMethod<StaffLoginRequest>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              mfaRequired: false,
            }),
          ),
          switchMap((request: StaffLoginRequest) =>
            authService.staffLogin(request).pipe(
              tap((response) => {
                if ('mfaRequired' in response) {
                  patchState(store, { isLoading: false, mfaRequired: true });
                } else {
                  const win = doc.defaultView;
                  if (win) {
                    win.localStorage.setItem(
                      'ihelp_token',
                      response.accessToken,
                    );
                    win.localStorage.setItem(
                      'ihelp_refresh_token',
                      response.refreshToken,
                    );
                    try {
                      const payload = JSON.parse(
                        win.atob(response.accessToken.split('.')[1]),
                      );
                      if (payload.email) {
                        win.localStorage.setItem(
                          'ihelp_user_name',
                          payload.email.split('@')[0],
                        );
                      }
                      if (payload.role) {
                        win.localStorage.setItem(
                          'ihelp_user_role',
                          payload.role.toLowerCase(),
                        );
                      }
                    } catch {
                      /* ignore decode errors */
                    }
                  }
                  patchState(store, { isLoading: false });
                  router.navigate(['/staff']);
                }
              }),
              catchError((err) => {
                const message =
                  err?.error?.message ?? 'Login failed';
                patchState(store, { isLoading: false, error: message });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      logout: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap(() => {
            const win = doc.defaultView;
            const refreshToken =
              win?.localStorage.getItem('ihelp_refresh_token') ?? '';
            return authService.logout(refreshToken).pipe(
              tap(() => {
                if (win) {
                  win.localStorage.removeItem('ihelp_token');
                  win.localStorage.removeItem('ihelp_refresh_token');
                  win.localStorage.removeItem('ihelp_user_role');
                  win.localStorage.removeItem('ihelp_user_name');
                }
                patchState(store, { user: null, isLoading: false });
                router.navigate(['/login']);
              }),
              catchError(() => {
                const win = doc.defaultView;
                if (win) {
                  win.localStorage.removeItem('ihelp_token');
                  win.localStorage.removeItem('ihelp_refresh_token');
                  win.localStorage.removeItem('ihelp_user_role');
                  win.localStorage.removeItem('ihelp_user_name');
                }
                patchState(store, { user: null, isLoading: false });
                router.navigate(['/login']);
                return EMPTY;
              }),
            );
          }),
        ),
      ),

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
