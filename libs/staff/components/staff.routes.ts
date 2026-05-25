import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from '@org/shared/ui';
import {authGuard} from '@org/shared/data-access';

export const staffRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./staff-login/staff-login.component').then((m) => m.StaffLoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: AuthenticatedLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'consultant',
        loadComponent: () =>
          import('./consultant/consultant.component').then(
            (m) => m.ConsultantComponent,
          ),
      },
      {
        path: 'supervisor',
        loadComponent: () =>
          import('./supervisor/supervisor.component').then(
            (m) => m.SupervisorComponent,
          ),
      },
      {
        path: 'coordinator',
        loadComponent: () =>
          import('./coordinator/coordinator.component').then(
            (m) => m.CoordinatorComponent,
          ),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'cases',
        loadComponent: () =>
          import('./cases-list/cases-list.component').then(
            (m) => m.CasesListComponent,
          ),
      },
      {
        path: 'cases/:id',
        loadComponent: () =>
          import('./case-detail/case-detail.component').then(
            (m) => m.CaseDetailComponent,
          ),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./staff-chat/staff-chat.component').then(
            (m) => m.StaffChatComponent,
          ),
      },
      {
        path: 'meetings',
        loadComponent: () =>
          import('./meetings/meetings.component').then(
            (m) => m.MeetingsComponent,
          ),
      },
      {
        path: 'courses',
        loadComponent: () =>
          import('./courses-manage/courses-manage.component').then(
            (m) => m.CoursesManageComponent,
          ),
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./team/team.component').then(
            (m) => m.TeamComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./analytics/analytics.component').then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: 'sla',
        loadComponent: () =>
          import('./sla-monitor/sla-monitor.component').then(
            (m) => m.SlaMonitorComponent,
          ),
      },
      {
        path: 'assignment',
        loadComponent: () =>
          import('./assignment/assignment.component').then(
            (m) => m.AssignmentComponent,
          ),
      },
      {
        path: 'workload',
        loadComponent: () =>
          import('./workload/workload.component').then(
            (m) => m.WorkloadComponent,
          ),
      },
      {
        path: 'crisis',
        loadComponent: () =>
          import('./crisis/crisis.component').then(
            (m) => m.CrisisComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users-manage/users-manage.component').then(
            (m) => m.UsersManageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./audit-log/audit-log.component').then(
            (m) => m.AuditLogComponent,
          ),
      },
      {
        path: 'gdpr',
        loadComponent: () =>
          import('./gdpr/gdpr.component').then(
            (m) => m.GdprComponent,
          ),
      },
    ],
  },
];
