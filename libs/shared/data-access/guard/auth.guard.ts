import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Auth guard that checks for a valid, non-expired token in localStorage.
 * Redirects to the appropriate login page if no token or token is expired.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const doc = inject(DOCUMENT);
  const win = doc.defaultView;
  const token = win?.localStorage.getItem('ihelp_token');

  if (!token) {
    return router.createUrlTree(['/login']);
  }

  // Check token expiration
  try {
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // Token expired — clear storage and redirect
      const role = win?.localStorage.getItem('ihelp_user_role') ?? '';
      const staffRoles = ['consultant', 'supervisor', 'coordinator', 'admin'];
      win?.localStorage.removeItem('ihelp_token');
      win?.localStorage.removeItem('ihelp_refresh_token');
      win?.localStorage.removeItem('ihelp_user_role');
      win?.localStorage.removeItem('ihelp_user_name');
      win?.localStorage.removeItem('ihelp_user_email');
      return router.createUrlTree([staffRoles.includes(role) ? '/staff/login' : '/login']);
    }
  } catch {
    // If token can't be decoded, let the interceptor handle 401
  }

  return true;
};
