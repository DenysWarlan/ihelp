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

export interface CreateInviteFormModel {
  readonly email: string;
  readonly role: string;
}
