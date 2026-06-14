// Models
export type {
  CaseListItem,
  CaseDetail,
  CaseNote,
  StaffCaseMessage,
  StaffMeeting,
  StaffDashboard,
  ScheduleMeetingRequest,
  ScheduleMeetingFormModel,
  StaffUser,
  TeamMeeting,
  TeamMeetingParticipant,
  TeamMeetingStatus,
  TeamParticipantStatus,
  CreateTeamMeetingPayload,
  TeamMeetingFormModel,
} from './model/staff.model';

// Services
export { StaffService } from './service/staff.service';
export { StaffFacade } from './service/staff-facade.service';

// Stores
export { StaffStore } from './store/staff.store';

// Admin Models
export type {
  AdminDashboardResponse,
  AdminDashboardStats,
  AdminDashboardAlerts,
  AdminDashboardAuditEntry,
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
  CreateUserFormModel,
  CreateInviteFormModel,
  EditUserFormModel,
  UsersQueryParams,
  PaginatedUsersResponse,
} from './model/admin.model';

// Admin Services
export { AdminService } from './service/admin.service';
export { AdminFacade } from './service/admin-facade.service';

// Admin Stores
export { AdminStore } from './store/admin.store';

// Coordinator Models
export type {
  SlaOverview,
  SlaTimer,
  WorkloadEntry,
  AssignmentSuggestion,
  AssignmentPriority,
  CrisisAlert,
  ConsultantDetail,
  ConsultantCaseItem,
} from './model/coordinator.model';

// Coordinator Services
export { CoordinatorService } from './service/coordinator.service';
export { CoordinatorFacadeService } from './service/coordinator-facade.service';

// Coordinator Stores
export { CoordinatorStore } from './store/coordinator.store';

// Supervisor Models
export type {
  ConsultantProfile,
  CrisisHistoryItem,
  TeamMember,
  TeamAnalytics,
  CaseMessage,
  SupervisorCaseDetail,
} from './model/supervisor.model';

// Supervisor Services
export { SupervisorService } from './service/supervisor.service';
export { SupervisorFacadeService } from './service/supervisor-facade.service';

// Supervisor Stores
export { SupervisorStore } from './store/supervisor.store';

// Staff Chat Models
export type {
  StaffChatConversation,
  StaffChatMessage,
} from './model/staff-chat.model';

// Staff Chat Services
export { StaffChatService } from './service/staff-chat.service';
export { StaffChatFacade } from './service/staff-chat-facade.service';

// Staff Chat Stores
export { StaffChatStore } from './store/staff-chat.store';

// Course Manage Models
export type {
  AdminCourse,
  AdminCourseDetail,
  AdminLesson,
  CourseStatus,
  CreateCourseFormModel,
  LessonFormModel,
} from './model/course-manage.model';

// Course Manage Services
export { CourseManageService } from './service/course-manage.service';
export { CourseManageFacade } from './service/course-manage-facade.service';

// Course Manage Stores
export { CourseManageStore } from './store/course-manage.store';

// Duplicate Models
export type {
  DuplicateUserSummary,
  DuplicateGroup,
  DuplicateGroupsResponse,
  MergePreview,
  MergeExecutionResult,
  ExecuteMergeRequest,
  MergeHistoryEntry,
  MergeHistoryResponse,
} from './model/duplicate.model';

// Duplicate Services
export { DuplicateService } from './service/duplicate.service';
export { DuplicateFacade } from './service/duplicate-facade.service';

// Duplicate Stores
export { DuplicateStore } from './store/duplicate.store';

// GDPR Models
export type {
  GdprAccessRequest,
  GdprRetentionPolicy,
  GdprSarKeyword,
  GdprAuditEntry,
  GdprAuditLogParams,
  GdprTab,
} from './model/gdpr.model';

// GDPR Services
export { GdprService } from './service/gdpr.service';
export { GdprFacade } from './service/gdpr-facade.service';

// GDPR Stores
export { GdprStore } from './store/gdpr.store';
