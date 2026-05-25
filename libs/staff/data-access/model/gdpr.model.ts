export interface GdprAccessRequest {
  readonly id: string;
  readonly requesterId: string;
  readonly approverId: string | null;
  readonly targetUserId: string;
  readonly reason: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  readonly expiresAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface GdprRetentionPolicy {
  readonly id: string;
  readonly entityType: string;
  readonly retentionDays: number;
  readonly isActive: boolean;
  readonly description: string | null;
  readonly createdAt: string;
}

export interface GdprSarKeyword {
  readonly id: string;
  readonly keyword: string;
  readonly language: string;
  readonly isActive: boolean;
  readonly createdAt: string;
}

export interface GdprAuditEntry {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly details: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: string;
}

export interface GdprAuditLogParams {
  readonly action?: string;
  readonly userId?: string;
  readonly from?: string;
  readonly to?: string;
}

export type GdprTab = 'accessRequests' | 'retentionPolicies' | 'sarKeywords';
