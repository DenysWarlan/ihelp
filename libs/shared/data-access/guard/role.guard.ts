import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Role-based route guard. Checks that the authenticated user has one of the
 * allowed roles before granting access. Redirects to the appropriate login
 * page if the role doesn't match.
 *
 * Usage in routes:
 *   canActivate: [roleGuard('ADMIN', 'COORDINATOR')]
 */
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const router = inject(Router);
    const doc = inject(DOCUMENT);
    const win = doc.defaultView;
    const role = win?.localStorage.getItem('ihelp_user_role')?.toUpperCase() ?? '';

    if (allowedRoles.includes(role)) {
      return true;
    }

    // Redirect to appropriate dashboard based on the user's actual role
    const staffRoles = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'];
    if (staffRoles.includes(role)) {
      return router.createUrlTree(['/staff']);
    }
    return router.createUrlTree(['/person']);
  };
}
