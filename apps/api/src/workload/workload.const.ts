/**
 * Workload module constants (S-E09-03..06).
 */

// ---------------------------------------------------------------------------
// Escalation chain for crisis slot exhaustion
// ---------------------------------------------------------------------------

/**
 * Escalation chain when all crisis slots are exhausted.
 * Each step includes the target role and delay in minutes from the initial trigger.
 */
export const CRISIS_OVERFLOW_ESCALATION_CHAIN = [
  { role: 'COORDINATOR', delayMinutes: 0, channel: 'IMMEDIATE' },
  { role: 'SUPERVISOR', delayMinutes: 10, channel: 'SMS' },
  { role: 'ADMIN', delayMinutes: 15, channel: 'PHONE' },
] as const;

/**
 * Out-of-band notification channels for forced escalation (S-E09-04).
 * Reuses the same pattern as crisis module NOTIFICATION_CHAIN.
 */
export const OUT_OF_BAND_CHANNELS = ['SMS', 'EMAIL', 'PHONE'] as const;

// ---------------------------------------------------------------------------
// Dashboard utilization thresholds
// ---------------------------------------------------------------------------

/** Utilization below this percentage is green (healthy). */
export const UTILIZATION_THRESHOLD_GREEN = 70;

/** Utilization at or above this percentage (but below red) is yellow (warning). */
export const UTILIZATION_THRESHOLD_YELLOW = 90;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const WORKLOAD_DASHBOARD_ROLES = ['COORDINATOR', 'ADMIN'] as const;
export const WORKLOAD_ADMIN_ROLES = ['ADMIN'] as const;

// ---------------------------------------------------------------------------
// MVP notification prefix
// ---------------------------------------------------------------------------

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]' as const;

// ---------------------------------------------------------------------------
// Audit actions
// ---------------------------------------------------------------------------

export const AUDIT_ACTION_CRISIS_OVERFLOW_ESCALATION =
  'CRISIS_OVERFLOW_ESCALATION' as const;
export const AUDIT_ACTION_UPDATE_LIMITS = 'UPDATE_CONSULTANT_LIMITS' as const;
