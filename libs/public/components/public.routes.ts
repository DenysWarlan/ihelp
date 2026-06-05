import { Routes } from '@angular/router';
import { PublicLayoutComponent } from '@org/shared/ui';

export const publicRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent
      ),
  },
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./landing/landing.component').then(
            (m) => m.LandingComponent
          ),
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./catalog/catalog.component').then(
            (m) => m.CatalogComponent
          ),
      },
      {
        path: 'catalog/:id',
        loadComponent: () =>
          import('./course-preview/course-preview.component').then(
            (m) => m.CoursePreviewComponent
          ),
      },
      {
        path: 'need-help',
        loadComponent: () =>
          import('./need-help/need-help.component').then(
            (m) => m.NeedHelpComponent
          ),
      },
    ],
  },
];
