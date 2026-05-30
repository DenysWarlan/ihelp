import { SlaStatus } from '@prisma/client';

import { EscalationAction } from './sla.const.js';

/**
 * Response shape returned by the SLA controller.
 */
export interface SlaTimerResponse {
  readonly id: string;
  readonly careCaseId: string;
  readonly startedAt: Date;
  readonly pausedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly currentLevel: number;
  readonly status: SlaStatus;
  readonly lastEscalatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Payload carried by each Bull delayed job for SLA escalation.
 */
export interface SlaEscalationJobData {
  readonly caseId: string;
  readonly level: number;
  readonly action: EscalationAction;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Dashboard (S-E07-05)
// ---------------------------------------------------------------------------

/** Colour indicator for the SLA dashboard. */
export type SlaColorIndicator = 'green' | 'yellow' | 'red';

/** Single row returned by the dashboard endpoint. */
export interface SlaDashboardEntry {
  readonly caseId: string;
  readonly consultantName: string | null;
  readonly currentLevel: number;
  readonly status: SlaStatus;
  readonly elapsedMs: number;
  readonly color: SlaColorIndicator;
  readonly startedAt: Date;
  readonly pausedAt: Date | null;
}

/** Full dashboard response. */
export interface SlaDashboardResponse {
  readonly timers: readonly SlaDashboardEntry[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Overview (coordinator widget)
// ---------------------------------------------------------------------------

/** Aggregated SLA overview for the coordinator dashboard widget. */
export interface SlaOverviewResponse {
  readonly totalActive: number;
  readonly atRisk: number;
  readonly breached: number;
  readonly onTrack: number;
  readonly timers: readonly SlaOverviewTimer[];
}

export interface SlaOverviewTimer {
  readonly id: string;
  readonly caseId: string;
  readonly personName: string;
  readonly type: string;
  readonly deadline: string;
  readonly remainingMinutes: number;
  readonly elapsedMinutes: number;
  readonly status: 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
}

// ---------------------------------------------------------------------------
// Response time tracking (S-E07-03)
// ---------------------------------------------------------------------------

/** Shape of a response time log entry. */
export interface ResponseTimeLogEntry {
  readonly id: string;
  readonly careCaseId: string;
  readonly personMessageId: string;
  readonly consultantMessageId: string | null;
  readonly consultantId: string | null;
  readonly personSentAt: Date;
  readonly consultantRepliedAt: Date | null;
  readonly responseTimeMs: number | null;
  readonly createdAt: Date;
}

// ---------------------------------------------------------------------------
// Distributed lock (S-E07-06)
// ---------------------------------------------------------------------------

/** Result of a lock acquisition attempt. */
export interface SlaLockResult {
  readonly acquired: boolean;
  readonly lockValue: string;
}
