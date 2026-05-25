import { Route } from '@angular/router';
import { authGuard } from '@org/shared/data-access';

export const appRoutes: Route[] = [
  // -------------------------------------------------------------------------
  // Public zone: landing, catalog, login — no auth required
  // -------------------------------------------------------------------------
  {
    path: '',
    loadChildren: () =>
      import('@org/public/components').then((m) => m.publicRoutes),
  },

  // -------------------------------------------------------------------------
  // Person zone: cabinet, courses, chat — auth required
  // -------------------------------------------------------------------------
  {
    path: 'person',
    canActivate: [authGuard],
    loadChildren: () =>
      import('@org/person/data-access').then((m) => m.personRoutes),
  },

  // -------------------------------------------------------------------------
  // Staff zone: consultant, supervisor, coordinator, admin — auth required
  // -------------------------------------------------------------------------
  {
    path: 'staff',
    canActivate: [authGuard],
    loadChildren: () =>
      import('@org/staff/data-access').then((m) => m.staffRoutes),
  },

  // -------------------------------------------------------------------------
  // Fallback
  // -------------------------------------------------------------------------
  {
    path: '**',
    redirectTo: '',
  },
];
