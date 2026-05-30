export interface SlaOverview {
  readonly totalActive: number;
  readonly atRisk: number;
  readonly breached: number;
  readonly onTrack: number;
  readonly timers: SlaTimer[];
}

export interface SlaTimer {
  readonly id: string;
  readonly caseId: string;
  readonly personName: string;
  readonly type: string;
  readonly deadline: string;
  readonly remainingMinutes: number;
  readonly elapsedMinutes: number;
  readonly status: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
}

export interface WorkloadEntry {
  readonly consultantId: string;
  readonly consultantName: string;
  readonly activeCases: number;
  readonly maxCases: number;
  readonly utilizationPercent: number;
  readonly status: 'AVAILABLE' | 'AT_CAPACITY' | 'OVERLOADED';
}

export type AssignmentPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AssignmentSuggestion {
  readonly caseId: string;
  readonly personName: string;
  readonly topic: string;
  readonly tags: readonly string[];
  readonly priority: AssignmentPriority;
  readonly waitTime: string;
  readonly suggestedConsultantId: string;
  readonly suggestedConsultantName: string;
  readonly suggestedConsultantSpecialization: string;
  readonly suggestedConsultantCaseCount: number;
  readonly reason: string;
}

export interface ConsultantCaseItem {
  readonly id: string;
  readonly personName: string;
  readonly topic: string;
  readonly status: string;
  readonly priority: string;
  readonly crisisLevel: string;
  readonly createdAt: string;
  readonly slaStatus: string | null;
  readonly slaLevel: number | null;
}

export interface ConsultantDetail {
  readonly consultantId: string;
  readonly consultantName: string;
  readonly specializations: readonly string[];
  readonly languages: readonly string[];
  readonly cases: readonly ConsultantCaseItem[];
}

export interface CrisisAlert {
  readonly id: string;
  readonly caseId: string;
  readonly personName: string;
  readonly keyword: string;
  readonly severity: 'HIGH' | 'CRITICAL';
  readonly detectedAt: string;
  readonly isAcknowledged: boolean;
}
