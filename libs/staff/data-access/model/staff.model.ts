export interface CaseListItem {
  readonly id: string;
  readonly personName: string;
  readonly topic: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
  readonly assignedAt: string;
  readonly lastMessageAt: string | null;
  readonly slaDeadline: string | null;
  readonly consultantName?: string;
}

export interface CaseDetail {
  readonly id: string;
  readonly personName: string;
  readonly personEmail: string;
  readonly consultantName?: string;
  readonly topic: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
  readonly description: string;
  readonly notes: CaseNote[];
  readonly messages: StaffCaseMessage[];
  readonly assignedAt: string;
  readonly createdAt: string;
  readonly slaDeadline: string | null;
}

export interface StaffCaseMessage {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly isFromStaff: boolean;
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

export interface ScheduleMeetingRequest {
  readonly caseId: string;
  readonly date: string;
  readonly time: string;
  readonly durationMinutes: number;
  readonly platform: string;
  readonly notes: string;
}

export interface ScheduleMeetingFormModel {
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly platform: string;
  readonly notes: string;
}
