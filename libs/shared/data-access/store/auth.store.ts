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
import {
  PersonLoginRequest,
  StaffLoginRequest,
  UserProfile,
} from '../model/auth.model';

/**
 * Decode JWT payload with proper UTF-8 support.
 * atob() only handles Latin-1, so Cyrillic/other multi-byte chars get garbled.
 */
function decodeJwtPayload(_win: unknown, token: string): string {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = (globalThis as unknown as { atob(s: string): string }).atob(base64);
  const bytes = Uint8Array.from({ length: raw.length }, (_, i) => raw.charCodeAt(i));
  const TD = (globalThis as unknown as { TextDecoder: new () => { decode(b: Uint8Array): string } }).TextDecoder;
  return new TD().decode(bytes);
}

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
                        decodeJwtPayload(win, response.accessToken),
                      );
                      if (payload.email) {
                        win.localStorage.setItem('ihelp_user_email', payload.email);
                        win.localStorage.setItem(
                          'ihelp_user_name',
                          payload.name ?? payload.email.split('@')[0],
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

      personLogin: rxMethod<PersonLoginRequest>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
            }),
          ),
          switchMap((request: PersonLoginRequest) =>
            authService.personLogin(request).pipe(
              tap((response) => {
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
                      decodeJwtPayload(win, response.accessToken),
                    );
                    if (payload.email) {
                      win.localStorage.setItem('ihelp_user_email', payload.email);
                      win.localStorage.setItem(
                        'ihelp_user_name',
                        payload.name ?? payload.email.split('@')[0],
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
                router.navigate(['/person/cabinet']);
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
            const role = win?.localStorage.getItem('ihelp_user_role') ?? '';
            const staffRoles = ['consultant', 'supervisor', 'coordinator', 'admin'];
            const redirectPath = staffRoles.includes(role) ? '/staff/login' : '/login';
            const refreshToken =
              win?.localStorage.getItem('ihelp_refresh_token') ?? '';
            return authService.logout(refreshToken).pipe(
              tap(() => {
                if (win) {
                  win.localStorage.removeItem('ihelp_token');
                  win.localStorage.removeItem('ihelp_refresh_token');
                  win.localStorage.removeItem('ihelp_user_role');
                  win.localStorage.removeItem('ihelp_user_name');
                  win.localStorage.removeItem('ihelp_user_email');
                }
                patchState(store, { user: null, isLoading: false });
                router.navigate([redirectPath]);
              }),
              catchError(() => {
                if (win) {
                  win.localStorage.removeItem('ihelp_token');
                  win.localStorage.removeItem('ihelp_refresh_token');
                  win.localStorage.removeItem('ihelp_user_role');
                  win.localStorage.removeItem('ihelp_user_name');
                  win.localStorage.removeItem('ihelp_user_email');
                }
                patchState(store, { user: null, isLoading: false });
                router.navigate([redirectPath]);
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
