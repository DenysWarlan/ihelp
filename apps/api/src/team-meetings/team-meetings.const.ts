/** Minimum team-meeting duration in minutes. */
export const MIN_TEAM_MEETING_DURATION = 15;

/** Maximum team-meeting duration in minutes. */
export const MAX_TEAM_MEETING_DURATION = 180;

/** Default team-meeting duration in minutes. */
export const DEFAULT_TEAM_MEETING_DURATION = 60;

/** Maximum number of participants that can be invited to a team meeting. */
export const MAX_TEAM_MEETING_PARTICIPANTS = 50;

/** Roles allowed to create and participate in internal team meetings (staff only). */
export const STAFF_ROLES = ['CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN'] as const;

/** Jitsi Meet base URL for video meetings. */
export const TEAM_MEETING_LINK_BASE_URL = 'https://meet.jit.si' as const;
