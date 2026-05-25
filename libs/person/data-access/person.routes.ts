import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from '@org/shared/ui';

export const personRoutes: Routes = [
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@org/person/components').then((m) => m.CabinetComponent),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('@org/person/components').then((m) => m.CoursesComponent),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('@org/person/components').then((m) => m.ChatComponent),
      },
    ],
  },
];
