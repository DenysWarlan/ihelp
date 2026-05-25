/** Consent type mapping from API values to Prisma enum values. */
export const CONSENT_TYPE_MAP = {
  data: 'GENERAL_DATA',
  sensitive: 'SENSITIVE_DATA',
} as const;

/** User field mapping for consent timestamps. */
export const CONSENT_FIELD_MAP = {
  data: 'dataConsentAt',
  sensitive: 'sensitiveDataConsentAt',
} as const;

/** Value used to anonymize sensitive text fields. */
export const ANONYMIZED_VALUE = '[WITHDRAWN]' as const;
