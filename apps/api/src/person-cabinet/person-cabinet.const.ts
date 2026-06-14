/**
 * Person Cabinet module constants (S-E15-02..09).
 */

import { CaseStatus, MeetingStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const PERSON_ROLE = 'PERSON' as const;

// ---------------------------------------------------------------------------
// Chat (S-E15-03)
// ---------------------------------------------------------------------------

/** Case statuses that allow person to chat. */
export const PERSON_CHAT_ELIGIBLE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.MEETING_SCHEDULED,
  CaseStatus.ON_HOLD,
  CaseStatus.TRANSFERRED,
] as const;

/** Default page size for person's chat messages. */
export const PERSON_CHAT_PAGE_SIZE = 50;

/** Maximum page size for person's chat messages. */
export const PERSON_CHAT_MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Meetings (S-E15-09)
// ---------------------------------------------------------------------------

/** Meeting statuses considered upcoming for person's cabinet. */
export const UPCOMING_MEETING_STATUSES: readonly MeetingStatus[] = [
  MeetingStatus.REQUESTED,
  MeetingStatus.SCHEDULED,
  MeetingStatus.CONFIRMED,
] as const;

// ---------------------------------------------------------------------------
// Profile (S-E15-05)
// ---------------------------------------------------------------------------

export const PROFILE_UPDATABLE_FIELDS = ['name', 'timezone'] as const;

// ---------------------------------------------------------------------------
// GDPR Data Export (S-E15-06)
// ---------------------------------------------------------------------------

export const DATA_EXPORT_QUEUE = 'data-export' as const;

export const JOB_PROCESS_DATA_EXPORT = 'PROCESS_DATA_EXPORT' as const;

/** Data export link expires after 7 days. */
export const DATA_EXPORT_EXPIRY_DAYS = 7;

export const MVP_NOTIFICATION_PREFIX = '[MVP NOTIFICATION]' as const;

// ---------------------------------------------------------------------------
// GDPR Deletion (S-E15-07)
// ---------------------------------------------------------------------------

/** Grace period in days before account deletion is executed. */
export const DELETION_GRACE_PERIOD_DAYS = 30;

// ---------------------------------------------------------------------------
// Meeting Reminders (S-E15-08)
// ---------------------------------------------------------------------------

export const MEETING_REMINDERS_QUEUE = 'meeting-reminders' as const;

export const JOB_MEETING_REMINDER = 'MEETING_REMINDER' as const;

/** Reminder delay: 1 hour before meeting. */
export const REMINDER_1H_MS = 60 * 60 * 1000;

/** Reminder delay: 15 minutes before meeting. */
export const REMINDER_15MIN_MS = 15 * 60 * 1000;
