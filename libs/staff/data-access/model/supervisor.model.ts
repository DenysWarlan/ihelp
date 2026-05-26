import type { CaseNote } from './staff.model';

export interface CrisisHistoryItem {
  readonly id: string;
  readonly detectedAt: string;
  readonly authorName: string;
  readonly consultantName: string;
  readonly clientName: string;
  readonly severity: 'critical' | 'high' | 'moderate';
  readonly status: 'resolved' | 'active' | 'escalated';
  readonly action: string;
  readonly isEscalated: boolean;
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly activeCases: number;
  readonly resolvedThisMonth: number;
  readonly avgResponseHours: number;
}

export interface TeamAnalytics {
  readonly totalCasesThisMonth: number;
  readonly resolvedCases: number;
  readonly avgResolutionDays: number;
  readonly satisfactionScore: number;
  readonly teamMembers: TeamMember[];
}

export interface CaseMessage {
  readonly id: string;
  readonly content: string;
  readonly authorName: string;
  readonly authorRole: 'PERSON' | 'CONSULTANT' | 'SUPERVISOR';
  readonly createdAt: string;
}

export interface SupervisorCaseDetail {
  readonly id: string;
  readonly personName: string;
  readonly consultantName: string;
  readonly topic: string;
  readonly status: string;
  readonly priority: string;
  readonly createdAt: string;
  readonly slaDeadline: string | null;
  readonly messages: CaseMessage[];
  readonly consultantNotes: CaseNote[];
}
