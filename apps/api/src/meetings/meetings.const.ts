import { MeetingStatus } from '@prisma/client';

/** Minimum meeting duration in minutes. */
export const MIN_MEETING_DURATION = 15;

/** Maximum meeting duration in minutes. */
export const MAX_MEETING_DURATION = 180;

/** Default meeting duration in minutes. */
export const DEFAULT_DURATION = 60;

/**
 * State-machine: allowed status transitions for Meeting.
 * Key = current status, value = list of statuses it can transition to.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  [MeetingStatus.SCHEDULED]: [
    MeetingStatus.CONFIRMED,
    MeetingStatus.CANCELLED,
  ],
  [MeetingStatus.CONFIRMED]: [
    MeetingStatus.IN_PROGRESS,
    MeetingStatus.CANCELLED,
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

/** Roles allowed to create meetings. */
export const CREATE_MEETING_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

/** Roles considered elevated for access control. */
export const ELEVATED_ROLES = ['SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;
