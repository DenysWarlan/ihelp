/** Default page size for admin user listing. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size for admin user listing. */
export const MAX_PAGE_SIZE = 100;

/** Staff roles that can be managed via admin endpoints. */
export const STAFF_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

// ---------------------------------------------------------------------------
// S-E13-03: Last Admin Protection
// ---------------------------------------------------------------------------

export const ERROR_LAST_ADMIN =
  'Cannot deactivate or change role of the last active admin. At least one admin must remain.' as const;

export const ERROR_SELF_ROLE_CHANGE =
  'Cannot change your own role — this could cause admin lockout' as const;

// ---------------------------------------------------------------------------
// S-E13-04: Block Consultant Deletion with Active Cases
// ---------------------------------------------------------------------------

export const ERROR_CONSULTANT_ACTIVE_CASES =
  'Cannot deactivate user with active cases. Transfer or close cases first.' as const;

// ---------------------------------------------------------------------------
// S-E13-05: Duplicate Account Detection
// ---------------------------------------------------------------------------

export const DUPLICATE_EXACT_EMAIL_REASON = 'Exact email match' as const;

export const DUPLICATE_NAME_REASON = 'Case-insensitive name match' as const;

// ---------------------------------------------------------------------------
// S-E13-07: Automation Settings
// ---------------------------------------------------------------------------

export const SETTINGS_CATEGORIES = ['sla', 'workload', 'crisis'] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// S-E13-08: Integration Settings
// ---------------------------------------------------------------------------

export const INTEGRATION_CATEGORY = 'integration' as const;

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;

export const ENCRYPTION_KEY_LENGTH = 32;

export const ENCRYPTION_IV_LENGTH = 16;

export const ENCRYPTION_AUTH_TAG_LENGTH = 16;

/** Mask for displaying encrypted values. */
export const ENCRYPTED_VALUE_MASK = '••••••••' as const;

// ---------------------------------------------------------------------------
// S-E13-09: Duty Schedule — Weekly View
// ---------------------------------------------------------------------------

/** Number of days for weekly schedule view. */
export const WEEKLY_SCHEDULE_DAYS = 7;

/** Default timezone for Kyiv (UTC+2 / UTC+3 DST). */
export const DEFAULT_TIMEZONE = 'Europe/Kyiv' as const;

// ---------------------------------------------------------------------------
// S-E13-10: Admin Audit Log
// ---------------------------------------------------------------------------

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]' as const;

export const AUDIT_ACTIONS = {
  USER_CREATED: 'ADMIN_USER_CREATED',
  USER_UPDATED: 'ADMIN_USER_UPDATED',
  USER_DEACTIVATED: 'ADMIN_USER_DEACTIVATED',
  INVITE_CREATED: 'ADMIN_INVITE_CREATED',
  INVITE_REVOKED: 'ADMIN_INVITE_REVOKED',
  SETTINGS_UPDATED: 'ADMIN_SETTINGS_UPDATED',
  INTEGRATION_UPDATED: 'ADMIN_INTEGRATION_UPDATED',
  INTEGRATION_TESTED: 'ADMIN_INTEGRATION_TESTED',
  DUTY_SCHEDULE_CREATED: 'ADMIN_DUTY_SCHEDULE_CREATED',
  DUTY_SCHEDULE_UPDATED: 'ADMIN_DUTY_SCHEDULE_UPDATED',
  DUTY_SCHEDULE_DELETED: 'ADMIN_DUTY_SCHEDULE_DELETED',
  USER_MERGE: 'ADMIN_USER_MERGE',
  DUPLICATE_DISMISSED: 'ADMIN_DUPLICATE_DISMISSED',
} as const;
