/** Number of days of inactivity before auto-pausing a case. */
export const INACTIVITY_DAYS = 7;

/** BullMQ queue name for auto-pause jobs. */
export const AUTO_PAUSE_QUEUE = 'auto-pause' as const;

/** BullMQ job name for the daily inactivity check. */
export const AUTO_PAUSE_JOB = 'check-inactivity' as const;

/** Cron expression: every day at 03:00 UTC. */
export const AUTO_PAUSE_CRON = '0 3 * * *' as const;

/** Audit action for system auto-pause. */
export const AUDIT_ACTION_AUTO_PAUSE = 'AUTO_PAUSE' as const;
