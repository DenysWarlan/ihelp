/**
 * SLA escalation level definitions.
 *
 * Each level specifies how long after the SLA timer started (in ms)
 * the escalation fires and what action to take.
 */

export const SLA_QUEUE = 'sla-timers' as const;

export enum EscalationAction {
  /** >4h: push notification to consultant (logged for MVP). */
  PUSH_CONSULTANT = 'PUSH_CONSULTANT',
  /** >12h: push + email to consultant (logged for MVP). */
  PUSH_EMAIL_CONSULTANT = 'PUSH_EMAIL_CONSULTANT',
  /** >24h: notify coordinator + auto-reassign to another consultant. */
  ESCALATE_COORDINATOR_REASSIGN = 'ESCALATE_COORDINATOR_REASSIGN',
  /** >48h: notify admin. */
  ESCALATE_ADMIN = 'ESCALATE_ADMIN',
}

export interface EscalationLevelDef {
  readonly level: number;
  readonly delayMs: number;
  readonly action: EscalationAction;
  readonly description: string;
}

export const ESCALATION_LEVELS: readonly EscalationLevelDef[] = [
  {
    level: 1,
    delayMs: 4 * 3600 * 1000, // 4 hours
    action: EscalationAction.PUSH_CONSULTANT,
    description: 'Push notification to consultant (4h)',
  },
  {
    level: 2,
    delayMs: 12 * 3600 * 1000, // 12 hours
    action: EscalationAction.PUSH_EMAIL_CONSULTANT,
    description: 'Push + email to consultant (12h)',
  },
  {
    level: 3,
    delayMs: 24 * 3600 * 1000, // 24 hours
    action: EscalationAction.ESCALATE_COORDINATOR_REASSIGN,
    description: 'Escalate to coordinator + auto-reassign (24h)',
  },
  {
    level: 4,
    delayMs: 48 * 3600 * 1000, // 48 hours
    action: EscalationAction.ESCALATE_ADMIN,
    description: 'Escalate to admin (48h)',
  },
] as const;

/**
 * Build a unique Bull job ID for a given case + escalation level.
 * Used to remove pending jobs on timer resolution or reset.
 */
export const slaJobId = (caseId: string, level: number): string =>
  `sla-${caseId}-L${level}`;

/** Audit actions for SLA events. */
export const AUDIT_ACTION_SLA_STARTED = 'SLA_STARTED' as const;
export const AUDIT_ACTION_SLA_RESOLVED = 'SLA_RESOLVED' as const;
export const AUDIT_ACTION_SLA_PAUSED = 'SLA_PAUSED' as const;
export const AUDIT_ACTION_SLA_RESUMED = 'SLA_RESUMED' as const;
export const AUDIT_ACTION_SLA_RESET = 'SLA_RESET' as const;
export const AUDIT_ACTION_SLA_ESCALATION = 'SLA_ESCALATION' as const;
