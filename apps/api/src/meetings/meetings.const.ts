import { MeetingStatus } from '@prisma/client';

/** Minimum meeting duration in minutes. */
export const MIN_MEETING_DURATION = 15;

/** Maximum meeting duration in minutes. */
export const MAX_MEETING_DURATION = 180;

/** Default meeting duration in minutes. */
export const DEFAULT_DURATION = 60;

// ---------------------------------------------------------------------------
// Bull queue & job constants
// ---------------------------------------------------------------------------

/** Bull queue name for meeting-related jobs. */
export const MEETINGS_QUEUE = 'meetings' as const;

/** Job type: generate a meeting video link (MVP: placeholder URL). */
export const JOB_GENERATE_LINK = 'GENERATE_LINK' as const;

/** Job type: send a meeting reminder to participant(s). */
export const JOB_REMINDER = 'REMINDER' as const;

/** Job type: check no-show 15 min after scheduledAt. */
export const JOB_NO_SHOW_CHECK = 'NO_SHOW_CHECK' as const;

/** Job type: "we are waiting" nudge 5 min after scheduledAt. */
export const JOB_NO_SHOW_WAIT_5MIN = 'NO_SHOW_WAIT_5MIN' as const;

/** Delay before auto no-show check (15 minutes). */
export const NO_SHOW_DELAY_MS = 15 * 60 * 1000;

/** Delay before "we are waiting" nudge (5 minutes). */
export const WAIT_DELAY_MS = 5 * 60 * 1000;

/** Reminder: 1 hour before meeting. */
export const REMINDER_1H_MS = 60 * 60 * 1000;

/** Reminder: 15 minutes before meeting. */
export const REMINDER_15MIN_MS = 15 * 60 * 1000;

/** Max retries for link generation. */
export const GENERATE_LINK_MAX_RETRIES = 3;

/** MVP base URL for placeholder meeting links. */
export const MEETING_LINK_BASE_URL = 'https://meet.ihelp.org' as const;

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * State-machine: allowed status transitions for Meeting.
 * Key = current status, value = list of statuses it can transition to.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  [MeetingStatus.SCHEDULED]: [
    MeetingStatus.CONFIRMED,
    MeetingStatus.CANCELLED,
    MeetingStatus.COMPLETED,
    MeetingStatus.NO_SHOW_PERSON,
    MeetingStatus.NO_SHOW_CONSULTANT,
  ],
  [MeetingStatus.CONFIRMED]: [
    MeetingStatus.IN_PROGRESS,
    MeetingStatus.CANCELLED,
    MeetingStatus.COMPLETED,
    MeetingStatus.NO_SHOW_PERSON,
    MeetingStatus.NO_SHOW_CONSULTANT,
  ],
  [MeetingStatus.IN_PROGRESS]: [
    MeetingStatus.COMPLETED,
    MeetingStatus.NO_SHOW_PERSON,
    MeetingStatus.NO_SHOW_CONSULTANT,
  ],
  [MeetingStatus.COMPLETED]: [],
  [MeetingStatus.CANCELLED]: [],
  [MeetingStatus.NO_SHOW_PERSON]: [],
  [MeetingStatus.NO_SHOW_CONSULTANT]: [],
};

/** Statuses that count as active (not cancelled or terminal) for overlap checks. */
export const ACTIVE_MEETING_STATUSES: MeetingStatus[] = [
  MeetingStatus.SCHEDULED,
  MeetingStatus.CONFIRMED,
  MeetingStatus.IN_PROGRESS,
];

/** Statuses eligible for auto no-show transition. */
export const NO_SHOW_ELIGIBLE_STATUSES: MeetingStatus[] = [
  MeetingStatus.SCHEDULED,
  MeetingStatus.CONFIRMED,
];

/** Roles allowed to create meetings. */
export const CREATE_MEETING_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

/** Roles considered elevated for access control. */
export const ELEVATED_ROLES = ['SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;
