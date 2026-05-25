// Models
export type {
  CaseListItem,
  CaseDetail,
  CaseNote,
  StaffMeeting,
  StaffDashboard,
} from './model/staff.model';

// Services
export { StaffService } from './service/staff.service';
export { StaffFacade } from './service/staff-facade.service';

// Stores
export { StaffStore } from './store/staff.store';

// Admin Models
export type {
  AdminUser,
  AdminInvite,
  AuditLogEntry,
  SystemSetting,
  CreateUserRequest,
  CreateInviteRequest,
  CreateUserFormModel,
  CreateInviteFormModel,
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
  CrisisAlert,
} from './model/coordinator.model';

// Coordinator Services
export { CoordinatorService } from './service/coordinator.service';
export { CoordinatorFacadeService } from './service/coordinator-facade.service';

// Coordinator Stores
export { CoordinatorStore } from './store/coordinator.store';

// Supervisor Models
export type {
  TeamMember,
  TeamAnalytics,
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
