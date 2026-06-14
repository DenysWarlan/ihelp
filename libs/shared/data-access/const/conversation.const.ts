/** REST base path for the conversation (non-case chat) API. */
export const CONVERSATION_API_BASE = '/api/conversations' as const;

/** Socket.io namespace for conversation realtime. */
export const CONVERSATION_SOCKET_NAMESPACE = '/conversations' as const;

/** Socket.io event names — must mirror the backend gateway. */
export const CONVERSATION_SOCKET_EVENTS = {
  CONNECT: 'connect',
  JOIN: 'conversation:join',
  MESSAGE: 'conversation:message',
  TYPING: 'conversation:typing',
  READ: 'conversation:read',
  ERROR: 'conversation:error',
  NEW_MESSAGE: 'conversation:new_message',
  NOTIFY: 'conversation:notify',
} as const;

/** Default number of messages requested per conversation load. */
export const CONVERSATION_PAGE_SIZE = 50;
