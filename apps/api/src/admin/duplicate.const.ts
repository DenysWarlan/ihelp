// ---------------------------------------------------------------------------
// S-E13-05: Duplicate Detection & Merge Constants
// ---------------------------------------------------------------------------

export const MATCH_REASONS = {
  EXACT_EMAIL: 'exact_email',
  EXACT_NAME: 'exact_name',
  SAME_TELEGRAM: 'same_telegram',
  TELEGRAM_CONTACT: 'telegram_contact',
  SHARED_REAL_EMAIL: 'shared_real_email',
} as const;

export type MatchReason = (typeof MATCH_REASONS)[keyof typeof MATCH_REASONS];

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type ConfidenceLevel =
  (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];

export const SYNTHETIC_EMAIL_SUFFIX = '@telegram.user' as const;

export const PRIMARY_SCORE_WEIGHTS = {
  REAL_EMAIL: 100,
  HAS_PASSWORD: 50,
  IS_ACTIVE: 30,
  PROVIDER_LINK: 20,
  CASE_COUNT: 10,
  AGE_PER_DAY: 1,
} as const;

export const ERROR_MERGE_CROSS_ROLE =
  'Cannot merge users with different roles. Change roles first or resolve manually.' as const;

export const ERROR_MERGE_SAME_USER =
  'Cannot merge a user with themselves.' as const;

export const ERROR_MERGE_INACTIVE =
  'Both users must be active to merge.' as const;

export const ERROR_MERGE_ALREADY_MERGED =
  'One of the users has already been merged.' as const;

export const ERROR_GROUP_NOT_FOUND =
  'Duplicate group not found. It may have been resolved.' as const;
