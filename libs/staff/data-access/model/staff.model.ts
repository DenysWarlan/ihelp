export type CaseStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'MEETING_SCHEDULED' | 'ON_HOLD' | 'TRANSFERRED' | 'COMPLETED' | 'CLOSED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
export type CrisisLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CaseListItem {
  readonly id: string;
  readonly personName: string;
  readonly topic: string;
  readonly status: CaseStatus;
  readonly priority: CasePriority;
  readonly assignedAt: string;
  readonly lastMessageAt: string | null;
  readonly slaDeadline: string | null;
  readonly consultantName?: string;
  readonly consultantUserId?: string;
}

export interface CaseNote {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly isSupervisorNote: boolean;
  readonly createdAt: string;
}

export interface StaffCaseMessage {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly senderRole: string;
  readonly channel: string;
  readonly isFromStaff: boolean;
  readonly createdAt: string;
}

export interface CaseMeeting {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: string;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly consultantName: string | null;
}

export interface CaseTag {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
}

export interface CaseFeedback {
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string;
}

export interface CaseSla {
  readonly status: string;
  readonly currentLevel: number;
  readonly startedAt: string;
  readonly lastEscalatedAt: string | null;
}

export interface CaseDetail {
  readonly id: string;
  readonly personId: string;
  readonly personName: string;
  readonly personEmail: string | null;
  readonly personPhone: string | null;
  readonly consultantName?: string;
  readonly topic: string;
  readonly status: CaseStatus;
  readonly priority: CasePriority;
  readonly crisisLevel: CrisisLevel;
  readonly source: string;
  readonly description: string | null;
  readonly name: string | null;
  readonly country: string | null;
  readonly language: string | null;
  readonly contactMethod: string | null;
  readonly contactValue: string | null;
  readonly sourceCourse: { id: string; title: string } | null;
  readonly sourceLesson: { id: string; title: string } | null;
  readonly firstResponseAt: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly notes: CaseNote[];
  readonly messages: StaffCaseMessage[];
  readonly meetings: CaseMeeting[];
  readonly tags: CaseTag[];
  readonly feedback: CaseFeedback | null;
  readonly sla: CaseSla | null;
}

export interface StaffMeeting {
  readonly id: string;
  readonly careCaseId: string;
  readonly status: 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW_PERSON' | 'NO_SHOW_CONSULTANT' | 'CONFIRMED';
  readonly scheduledAt: string;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly notes: string | null;
  readonly personName: string | null;
  readonly topic: string | null;
  readonly personTzTime: string;
  readonly consultantTzTime: string;
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
  readonly notes: string;
}

export interface ScheduleMeetingFormModel {
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly notes: string;
}

export type TeamMeetingStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
export type TeamParticipantStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';

export interface StaffUser {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface TeamMeetingParticipant {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly status: TeamParticipantStatus;
}

export interface TeamMeeting {
  readonly id: string;
  readonly organizerId: string;
  readonly organizerName: string;
  readonly title: string;
  readonly scheduledAt: string;
  readonly durationMin: number;
  readonly meetingUrl: string | null;
  readonly notes: string | null;
  readonly status: TeamMeetingStatus;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly createdAt: string;
  readonly participants: TeamMeetingParticipant[];
  readonly isOrganizer: boolean;
  readonly myStatus: TeamParticipantStatus | null;
}

export interface CreateTeamMeetingPayload {
  readonly title: string;
  readonly scheduledAt: string;
  readonly participantIds: string[];
  readonly durationMin: number;
  readonly notes?: string;
}

export interface TeamMeetingFormModel {
  readonly title: string;
  readonly date: string;
  readonly time: string;
  readonly duration: string;
  readonly participantIds: string[];
  readonly notes: string;
}
