import { MessageChannel } from '@prisma/client';

/** Channels supported in MVP. Others return 422. */
export const SUPPORTED_CHANNELS: MessageChannel[] = [
  MessageChannel.WEB,
  MessageChannel.TELEGRAM,
] as const;

/** Maximum message content length (matches DB VarChar(10000)). */
export const MAX_MESSAGE_LENGTH = 10000;

/** Default page size for message history. */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size for message history. */
export const MAX_PAGE_SIZE = 100;

/** Socket.io event names. */
export const CHAT_EVENTS = {
  JOIN: 'chat:join',
  MESSAGE: 'chat:message',
  TYPING: 'chat:typing',
  READ: 'chat:read',
  ERROR: 'chat:error',
  NEW_MESSAGE: 'chat:new_message',
  MESSAGES_READ: 'chat:messages_read',
} as const;

/** Roles that can access all cases (not restricted to own assignments). */
export const ELEVATED_CHAT_ROLES = [
  'SUPERVISOR',
  'COORDINATOR',
  'ADMIN',
] as const;

/** Room prefix for case-based rooms. */
export const CASE_ROOM_PREFIX = 'case:' as const;
