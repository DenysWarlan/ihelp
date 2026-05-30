import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from '@org/shared/ui';
import { authGuard, roleGuard } from '@org/shared/data-access';

const ADMIN_ONLY = ['ADMIN'] as const;
const COORD_ONLY = ['COORDINATOR'] as const;
const SUPER_ONLY = ['SUPERVISOR'] as const;
const ADMIN_COORD = ['ADMIN', 'COORDINATOR'] as const;

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
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'supervisor/cases',
        canActivate: [roleGuard(...SUPER_ONLY)],
        loadComponent: () =>
          import('./supervisor-cases/supervisor-cases.component').then(
            (m) => m.SupervisorCasesComponent,
          ),
      },
      {
        path: 'supervisor/cases/:id',
        canActivate: [roleGuard(...SUPER_ONLY)],
        loadComponent: () =>
          import('./supervisor-case-detail/supervisor-case-detail.component').then(
            (m) => m.SupervisorCaseDetailComponent,
          ),
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
        path: 'meetings/schedule/:caseId',
        loadComponent: () =>
          import('./schedule-meeting/schedule-meeting.component').then(
            (m) => m.ScheduleMeetingComponent,
          ),
      },
      {
        path: 'courses',
        canActivate: [roleGuard(...ADMIN_COORD)],
        loadComponent: () =>
          import('./courses-manage/courses-manage.component').then(
            (m) => m.CoursesManageComponent,
          ),
      },
      {
        path: 'courses/:id',
        canActivate: [roleGuard(...ADMIN_COORD)],
        loadComponent: () =>
          import('./course-edit/course-edit.component').then(
            (m) => m.CourseEditComponent,
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
        canActivate: [roleGuard(...COORD_ONLY)],
        loadComponent: () =>
          import('./sla-monitor/sla-monitor.component').then(
            (m) => m.SlaMonitorComponent,
          ),
      },
      {
        path: 'assignment',
        canActivate: [roleGuard(...COORD_ONLY)],
        loadComponent: () =>
          import('./assignment/assignment.component').then(
            (m) => m.AssignmentComponent,
          ),
      },
      {
        path: 'workload',
        canActivate: [roleGuard(...COORD_ONLY)],
        loadComponent: () =>
          import('./workload/workload.component').then(
            (m) => m.WorkloadComponent,
          ),
      },
      {
        path: 'crisis',
        canActivate: [roleGuard(...COORD_ONLY)],
        loadComponent: () =>
          import('./crisis/crisis.component').then(
            (m) => m.CrisisComponent,
          ),
      },
      {
        path: 'supervisor/crisis',
        canActivate: [roleGuard(...SUPER_ONLY)],
        loadComponent: () =>
          import('./crisis-history/crisis-history.component').then(
            (m) => m.CrisisHistoryComponent,
          ),
      },
      {
        path: 'users',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./users-manage/users-manage.component').then(
            (m) => m.UsersManageComponent,
          ),
      },
      {
        path: 'duplicates',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./duplicate-list/duplicate-list.component').then(
            (m) => m.DuplicateListComponent,
          ),
      },
      {
        path: 'duplicates/:groupId',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./duplicate-review/duplicate-review.component').then(
            (m) => m.DuplicateReviewComponent,
          ),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'audit',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./audit-log/audit-log.component').then(
            (m) => m.AuditLogComponent,
          ),
      },
      {
        path: 'gdpr',
        canActivate: [roleGuard(...ADMIN_ONLY)],
        loadComponent: () =>
          import('./gdpr/gdpr.component').then(
            (m) => m.GdprComponent,
          ),
      },
    ],
  },
];
