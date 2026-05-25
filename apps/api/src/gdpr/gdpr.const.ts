/** Number of days before a deletion request is executed (GDPR grace period). */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/** BullMQ queue name for GDPR deletion jobs. */
export const GDPR_DELETION_QUEUE = 'gdpr-deletion';

/** BullMQ job name for executing a deferred deletion. */
export const DELETION_JOB_NAME = 'execute-deletion';

/** Value used to anonymize personal data in case records kept for statistics. */
export const ANONYMIZED_CASE_NAME = '[DELETED USER]' as const;

/** Value used to anonymize text fields. */
export const ANONYMIZED_TEXT = '[REDACTED]' as const;
