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
