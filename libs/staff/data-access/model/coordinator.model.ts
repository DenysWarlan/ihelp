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

export interface AssignmentSuggestion {
  readonly caseId: string;
  readonly personName: string;
  readonly topic: string;
  readonly suggestedConsultantId: string;
  readonly suggestedConsultantName: string;
  readonly reason: string;
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
