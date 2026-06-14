/** Maximum message content length (matches DB VarChar(10000)). */
export const MAX_CONVERSATION_MESSAGE_LENGTH = 10000;

/** Default page size for message history. */
export const DEFAULT_CONVERSATION_PAGE_SIZE = 50;

/** Maximum page size for message history. */
export const MAX_CONVERSATION_PAGE_SIZE = 100;

/** Maximum number of participants in a group conversation (excluding creator). */
export const MAX_CONVERSATION_PARTICIPANTS = 50;

/** Staff roles allowed to start conversations and pick any contact. */
export const STAFF_ROLES = [
  'CONSULTANT',
  'SUPERVISOR',
  'COORDINATOR',
  'ADMIN',
] as const;

/** Socket.io room prefix for conversation rooms. */
export const CONVERSATION_ROOM_PREFIX = 'conversation:' as const;

/** Socket.io event names for conversation realtime. */
export const CONVERSATION_EVENTS = {
  JOIN: 'conversation:join',
  MESSAGE: 'conversation:message',
  TYPING: 'conversation:typing',
  READ: 'conversation:read',
  ERROR: 'conversation:error',
  NEW_MESSAGE: 'conversation:new_message',
  NOTIFY: 'conversation:notify',
} as const;
