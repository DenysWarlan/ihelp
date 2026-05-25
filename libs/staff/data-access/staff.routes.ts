import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from '@org/shared/ui';

export const staffRoutes: Routes = [
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@org/staff/components').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'consultant',
        loadComponent: () =>
          import('@org/staff/components').then(
            (m) => m.ConsultantComponent,
          ),
      },
      {
        path: 'supervisor',
        loadComponent: () =>
          import('@org/staff/components').then(
            (m) => m.SupervisorComponent,
          ),
      },
      {
        path: 'coordinator',
        loadComponent: () =>
          import('@org/staff/components').then(
            (m) => m.CoordinatorComponent,
          ),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('@org/staff/components').then((m) => m.AdminComponent),
      },
    ],
  },
];
