export interface CaseListItem {
  readonly id: string;
  readonly personName: string;
  readonly topic: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
  readonly assignedAt: string;
  readonly lastMessageAt: string | null;
  readonly slaDeadline: string | null;
}

export interface CaseDetail {
  readonly id: string;
  readonly personName: string;
  readonly personEmail: string;
  readonly topic: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
  readonly description: string;
  readonly notes: CaseNote[];
  readonly assignedAt: string;
  readonly createdAt: string;
}

export interface CaseNote {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly isInternal: boolean;
}

export interface StaffMeeting {
  readonly id: string;
  readonly title: string;
  readonly personName: string;
  readonly scheduledAt: string;
  readonly durationMinutes: number;
  readonly status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  readonly meetingUrl: string | null;
}

export interface StaffDashboard {
  readonly activeCases: number;
  readonly pendingCases: number;
  readonly todayMeetings: number;
  readonly resolvedThisWeek: number;
}
