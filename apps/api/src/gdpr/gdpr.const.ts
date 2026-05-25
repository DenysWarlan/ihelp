/** Number of days before a deletion request is executed (GDPR grace period). */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/** BullMQ queue name for GDPR deletion jobs. */
export const GDPR_DELETION_QUEUE = 'gdpr-deletion';

/** BullMQ queue name for GDPR data export jobs. */
export const GDPR_EXPORT_QUEUE = 'gdpr-export';

/** BullMQ queue name for GDPR retention policy jobs. */
export const GDPR_RETENTION_QUEUE = 'gdpr-retention';

/** BullMQ job name for executing a deferred deletion. */
export const DELETION_JOB_NAME = 'execute-deletion';

/** BullMQ job name for generating a data export. */
export const EXPORT_JOB_NAME = 'generate-export';

/** BullMQ job name for retention policy check. */
export const RETENTION_CHECK_JOB_NAME = 'retention-check';

/** Value used to anonymize personal data in case records kept for statistics. */
export const ANONYMIZED_CASE_NAME = '[DELETED USER]' as const;

/** Value used to anonymize text fields. */
export const ANONYMIZED_TEXT = '[REDACTED]' as const;

/** PostgreSQL advisory lock ID for data export operations. */
export const EXPORT_ADVISORY_LOCK_ID = 100001;

/** PostgreSQL advisory lock ID for anonymization/deletion operations. */
export const ANONYMIZATION_ADVISORY_LOCK_ID = 100002;

/** Number of days before data export file expires and is cleaned up. */
export const EXPORT_FILE_EXPIRY_DAYS = 7;

/** SAR response timeframe in days (Art. 15 GDPR). */
export const SAR_RESPONSE_TIMEFRAME_DAYS = 30;

/** Number of days before retention-based deletion to send a notification. */
export const RETENTION_NOTIFICATION_DAYS_BEFORE = 30;

/** Cron expression for retention policy checks (daily at 2 AM). */
export const RETENTION_CRON_EXPRESSION = '0 2 * * *';

/** DataAccessApproval expiration time in hours. */
export const ACCESS_APPROVAL_EXPIRY_HOURS = 24;

/** Roles allowed to access GDPR admin endpoints. */
export const GDPR_ADMIN_ROLES = ['ADMIN'] as const;

/** Roles allowed to approve data access requests (four-eyes principle). */
export const GDPR_APPROVER_ROLES = ['ADMIN'] as const;

/** Roles allowed to view audit logs. */
export const GDPR_AUDIT_ROLES = ['ADMIN', 'COORDINATOR'] as const;

/** Default SAR keywords to seed in Ukrainian and Russian. */
export const DEFAULT_SAR_KEYWORDS: readonly { keyword: string; language: string }[] = [
  // Ukrainian
  { keyword: 'мої дані', language: 'uk' },
  { keyword: 'доступ до даних', language: 'uk' },
  { keyword: 'мої персональні дані', language: 'uk' },
  { keyword: 'копія моїх даних', language: 'uk' },
  { keyword: 'які дані ви маєте', language: 'uk' },
  { keyword: 'видалити мої дані', language: 'uk' },
  { keyword: 'запит на дані', language: 'uk' },
  { keyword: 'право на доступ', language: 'uk' },
  // Russian
  { keyword: 'мои данные', language: 'ru' },
  { keyword: 'доступ к данным', language: 'ru' },
  { keyword: 'мои персональные данные', language: 'ru' },
  { keyword: 'копия моих данных', language: 'ru' },
  { keyword: 'какие данные вы имеете', language: 'ru' },
  { keyword: 'удалить мои данные', language: 'ru' },
  { keyword: 'запрос на данные', language: 'ru' },
  { keyword: 'право на доступ', language: 'ru' },
] as const;

/** PII detection regex patterns. */
export const PII_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const PII_PHONE_REGEX = /(?:\+?3?8?)?\s*\(?0?\d{2}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;

/** Audit log actions for GDPR PII access tracking. */
export const AUDIT_ACTION_PII_VIEW = 'PII_VIEW';
export const AUDIT_ACTION_PII_EXPORT = 'PII_EXPORT';
export const AUDIT_ACTION_PII_DELETE = 'PII_DELETE';
export const AUDIT_ACTION_CONSENT_CHANGE = 'CONSENT_CHANGE';
export const AUDIT_ACTION_DATA_ACCESS_REQUEST = 'DATA_ACCESS_REQUEST';
export const AUDIT_ACTION_DATA_ACCESS_APPROVE = 'DATA_ACCESS_APPROVE';
export const AUDIT_ACTION_DATA_ACCESS_REJECT = 'DATA_ACCESS_REJECT';
export const AUDIT_ACTION_SAR_DETECTED = 'SAR_DETECTED';
