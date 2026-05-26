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
          import('./cabinet/cabinet.component').then((m) => m.CabinetComponent),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./courses/courses.component').then((m) => m.CoursesComponent),
      },
      {
        path: 'courses/:id',
        loadComponent: () =>
          import('./course-detail/course-detail.component').then((m) => m.CourseDetailComponent),
      },
      {
        path: 'courses/:courseId/lessons/:lessonId',
        loadComponent: () =>
          import('./lesson-detail/lesson-detail.component').then((m) => m.LessonDetailComponent),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'meetings',
        loadComponent: () =>
          import('./meetings/meetings.component').then((m) => m.MeetingsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
];
