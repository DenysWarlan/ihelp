export interface DuplicateUserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly hasPassword: boolean;
  readonly providers: string[];
  readonly caseCount: number;
  readonly enrollmentCount: number;
  readonly messageCount: number;
  readonly meetingCount: number;
  readonly score: number;
}

export interface DuplicateGroup {
  readonly groupId: string;
  readonly users: DuplicateUserSummary[];
  readonly matchReasons: string[];
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly suggestedPrimaryId: string;
}

export interface DuplicateGroupsResponse {
  readonly groups: DuplicateGroup[];
  readonly total: number;
}

export interface MergePreview {
  readonly casesReassigned: number;
  readonly messagesReattributed: number;
  readonly enrollmentsMerged: number;
  readonly enrollmentConflicts: number;
  readonly providerLinksMoved: number;
  readonly sessionsRevoked: number;
  readonly meetingsReassigned: number;
}

export interface MergeExecutionResult {
  readonly mergeId: string;
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
  readonly preview: MergePreview;
}

export interface ExecuteMergeRequest {
  readonly primaryUserId: string;
  readonly secondaryUserId: string;
}

export interface MergeHistoryEntry {
  readonly id: string;
  readonly primaryUserId: string;
  readonly primaryUserName: string;
  readonly primaryUserEmail: string;
  readonly secondaryUserId: string;
  readonly secondaryUserName: string;
  readonly secondaryUserEmail: string;
  readonly performedBy: string;
  readonly performedByName: string;
  readonly mergeDetails: MergePreview;
  readonly isReverted: boolean;
  readonly createdAt: string;
}

export interface MergeHistoryResponse {
  readonly data: MergeHistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}
