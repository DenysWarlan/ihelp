import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

const STAFF_ROLES = ['consultant', 'supervisor', 'coordinator', 'admin'];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const doc = inject(DOCUMENT);
  const router = inject(Router);
  const win = doc.defaultView;
  const token = win?.localStorage.getItem('ihelp_token');

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    tap({
      error: (err) => {
        const isAuthRequest = req.url.includes('/auth/');
        if (err.status === 401 && win && !isAuthRequest) {
          const isStaffRoute = router.url.startsWith('/staff');
          const role = win.localStorage.getItem('ihelp_user_role') ?? '';
          const isStaff = isStaffRoute || STAFF_ROLES.includes(role);

          win.localStorage.removeItem('ihelp_token');
          win.localStorage.removeItem('ihelp_refresh_token');
          win.localStorage.removeItem('ihelp_user_role');
          win.localStorage.removeItem('ihelp_user_name');
          win.localStorage.removeItem('ihelp_user_email');

          router.navigate([isStaff ? '/staff/login' : '/login']);
        }
      },
    }),
  );
};
