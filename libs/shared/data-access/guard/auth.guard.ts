import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Simple auth guard that checks for a token in localStorage.
 * Redirects to /login if no token is found.
 *
 * This is a placeholder guard that will be enhanced when E01 Auth
 * (JWT / session-based authentication) is implemented.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const doc = inject(DOCUMENT);
  const win = doc.defaultView;
  const token = win?.localStorage.getItem('ihelp_token');

  if (token) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
