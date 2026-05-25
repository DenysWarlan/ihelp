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

/** Maximum attachment size in bytes (10 MB). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Error message for oversized attachments. */
export const ATTACHMENT_ERROR_MSG =
  'Attachment exceeds the 10 MB size limit. The text message has been saved, but the attachment was rejected.';

/** Socket.io event names. */
export const CHAT_EVENTS = {
  JOIN: 'chat:join',
  MESSAGE: 'chat:message',
  TYPING: 'chat:typing',
  READ: 'chat:read',
  ERROR: 'chat:error',
  NEW_MESSAGE: 'chat:new_message',
  MESSAGES_READ: 'chat:messages_read',
  MESSAGE_EDITED: 'chat:message_edited',
  MESSAGE_DELETED: 'chat:message_deleted',
} as const;

/** Roles that can access all cases (not restricted to own assignments). */
export const ELEVATED_CHAT_ROLES = [
  'SUPERVISOR',
  'COORDINATOR',
  'ADMIN',
] as const;

/** Room prefix for case-based rooms. */
export const CASE_ROOM_PREFIX = 'case:' as const;

/** Roles that trigger SLA resolution and response-time closure. */
export const SLA_RESPONDING_ROLES: readonly string[] = [
  'CONSULTANT',
  'SUPERVISOR',
  'COORDINATOR',
  'ADMIN',
] as const;
