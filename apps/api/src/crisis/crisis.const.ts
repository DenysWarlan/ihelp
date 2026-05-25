import { CrisisLevel, CrisisRiskLevel } from '@prisma/client';

import { DefaultKeywordEntry } from './crisis.model.js';

// ---------------------------------------------------------------------------
// System sender placeholder (used for auto-reply messages)
// ---------------------------------------------------------------------------

export const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Escalation timing
// ---------------------------------------------------------------------------

/** Minutes before repeating an unacknowledged escalation (MVP: log-based). */
export const ESCALATION_REPEAT_MINUTES = 15;

// ---------------------------------------------------------------------------
// MVP notification prefix
// ---------------------------------------------------------------------------

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]';

// ---------------------------------------------------------------------------
// Default auto-reply template (Ukrainian)
// ---------------------------------------------------------------------------

export const DEFAULT_AUTO_REPLY_TEMPLATE =
  'Якщо вам потрібна термінова допомога, зателефонуйте на гарячу лінію 7333. Наш консультант зв\'яжеться з вами найближчим часом.';

// ---------------------------------------------------------------------------
// Risk level → crisis level mapping
// ---------------------------------------------------------------------------

export const RISK_TO_CRISIS_LEVEL: Record<CrisisRiskLevel, CrisisLevel> = {
  [CrisisRiskLevel.HIGH]: CrisisLevel.CRITICAL,
  [CrisisRiskLevel.MEDIUM]: CrisisLevel.HIGH,
  [CrisisRiskLevel.LOW]: CrisisLevel.MEDIUM,
} as const;

// ---------------------------------------------------------------------------
// Fallback notification chain (MVP: all log-based)
// ---------------------------------------------------------------------------

export const NOTIFICATION_CHAIN = ['SMS', 'PUSH', 'EMAIL', 'PHONE'] as const;

// ---------------------------------------------------------------------------
// Default crisis keywords seed data
// ---------------------------------------------------------------------------

export const DEFAULT_CRISIS_KEYWORDS: readonly DefaultKeywordEntry[] = [
  // Ukrainian — HIGH
  { keyword: 'самогубство', language: 'uk', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'суїцид', language: 'uk', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'хочу померти', language: 'uk', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'не хочу жити', language: 'uk', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'покінчу з собою', language: 'uk', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: "вб'ю себе", language: 'uk', riskLevel: CrisisRiskLevel.HIGH },

  // Ukrainian — MEDIUM
  { keyword: 'ріжу себе', language: 'uk', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: 'самоушкодження', language: 'uk', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: "б'ю себе", language: 'uk', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: 'не бачу сенсу', language: 'uk', riskLevel: CrisisRiskLevel.MEDIUM },

  // Ukrainian — LOW
  { keyword: 'безнадія', language: 'uk', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'все погано', language: 'uk', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'не можу більше', language: 'uk', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'хочу зникнути', language: 'uk', riskLevel: CrisisRiskLevel.LOW },

  // Russian — HIGH
  { keyword: 'самоубийство', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'суицид', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'хочу умереть', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'не хочу жить', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'покончу с собой', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },
  { keyword: 'убью себя', language: 'ru', riskLevel: CrisisRiskLevel.HIGH },

  // Russian — MEDIUM
  { keyword: 'режу себя', language: 'ru', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: 'самоповреждение', language: 'ru', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: 'бью себя', language: 'ru', riskLevel: CrisisRiskLevel.MEDIUM },
  { keyword: 'не вижу смысла', language: 'ru', riskLevel: CrisisRiskLevel.MEDIUM },

  // Russian — LOW
  { keyword: 'безнадёжность', language: 'ru', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'всё плохо', language: 'ru', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'не могу больше', language: 'ru', riskLevel: CrisisRiskLevel.LOW },
  { keyword: 'хочу исчезнуть', language: 'ru', riskLevel: CrisisRiskLevel.LOW },
] as const;

// ---------------------------------------------------------------------------
// Audit action constants
// ---------------------------------------------------------------------------

export const CRISIS_AUDIT_ACTIONS = {
  KEYWORDS_SCANNED: 'CRISIS_KEYWORDS_SCANNED',
  RISK_CLASSIFIED: 'CRISIS_RISK_CLASSIFIED',
  ALERT_CREATED: 'CRISIS_ALERT_CREATED',
  ESCALATION_TRIGGERED: 'CRISIS_ESCALATION_TRIGGERED',
  AUTO_REPLY_SENT: 'CRISIS_AUTO_REPLY_SENT',
  KEYWORDS_SEEDED: 'CRISIS_KEYWORDS_SEEDED',
} as const;
