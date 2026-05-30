export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface AdminInvite {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'REVOKED';
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly inviterName: string;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly actorName: string;
  readonly details: string | null;
  readonly createdAt: string;
}

export interface SystemSetting {
  readonly key: string;
  readonly value: string;
  readonly description: string;
  readonly category: string;
}

export interface CreateUserRequest {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly password: string;
}

export interface CreateInviteRequest {
  readonly email: string;
  readonly role: string;
}

export interface CreateUserFormModel {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly password: string;
}

export interface EditUserFormModel {
  readonly name: string;
  readonly role: string;
}

export interface CreateInviteFormModel {
  readonly email: string;
  readonly role: string;
}

export interface UsersQueryParams {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly role?: string;
}

export interface PaginatedUsersResponse {
  readonly data: AdminUser[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface DuplicateAccount {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly reason: string;
  readonly matchedWith: string;
}

export interface DuplicatesResponse {
  readonly duplicates: DuplicateAccount[];
  readonly total: number;
}

export interface AdminDashboardStats {
  readonly totalUsers: number;
  readonly usersByRole: Record<string, number>;
  readonly activeCases: number;
  readonly pendingInvites: number;
  readonly slaBreaches: number;
}

export interface AdminDashboardAlerts {
  readonly crisisAlerts: number;
  readonly duplicateSuspects: number;
}

export interface AdminDashboardAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly performedByName: string;
  readonly createdAt: string;
}

export interface AdminDashboardResponse {
  readonly stats: AdminDashboardStats;
  readonly alerts: AdminDashboardAlerts;
  readonly recentAudit: AdminDashboardAuditEntry[];
}
