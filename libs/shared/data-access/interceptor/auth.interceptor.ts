import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

const STAFF_ROLES = ['consultant', 'supervisor', 'coordinator', 'admin'];

let isRefreshing = false;

function clearAuthAndRedirect(win: Window, router: Router): void {
  const role = win.localStorage.getItem('ihelp_user_role') ?? '';
  const isStaff = STAFF_ROLES.includes(role);
  win.localStorage.removeItem('ihelp_token');
  win.localStorage.removeItem('ihelp_refresh_token');
  win.localStorage.removeItem('ihelp_user_role');
  win.localStorage.removeItem('ihelp_user_name');
  win.localStorage.removeItem('ihelp_user_email');
  router.navigate([isStaff ? '/staff/login' : '/login']);
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const doc = inject(DOCUMENT);
  const router = inject(Router);
  const http = inject(HttpClient);
  const win = doc.defaultView;
  const token = win?.localStorage.getItem('ihelp_token');

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthRequest = req.url.includes('/auth/');
      if (err.status === 401 && win && !isAuthRequest && !isRefreshing) {
        const refreshToken = win.localStorage.getItem('ihelp_refresh_token');
        if (refreshToken) {
          isRefreshing = true;
          return http.post<{ accessToken: string; refreshToken: string }>(
            '/api/auth/refresh',
            { refreshToken },
          ).pipe(
            switchMap((tokens) => {
              isRefreshing = false;
              win.localStorage.setItem('ihelp_token', tokens.accessToken);
              win.localStorage.setItem('ihelp_refresh_token', tokens.refreshToken);
              // Retry the original request with the new token
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${tokens.accessToken}` },
              });
              return next(retryReq);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              clearAuthAndRedirect(win, router);
              return throwError(() => refreshErr);
            }),
          );
        }
        clearAuthAndRedirect(win, router);
      }
      return throwError(() => err);
    }),
  );
};
